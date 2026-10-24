import { describe, expect, it } from 'vitest';
import { createRateLimiter, tooManyRequests } from '#lib/server/rate-limit.js';

describe('createRateLimiter', () => {
	it('allows up to the limit per key, then reports when to retry', () => {
		const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
		expect([1, 2, 3].map(() => limiter.check('a', 1, 0).ok)).toEqual([true, true, true]);
		expect(limiter.check('a', 1, 15_000)).toEqual({ ok: false, retryAfterSeconds: 45 });
		expect(limiter.check('b', 1, 15_000).ok).toBe(true);
	});

	it('weights checks by cost and never charges a rejected request', () => {
		const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
		expect(limiter.check('a', 8, 0).ok).toBe(true);
		expect(limiter.check('a', 3, 0).ok).toBe(false);
		expect(limiter.check('a', 2, 0).ok).toBe(true);
	});

	it('starts a fresh window once the old one expires', () => {
		const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
		expect(limiter.check('a', 1, 0).ok).toBe(true);
		expect(limiter.check('a', 1, 59_999).ok).toBe(false);
		expect(limiter.check('a', 1, 60_000).ok).toBe(true);
	});

	it('caps the number of tracked keys', () => {
		const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 3 });
		for (const key of ['a', 'b', 'c', 'd', 'e']) limiter.check(key, 1, 0);
		expect(limiter.size).toBe(3);
		expect(limiter.check('e', 1, 0).ok).toBe(false);
		expect(limiter.check('a', 1, 0).ok).toBe(true);
	});
});

describe('tooManyRequests', () => {
	it('returns 429 with Retry-After and a JSON error', async () => {
		const response = tooManyRequests(12);
		expect(response.status).toBe(429);
		expect(response.headers.get('retry-after')).toBe('12');
		expect(await response.json()).toEqual({ error: 'Too many requests. Try again shortly.' });
	});
});

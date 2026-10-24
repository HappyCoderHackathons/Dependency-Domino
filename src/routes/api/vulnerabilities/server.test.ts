import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { clearAdvisoryCache } from '#lib/server/osv/client.js';
import { batchLimiter } from '#lib/server/osv/limits.js';

beforeEach(() => {
	clearAdvisoryCache();
	batchLimiter.clear();
});

function call(body: unknown, fetch = vi.fn(), address = '203.0.113.1') {
	const request = new Request('http://localhost/api/vulnerabilities', {
		method: 'POST',
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
	return POST({ request, fetch, getClientAddress: () => address } as unknown as Parameters<typeof POST>[0]);
}

const osvResults = (results: unknown[]) => vi.fn().mockResolvedValue(new Response(JSON.stringify({ results })));

describe('POST /api/vulnerabilities', () => {
	it('returns a VulnerabilityResponse with advisory ids from OSV', async () => {
		const packages = [
			{ name: 'package-a', version: '1.0.0' },
			{ name: 'package-b', version: '2.0.0' }
		];
		const response = await call({ packages }, osvResults([{ vulns: [{ id: 'GHSA-1' }] }, {}]));
		expect(await response.json()).toEqual({
			status: 'complete',
			warnings: [],
			results: [
				{ name: 'package-a', version: '1.0.0', advisoryIds: ['GHSA-1'] },
				{ name: 'package-b', version: '2.0.0', advisoryIds: [] }
			]
		});
	});

	it('returns a complete empty response without calling OSV for no packages', async () => {
		const fetch = vi.fn();
		const response = await call({ packages: [] }, fetch);
		expect(await response.json()).toEqual({ status: 'complete', warnings: [], results: [] });
		expect(fetch).not.toHaveBeenCalled();
	});

	it('returns 400 for an invalid body without calling OSV', async () => {
		const fetch = vi.fn();
		const response = await call({ invalid: 'data' }, fetch);
		expect(response.status).toBe(400);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('passes an unavailable status through when OSV fails', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response('', { status: 400 }));
		const response = await call({ packages: [{ name: 'package-a', version: '1.0.0' }] }, fetch);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ status: 'unavailable', results: [] });
	});

	it('returns 429 with Retry-After once a client uses up its budget, without calling OSV', async () => {
		const packages = Array.from({ length: 2000 }, (_, i) => ({ name: `pkg-${i}`, version: '1.0.0' }));
		const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
			Response.json({ results: JSON.parse(String(init?.body)).queries.map(() => ({})) })
		);
		for (let i = 0; i < 3; i++) expect((await call({ packages }, fetch)).status).toBe(200);
		const calls = fetch.mock.calls.length;

		const limited = await call({ packages }, fetch);
		expect(limited.status).toBe(429);
		expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
		expect(fetch).toHaveBeenCalledTimes(calls);

		expect((await call({ packages: [] }, fetch, '203.0.113.2')).status).toBe(200);
	});
});

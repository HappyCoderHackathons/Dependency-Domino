import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import { detailsLimiter } from '#lib/server/osv/limits.js';

beforeEach(() => detailsLimiter.clear());

function call(id: string, fetch = vi.fn()) {
	return GET({ params: { id }, fetch, getClientAddress: () => '203.0.113.1' } as unknown as Parameters<typeof GET>[0]);
}

describe('GET /api/vulnerabilities/[id]', () => {
	it('returns normalized details', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ id: 'GHSA-35jh-r3h4-6jhm', summary: 'Command Injection' })));
		const response = await call('GHSA-35jh-r3h4-6jhm', fetch);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: 'GHSA-35jh-r3h4-6jhm',
			summary: 'Command Injection',
			published: null,
			severity: null,
			aliases: []
		});
	});

	it.each(['../x', 'a b', 'x', '', 'GHSA/1', 'a'.repeat(101)])('rejects the id %j without calling OSV', async (id) => {
		const fetch = vi.fn();
		expect((await call(id, fetch)).status).toBe(400);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('returns 404 when OSV has no record', async () => {
		const response = await call('GHSA-0000-0000-0000', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
		expect(response.status).toBe(404);
	});

	it('returns 502 when OSV cannot be reached', async () => {
		const response = await call('GHSA-35jh-r3h4-6jhm', vi.fn().mockRejectedValue(new TypeError('network')));
		expect(response.status).toBe(502);
	});

	it('returns 429 after 60 lookups in a minute from one client', async () => {
		const fetch = vi.fn(async () => Response.json({ id: 'GHSA-35jh-r3h4-6jhm' }));
		for (let i = 0; i < 60; i++) expect((await call('GHSA-35jh-r3h4-6jhm', fetch)).status).toBe(200);
		const limited = await call('GHSA-35jh-r3h4-6jhm', fetch);
		expect(limited.status).toBe(429);
		expect(fetch).toHaveBeenCalledTimes(60);
	});
});

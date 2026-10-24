import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { clearAdvisoryCache } from '#lib/server/osv/client.js';

beforeEach(() => clearAdvisoryCache());

function call(body: unknown, fetch = vi.fn()) {
	const request = new Request('http://localhost/api/vulnerabilities', {
		method: 'POST',
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
	return POST({ request, fetch } as unknown as Parameters<typeof POST>[0]);
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
});

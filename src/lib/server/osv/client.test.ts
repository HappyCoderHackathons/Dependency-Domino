import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_SIZE, clearAdvisoryCache, lookupAdvisories, MAX_PAGES } from '#lib/server/osv/client.js';

beforeEach(() => clearAdvisoryCache());

interface Query {
	package: { name: string };
	version: string;
	page_token?: string;
}

const pkg = (i: number) => ({ name: `pkg-${i}`, version: '1.0.0' });
const okResponse = (results: unknown[]) => new Response(JSON.stringify({ results }), { status: 200 });
const queriesOf = (init: RequestInit | undefined): Query[] => JSON.parse(String(init?.body)).queries;

/** Mock OSV that answers each query in a batch with `respond`. */
function osv(respond: (query: Query) => unknown) {
	return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => okResponse(queriesOf(init).map(respond)));
}

const result = (name: string, advisoryIds: string[] = []) => ({ name, version: '1.0.0', advisoryIds });

describe('lookupAdvisories chunking', () => {
	it('splits 250 packages into requests of 100, 100, and 50', async () => {
		const fetch = osv(() => ({}));
		const response = await lookupAdvisories(
			Array.from({ length: 250 }, (_, i) => pkg(i)),
			{ fetch }
		);
		expect(fetch.mock.calls.map(([, init]) => queriesOf(init).length)).toEqual([CHUNK_SIZE, CHUNK_SIZE, 50]);
		expect(response.status).toBe('complete');
		expect(response.results).toHaveLength(250);
	});

	it('maps each result back to its package by position', async () => {
		const fetch = osv((query) =>
			query.package.name === 'pkg-2' ? {} : { vulns: [{ id: `GHSA-${query.package.name}` }] }
		);
		const response = await lookupAdvisories([pkg(1), pkg(2), pkg(3)], { fetch });
		expect(response).toEqual({
			status: 'complete',
			results: [result('pkg-1', ['GHSA-pkg-1']), result('pkg-2'), result('pkg-3', ['GHSA-pkg-3'])],
			warnings: []
		});
	});

	it('never has more than 2 requests in flight', async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 10));
			inFlight--;
			return okResponse(queriesOf(init).map(() => ({})));
		});
		await lookupAdvisories(
			Array.from({ length: CHUNK_SIZE * 5 }, (_, i) => pkg(i)),
			{ fetch }
		);
		expect(fetch).toHaveBeenCalledTimes(5);
		expect(maxInFlight).toBe(2);
	});
});

describe('lookupAdvisories pagination', () => {
	it('follows next_page_token and combines ids from every page', async () => {
		const pages: Record<string, unknown> = {
			'': { vulns: [{ id: 'A' }], next_page_token: 't1' },
			t1: { vulns: [{ id: 'B' }], next_page_token: 't2' },
			t2: { vulns: [{ id: 'C' }] }
		};
		const fetch = osv((query) => pages[query.page_token ?? '']);
		const response = await lookupAdvisories([pkg(1)], { fetch });
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(response.results).toEqual([result('pkg-1', ['A', 'B', 'C'])]);
	});

	it('stops after MAX_PAGES follow-up pages', async () => {
		const fetch = osv(() => ({ vulns: [{ id: 'A' }], next_page_token: 'more' }));
		const response = await lookupAdvisories([pkg(1)], { fetch });
		expect(fetch).toHaveBeenCalledTimes(MAX_PAGES + 1);
		expect(response.results[0].advisoryIds).toHaveLength(MAX_PAGES + 1);
	});
});

describe('lookupAdvisories retries', () => {
	it.each([
		['a network error', () => Promise.reject(new Error('network'))],
		['a 5xx', () => Promise.resolve(new Response('', { status: 503 }))]
	])('retries once after %s and succeeds', async (_label, failure) => {
		const fetch = vi
			.fn()
			.mockImplementationOnce(failure)
			.mockResolvedValueOnce(okResponse([{}]));
		expect(await lookupAdvisories([pkg(1)], { fetch })).toMatchObject({ status: 'complete' });
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('does not retry a 4xx', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response('', { status: 400 }));
		expect(await lookupAdvisories([pkg(1)], { fetch })).toMatchObject({ status: 'unavailable' });
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('gives up after a request times out twice', async () => {
		const fetch = vi.fn(
			(_url: string | URL | Request, init?: RequestInit) =>
				new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))
		);
		expect(await lookupAdvisories([pkg(1)], { fetch, timeoutMs: 10 })).toMatchObject({ status: 'unavailable' });
		expect(fetch).toHaveBeenCalledTimes(2);
	});
});

describe('lookupAdvisories status', () => {
	it('is complete with no warnings for an empty list', async () => {
		expect(await lookupAdvisories([], { fetch: vi.fn() })).toEqual({ status: 'complete', results: [], warnings: [] });
	});

	it('is partial and omits packages from a failed chunk', async () => {
		let call = 0;
		const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) =>
			++call === 1 ? okResponse(queriesOf(init).map(() => ({}))) : new Response('', { status: 400 })
		);
		const response = await lookupAdvisories(
			Array.from({ length: 150 }, (_, i) => pkg(i)),
			{ fetch }
		);
		expect(response.status).toBe('partial');
		expect(response.results).toHaveLength(100);
		expect(response.warnings).toEqual(['Could not check 50 of 150 packages. Known advisories may be missing.']);
	});

	it('is unavailable with no results when every chunk fails', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response('', { status: 400 }));
		const response = await lookupAdvisories([pkg(1), pkg(2)], { fetch });
		expect(response).toEqual({
			status: 'unavailable',
			results: [],
			warnings: ['Could not check 2 of 2 packages. Known advisories may be missing.']
		});
	});

	it('counts a package as unchecked when a follow-up page fails', async () => {
		const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			const queries = queriesOf(init);
			if (queries[0].page_token) return new Response('', { status: 400 });
			return okResponse(queries.map((query) => (query.package.name === 'pkg-1' ? { next_page_token: 't' } : {})));
		});
		const response = await lookupAdvisories([pkg(1), pkg(2)], { fetch });
		expect(response.status).toBe('partial');
		expect(response.results).toEqual([result('pkg-2')]);
	});

	it('treats a response with the wrong number of results as a failure', async () => {
		const fetch = vi.fn().mockResolvedValue(okResponse([{}]));
		expect(await lookupAdvisories([pkg(1), pkg(2)], { fetch })).toMatchObject({ status: 'unavailable' });
	});
});

describe('lookupAdvisories cache', () => {
	afterEach(() => vi.useRealTimers());

	it('does not call OSV again for a package checked within the TTL', async () => {
		const fetch = osv(() => ({ vulns: [{ id: 'A' }] }));
		await lookupAdvisories([pkg(1)], { fetch });
		const response = await lookupAdvisories([pkg(1), pkg(2)], { fetch });
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(queriesOf(fetch.mock.calls[1][1]).map((query) => query.package.name)).toEqual(['pkg-2']);
		expect(response.results).toEqual([result('pkg-1', ['A']), result('pkg-2', ['A'])]);
	});

	it('queries again after the TTL expires', async () => {
		vi.useFakeTimers();
		const fetch = osv(() => ({}));
		await lookupAdvisories([pkg(1)], { fetch });
		vi.setSystemTime(Date.now() + 60 * 60 * 1000);
		await lookupAdvisories([pkg(1)], { fetch });
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('does not cache packages from a failed chunk', async () => {
		const failing = vi.fn().mockResolvedValue(new Response('', { status: 400 }));
		await lookupAdvisories([pkg(1)], { fetch: failing });
		const fetch = osv(() => ({}));
		expect(await lookupAdvisories([pkg(1)], { fetch })).toMatchObject({ status: 'complete' });
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});

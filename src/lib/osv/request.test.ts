import { describe, expect, it, vi } from 'vitest';
import { requestAdvisories, requestAdvisoryDetails } from '#lib/osv/request.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import demo from '#lib/fixtures/demo-lockfile.json';
import type { DependencyGraph } from '#lib/types.js';

function demoGraph(): DependencyGraph {
	const result = parseLockfile(JSON.stringify(demo));
	if (!result.ok) throw new Error(result.message);
	return result.graph;
}

describe('requestAdvisories', () => {
	it('posts unique registry pairs and returns the response', async () => {
		const body = { status: 'complete', results: [], warnings: [] };
		const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
		expect(await requestAdvisories(demoGraph(), fetch)).toEqual(body);

		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe('/api/vulnerabilities');
		const { packages } = JSON.parse(init.body);
		expect(packages).toHaveLength(13);
		expect(packages).toContainEqual({ name: '@domino-demo/tiny-pad', version: '1.0.4' });
	});

	it('does not call the endpoint when there is nothing to check', async () => {
		const fetch = vi.fn();
		const graph = { ...demoGraph(), nodes: demoGraph().nodes.filter((node) => node.id === '') };
		expect(await requestAdvisories(graph, fetch)).toEqual({ status: 'complete', results: [], warnings: [] });
		expect(fetch).not.toHaveBeenCalled();
	});

	it.each([
		['offline', () => Promise.reject(new TypeError('Failed to fetch'))],
		['a non-200', () => Promise.resolve(new Response('', { status: 400 }))]
	])('returns unavailable instead of throwing when %s', async (_label, failure) => {
		const result = await requestAdvisories(demoGraph(), vi.fn().mockImplementation(failure));
		expect(result).toEqual({
			status: 'unavailable',
			results: [],
			warnings: ['Known advisories could not be checked.']
		});
	});
});

describe('requestAdvisoryDetails', () => {
	it('returns the details from the endpoint', async () => {
		const details = { id: 'GHSA-1', summary: 'x', published: null, severity: null, aliases: [] };
		const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(details)));
		expect(await requestAdvisoryDetails('GHSA-1', fetch)).toEqual(details);
		expect(fetch.mock.calls[0][0]).toBe('/api/vulnerabilities/GHSA-1');
	});

	it.each([
		['offline', () => Promise.reject(new TypeError('Failed to fetch'))],
		['a 404', () => Promise.resolve(new Response('', { status: 404 }))]
	])('returns null when %s', async (_label, failure) => {
		expect(await requestAdvisoryDetails('GHSA-1', vi.fn().mockImplementation(failure))).toBeNull();
	});
});

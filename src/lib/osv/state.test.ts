import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppState } from '#lib/state.svelte.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import { simulateCompromise } from '#lib/graph/impact.js';
import type { VulnerabilityResponse } from '#lib/types.js';

function graph() {
	const result = parseLockfile(
		JSON.stringify({
			lockfileVersion: 3,
			packages: {
				'': { dependencies: { example: '1.0.0' } },
				'node_modules/example': { version: '1.0.0', resolved: 'https://registry.npmjs.org/example/-/example-1.0.0.tgz' }
			}
		})
	);
	if (!result.ok) throw new Error(result.message);
	return result.graph;
}

function reply(ids: string[], warnings: string[] = []) {
	return new Response(
		JSON.stringify({ status: 'complete', results: [{ name: 'example', version: '1.0.0', advisoryIds: ids }], warnings })
	);
}

afterEach(() => vi.unstubAllGlobals());

describe('advisory state integration', () => {
	it('does not mark a linked package when a registry instance has the same identity', async () => {
		const app = new AppState();
		app.graph = graph();
		app.graph.nodes.push({ ...app.graph.nodes[1], id: 'node_modules/local/node_modules/example', source: 'link' });
		await app.checkAdvisories(vi.fn().mockResolvedValue(reply(['GHSA-example'])));
		expect(app.graph.nodes[1].advisoryIds).toEqual(['GHSA-example']);
		expect(app.graph.nodes[2].advisoryIds).toEqual([]);
	});
	it('retains empty successful results and clears old matches and warnings on retry without resetting simulation', async () => {
		const app = new AppState();
		app.graph = graph();
		app.select('node_modules/example');
		app.setImpact(simulateCompromise(app.graph, 'node_modules/example'));
		const impact = app.impact;
		await app.checkAdvisories(vi.fn().mockResolvedValue(reply(['GHSA-example'], ['Earlier lookup warning'])));
		expect(app.graph.nodes.find((node) => node.name === 'example')?.advisoryIds).toEqual(['GHSA-example']);
		expect(app.advisoryNodes.map((node) => node.id)).toEqual(['node_modules/example']);
		app.select(app.advisoryNodes[0].id);
		expect(app.selectedAdvisories?.advisoryIds).toEqual(['GHSA-example']);
		await app.checkAdvisories(vi.fn().mockResolvedValue(reply([])));
		expect(app.osvResponse?.results[0].advisoryIds).toEqual([]);
		expect(app.graph.nodes.find((node) => node.name === 'example')?.advisoryIds).toEqual([]);
		expect(app.advisoryNodes).toEqual([]);
		expect(app.warnings).toEqual([]);
		expect(app.impact).toBe(impact);
		expect(app.selectedId).toBe('node_modules/example');
	});

	it('ignores an old response after loading another graph', async () => {
		let finish!: (response: Response) => void;
		const app = new AppState();
		app.graph = graph();
		const pending = app.checkAdvisories(
			vi.fn().mockImplementation(
				() =>
					new Promise<Response>((resolve) => {
						finish = resolve;
					})
			)
		);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply([])));
		const newer = graph();
		app.loadGraph(newer, 'new lockfile');
		finish(reply(['GHSA-stale']));
		await pending;
		expect(app.graph?.nodes.every((node) => node.advisoryIds.length === 0)).toBe(true);
		expect(app.sourceLabel).toBe('new lockfile');
	});

	it('reports a failed retry instead of retaining old matches', async () => {
		const app = new AppState();
		app.graph = graph();
		await app.checkAdvisories(vi.fn().mockResolvedValue(reply(['GHSA-example'])));
		await app.checkAdvisories(vi.fn().mockRejectedValue(new TypeError('offline')));
		expect(app.osvStatus).toBe('unavailable');
		expect(app.osvResponse).toMatchObject<Partial<VulnerabilityResponse>>({ results: [] });
		expect(app.graph.nodes.every((node) => node.advisoryIds.length === 0)).toBe(true);
	});

	it('keeps the five most recent simulations and clears them for a new graph', () => {
		const app = new AppState();
		for (let i = 0; i < 6; i++) {
			app.setImpact({
				originIds: [`origin-${i}`],
				originId: `origin-${i}`,
				ancestorIds: [],
				layers: [[`origin-${i}`]],
				samplePaths: []
			});
		}
		expect(app.recentSimulations).toHaveLength(5);
		expect(app.recentSimulations[0].originIds).toEqual(['origin-5']);
		expect(app.recentSimulations[4].originIds).toEqual(['origin-1']);
		app.loadGraph(graph(), 'new lockfile');
		expect(app.recentSimulations).toEqual([]);
	});

	it('loads advisory details independently and caches successful and failed lookups', async () => {
		const app = new AppState();
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ id: 'GHSA-one', summary: 'First', published: null, severity: 'HIGH', aliases: [] })
				)
			)
			.mockResolvedValueOnce(new Response('', { status: 502 }));

		await app.loadAdvisoryDetails(['GHSA-one', 'GHSA-two'], fetch);
		expect(app.advisoryDetail('GHSA-one')).toMatchObject({ status: 'loaded', details: { summary: 'First' } });
		expect(app.advisoryDetail('GHSA-two')).toEqual({ status: 'failed' });

		await app.loadAdvisoryDetails(['GHSA-one', 'GHSA-two'], fetch);
		expect(fetch).toHaveBeenCalledTimes(2);
	});
});

import { expect, it } from 'vitest';
import { buildSummaryCard } from './summary-card';
import { parseLockfile } from '#lib/parser/lockfile.js';
import { simulateCompromise } from '#lib/graph/impact.js';
import demo from '#lib/fixtures/demo-lockfile.json';

const parsed = parseLockfile(JSON.stringify(demo));
if (!parsed.ok) throw new Error(parsed.message);
const graph = parsed.graph;

it('snapshots full-graph metrics and the chosen explanatory path', () => {
	const impact = simulateCompromise(graph, 'node_modules/@domino-demo/tiny-pad');
	const card = buildSummaryCard(graph, impact, 1);
	expect(card).toMatchObject({ project: 'demo-app', affected: 6, hopsToRoot: 3, omittedPackages: 0 });
	expect(card.path[1]?.name).toBe('@domino-demo/report-gen');
	expect(card.origins).toEqual([{ name: '@domino-demo/tiny-pad', version: '1.0.4' }]);
	expect(card.origins[0]).not.toBe(graph.nodes.find((node) => node.id === impact.originId));
});

it('folds a long path while preserving both endpoints and its real hop count', () => {
	const ids = graph.nodes.map((node) => node.id);
	const impact = { ...simulateCompromise(graph, ids.at(-1)!), samplePaths: [ids] };
	const card = buildSummaryCard(graph, impact);
	expect(card.path).toHaveLength(5);
	expect(card.path[2]).toBeNull();
	expect(card.path[0]?.name).toBe('demo-app');
	expect(card.path.at(-1)?.name).toBe(graph.nodes.at(-1)!.name);
	expect(card.pathHops).toBe(ids.length - 1);
	expect(card.omittedPackages).toBe(ids.length - 4);
});

it('handles disconnected roots and multiple origins without inventing a root path', () => {
	const detached = { ...graph, edges: [] };
	const impact = simulateCompromise(detached, [graph.nodes[1].id, graph.nodes[2].id]);
	expect(buildSummaryCard(detached, impact)).toMatchObject({ affected: 0, hopsToRoot: null, path: [], pathHops: null });
	expect(buildSummaryCard(detached, impact).origins).toHaveLength(2);
	expect(() => buildSummaryCard(graph, { ...impact, originIds: ['missing'] })).toThrow();
});

it('represents a root-origin trace with zero dependency hops', () => {
	const card = buildSummaryCard(graph, simulateCompromise(graph, ''));
	expect(card).toMatchObject({ affected: 0, hopsToRoot: 0, pathHops: 0, omittedPackages: 0 });
	expect(card.path).toHaveLength(1);
});

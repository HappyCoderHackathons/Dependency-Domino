import { describe, expect, it } from 'vitest';
import { rankByImpact } from '#lib/graph/ranking.js';
import { indexGraph } from '#lib/graph/exploration.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import demo from '#lib/fixtures/demo-lockfile.json';

function graph() {
	const result = parseLockfile(JSON.stringify(demo));
	if (!result.ok) throw new Error(result.message);
	return result.graph;
}

describe('dependent-count ranking', () => {
	it('ranks the demo by unique dependent instances and excludes the project root', () => {
		const ranked = rankByImpact(graph());
		expect(ranked[0]).toEqual({ id: 'node_modules/@domino-demo/tiny-pad', dependentCount: 6 });
		expect(ranked[1]).toEqual({ id: 'node_modules/@domino-demo/string-utils', dependentCount: 3 });
		expect(ranked.some((row) => row.id === '')).toBe(false);
		expect(ranked).toHaveLength(13);
	});

	it('handles cycles, shared routes, and disconnected copies without counting the origin', () => {
		const original = graph();
		const ids = ['', 'a', 'b', 'c', 'isolated'];
		const nodes = ids.map((id) => ({ ...original.nodes[0], id, name: id || 'project' }));
		const edges = [
			['', 'a'],
			['', 'b'],
			['a', 'c'],
			['b', 'c'],
			['c', 'a']
		].map(([source, target]) => ({ source, target, kind: 'runtime' as const }));
		const ranked = rankByImpact({ nodes, edges, warnings: [] });
		expect(ranked).toEqual([
			{ id: 'a', dependentCount: 2 },
			{ id: 'c', dependentCount: 2 },
			{ id: 'b', dependentCount: 0 },
			{ id: 'isolated', dependentCount: 0 }
		]);
	});

	it('caches results per graph and retains separate installed copies', () => {
		const original = graph();
		expect(rankByImpact(original)).toBe(rankByImpact(original));
		const ids = indexGraph(original)
			.byName.get('@domino-demo/date-helpers')!
			.map((node) => node.id);
		expect(rankByImpact(original).filter((row) => ids.includes(row.id))).toHaveLength(2);
		expect(rankByImpact({ ...original, edges: [] }).every((row) => row.dependentCount === 0)).toBe(true);
	});
});

import { describe, expect, it } from 'vitest';
import { indexGraph, neighborhoodIds, transitiveDependencyCount } from '#lib/graph/exploration.js';
import type { DependencyGraph } from '#lib/types.js';

const graph: DependencyGraph = {
	nodes: ['', 'a', 'b', 'nested/b', 'c', 'isolated'].map((id) => ({
		id,
		name: id.endsWith('b') ? 'b' : id || 'project',
		version: '1.0.0',
		direct: id === 'a',
		devOnly: false,
		optional: false,
		source: 'registry',
		advisoryIds: []
	})),
	edges: [
		{ source: '', target: 'a', kind: 'runtime', requestedRange: '^1.0.0' },
		{ source: 'a', target: 'b', kind: 'peer', requestedRange: '~1.0.0' },
		{ source: 'a', target: 'nested/b', kind: 'optional' },
		{ source: 'b', target: 'c', kind: 'runtime' },
		{ source: 'c', target: 'b', kind: 'runtime' }
	],
	warnings: []
};

describe('graph exploration', () => {
	it('counts direct and indirect installed instances once, even with cycles and duplicate names', () => {
		const index = indexGraph(graph);
		expect(transitiveDependencyCount(index, '')).toBe(4);
		expect(transitiveDependencyCount(index, 'a')).toBe(3);
		expect(transitiveDependencyCount(index, 'b')).toBe(1);
		expect(transitiveDependencyCount(index, 'isolated')).toBe(0);
		expect(transitiveDependencyCount(index, 'missing')).toBe(0);
	});

	it('does not count a shared dependency twice or reuse counts for another graph', () => {
		const diamond: DependencyGraph = {
			...graph,
			edges: [
				{ source: 'a', target: 'b', kind: 'runtime' },
				{ source: 'a', target: 'nested/b', kind: 'runtime' },
				{ source: 'b', target: 'c', kind: 'runtime' },
				{ source: 'nested/b', target: 'c', kind: 'runtime' }
			]
		};
		expect(transitiveDependencyCount(indexGraph(diamond), 'a')).toBe(3);
		expect(transitiveDependencyCount(indexGraph({ ...diamond, edges: [] }), 'a')).toBe(0);
	});
	it('indexes edge metadata and keeps duplicate installed copies separate', () => {
		const index = indexGraph(graph);
		expect(index.dependencies.get('a')).toEqual(graph.edges.slice(1, 3));
		expect(index.dependents.get('nested/b')).toEqual([graph.edges[2]]);
		expect(index.nodes.get('b')?.name).toBe(index.nodes.get('nested/b')?.name);
	});

	it('traverses dependencies and dependents in their respective directions', () => {
		const index = indexGraph(graph);
		expect(neighborhoodIds(index, 'a', 1, 'dependencies')).toEqual(new Set(['a', 'b', 'nested/b']));
		expect(neighborhoodIds(index, 'a', 1, 'dependents')).toEqual(new Set(['a', '']));
		expect(neighborhoodIds(index, 'a', 1)).toEqual(new Set(['a', '', 'b', 'nested/b']));
	});

	it('limits shortest-hop distance, handles cycles, and excludes disconnected nodes', () => {
		const index = indexGraph(graph);
		expect(neighborhoodIds(index, '', 1)).toEqual(new Set(['', 'a']));
		expect(neighborhoodIds(index, '', 2)).toEqual(new Set(['', 'a', 'b', 'nested/b']));
		expect(neighborhoodIds(index, '', 4)).toEqual(new Set(['', 'a', 'b', 'nested/b', 'c']));
	});

	it('handles an isolated or absent selection without fabricating nodes', () => {
		const index = indexGraph(graph);
		expect(neighborhoodIds(index, 'isolated', 4)).toEqual(new Set(['isolated']));
		expect(neighborhoodIds(index, 'missing', 4)).toEqual(new Set());
		expect(
			indexGraph({ ...graph, edges: [{ source: 'a', target: 'missing', kind: 'runtime' }] }).dependencies.size
		).toBe(0);
	});
});

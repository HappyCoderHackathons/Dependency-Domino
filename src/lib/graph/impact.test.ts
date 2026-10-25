import { describe, expect, it } from 'vitest';
import { buildReverseAdjacency, pathFromRoot, simulateCompromise, traverse } from '#lib/graph/impact.js';
import type { DependencyEdge, DependencyGraph } from '#lib/types.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import demo from '#lib/fixtures/demo-lockfile.json';

function edges(...pairs: [string, string][]): DependencyEdge[] {
	return pairs.map(([source, target]) => ({ source, target, kind: 'runtime' }));
}

function demoGraph(): DependencyGraph {
	const result = parseLockfile(JSON.stringify(demo));
	if (!result.ok) throw new Error(result.message);
	return result.graph;
}

const demoId = (name: string) => `node_modules/@domino-demo/${name}`;

describe('buildReverseAdjacency', () => {
	it('builds a map of consumers for each dependency', () => {
		const graph = edges(['a', 'b'], ['a', 'c'], ['b', 'c'], ['c', 'd']);
		const reverseAdjacency = buildReverseAdjacency(graph);
		expect(reverseAdjacency.get('b')).toEqual(new Set(['a']));
		expect(reverseAdjacency.get('c')).toEqual(new Set(['a', 'b']));
		expect(reverseAdjacency.get('d')).toEqual(new Set(['c']));
	});
});

describe('traverse', () => {
	it('performs a reverse BFS traversal from the origin', () => {
		const consumers = new Map<string, Set<string>>([['b', new Set(['a'])]]);
		const result = traverse(consumers, 'b');
		expect(result.parents.get('a')).toBe('b');
	});
	it('terminates on a -> b -> c -> a and returns the correct ancestors', () => {
		const consumers = new Map<string, Set<string>>([
			['a', new Set(['b'])],
			['b', new Set(['c'])],
			['c', new Set(['a'])]
		]);
		const result = traverse(consumers, 'a');
		expect(result.visited).toEqual(new Set(['a', 'b', 'c']));
		expect(result.layers).toEqual([['a'], ['b'], ['c']]);
		expect(result.parents.get('b')).toBe('a');
		expect(result.parents.get('c')).toBe('b');
	});
	it('puts each node in exactly one layer at its shortest distance from the origin', () => {
		const consumers = new Map<string, Set<string>>([
			['a', new Set(['b', 'c'])],
			['b', new Set(['d'])],
			['c', new Set(['d'])],
			['d', new Set(['e'])]
		]);
		const result = traverse(consumers, 'a');
		expect(result.layers).toEqual([['a'], ['b', 'c'], ['d'], ['e']]);
	});
	it('returns the correct path from the root to the origin', () => {
		const consumers = buildReverseAdjacency(edges(['', 'a'], ['a', 'b'], ['b', 'c']));
		const result = traverse(consumers, 'c');
		expect(pathFromRoot(result, 'c')).toEqual(['', 'a', 'b', 'c']);
	});
	it('returns an empty path when the root is not reachable', () => {
		const consumers = new Map<string, Set<string>>([
			['a', new Set(['b'])],
			['b', new Set(['c'])]
		]);
		const result = traverse(consumers, 'c');
		expect(pathFromRoot(result, 'c')).toEqual([]);
	});
});

describe('simulateCompromise', () => {
	it('compromising tiny-pad reaches both direct dependencies and the root', () => {
		const result = simulateCompromise(demoGraph(), demoId('tiny-pad'));
		expect(result.originId).toBe(demoId('tiny-pad'));
		expect(result.ancestorIds).toHaveLength(7);
		expect(result.ancestorIds).toEqual(expect.arrayContaining([demoId('ui-kit'), demoId('report-gen'), '']));
		expect(result.layers).toEqual([
			[demoId('tiny-pad')],
			[demoId('format-core'), demoId('string-utils'), `${demoId('chart-lite')}/${demoId('date-helpers')}`],
			[demoId('ui-kit'), demoId('report-gen'), demoId('chart-lite')],
			['']
		]);
		expect(result.samplePaths).toEqual([
			['', demoId('ui-kit'), demoId('format-core'), demoId('tiny-pad')],
			['', demoId('report-gen'), demoId('format-core'), demoId('tiny-pad')]
		]);
		expect(result.rootBranchCount).toBe(2);
	});
	it('returns the same result when called multiple times with the same graph and origin', () => {
		const graph = demoGraph();
		expect(simulateCompromise(graph, demoId('diff-view'))).toEqual(simulateCompromise(graph, demoId('diff-view')));
	});
	it('returns no ancestors, one layer, and a root-only path when the root is the origin', () => {
		const result = simulateCompromise(demoGraph(), '');
		expect(result.originId).toBe('');
		expect(result.ancestorIds).toEqual([]);
		expect(result.layers).toEqual([['']]);
		expect(result.samplePaths).toEqual([['']]);
	});

	it('traverses multiple origins and counts overlapping ancestors once', () => {
		const graph = {
			nodes: [
				{
					id: '',
					name: 'root',
					version: null,
					direct: false,
					devOnly: false,
					optional: false,
					source: 'unknown' as const,
					advisoryIds: []
				},
				{
					id: 'a',
					name: 'shared-a',
					version: '1',
					direct: true,
					devOnly: false,
					optional: false,
					source: 'registry' as const,
					advisoryIds: []
				},
				{
					id: 'b',
					name: 'shared-b',
					version: '1',
					direct: true,
					devOnly: false,
					optional: false,
					source: 'registry' as const,
					advisoryIds: []
				},
				{
					id: 'shared',
					name: 'consumer',
					version: '1',
					direct: false,
					devOnly: false,
					optional: false,
					source: 'registry' as const,
					advisoryIds: []
				}
			],
			edges: [
				{ source: '', target: 'a', kind: 'runtime' as const },
				{ source: '', target: 'b', kind: 'runtime' as const },
				{ source: 'shared', target: 'a', kind: 'runtime' as const },
				{ source: 'shared', target: 'b', kind: 'runtime' as const }
			],
			warnings: []
		};
		const result = simulateCompromise(graph, ['a', 'b']);
		expect(result.originIds).toEqual(['a', 'b']);
		expect(result.layers[0]).toEqual(['a', 'b']);
		expect(result.ancestorIds).toEqual(['', 'shared']);
		expect(result.samplePaths).toEqual([
			['', 'a'],
			['', 'b']
		]);
	});
});

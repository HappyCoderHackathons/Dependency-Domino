import { describe, expect, it } from 'vitest';
import { indexGraph } from '#lib/graph/exploration.js';
import { MAX_SAMPLE_PATHS, sampleRootPaths } from '#lib/graph/paths.js';

function index(edges: [string, string][], extra: string[] = []) {
	const ids = new Set(['', ...extra, ...edges.flat()]);
	return indexGraph({
		nodes: [...ids].map((id) => ({
			id,
			name: id || 'project',
			version: '1',
			direct: false,
			devOnly: false,
			optional: false,
			source: 'registry' as const,
			advisoryIds: []
		})),
		edges: edges.map(([source, target]) => ({ source, target, kind: 'runtime' as const })),
		warnings: []
	});
}

describe('bounded root path samples', () => {
	it('shows both branches of a diamond and counts distinct direct dependencies', () => {
		const result = sampleRootPaths(
			index([
				['', 'a'],
				['', 'b'],
				['a', 'x'],
				['b', 'x']
			]),
			['x']
		);
		expect(result).toEqual({
			samplePaths: [
				['', 'a', 'x'],
				['', 'b', 'x']
			],
			rootBranchCount: 2
		});
	});

	it('finds alternative paths within one direct dependency and avoids duplicate edges', () => {
		const result = sampleRootPaths(
			index([
				['', 'a'],
				['a', 'b'],
				['a', 'b'],
				['a', 'c'],
				['b', 'x'],
				['c', 'x']
			]),
			['x']
		);
		expect(result).toEqual({
			samplePaths: [
				['', 'a', 'b', 'x'],
				['', 'a', 'c', 'x']
			],
			rootBranchCount: 1
		});
	});

	it('includes a longer direct branch, without following cycles back through the root', () => {
		const result = sampleRootPaths(
			index([
				['', 'x'],
				['', 'a'],
				['a', 'b'],
				['b', 'a'],
				['b', 'x'],
				['', 'cycle'],
				['cycle', '']
			]),
			['x']
		);
		expect(result).toEqual({
			samplePaths: [
				['', 'x'],
				['', 'a', 'b', 'x']
			],
			rootBranchCount: 2
		});
	});

	it('caps samples without truncating the direct-branch count, including multiple origins', () => {
		const edges: [string, string][] = Array.from(
			{ length: 30 },
			(_, i) =>
				[
					['', `branch-${i}`],
					[`branch-${i}`, 'x']
				] as [string, string][]
		).flat();
		const result = sampleRootPaths(index([...edges, ['', 'y']]), ['x', 'y', 'x'], 500);
		expect(result.samplePaths).toHaveLength(MAX_SAMPLE_PATHS);
		expect(result.samplePaths[1]).toEqual(['', 'y']);
		expect(result.rootBranchCount).toBe(31);
	});

	it('reports absent root paths and handles a root origin', () => {
		const graph = index([['', 'a']], ['isolated']);
		expect(sampleRootPaths(graph, ['isolated'])).toEqual({ samplePaths: [], rootBranchCount: 0 });
		expect(sampleRootPaths(graph, [''])).toEqual({ samplePaths: [['']], rootBranchCount: 0 });
	});

	it('walks deep chains without recursive calls or copying every intermediate path', () => {
		const edges: [string, string][] = [
			['', '0'],
			...Array.from({ length: 1200 }, (_, i) => [String(i), String(i + 1)] as [string, string])
		];
		const result = sampleRootPaths(index(edges), ['1200']);
		expect(result.samplePaths[0]).toHaveLength(1202);
		expect(result.rootBranchCount).toBe(1);
	});
});

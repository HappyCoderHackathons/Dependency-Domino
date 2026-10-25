import { expect, it } from 'vitest';
import { everyPathPackages, previewRemoval } from './scenarios';
import type { DependencyGraph } from '#lib/types.js';

function graph(pairs: [string, string][], extra: string[] = []): DependencyGraph {
	const ids = [...new Set(['', ...pairs.flat(), ...extra])];
	return {
		nodes: ids.map((id) => ({
			id,
			name: id || 'root',
			version: '1.0.0',
			source: 'registry',
			direct: false,
			devOnly: false,
			optional: false,
			advisoryIds: []
		})),
		edges: pairs.map(([source, target]) => ({ source, target, kind: 'runtime' })),
		warnings: []
	};
}

it('finds every intermediate in a chain but none in a diamond', () => {
	expect(
		everyPathPackages(
			graph([
				['', 'a'],
				['a', 'b'],
				['b', 'x']
			]),
			'x'
		)
	).toEqual(['a', 'b']);
	expect(
		everyPathPackages(
			graph([
				['', 'a'],
				['', 'b'],
				['a', 'x'],
				['b', 'x']
			]),
			'x'
		)
	).toEqual([]);
});

it('considers longer alternate routes and cycles, not just sampled shortest paths', () => {
	const g = graph([
		['', 'a'],
		['a', 'x'],
		['', 'b'],
		['b', 'c'],
		['c', 'x'],
		['c', 'b'],
		['x', 'tail']
	]);
	expect(everyPathPackages(g, 'x')).toEqual([]);
	expect(everyPathPackages(g, 'tail')).toEqual(['x']);
	expect(everyPathPackages(g, 'gone')).toEqual([]);
	expect(everyPathPackages(g, '')).toEqual([]);
});

it('previews removal on a copy, excluding the removed node and previously disconnected nodes from loss counts', () => {
	const g = graph(
		[
			['', 'a'],
			['a', 'b'],
			['b', 'c'],
			['c', 'b']
		],
		['disconnected']
	);
	const before = structuredClone(g);
	const result = previewRemoval(g, 'a');
	expect(result.unreachableIds).toEqual(['b', 'c']);
	expect(result.graph.nodes.map((node) => node.id)).not.toContain('a');
	expect(result.graph.edges.some((edge) => edge.source === 'a' || edge.target === 'a')).toBe(false);
	expect(g).toEqual(before);
	expect(previewRemoval(g, 'disconnected').unreachableIds).toEqual([]);
	expect(previewRemoval(g, 'disconnected').rootReachableBefore).toBe(false);
	expect(() => previewRemoval(g, '')).toThrow();
});

it('keeps shared dependencies reachable through another branch and caches every-path results', () => {
	const g = graph([
		['', 'a'],
		['', 'b'],
		['a', 'x'],
		['b', 'x'],
		['x', 'leaf']
	]);
	expect(previewRemoval(g, 'a').unreachableIds).toEqual([]);
	expect(previewRemoval(g, 'x').unreachableIds).toEqual(['leaf']);
	expect(everyPathPackages(g, 'leaf')).toEqual(['x']);
});

it('handles a long chain iteratively', () => {
	const pairs: [string, string][] = [['', '0']];
	for (let i = 1; i < 1200; i++) pairs.push([String(i - 1), String(i)]);
	const result = everyPathPackages(graph(pairs), '1199');
	expect(result).toHaveLength(1199);
	expect(result[0]).toBe('0');
	expect(result.at(-1)).toBe('1198');
});

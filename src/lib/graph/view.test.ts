import { describe, expect, it } from 'vitest';
import { chooseRankDir, rankFromRoot, visibleNodeIds } from '#lib/graph/view.js';
import type { DependencyGraph, PackageNode } from '#lib/types.js';

function node(id: string, extra: Partial<PackageNode> = {}): PackageNode {
	return {
		id,
		name: id || 'root',
		version: '1.0.0',
		direct: false,
		devOnly: false,
		optional: false,
		source: 'registry',
		advisoryIds: [],
		...extra
	};
}

function graph(nodes: PackageNode[], edges: [string, string][]): DependencyGraph {
	return { nodes, edges: edges.map(([source, target]) => ({ source, target, kind: 'runtime' })), warnings: [] };
}

const viewport = { width: 900, height: 800 };

describe('rankFromRoot', () => {
	it('ranks by shortest hop count and survives cycles', () => {
		const g = graph(
			[node(''), node('a'), node('b'), node('c')],
			[
				['', 'a'],
				['a', 'b'],
				['b', 'a'],
				['', 'b'],
				['b', 'c']
			]
		);
		expect(Object.fromEntries(rankFromRoot(g))).toEqual({ '': 0, a: 1, b: 1, c: 2 });
	});
});

describe('chooseRankDir', () => {
	it('lays a wide, shallow graph out left to right', () => {
		const leaves = Array.from({ length: 80 }, (_, i) => node(`p${i}`));
		const g = graph(
			[node(''), ...leaves],
			leaves.map((n) => ['', n.id])
		);
		expect(chooseRankDir(g, viewport)).toBe('LR');
	});

	it('lays a long chain out top down', () => {
		const chain = Array.from({ length: 30 }, (_, i) => node(`c${i}`));
		const ids = ['', ...chain.map((n) => n.id)];
		const g = graph(
			[node(''), ...chain],
			ids.slice(1).map((id, i) => [ids[i], id])
		);
		expect(chooseRankDir(g, viewport)).toBe('TB');
	});
});

describe('visibleNodeIds', () => {
	const g = graph(
		[node(''), node('lib', { direct: true }), node('tool', { direct: true, devOnly: true }), node('deep')],
		[]
	);

	it('hides dev-only packages but keeps the root', () => {
		expect([...visibleNodeIds(g, { hideDev: true, directOnly: false })]).toEqual(['', 'lib', 'deep']);
	});

	it('keeps only the root and direct dependencies', () => {
		expect([...visibleNodeIds(g, { hideDev: false, directOnly: true })]).toEqual(['', 'lib', 'tool']);
	});
});

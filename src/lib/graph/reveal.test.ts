import { describe, expect, it } from 'vitest';
import type { DependencyGraph } from '#lib/types.js';
import { rankFromRoot } from './view.js';
import {
	INITIAL_REVEAL,
	deepen,
	isProgressive,
	pathFromRoot,
	pinPath,
	revealKey,
	revealedNodeIds,
	subgraph
} from './reveal.js';

/** Builds a graph from [consumer, dependency] pairs; '' is the root. Only the fields these helpers read matter. */
function graphOf(pairs: [string, string][], extra: string[] = []): DependencyGraph {
	const ids = new Set(['', ...extra]);
	for (const [a, b] of pairs) ids.add(a).add(b);
	return {
		nodes: [...ids].map((id) => ({ id, name: id, version: '1.0.0', advisoryIds: [] })),
		edges: pairs.map(([source, target]) => ({ source, target, kind: 'production' })),
		warnings: []
	} as unknown as DependencyGraph;
}

// '' -> a -> b -> c -> d, and '' -> x
const chain = graphOf([
	['', 'a'],
	['a', 'b'],
	['b', 'c'],
	['c', 'd'],
	['', 'x']
]);
const ranks = rankFromRoot(chain);
const ids = (set: Set<string>) => [...set].sort();

describe('revealedNodeIds', () => {
	it('shows the root and everything within the depth', () => {
		expect(ids(revealedNodeIds(chain, ranks, INITIAL_REVEAL))).toEqual(['', 'a', 'b', 'x']);
	});

	it('adds pinned ids beyond the depth', () => {
		const revealed = revealedNodeIds(chain, ranks, { depth: 1, pinned: new Set(['d']) });
		expect(ids(revealed)).toEqual(['', 'a', 'd', 'x']);
	});

	it('shows unreachable instances only once the whole reachable graph is shown', () => {
		const g = graphOf([['', 'a']], ['orphan']);
		const r = rankFromRoot(g);
		expect(revealedNodeIds(g, r, { depth: 0, pinned: new Set() }).has('orphan')).toBe(false);
		expect(revealedNodeIds(g, r, { depth: 1, pinned: new Set() }).has('orphan')).toBe(true);
	});
});

describe('deepen', () => {
	it('adds one depth level', () => {
		const next = deepen(ranks, INITIAL_REVEAL);
		expect(next.depth).toBe(3);
		expect(ids(revealedNodeIds(chain, ranks, next))).toEqual(['', 'a', 'b', 'c', 'x']);
	});

	it('drops pinned ids the new depth covers', () => {
		const next = deepen(ranks, { depth: 2, pinned: new Set(['c', 'd']) });
		expect([...next.pinned]).toEqual(['d']);
	});

	it('stops at the deepest rank', () => {
		const full = { depth: 4, pinned: new Set<string>() };
		expect(deepen(ranks, full)).toBe(full);
	});
});

describe('pathFromRoot', () => {
	it('returns the path root first', () => {
		expect(pathFromRoot(chain, 'd')).toEqual(['', 'a', 'b', 'c', 'd']);
	});

	it('takes the shortest of several paths', () => {
		const g = graphOf([
			['', 'a'],
			['a', 'b'],
			['b', 'z'],
			['', 'z']
		]);
		expect(pathFromRoot(g, 'z')).toEqual(['', 'z']);
	});

	it('survives cycles', () => {
		const g = graphOf([
			['', 'a'],
			['a', 'b'],
			['b', 'a']
		]);
		expect(pathFromRoot(g, 'b')).toEqual(['', 'a', 'b']);
	});

	it('returns just the id when no path reaches it', () => {
		expect(pathFromRoot(graphOf([['', 'a']], ['orphan']), 'orphan')).toEqual(['orphan']);
	});

	it('handles the root itself', () => {
		expect(pathFromRoot(chain, '')).toEqual(['']);
	});
});

describe('pinPath', () => {
	it('pins the hidden node and the hidden steps of its path, not the ones already shown', () => {
		const next = pinPath(chain, ranks, INITIAL_REVEAL, 'd');
		expect(ids(next.pinned as Set<string>)).toEqual(['c', 'd']);
		const revealed = revealedNodeIds(chain, ranks, next);
		for (const id of pathFromRoot(chain, 'd')) expect(revealed.has(id)).toBe(true);
		expect(revealed.has('x')).toBe(true);
	});

	it('changes nothing for a node that is already shown', () => {
		expect([...pinPath(chain, ranks, INITIAL_REVEAL, 'b').pinned]).toEqual([]);
	});

	it('pins an unreachable node by itself', () => {
		const g = graphOf([['', 'a']], ['orphan']);
		const next = pinPath(g, rankFromRoot(g), { depth: 0, pinned: new Set() }, 'orphan');
		expect([...next.pinned]).toEqual(['orphan']);
	});
});

describe('revealKey', () => {
	it('ignores pin order and tracks depth', () => {
		const a = revealKey({ depth: 2, pinned: new Set(['c', 'd']) });
		expect(revealKey({ depth: 2, pinned: new Set(['d', 'c']) })).toBe(a);
		expect(revealKey({ depth: 3, pinned: new Set(['c', 'd']) })).not.toBe(a);
	});
});

describe('subgraph and isProgressive', () => {
	it('keeps only edges between kept nodes', () => {
		const sub = subgraph(chain, new Set(['', 'a', 'b']));
		expect(sub.nodes.map((n) => n.id)).toEqual(['', 'a', 'b']);
		expect(sub.edges.map((e) => `${e.source}>${e.target}`)).toEqual(['>a', 'a>b']);
	});

	it('is false for small graphs', () => {
		expect(isProgressive(chain)).toBe(false);
	});
});
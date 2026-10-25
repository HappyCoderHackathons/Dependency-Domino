import type { DependencyGraph } from '#lib/types.js';
import { LARGE_GRAPH_NODES } from './view.js';

/** Large graphs open showing the root plus everything within this many edges of it. */
export const INITIAL_REVEAL_DEPTH = 2;

export interface RevealState {
	/** Everything within this many edges of the root is shown. */
	depth: number;
	/** Extra ids shown beyond `depth`: a searched package and its path back to the root. */
	pinned: ReadonlySet<string>;
}

export const INITIAL_REVEAL: RevealState = { depth: INITIAL_REVEAL_DEPTH, pinned: new Set() };

/** Only graphs above the large-graph threshold are revealed progressively; smaller ones show everything. */
export function isProgressive(graph: DependencyGraph): boolean {
	return graph.nodes.length > LARGE_GRAPH_NODES;
}

/** Deepest rank reachable from the root. */
export function maxRank(ranks: ReadonlyMap<string, number>): number {
	let max = 0;
	for (const rank of ranks.values()) if (rank > max) max = rank;
	return max;
}

/**
 * Ids on the canvas before filters apply. Once the depth reaches the deepest reachable rank the whole
 * graph is shown, including instances no path from the root reaches.
 */
export function revealedNodeIds(
	graph: DependencyGraph,
	ranks: ReadonlyMap<string, number>,
	reveal: RevealState
): Set<string> {
	const ids = new Set<string>();
	if (reveal.depth >= maxRank(ranks)) {
		for (const node of graph.nodes) ids.add(node.id);
		return ids;
	}
	for (const [id, rank] of ranks) if (rank <= reveal.depth) ids.add(id);
	for (const id of reveal.pinned) ids.add(id);
	return ids;
}

/** Shortest path from the root to `id` along consumer -> dependency edges, root first. Unreachable ids get `[id]`. */
export function pathFromRoot(graph: DependencyGraph, id: string): string[] {
	if (id === '') return [''];

	const deps = new Map<string, string[]>();
	for (const edge of graph.edges) {
		const list = deps.get(edge.source);
		if (list) list.push(edge.target);
		else deps.set(edge.source, [edge.target]);
	}

	const parent = new Map<string, string>();
	const seen = new Set<string>(['']);
	let frontier = [''];
	while (frontier.length > 0 && !seen.has(id)) {
		const next: string[] = [];
		for (const from of frontier) {
			for (const to of deps.get(from) ?? []) {
				if (seen.has(to)) continue;
				seen.add(to);
				parent.set(to, from);
				next.push(to);
			}
		}
		frontier = next;
	}
	if (!seen.has(id)) return [id];

	const path = [id];
	for (let at = id; at !== '';) {
		at = parent.get(at)!;
		path.push(at);
	}
	return path.reverse();
}

function beyond(ranks: ReadonlyMap<string, number>, depth: number, pinned: ReadonlySet<string>): Set<string> {
	const kept = new Set<string>();
	for (const id of pinned) {
		const rank = ranks.get(id);
		if (rank === undefined || rank > depth) kept.add(id);
	}
	return kept;
}

/** "Show more": one more depth level. Pinned ids the new depth now covers are dropped so keys stay canonical. */
export function deepen(ranks: ReadonlyMap<string, number>, reveal: RevealState): RevealState {
	if (reveal.depth >= maxRank(ranks)) return reveal;
	const depth = reveal.depth + 1;
	return { depth, pinned: beyond(ranks, depth, reveal.pinned) };
}

/** Search result: pin the node and its path to the root, skipping steps already inside the depth. */
export function pinPath(
	graph: DependencyGraph,
	ranks: ReadonlyMap<string, number>,
	reveal: RevealState,
	id: string
): RevealState {
	const pinned = new Set(reveal.pinned);
	for (const step of beyond(ranks, reveal.depth, new Set(pathFromRoot(graph, id)))) pinned.add(step);
	return { depth: reveal.depth, pinned };
}

/** Stable identity of what is revealed, for the layout cache. */
export function revealKey(reveal: RevealState): string {
	return `${reveal.depth}|${[...reveal.pinned].sort().join('\n')}`;
}

/** The nodes in `ids` and the edges between them. */
export function subgraph(graph: DependencyGraph, ids: ReadonlySet<string>): DependencyGraph {
	return {
		...graph,
		nodes: graph.nodes.filter((n) => ids.has(n.id)),
		edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target))
	};
}

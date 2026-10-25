import type { DependencyGraph } from '#lib/types.js';

/** Above this many installed instances the canvas switches to large-graph rendering and shows a notice. */
export const LARGE_GRAPH_NODES = 300;

export type RankDir = 'TB' | 'LR';
export type LayoutDirection = 'auto' | RankDir;

export interface ViewFilters {
	hideDev: boolean;
	directOnly: boolean;
}

export const DEFAULT_FILTERS: ViewFilters = { hideDev: false, directOnly: false };

/** Breadth-first ranks from the root along consumer -> dependency edges. Unreachable nodes are left out. */
export function rankFromRoot(graph: DependencyGraph): Map<string, number> {
	const deps = new Map<string, string[]>();
	for (const edge of graph.edges) {
		const list = deps.get(edge.source);
		if (list) list.push(edge.target);
		else deps.set(edge.source, [edge.target]);
	}

	const ranks = new Map<string, number>([['', 0]]);
	let frontier = [''];
	while (frontier.length > 0) {
		const next: string[] = [];
		for (const id of frontier) {
			for (const target of deps.get(id) ?? []) {
				if (ranks.has(target)) continue;
				ranks.set(target, ranks.get(id)! + 1);
				next.push(target);
			}
		}
		frontier = next;
	}
	return ranks;
}

// Rough footprint of one node plus spacing, matching the dagre settings in DependencyGraph.svelte.
const FOOTPRINT = {
	TB: { across: 160, along: 100 },
	LR: { across: 46, along: 210 }
};

/**
 * Picks the direction whose estimated layout fits the viewport at the larger zoom. Wide, shallow graphs
 * (many direct dependencies) read better left to right; long, narrow chains read better top down.
 */
export function chooseRankDir(graph: DependencyGraph, viewport: { width: number; height: number }): RankDir {
	const perRank = new Map<number, number>();
	const ranks = rankFromRoot(graph);
	for (const rank of ranks.values()) perRank.set(rank, (perRank.get(rank) ?? 0) + 1);
	const unreachable = graph.nodes.length - ranks.size;

	const depth = Math.max(perRank.size, 1);
	const widest = Math.max(...perRank.values(), unreachable, 1);
	const scale = (dir: RankDir) => {
		const { across, along } = FOOTPRINT[dir];
		const [w, h] = dir === 'TB' ? [widest * across, depth * along] : [depth * along, widest * across];
		return Math.min(viewport.width / w, viewport.height / h);
	};
	return scale('LR') > scale('TB') ? 'LR' : 'TB';
}

/** Ids that stay on the canvas under the given filters. The simulation always uses the full graph. */
export function visibleNodeIds(graph: DependencyGraph, filters: ViewFilters): Set<string> {
	const ids = new Set<string>();
	for (const node of graph.nodes) {
		if (node.id !== '') {
			if (filters.hideDev && node.devOnly) continue;
			if (filters.directOnly && !node.direct) continue;
		}
		ids.add(node.id);
	}
	return ids;
}

export function filtersActive(filters: ViewFilters): boolean {
	return filters.hideDev || filters.directOnly;
}

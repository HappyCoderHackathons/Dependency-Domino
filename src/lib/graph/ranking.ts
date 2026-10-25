import { buildReverseAdjacency } from '#lib/graph/impact.js';
import type { DependencyGraph } from '#lib/types.js';

export interface ImpactRank {
	id: string;
	dependentCount: number;
}
const cache = new WeakMap<DependencyGraph, ImpactRank[]>();

/** Ranks installed instances by unique dependent instances, excluding themselves and the project root. */
export function rankByImpact(graph: DependencyGraph): ImpactRank[] {
	const cached = cache.get(graph);
	if (cached) return cached;
	const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
	const consumers = buildReverseAdjacency(
		graph.edges.filter((edge) => nodes.has(edge.source) && nodes.has(edge.target))
	);
	const results = graph.nodes
		.filter((node) => node.id !== '')
		.map((origin) => {
			const seen = new Set([origin.id]);
			const queue = [origin.id];
			for (let at = 0; at < queue.length; at++) {
				for (const id of consumers.get(queue[at]) ?? []) {
					if (seen.has(id)) continue;
					seen.add(id);
					queue.push(id);
				}
			}
			seen.delete(origin.id);
			seen.delete('');
			return { id: origin.id, dependentCount: seen.size };
		})
		.sort(
			(a, b) =>
				b.dependentCount - a.dependentCount ||
				nodes.get(a.id)!.name.localeCompare(nodes.get(b.id)!.name) ||
				a.id.localeCompare(b.id)
		);
	cache.set(graph, results);
	return results;
}

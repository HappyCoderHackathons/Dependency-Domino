import type { DependencyEdge, DependencyGraph, PackageNode } from '#lib/types.js';

export type NeighborhoodDirection = 'both' | 'dependencies' | 'dependents';

export interface GraphIndex {
	nodes: Map<string, PackageNode>;
	dependencies: Map<string, DependencyEdge[]>;
	dependents: Map<string, DependencyEdge[]>;
}

/** Index once per graph, so navigating between packages does not repeatedly scan every edge. */
export function indexGraph(graph: DependencyGraph): GraphIndex {
	const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
	const dependencies = new Map<string, DependencyEdge[]>();
	const dependents = new Map<string, DependencyEdge[]>();
	for (const edge of graph.edges) {
		if (!nodes.has(edge.source) || !nodes.has(edge.target)) continue;
		if (!dependencies.has(edge.source)) dependencies.set(edge.source, []);
		if (!dependents.has(edge.target)) dependents.set(edge.target, []);
		dependencies.get(edge.source)!.push(edge);
		dependents.get(edge.target)!.push(edge);
	}
	return { nodes, dependencies, dependents };
}

/** Shortest edge distance, optionally following consumers, dependencies, or both. Cycles visit each id once. */
export function neighborhoodIds(
	index: GraphIndex,
	originId: string,
	hops: number,
	direction: NeighborhoodDirection = 'both'
): Set<string> {
	if (!index.nodes.has(originId)) return new Set();
	const visited = new Set([originId]);
	let frontier = [originId];
	for (let depth = 0; depth < hops && frontier.length > 0; depth++) {
		const next: string[] = [];
		for (const id of frontier) {
			const neighbors = [
				...(direction !== 'dependents' ? (index.dependencies.get(id) ?? []).map((edge) => edge.target) : []),
				...(direction !== 'dependencies' ? (index.dependents.get(id) ?? []).map((edge) => edge.source) : [])
			];
			for (const neighbor of neighbors) {
				if (visited.has(neighbor)) continue;
				visited.add(neighbor);
				next.push(neighbor);
			}
		}
		frontier = next;
	}
	return visited;
}

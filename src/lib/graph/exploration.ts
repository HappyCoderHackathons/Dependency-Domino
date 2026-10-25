import type { DependencyEdge, DependencyGraph, PackageNode } from '#lib/types.js';

export type NeighborhoodDirection = 'both' | 'dependencies' | 'dependents';

export interface GraphIndex {
	nodes: Map<string, PackageNode>;
	byName: Map<string, PackageNode[]>;
	dependencies: Map<string, DependencyEdge[]>;
	dependents: Map<string, DependencyEdge[]>;
}

/** Index once per graph, so navigating between packages does not repeatedly scan every edge. */
export function indexGraph(graph: DependencyGraph): GraphIndex {
	const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
	const byName = new Map<string, PackageNode[]>();
	for (const node of graph.nodes) {
		if (node.id === '') continue;
		if (!byName.has(node.name)) byName.set(node.name, []);
		byName.get(node.name)!.push(node);
	}
	const dependencies = new Map<string, DependencyEdge[]>();
	const dependents = new Map<string, DependencyEdge[]>();
	for (const edge of graph.edges) {
		if (!nodes.has(edge.source) || !nodes.has(edge.target)) continue;
		if (!dependencies.has(edge.source)) dependencies.set(edge.source, []);
		if (!dependents.has(edge.target)) dependents.set(edge.target, []);
		dependencies.get(edge.source)!.push(edge);
		dependents.get(edge.target)!.push(edge);
	}
	return { nodes, byName, dependencies, dependents };
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

const dependencyCounts = new WeakMap<GraphIndex, Map<string, number>>();

/** Unique recorded installed dependencies, direct and indirect, excluding the selection and project root. */
export function transitiveDependencyCount(index: GraphIndex, originId: string): number {
	let counts = dependencyCounts.get(index);
	if (!counts) {
		counts = new Map();
		dependencyCounts.set(index, counts);
	}
	const cached = counts.get(originId);
	if (cached !== undefined) return cached;
	const reached = neighborhoodIds(index, originId, Infinity, 'dependencies');
	reached.delete(originId);
	reached.delete('');
	counts.set(originId, reached.size);
	return reached.size;
}

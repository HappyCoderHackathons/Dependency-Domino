import type { DependencyEdge, DependencyGraph, ImpactResult } from '#lib/types.js';

const adjacencyCache = new WeakMap<DependencyGraph, Map<string, Set<string>>>();

interface Traversal {
	visited: Set<string>;
	layers: string[][];
	// consumer -> the node one hop closer to the origin it was reached from
	parents: Map<string, string>;
}

function consumersFor(graph: DependencyGraph): Map<string, Set<string>> {
	const cached = adjacencyCache.get(graph);
	if (cached) return cached;

	const consumers = buildReverseAdjacency(graph.edges);
	adjacencyCache.set(graph, consumers);
	return consumers;
}

export function simulateCompromise(graph: DependencyGraph, originId: string): ImpactResult {
	const traversal = traverse(consumersFor(graph), originId);
	const path = pathFromRoot(traversal, originId);

	return {
		originId,
		ancestorIds: [...traversal.visited].filter((id) => id !== originId),
		layers: traversal.layers,
		samplePaths: path.length > 0 ? [path] : []
	};
}

// Reverse BFS
export function traverse(consumers: Map<string, Set<string>>, originId: string): Traversal {
	const visited = new Set([originId]);
	const layers: string[][] = [[originId]];
	const parents = new Map<string, string>();

	let frontier = [originId];

	while (frontier.length > 0) {
		const next: string[] = [];
		for (const id of frontier) {
			const consumerSet = consumers.get(id);
			if (!consumerSet) continue;
			for (const consumer of consumerSet) {
				if (visited.has(consumer)) continue;
				visited.add(consumer);
				parents.set(consumer, id);
				next.push(consumer);
			}
		}
		if (next.length > 0) layers.push(next);
		frontier = next;
	}
	return { visited, layers, parents };
}

// Maps each dependency id to the ids of packages that consume it
export function buildReverseAdjacency(graph: DependencyEdge[]): Map<string, Set<string>> {
	const consumers = new Map<string, Set<string>>();
	for (const edge of graph) {
		if (!consumers.has(edge.target)) {
			consumers.set(edge.target, new Set());
		}
		consumers.get(edge.target)!.add(edge.source);
	}
	return consumers;
}

// Root-to-origin path built by following parents from the root, or [] when the root was not reached
export function pathFromRoot(traversal: Traversal, originId: string): string[] {
	if (!traversal.visited.has('')) return [];

	const path = [''];
	let current = '';
	while (current !== originId) {
		const parent = traversal.parents.get(current);
		if (parent === undefined) return [];
		path.push(parent);
		current = parent;
	}
	return path;
}

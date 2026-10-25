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

export function simulateCompromise(graph: DependencyGraph, origins: string | string[]): ImpactResult {
	const originIds = [...new Set(typeof origins === 'string' ? [origins] : origins)];
	if (originIds.length === 0) throw new Error('A simulation requires at least one origin.');
	const traversal = traverse(consumersFor(graph), originIds);
	const samplePaths = originIds
		.map((originId) => pathFromRoot(traverse(consumersFor(graph), originId), originId))
		.filter((path) => path.length > 0);

	return {
		originIds,
		originId: originIds[0],
		ancestorIds: [...traversal.visited].filter((id) => !originIds.includes(id)),
		layers: traversal.layers,
		samplePaths
	};
}

// Reverse BFS
export function traverse(consumers: Map<string, Set<string>>, origins: string | string[]): Traversal {
	const originIds = [...new Set(typeof origins === 'string' ? [origins] : origins)];
	const visited = new Set(originIds);
	const layers: string[][] = [originIds];
	const parents = new Map<string, string>();

	let frontier = originIds;

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

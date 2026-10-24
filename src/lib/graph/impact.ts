import type { DependencyEdge, DependencyGraph, ImpactResult } from '#lib/types.js';

interface Traversal {
    visited: Set<string>;
    layers: string[][];
    // consumer -> the node one hop closer to the origin it was reached from
    parents: Map<string, string>;
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
        layers.push(next);
        frontier = next;
        if (next.length > 0) {
            layers.push(next);
        }
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

// Root-to-orign path built by following parents from the root or [] when root was not reached
export function pathFromRoot(traversal: Traversal, originId: string): string[] {
    // TODO: if traversal.visited lacks '', return []
	// otherwise start at '' and keep stepping to traversal.parents.get(current) until current === originId
    if (!traversal.visited.has('')) {
        return [];
    }
    const path: string[] = [];
    let current = '';
    while (current !== originId) {
        path.push(current);
        current = traversal.parents.get(current) || '';
    }
    path.push(originId);
    return path;
}
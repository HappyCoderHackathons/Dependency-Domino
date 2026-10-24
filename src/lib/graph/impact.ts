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
    const layers: string[][] = [];
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
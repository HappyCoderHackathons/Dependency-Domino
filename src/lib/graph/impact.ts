import type { DependencyEdge, DependencyGraph, ImpactResult } from '#lib/types.js';

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
import type { DependencyEdge, DependencyKind, PackageNode} from '#lib/types.js';
import { resolveDependency } from '#lib/parser/resolve.js';

export interface EdgesResult {
    edges: DependencyEdge[];
    warnings: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildEdges(packages: Record<string, unknown>, nodes: Record<string, PackageNode[]>): EdgesResult {
    const packageNodes = Object.values(nodes).flat();
    const installed = new Set(packageNodes.map((node) => node.id));
    const edges: DependencyEdge[] = [];
    const warnings: string[] = [];

    // Add a form to the list of edges
    function addForm(consumerId: string, field: unknown, kind: DependencyKind) {
        if (!isObject(field)) return;

        for (const [name, range] of Object.entries(field)) {
            const target = resolveDependency(installed, consumerId, name);

            if (target === null) continue;

            edges.push({
                source: consumerId,
                target,
                kind,
                requestedRange: typeof range === 'string' ? range : undefined
            });
        }
    }
    
        for (const node of packageNodes) {
            const descriptor = packages[node.id];

            if (!isObject(descriptor)) continue;

            addForm(node.id, descriptor.dependencies, 'runtime');
        }

        return { edges, warnings };
}
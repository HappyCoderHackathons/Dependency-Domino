import type { DependencyEdge, DependencyKind, PackageNode} from '#lib/types.js';
import { resolveDependency } from '#lib/parser/resolve.js';

export interface EdgesResult {
    edges: DependencyEdge[];
    warnings: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function consumerLabel(consumerId: string): string {
    return consumerId === '' ? 'root': consumerId;
}

export function buildEdges(packages: Record<string, unknown>, nodes: Record<string, PackageNode[]>): EdgesResult {
    const packageNodes = Object.values(nodes).flat();
    const installed = new Set(packageNodes.map((node) => node.id));
    const edges: DependencyEdge[] = [];
    const warnings: string[] = [];

    const seen = new Set<string>();

    function addEdge(edge: DependencyEdge) {
        const key = [edge.source, edge.target, edge.kind].join('\u0000');
        if (seen.has(key)) return;
        seen.add(key);
        edges.push(edge);
    }

    // Add a form to the list of edges
    function addForm(consumerId: string, field: unknown, kind: DependencyKind) {
        if (!isObject(field)) return;

        for (const [name, range] of Object.entries(field)) {
            const target = resolveDependency(installed, consumerId, name);

            if (target === null) {
                warnings.push(`Could not resolve "${name}" required by ${consumerLabel(consumerId)}`);
                continue;
            }

            if (kind === 'optional') {
                const targetNode = packageNodes.find((node) => node.id === target);
                if (targetNode && !targetNode.optional) {
                    warnings.push(`Optional dependency "${name}" required by ${consumerLabel(consumerId)} is not marked as optional in its package.json`);
                }
            }

            addEdge({
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

            addForm(node.id, descriptor.optionalDependencies, 'optional');

            if (node.id === '') addForm(node.id, descriptor.devDependencies, 'development');
        }

        return { edges, warnings };
}

export function markDirect(nodes: PackageNode[], edges: DependencyEdge[]): PackageNode[] {t
    const directTargets = new Set(edges.filter((edge) => edge.source === '').map((edge) => edge.target));

    return nodes.map((node) => ({
        ...node,
        direct: directTargets.has(node.id)
    }));
}
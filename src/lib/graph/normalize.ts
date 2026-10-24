import type { ElementDefinition } from 'cytoscape';
import type { DependencyEdge } from '#lib/types.js';

// Cytoscape rejects "" as an id, so the root uses a stand-in on the canvas.
export const ROOT_ID = '__root__';

export function toCyId(id: string): string {
    if (id === '') { return ROOT_ID; }
    return id;
}

export function fromCyId(id: string): string {
    if (id === ROOT_ID) { return ''; }
	return id;
}

export function toElements(graph: DependencyEdge[]): ElementDefinition[] {
    const nodes: ElementDefinition[] = graph.nodes.map((node) => ({
        group: 'nodes',
        data: {
            id: toCyId(node.id),
            label: `${node.name}@${node.version}`,
            name: node.name,
            version: node.version,
        },
        classes: [node.direct ? 'direct' : 'indirect']
	}));

    const edges: ElementDefinition[] = graph.edges.map((edge) => ({
        group: 'edges',
        data: {
            id: `${toCyId(edge.source)}->${toCyId(edge.target)}:${edge.kind}`,
            source: toCyId(edge.source),
            target: toCyId(edge.target),
            kind: edge.kind,
        },
        classes: [edge.kind]
    }));

    return [...nodes, ...edges];
}

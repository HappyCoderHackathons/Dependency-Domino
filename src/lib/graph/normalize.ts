import type { ElementDefinition } from 'cytoscape';
import type { DependencyGraph, PackageNode } from '#lib/types.js';

// Cytoscape rejects "" as an id, so the root uses a stand-in on the canvas.
export const ROOT_ID = '__root__';

export function toCyId(id: string): string {
	return id === '' ? ROOT_ID : id;
}

export function fromCyId(id: string): string {
	return id === ROOT_ID ? '' : id;
}

function nodeClasses(node: PackageNode): string[] {
	const classes: string[] = [];
	if (node.id === '') classes.push('root');
	if (node.devOnly) classes.push('dev');
	if (node.optional) classes.push('optional');
	if (node.source === 'link') classes.push('link');
	if (node.direct) classes.push('direct');
	if (node.advisoryIds.length > 0) classes.push('advisory');
	return classes;
}

export function toElements(graph: DependencyGraph): ElementDefinition[] {
	const nodes: ElementDefinition[] = graph.nodes.map((node) => ({
		group: 'nodes',
		data: {
			id: toCyId(node.id),
			label: node.version ? `${node.name}@${node.version}` : node.name,
			name: node.name,
			version: node.version
		},
		classes: nodeClasses(node)
	}));

	const edges: ElementDefinition[] = graph.edges.map((edge) => ({
		group: 'edges',
		data: {
			id: `${toCyId(edge.source)}->${toCyId(edge.target)}:${edge.kind}`,
			source: toCyId(edge.source),
			target: toCyId(edge.target),
			kind: edge.kind
		},
		classes: [edge.kind]
	}));

	return [...nodes, ...edges];
}

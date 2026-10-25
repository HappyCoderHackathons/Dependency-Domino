import type { ElementDefinition } from 'cytoscape';
import type { DependencyGraph, PackageNode } from '#lib/types.js';

// Cytoscape rejects "" as an id, so the root uses a stand-in on the canvas.
export const ROOT_ID = '__root__';

export type LabelMode = 'name-version' | 'name';

/** Version ambiguity is determined across the full graph, including copies outside the current view. */
export function namesWithMultipleVersions(graph: DependencyGraph): Set<string> {
	const versions = new Map<string, string | null>();
	const ambiguous = new Set<string>();
	for (const node of graph.nodes) {
		if (node.id === '') continue;
		if (versions.has(node.name) && versions.get(node.name) !== node.version) ambiguous.add(node.name);
		else versions.set(node.name, node.version);
	}
	return ambiguous;
}

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
	if (node.workspacePath) classes.push('workspace');
	if (node.direct) classes.push('direct');
	if (node.source === 'other' && node.id !== '') classes.push('unsupported');
	if (node.hasInstallScript === true) classes.push('install-script');
	if (node.advisoryIds.length > 0) classes.push('advisory');
	return classes;
}

export function nodeLabel(
	node: PackageNode,
	mode: LabelMode = 'name-version',
	ambiguousNames: ReadonlySet<string> = new Set()
): string {
	const showVersion = mode === 'name-version' || ambiguousNames.has(node.name);
	const label = showVersion && node.version ? `${node.name}@${node.version}` : node.name;
	return node.advisoryIds.length > 0 ? `OSV: ${label} (${node.advisoryIds.length})` : label;
}

export function toElements(graph: DependencyGraph, mode: LabelMode = 'name-version'): ElementDefinition[] {
	const ambiguousNames = namesWithMultipleVersions(graph);
	const nodes: ElementDefinition[] = graph.nodes.map((node) => ({
		group: 'nodes',
		data: {
			id: toCyId(node.id),
			label: nodeLabel(node, mode, ambiguousNames),
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

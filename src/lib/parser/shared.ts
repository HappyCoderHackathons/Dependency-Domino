import { parseAllDocuments, parseDocument } from 'yaml';
import { MAX_LOCKFILE_BYTES } from '#lib/parser/lockfile.js';
import type { DependencyEdge, DependencyGraph, DependencyKind, PackageNode, ParseResult } from '#lib/types.js';

export function object(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function record(value: unknown): Record<string, unknown> {
	return object(value) ? value : {};
}

export function failure(
	message: string,
	code: Extract<ParseResult, { ok: false }>['code'] = 'invalid_lockfile'
): Extract<ParseResult, { ok: false }> {
	return { ok: false, code, message };
}

export function tooLarge(text: string): boolean {
	return text.length > MAX_LOCKFILE_BYTES || new TextEncoder().encode(text).length > MAX_LOCKFILE_BYTES;
}

export function readYaml(text: string): unknown {
	const doc = parseDocument(text, { uniqueKeys: true });
	if (doc.errors.length > 0) throw new Error('Invalid YAML');
	return doc.toJS({ maxAliasCount: 50 });
}

export function readYamlDocuments(text: string): unknown[] {
	return parseAllDocuments(text, { uniqueKeys: true }).map((doc) => {
		if (doc.errors.length > 0) throw new Error('Invalid YAML');
		return doc.toJS({ maxAliasCount: 50 });
	});
}

export function identity(locator: string): { name: string; version: string } | null {
	const match = locator.match(/^(@[^/]+\/[^@]+|[^@/]+)@(?:npm:)?(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)(?:\(|_|$)/);
	return match ? { name: match[1], version: match[2] } : null;
}

export function packageNode(
	id: string,
	name: string,
	version: string | null,
	source: PackageNode['source']
): PackageNode {
	return { id, name, version, source, direct: false, devOnly: false, optional: false, advisoryIds: [] };
}

export class GraphBuilder {
	graph: DependencyGraph = { nodes: [packageNode('', 'root', null, 'unknown')], edges: [], warnings: [] };
	private nodes = new Map<string, PackageNode>([['', this.graph.nodes[0]]]);
	private edgeKeys = new Set<string>();

	add(node: PackageNode) {
		if (this.nodes.has(node.id)) return;
		this.nodes.set(node.id, node);
		this.graph.nodes.push(node);
	}

	edge(
		source: string,
		target: string | null,
		kind: DependencyKind,
		name: string,
		requestedRange?: string,
		optionalPeer = false
	) {
		if (target === null || !this.nodes.has(target)) {
			if (!optionalPeer) this.graph.warnings.push(`Could not resolve "${name}" required by ${source || 'root'}`);
			return;
		}
		const key = JSON.stringify([source, target, kind]);
		if (this.edgeKeys.has(key)) return;
		this.edgeKeys.add(key);
		this.graph.edges.push({ source, target, kind, requestedRange });
	}

	finish(): ParseResult {
		const adjacency = new Map<string, DependencyEdge[]>();
		for (const edge of this.graph.edges) {
			const list = adjacency.get(edge.source) ?? [];
			list.push(edge);
			adjacency.set(edge.source, list);
			if (edge.source === '' && edge.target !== '') this.nodes.get(edge.target)!.direct = true;
		}
		const reachable = (includeDev: boolean) => {
			const seen = new Set(['']);
			const queue = [''];
			for (let i = 0; i < queue.length; i++) {
				for (const edge of adjacency.get(queue[i]) ?? []) {
					if ((!includeDev && edge.kind === 'development') || seen.has(edge.target)) continue;
					seen.add(edge.target);
					queue.push(edge.target);
				}
			}
			return seen;
		};
		const all = reachable(true);
		const prod = reachable(false);
		for (const node of this.graph.nodes) node.devOnly = all.has(node.id) && !prod.has(node.id);
		return { ok: true, graph: this.graph };
	}
}

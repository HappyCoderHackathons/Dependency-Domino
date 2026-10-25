import type { DependencyEdge, DependencyKind, PackageNode } from '#lib/types.js';
import { resolveDependency } from '#lib/parser/resolve.js';

const UNUSUAL_PREFIXES = ['npm:', 'workspace:', 'file:', 'link:', 'git', 'github:', 'http'];

export interface EdgesResult {
	edges: DependencyEdge[];
	warnings: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function consumerLabel(consumerId: string): string {
	return consumerId === '' ? 'root' : consumerId;
}

function isUnusualRange(range: string): boolean {
	return UNUSUAL_PREFIXES.some((prefix) => range.startsWith(prefix));
}

function optionalPeers(meta: unknown): Set<string> {
	if (!isObject(meta)) return new Set();
	return new Set(Object.keys(meta).filter((name) => isObject(meta[name]) && meta[name].optional === true));
}

export function buildEdges(packages: Record<string, unknown>, nodes: PackageNode[]): EdgesResult {
	const installed = new Set(nodes.map((node) => node.id));
	const edges: DependencyEdge[] = [];
	const warnings: string[] = [];
	const seen = new Set<string>();

	function addEdge(edge: DependencyEdge) {
		const key = [edge.source, edge.target, edge.kind].join('\u0000');
		if (seen.has(key)) return;
		seen.add(key);
		edges.push(edge);
	}

	function addFrom(
		consumerId: string,
		field: unknown,
		kind: DependencyKind,
		optionalNames: ReadonlySet<string> = new Set(),
		resolutionPath = consumerId
	) {
		if (!isObject(field)) return;

		for (const [name, range] of Object.entries(field)) {
			const target = resolveDependency(installed, resolutionPath, name);
			if (target === null && optionalNames.has(name)) continue;

			const consumer = consumerLabel(consumerId);
			if (typeof range === 'string' && isUnusualRange(range)) {
				warnings.push(`Unusual dependency range "${range}" required by ${consumer}`);
			}

			if (target === null) {
				warnings.push(
					kind === 'optional'
						? `Optional dependency "${name}" required by ${consumer} is not installed`
						: `Could not resolve "${name}" required by ${consumer}`
				);
				continue;
			}

			addEdge({ source: consumerId, target, kind, requestedRange: typeof range === 'string' ? range : undefined });
		}
	}

	for (const node of nodes) {
		const descriptor = packages[node.workspacePath ?? node.id];
		if (!isObject(descriptor)) continue;

		if (descriptor.link === true && !node.workspacePath) {
			warnings.push(`${node.id} links to ${String(descriptor.resolved)}. Its dependencies are not traced.`);
		}

		const path = node.workspacePath ?? node.id;
		addFrom(node.id, descriptor.dependencies, 'runtime', new Set(), path);
		addFrom(node.id, descriptor.optionalDependencies, 'optional', new Set(), path);
		addFrom(node.id, descriptor.peerDependencies, 'peer', optionalPeers(descriptor.peerDependenciesMeta), path);
		if (node.id === '' || node.workspacePath)
			addFrom(node.id, descriptor.devDependencies, 'development', new Set(), path);
	}
	const byConsumer = new Map<string, string[]>();
	for (const edge of edges) {
		const targets = byConsumer.get(edge.source) ?? [];
		targets.push(edge.target);
		byConsumer.set(edge.source, targets);
	}
	const reachable = new Set(['']);
	const queue = [''];
	for (let i = 0; i < queue.length; i++) {
		for (const target of byConsumer.get(queue[i]) ?? []) {
			if (!reachable.has(target)) {
				reachable.add(target);
				queue.push(target);
			}
		}
	}
	for (const node of nodes) {
		if (node.workspacePath && !reachable.has(node.id)) {
			warnings.push(
				`Project member "${node.workspacePath}" has no recorded dependency path from root. No root membership edge is inferred.`
			);
		}
	}

	return { edges, warnings };
}

export function markDirect(nodes: PackageNode[], edges: DependencyEdge[]): PackageNode[] {
	const directTargets = new Set(edges.filter((edge) => edge.source === '').map((edge) => edge.target));
	return nodes.map((node) => ({ ...node, direct: directTargets.has(node.id) }));
}

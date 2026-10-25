import type { DependencyGraph, ImpactResult } from '#lib/types.js';
import { impactMetrics } from '#lib/graph/metrics.js';

export interface CardPackage {
	name: string;
	version: string | null;
}
export interface SummaryCard {
	project: string;
	origins: CardPackage[];
	affected: number;
	hopsToRoot: number | null;
	path: (CardPackage | null)[];
	pathHops: number | null;
	omittedPackages: number;
}

/** Snapshot validated graph values before asynchronous font loading and PNG encoding. */
export function buildSummaryCard(graph: DependencyGraph, impact: ImpactResult, pathIndex = 0): SummaryCard {
	const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
	function copy(id: string): CardPackage {
		const node = nodes.get(id);
		if (!node) throw new Error('The result references a package missing from the graph.');
		return { name: node.name, version: node.version };
	}
	const ids = impact.originIds ?? [impact.originId];
	if (!ids.length) throw new Error('A summary requires an origin.');
	const path = (impact.samplePaths[pathIndex] ?? impact.samplePaths[0] ?? []).map(copy);
	const omittedPackages = path.length > 5 ? path.length - 4 : 0;
	const metrics = impactMetrics(graph, impact);
	return {
		project: nodes.get('')?.name ?? 'Project',
		origins: ids.map(copy),
		affected: metrics.affectedInstances,
		hopsToRoot: metrics.shortestDistanceToRoot,
		path: omittedPackages ? [...path.slice(0, 2), null, ...path.slice(-2)] : path,
		pathHops: path.length ? path.length - 1 : null,
		omittedPackages
	};
}

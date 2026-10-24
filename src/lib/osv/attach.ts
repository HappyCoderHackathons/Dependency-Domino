import type { DependencyGraph, VulnerabilityResponse } from '#lib/types.js';

/** Returns a new graph with advisoryIds set on every node matching a result's exact name@version. */
export function attachAdvisories(graph: DependencyGraph, response: VulnerabilityResponse): DependencyGraph {
	const idsByKey = new Map<string, string[]>();
	for (const result of response.results) idsByKey.set(`${result.name}@${result.version}`, result.advisoryIds);

	return {
		...graph,
		nodes: graph.nodes.map((node) => {
			const ids = node.version === null ? undefined : idsByKey.get(`${node.name}@${node.version}`);
			return ids ? { ...node, advisoryIds: ids } : node;
		})
	};
}

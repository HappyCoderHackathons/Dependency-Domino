import type { DependencyGraph, VulnerabilityQuery } from '#lib/types.js';

// Unique registry name/version pairs worth checking against OSV.
export function advisoryQuery(graph: DependencyGraph): VulnerabilityQuery['packages'] {
	const seen = new Set<string>();
	const packages: VulnerabilityQuery['packages'] = [];

	for (const node of graph.nodes) {
		if (node.source === 'registry' && node.version !== null) {
			const key = `${node.name}@${node.version}`;
			if (!seen.has(key)) {
				seen.add(key);
				packages.push({ name: node.name, version: node.version });
			}
		}
	}
	return packages;
}

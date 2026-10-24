import type { DependencyGraph } from '#lib/types.js';

export interface GraphMetrics {
	installedInstances: number;
	/** Distinct name/version pairs, with null retained as an unknown version. */
	distinctPackageVersions: number;
	directDependencies: number;
	warningCount: number;
	/** Missing dependency declarations, not edges in the resolved graph. */
	unresolvedDependencies: number;
	otherWarnings: number;
}

/** Package totals exclude the project root. Warnings come from the parser, not OSV. */
export function graphMetrics(graph: DependencyGraph): GraphMetrics {
	const packages = graph.nodes.filter((node) => node.id !== '');
	const versions = new Set(packages.map((node) => JSON.stringify([node.name, node.version])));
	// The parser currently exposes warnings as strings rather than structured diagnostics.
	const unresolvedDependencies = graph.warnings.filter(
		(warning) =>
			warning.startsWith('Could not resolve "') ||
			(warning.startsWith('Optional dependency "') && warning.endsWith(' is not installed'))
	).length;

	return {
		installedInstances: packages.length,
		distinctPackageVersions: versions.size,
		directDependencies: packages.filter((node) => node.direct).length,
		warningCount: graph.warnings.length,
		unresolvedDependencies,
		otherWarnings: graph.warnings.length - unresolvedDependencies
	};
}

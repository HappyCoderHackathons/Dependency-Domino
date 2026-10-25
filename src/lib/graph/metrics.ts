import type { DependencyGraph, ImpactResult } from '#lib/types.js';

export interface GraphMetrics {
	installedInstances: number;
	installScriptInstances: number;
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
		installScriptInstances: packages.filter((node) => node.hasInstallScript === true).length,
		distinctPackageVersions: versions.size,
		directDependencies: packages.filter((node) => node.direct).length,
		warningCount: graph.warnings.length,
		unresolvedDependencies,
		otherWarnings: graph.warnings.length - unresolvedDependencies
	};
}

export interface ImpactMetrics {
	/** Installed ancestors only, excluding the origin and project root. */
	affectedInstances: number;
	developmentOnlyInstances: number;
	/** Not marked dev-only in the lockfile; this does not establish runtime execution. */
	otherInstances: number;
	/** Number of dependency hops to the root, or null when it is unreachable. */
	shortestDistanceToRoot: number | null;
}

/** Summarizes a simulation result produced for this graph. */
export function impactMetrics(graph: DependencyGraph, impact: ImpactResult): ImpactMetrics {
	const ancestors = new Set(impact.ancestorIds);
	const origins = new Set(impact.originIds ?? [impact.originId]);
	const affected = graph.nodes.filter((node) => node.id !== '' && !origins.has(node.id) && ancestors.has(node.id));
	const developmentOnlyInstances = affected.filter((node) => node.devOnly).length;
	const rootLayer = impact.layers.findIndex((layer) => layer.includes(''));

	return {
		affectedInstances: affected.length,
		developmentOnlyInstances,
		otherInstances: affected.length - developmentOnlyInstances,
		shortestDistanceToRoot: rootLayer === -1 ? null : rootLayer
	};
}

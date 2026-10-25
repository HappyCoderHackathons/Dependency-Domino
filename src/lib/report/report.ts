import { graphMetrics, impactMetrics } from '#lib/graph/metrics.js';
import type { GraphMetrics, ImpactMetrics } from '#lib/graph/metrics.js';
import type { OsvStatus } from '#lib/osv/status.js';
import type { DependencyGraph, ImpactResult, PackageNode } from '#lib/types.js';

export const REPORT_DISCLAIMER =
	'This is a hypothetical dependency exposure model, not a vulnerability finding or proof of exploitability or code execution. ' +
	'Advisory IDs are separate external matches for package versions and do not establish that vulnerable code is used.';

export interface SimulationReport {
	schemaVersion: 1;
	generatedAt: string;
	sourceLabel: string | null;
	disclaimer: string;
	advisoryLookupStatus: OsvStatus | 'not_provided';
	origins: PackageNode[];
	/** First origin, retained for compatibility with schema version 1 consumers. */
	origin: PackageNode;
	/** Includes the project root when reached; impact metrics exclude it. */
	ancestors: PackageNode[];
	samplePaths: PackageNode[][];
	metrics: { graph: GraphMetrics; impact: ImpactMetrics };
	warnings: string[];
}

export interface ReportOptions {
	generatedAt: string;
	sourceLabel?: string | null;
	advisoryLookupStatus?: OsvStatus;
	/** May include lookup warnings; graph metrics still count parser warnings only. */
	warnings?: readonly string[];
}

/** Copies a simulation into a stable snapshot. The caller supplies time to keep this pure. */
export function buildSimulationReport(
	graph: DependencyGraph,
	impact: ImpactResult,
	options: ReportOptions
): SimulationReport {
	const generatedAt = new Date(options.generatedAt).toISOString();
	const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
	const copy = (id: string): PackageNode => {
		const node = nodes.get(id);
		if (!node) throw new Error('The simulation references a package absent from this graph. Run the simulation again.');
		return { ...node, advisoryIds: [...node.advisoryIds] };
	};
	return {
		schemaVersion: 1,
		generatedAt,
		sourceLabel: options.sourceLabel ?? null,
		disclaimer: REPORT_DISCLAIMER,
		advisoryLookupStatus: options.advisoryLookupStatus ?? 'not_provided',
		origins: (impact.originIds ?? [impact.originId]).map(copy),
		origin: copy(impact.originId),
		ancestors: [...new Set(impact.ancestorIds)]
			.filter((id) => !(impact.originIds ?? [impact.originId]).includes(id))
			.map(copy),
		samplePaths: impact.samplePaths.map((path) => path.map(copy)),
		metrics: { graph: graphMetrics(graph), impact: impactMetrics(graph, impact) },
		warnings: [...new Set([...graph.warnings, ...(options.warnings ?? [])])]
	};
}

export function reportToJson(report: SimulationReport): string {
	return JSON.stringify(report, null, 2) + '\n';
}

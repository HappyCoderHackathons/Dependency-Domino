export type DependencyKind = 'runtime' | 'development' | 'optional';

export interface PackageNode {
	/** Exact lockfile package path, `""` for the root project */
	id: string;
	name: string;
	version: string | null;
	direct: boolean;
	devOnly: boolean;
	optional: boolean;
	source: 'registry' | 'link' | 'other' | 'unknown';
	advisoryIds: string[];
}

export interface DependencyEdge {
	/** Consumer package instance */
	source: string;
	/** Required package instance */
	target: string;
	kind: DependencyKind;
	requestedRange?: string;
}

export interface DependencyGraph {
	nodes: PackageNode[];
	edges: DependencyEdge[];
	warnings: string[];
}

export type ParseErrorCode = 'too_large' | 'invalid_json' | 'not_object' | 'unsupported_version' | 'missing_packages';

export type ParseResult = { ok: true; graph: DependencyGraph } | { ok: false; code: ParseErrorCode; message: string };

export interface ImpactResult {
	originId: string;
	/** Unique package instances depending on origin */
	ancestorIds: string[];
	/** Breadth-first layers for animation */
	layers: string[][];
	/** Root-to-origin explanatory paths */
	samplePaths: string[][];
}

export interface VulnerabilityQuery {
	packages: { name: string; version: string }[];
}

export interface VulnerabilityResponse {
	status: 'complete' | 'partial' | 'unavailable';
	results: { name: string; version: string; advisoryIds: string[] }[];
	warnings: string[];
}

export interface AdvisoryDetails {
	id: string;
	summary: string | null;
	/** ISO timestamp from OSV, when present */
	published: string | null;
	/** Plain label such as "HIGH" or a CVSS vector, only when OSV provides one */
	severity: string | null;
	aliases: string[];
}

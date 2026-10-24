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

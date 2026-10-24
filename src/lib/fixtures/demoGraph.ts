// src/lib/fixtures/demoGraph.ts
// Hand-built demo graph with hypothetical package names. It follows the plan's model:
// node id = lockfile path, edges point consumer -> dependency.
// Swap it for a real lockfile run through the parser once #25 lands.

import type { DependencyEdge, DependencyGraph, PackageNode } from '#lib/types.ts';

const node = (
	id: string,
	name: string,
	version: string | null,
	overrides: Partial<PackageNode> = {}
): PackageNode => ({
	id,
	name,
	version,
	direct: false,
	devOnly: false,
	optional: false,
	source: 'registry',
	advisoryIds: [],
	...overrides
});

const edge = (
	source: string,
	target: string,
	kind: DependencyEdge['kind'] = 'runtime'
): DependencyEdge => ({ source, target, kind });

const nodes: PackageNode[] = [
	node('', 'demo-app', '1.0.0', { source: 'other' }),

	// Direct dependencies
	node('node_modules/ui-kit', 'ui-kit', '3.2.0', { direct: true }),
	node('node_modules/reporting', 'reporting', '1.8.0', { direct: true }),
	node('node_modules/test-runner', 'test-runner', '5.1.0', { direct: true, devOnly: true }),

	// ui-kit branch
	node('node_modules/component-core', 'component-core', '3.2.0'),
	node('node_modules/theme-engine', 'theme-engine', '2.4.1'),
	node('node_modules/color-math', 'color-math', '1.1.0'),

	// reporting branch
	node('node_modules/chart-lib', 'chart-lib', '4.0.2'),
	node('node_modules/csv-writer', 'csv-writer', '0.9.3'),
	node('node_modules/string-pad', 'string-pad', '1.0.1'),
	node('node_modules/d3-scale-lite', 'd3-scale-lite', '2.0.0'),

	// Same package name, two installed instances
	node('node_modules/helper-lib', 'helper-lib', '2.0.0'),
	node('node_modules/reporting/node_modules/helper-lib', 'helper-lib', '1.4.0'),

	// Deep utility every branch eventually reaches (the blast-radius moment)
	node('node_modules/tiny-utils', 'tiny-utils', '0.3.7'),

	// Dev-only branch
	node('node_modules/assert-kit', 'assert-kit', '2.2.0', { devOnly: true }),
	node('node_modules/deep-equal-lite', 'deep-equal-lite', '1.0.4', { devOnly: true })
];

const edges: DependencyEdge[] = [
	edge('', 'node_modules/ui-kit'),
	edge('', 'node_modules/reporting'),
	edge('', 'node_modules/test-runner', 'development'),

	edge('node_modules/ui-kit', 'node_modules/component-core'),
	edge('node_modules/ui-kit', 'node_modules/theme-engine'),
	edge('node_modules/component-core', 'node_modules/helper-lib'),
	edge('node_modules/theme-engine', 'node_modules/color-math'),
	edge('node_modules/color-math', 'node_modules/tiny-utils'),

	edge('node_modules/reporting', 'node_modules/chart-lib'),
	edge('node_modules/reporting', 'node_modules/csv-writer'),
	edge('node_modules/reporting', 'node_modules/reporting/node_modules/helper-lib'),
	edge('node_modules/chart-lib', 'node_modules/helper-lib'),
	edge('node_modules/chart-lib', 'node_modules/d3-scale-lite'),
	edge('node_modules/csv-writer', 'node_modules/string-pad'),

	edge('node_modules/helper-lib', 'node_modules/tiny-utils'),
	edge('node_modules/reporting/node_modules/helper-lib', 'node_modules/tiny-utils'),

	edge('node_modules/test-runner', 'node_modules/assert-kit', 'development'),
	edge('node_modules/assert-kit', 'node_modules/deep-equal-lite', 'development'),
	edge('node_modules/assert-kit', 'node_modules/tiny-utils', 'development')
];

export const demoGraph: DependencyGraph = { nodes, edges, warnings: [] };
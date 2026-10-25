import { describe, expect, it } from 'vitest';
import { graphMetrics, impactMetrics } from '#lib/graph/metrics.js';
import { simulateCompromise } from '#lib/graph/impact.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import type { DependencyGraph } from '#lib/types.js';

function graphFor(packages: Record<string, unknown>): DependencyGraph {
	const result = parseLockfile(JSON.stringify({ lockfileVersion: 3, packages }));
	if (!result.ok) throw new Error(result.message);
	return result.graph;
}

describe('graphMetrics', () => {
	it('counts installed copies separately, distinct versions once, and all direct dependency kinds', () => {
		const graph = graphFor({
			'': {
				name: 'project',
				dependencies: { a: '1.0.0', x: '1.0.0' },
				devDependencies: { dev: '1.0.0' },
				optionalDependencies: { opt: '1.0.0' },
				peerDependencies: { peer: '1.0.0', x: '^1.0.0' }
			},
			'node_modules/a': { version: '1.0.0', hasInstallScript: true },
			'node_modules/x': { version: '1.0.0' },
			'node_modules/a/node_modules/x': { version: '1.0.0' },
			'node_modules/a/node_modules/b/node_modules/x': { version: '2.0.0' },
			'node_modules/dev': { version: '1.0.0', dev: true },
			'node_modules/opt': { version: '1.0.0', optional: true },
			'node_modules/peer': { version: '1.0.0' }
		});
		const before = structuredClone(graph);
		expect(graphMetrics(graph)).toEqual({
			installedInstances: 7,
			installScriptInstances: 1,
			nonDefaultHostInstances: 0,
			distinctPackageVersions: 6,
			directDependencies: 5,
			warningCount: 0,
			unresolvedDependencies: 0,
			otherWarnings: 0
		});
		expect(graph).toEqual(before);
	});

	it('keeps unknown versions distinct from known versions while excluding the root', () => {
		const graph = graphFor({
			'': { name: 'x', version: '1.0.0' },
			'node_modules/x': {},
			'node_modules/a/node_modules/x': {},
			'node_modules/b/node_modules/x': { version: '1.0.0' }
		});
		expect(graphMetrics(graph)).toMatchObject({ installedInstances: 3, distinctPackageVersions: 2 });
	});

	it('separates missing dependency warnings from alias, link, and other parser caveats', () => {
		const graph = graphFor({
			'': {
				dependencies: { missing: '1.0.0', alias: 'npm:real@1.0.0' },
				optionalDependencies: { absent: '1.0.0' },
				peerDependencies: { required: '1.0.0', optional: '1.0.0' },
				peerDependenciesMeta: { optional: { optional: true } }
			},
			'node_modules/alias': { name: 'real', version: '1.0.0' },
			'node_modules/local': { link: true, resolved: 'packages/local' }
		});
		expect(graphMetrics(graph)).toMatchObject({ warningCount: 5, unresolvedDependencies: 3, otherWarnings: 2 });
	});

	it.each([graphFor({ '': { name: 'project' } }), { nodes: [], edges: [], warnings: [] }])(
		'returns zero totals for root-only or empty graphs',
		(graph) => {
			expect(graphMetrics(graph)).toEqual({
				installedInstances: 0,
				installScriptInstances: 0,
				nonDefaultHostInstances: 0,
				distinctPackageVersions: 0,
				directDependencies: 0,
				warningCount: 0,
				unresolvedDependencies: 0,
				otherWarnings: 0
			});
		}
	);
});

describe('impactMetrics', () => {
	it('counts affected installed instances by development flag and uses the shortest root distance', () => {
		const graph = graphFor({
			'': { dependencies: { a: '1.0.0', shared: '1.0.0' }, devDependencies: { dev: '1.0.0' } },
			'node_modules/a': { version: '1.0.0', dependencies: { shared: '1.0.0' } },
			'node_modules/shared': { version: '1.0.0' },
			'node_modules/dev': { version: '1.0.0', dev: true, dependencies: { shared: '1.0.0' } }
		});
		const impact = simulateCompromise(graph, 'node_modules/shared');
		const before = structuredClone({ graph, impact });
		expect(impactMetrics(graph, impact)).toEqual({
			affectedInstances: 2,
			developmentOnlyInstances: 1,
			otherInstances: 1,
			shortestDistanceToRoot: 1
		});
		expect({ graph, impact }).toEqual(before);
	});

	it('counts duplicate package instances separately and does not classify optional flags as dev-only', () => {
		const graph = graphFor({
			'': { dependencies: { x: '1.0.0', a: '1.0.0' } },
			'node_modules/a': { dependencies: { x: '1.0.0' } },
			'node_modules/x': { version: '1.0.0', optional: true, dependencies: { shared: '1.0.0' } },
			'node_modules/a/node_modules/x': {
				version: '1.0.0',
				devOptional: true,
				dependencies: { shared: '1.0.0' }
			},
			'node_modules/shared': { version: '1.0.0', dev: true }
		});
		expect(impactMetrics(graph, simulateCompromise(graph, 'node_modules/shared'))).toEqual({
			affectedInstances: 3,
			developmentOnlyInstances: 0,
			otherInstances: 3,
			shortestDistanceToRoot: 2
		});
	});

	it('returns null for an unreachable root while still counting affected packages', () => {
		const graph = graphFor({
			'': {},
			'node_modules/a': { dev: true, dependencies: { shared: '1.0.0' } },
			'node_modules/shared': {}
		});
		expect(impactMetrics(graph, simulateCompromise(graph, 'node_modules/shared'))).toEqual({
			affectedInstances: 1,
			developmentOnlyInstances: 1,
			otherInstances: 0,
			shortestDistanceToRoot: null
		});
	});

	it('returns zero affected instances and distance zero for the root origin', () => {
		const graph = graphFor({ '': { dependencies: { a: '1.0.0' } }, 'node_modules/a': {} });
		expect(impactMetrics(graph, simulateCompromise(graph, ''))).toEqual({
			affectedInstances: 0,
			developmentOnlyInstances: 0,
			otherInstances: 0,
			shortestDistanceToRoot: 0
		});
	});

	it('handles cycles without counting the origin or repeated ancestors', () => {
		const graph = graphFor({
			'': { dependencies: { a: '1.0.0' } },
			'node_modules/a': { dependencies: { b: '1.0.0' } },
			'node_modules/b': { dependencies: { a: '1.0.0' } }
		});
		expect(impactMetrics(graph, simulateCompromise(graph, 'node_modules/a'))).toEqual({
			affectedInstances: 1,
			developmentOnlyInstances: 0,
			otherInstances: 1,
			shortestDistanceToRoot: 1
		});
	});
});

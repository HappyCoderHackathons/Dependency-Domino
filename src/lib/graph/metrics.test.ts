import { describe, expect, it } from 'vitest';
import { graphMetrics } from '#lib/graph/metrics.js';
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
			'node_modules/a': { version: '1.0.0' },
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
				distinctPackageVersions: 0,
				directDependencies: 0,
				warningCount: 0,
				unresolvedDependencies: 0,
				otherWarnings: 0
			});
		}
	);
});

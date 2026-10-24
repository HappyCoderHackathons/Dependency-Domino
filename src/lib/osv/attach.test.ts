import { describe, expect, it } from 'vitest';
import { attachAdvisories } from '#lib/osv/attach.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import duplicateVersions from '#lib/fixtures/edge/duplicate-versions.json';
import type { DependencyGraph, VulnerabilityResponse } from '#lib/types.js';

function graphOf(packages: Record<string, unknown>): DependencyGraph {
	const result = parseLockfile(JSON.stringify({ lockfileVersion: 3, packages }));
	if (!result.ok) throw new Error(result.message);
	return result.graph;
}

const response = (results: VulnerabilityResponse['results']): VulnerabilityResponse => ({
	status: 'complete',
	results,
	warnings: []
});

const idsById = (graph: DependencyGraph) => Object.fromEntries(graph.nodes.map((node) => [node.id, node.advisoryIds]));

describe('attachAdvisories', () => {
	it('sets ids on every installed copy with the same name and version', () => {
		const graph = graphOf({
			'': { dependencies: { a: '1.0.0', x: '1.0.0' } },
			'node_modules/a': { version: '1.0.0', dependencies: { x: '1.0.0' } },
			'node_modules/a/node_modules/x': { version: '1.0.0' },
			'node_modules/x': { version: '1.0.0' }
		});
		const attached = attachAdvisories(graph, response([{ name: 'x', version: '1.0.0', advisoryIds: ['GHSA-1'] }]));
		expect(idsById(attached)).toEqual({
			'': [],
			'node_modules/a': [],
			'node_modules/a/node_modules/x': ['GHSA-1'],
			'node_modules/x': ['GHSA-1']
		});
	});

	it('never applies a result for 1.0.0 to a node at 2.0.0', () => {
		const graph = graphOf(duplicateVersions.packages);
		const attached = attachAdvisories(graph, response([{ name: 'x', version: '1.0.0', advisoryIds: ['GHSA-1'] }]));
		expect(idsById(attached)['node_modules/x']).toEqual(['GHSA-1']);
		expect(idsById(attached)['node_modules/a/node_modules/x']).toEqual([]);
	});

	it('leaves nodes without a result unchanged and does not mutate the input graph', () => {
		const graph = graphOf(duplicateVersions.packages);
		const before = structuredClone(graph);
		const attached = attachAdvisories(graph, response([{ name: 'a', version: '1.0.0', advisoryIds: ['GHSA-2'] }]));
		expect(graph).toEqual(before);
		expect(attached).not.toBe(graph);
		expect(attached.nodes.find((node) => node.id === 'node_modules/x')).toBe(
			graph.nodes.find((node) => node.id === 'node_modules/x')
		);
		expect(attached.edges).toBe(graph.edges);
	});
});

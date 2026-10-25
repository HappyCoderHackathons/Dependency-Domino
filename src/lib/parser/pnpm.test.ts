import { describe, expect, it } from 'vitest';
import { parsePnpmLockfile } from '#lib/parser/pnpm.js';
import { simulateCompromise } from '#lib/graph/impact.js';
import { advisoryQuery } from '#lib/osv/query.js';

const v9 = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      app: {specifier: ^1, version: 1.0.0(peer@2.0.0)}
      alias: {specifier: 'npm:@scope/lib@1', version: '@scope/lib@1.0.0'}
    devDependencies:
      tool: {specifier: ^1, version: 1.0.0}
packages:
  app@1.0.0:
    peerDependencies: {peer: ^2}
  peer@2.0.0: {}
  '@scope/lib@1.0.0': {}
  tool@1.0.0: {}
snapshots:
  app@1.0.0(peer@2.0.0):
    dependencies: {peer: 2.0.0}
  app@1.0.0(peer@3.0.0): {}
  peer@2.0.0: {}
  '@scope/lib@1.0.0': {}
  tool@1.0.0:
    dependencies: {peer: 2.0.0}
`;

describe('pnpm lockfiles', () => {
	it('uses the final project document in a multi-document lockfile with an explicit caveat', () => {
		const result = parsePnpmLockfile("lockfileVersion: '9.0'\nimporters: {}\n---\n" + v9);
		if (!result.ok) throw new Error(result.message);
		expect(result.graph.edges.length).toBeGreaterThan(2);
		expect(result.graph.warnings.some((warning) => warning.includes('configuration lockfile documents'))).toBe(true);
	});
	it('preserves peer contexts and aliases while supporting traversal, dev flags, and OSV pairs', () => {
		const result = parsePnpmLockfile(v9);
		if (!result.ok) throw new Error(result.message);
		expect(result.graph.nodes.filter((node) => node.name === 'app')).toHaveLength(2);
		expect(result.graph.edges).toContainEqual({
			source: 'pnpm:app@1.0.0(peer@2.0.0)',
			target: 'pnpm:peer@2.0.0',
			kind: 'peer',
			requestedRange: '2.0.0'
		});
		expect(result.graph.nodes.find((node) => node.name === 'tool')).toMatchObject({ direct: true, devOnly: true });
		expect(result.graph.nodes.find((node) => node.name === 'peer')?.devOnly).toBe(false);
		expect(simulateCompromise(result.graph, 'pnpm:peer@2.0.0').samplePaths[0][0]).toBe('');
		expect(advisoryQuery(result.graph)).toContainEqual({ name: '@scope/lib', version: '1.0.0' });
	});

	it('reads v6 standalone roots and warns for missing dependencies instead of fabricating nodes', () => {
		const result = parsePnpmLockfile(`lockfileVersion: '6.0'
dependencies: {a: {specifier: ^1, version: 1.0.0}}
packages:
  /a@1.0.0:
    dependencies: {missing: 2.0.0}
`);
		if (!result.ok) throw new Error(result.message);
		expect(result.graph.edges).toHaveLength(1);
		expect(result.graph.nodes).toHaveLength(2);
		expect(result.graph.warnings).toContain('Could not resolve "missing" required by pnpm:/a@1.0.0');
	});

	it('connects explicit workspace links through importer identities', () => {
		const result = parsePnpmLockfile(`lockfileVersion: '9.0'
importers:
  .:
    dependencies: {local: {specifier: 'workspace:*', version: 'link:packages/local'}}
  packages/local:
    dependencies: {x: {specifier: ^1, version: 1.0.0}}
packages: {x@1.0.0: {}}
snapshots: {x@1.0.0: {}}
`);
		if (!result.ok) throw new Error(result.message);
		expect(simulateCompromise(result.graph, 'pnpm:x@1.0.0').samplePaths).toEqual([
			['', 'pnpm:workspace:packages/local', 'pnpm:x@1.0.0']
		]);
	});

	it('does not clamp a workspace link outside the project into a root self-edge', () => {
		const result = parsePnpmLockfile(
			"lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      external: {version: 'link:../external'}"
		);
		if (!result.ok) throw new Error(result.message);
		expect(result.graph.edges).toEqual([]);
		expect(result.graph.warnings).toContain('Could not resolve "external" required by root');
	});

	it.each([
		'lockfileVersion: 5.4',
		'lockfileVersion: 9\nimporters: []',
		'x: [',
		'lockfileVersion: 9\nimporters: {}\npackages: []'
	])('rejects malformed or unsupported inputs', (text) => {
		expect(parsePnpmLockfile(text).ok).toBe(false);
	});
});

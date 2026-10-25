import { expect, it } from 'vitest';
import { parseDependencyLockfile } from './import';
import { parseLockfile } from './lockfile';
import { graphMetrics } from '#lib/graph/metrics.js';
import { simulateCompromise } from '#lib/graph/impact.js';
import v1 from '#lib/fixtures/minimal-v1.json';

it('imports v1 nested instances, hoisted scoped requirements, and cycles without inventing root edges', () => {
	const result = parseDependencyLockfile(JSON.stringify(v1), 'package-lock.json');
	if (!result.ok) throw new Error(result.message);
	expect(result.lockfileVersion).toBe(1);
	expect(result.graph.nodes).toHaveLength(5);
	expect(result.graph.edges.map(({ source, target }) => [source, target])).toEqual([
		['node_modules/a', 'node_modules/a/node_modules/b'],
		['node_modules/a', 'node_modules/@scope/util'],
		['node_modules/a/node_modules/b', 'node_modules/a']
	]);
	expect(result.graph.nodes.every((node) => !node.direct)).toBe(true);
	expect(result.graph.nodes.find((node) => node.id === 'node_modules/b')?.devOnly).toBe(true);
	expect(result.graph.warnings.join(' ')).toContain('root manifest');
	expect(simulateCompromise(result.graph, 'node_modules/@scope/util').ancestorIds).toContain('node_modules/a');
});

it('rejects malformed v1 trees and warns about invalid entries and unresolved requirements', () => {
	expect(parseDependencyLockfile('{"lockfileVersion":1,"dependencies":[]}', 'package-lock.json')).toMatchObject({
		ok: false
	});
	const result = parseDependencyLockfile(
		JSON.stringify({
			lockfileVersion: 1,
			dependencies: {
				bad: null,
				'../escape': {},
				valid: { version: '1.0.0', requires: { gone: '*' } }
			}
		})
	);
	if (!result.ok) throw new Error(result.message);
	expect(result.graph.nodes.map((node) => node.id)).toEqual(['', 'node_modules/valid']);
	expect(result.graph.warnings.join(' ')).toContain('Could not resolve "gone"');
});

it('traces workspace declarations at their real paths while retaining installed link identities', () => {
	const result = parseLockfile(
		JSON.stringify({
			lockfileVersion: 3,
			packages: {
				'': { name: 'monorepo', workspaces: ['packages/*'], dependencies: { web: 'file:packages/web' } },
				'node_modules/web': { link: true, resolved: 'packages/web' },
				'node_modules/lib': { link: true, resolved: 'packages/lib' },
				'packages/web': {
					name: 'web',
					version: '1.0.0',
					dependencies: { lib: '*', x: '1' },
					devDependencies: { tool: '*' }
				},
				'packages/lib': { name: 'lib', version: '1.0.0', dependencies: { web: '*' } },
				'packages/web/node_modules/x': { version: '1.0.0' },
				'node_modules/x': { version: '2.0.0' },
				'node_modules/tool': { version: '1.0.0', dev: true }
			}
		})
	);
	if (!result.ok) throw new Error(result.message);
	expect(result.graph.nodes.find((node) => node.id === 'node_modules/web')).toMatchObject({
		workspacePath: 'packages/web',
		version: '1.0.0'
	});
	expect(result.graph.nodes.some((node) => node.id === 'packages/web')).toBe(false);
	expect(result.graph.edges).toContainEqual({
		source: 'node_modules/web',
		target: 'packages/web/node_modules/x',
		kind: 'runtime',
		requestedRange: '1'
	});
	expect(result.graph.edges).toContainEqual({
		source: 'node_modules/web',
		target: 'node_modules/tool',
		kind: 'development',
		requestedRange: '*'
	});
	expect(result.graph.warnings.join(' ')).not.toContain('not traced');
	expect(simulateCompromise(result.graph, 'packages/web/node_modules/x').ancestorIds).toContain('');
});

it('keeps missing or external links explicit instead of tracing arbitrary folders', () => {
	const result = parseLockfile(
		JSON.stringify({
			lockfileVersion: 3,
			packages: {
				'': {},
				'node_modules/missing': { link: true, resolved: 'packages/missing' },
				'node_modules/external': { link: true, resolved: '../external' },
				'../external': { dependencies: { x: '*' } }
			}
		})
	);
	if (!result.ok) throw new Error(result.message);
	expect(result.graph.nodes.some((node) => node.workspacePath)).toBe(false);
	expect(result.graph.warnings.filter((warning) => warning.includes('not traced'))).toHaveLength(2);
});

it('does not invent root membership edges for an otherwise connected workspace cycle', () => {
	const result = parseLockfile(
		JSON.stringify({
			lockfileVersion: 3,
			packages: {
				'': { workspaces: ['packages/*'] },
				'node_modules/a': { link: true, resolved: './packages/a' },
				'node_modules/b': { link: true, resolved: 'packages/b' },
				'packages/a': { name: 'a', version: '1.0.0', dependencies: { b: '*' } },
				'packages/b': { name: 'b', version: '1.0.0', dependencies: { a: '*' } }
			}
		})
	);
	if (!result.ok) throw new Error(result.message);
	expect(result.graph.edges).toHaveLength(2);
	expect(result.graph.edges.some((edge) => edge.source === '')).toBe(false);
	expect(result.graph.nodes.find((node) => node.id === 'node_modules/a')?.version).toBe('1.0.0');
	expect(result.graph.warnings.filter((warning) => warning.includes('No root membership edge'))).toHaveLength(2);
});

it('records only HTTP(S) hostnames and counts non-default hosts without changing source classification', () => {
	const result = parseLockfile(
		JSON.stringify({
			lockfileVersion: 3,
			packages: {
				'': {},
				'node_modules/default': { resolved: 'https://registry.npmjs.org/a/-/a.tgz' },
				'node_modules/mirror': { resolved: 'https://user:secret@mirror.example:8443/a.tgz?token=secret' },
				'node_modules/archive': { resolved: 'https://example.com/archive.zip' },
				'node_modules/git': { resolved: 'git+ssh://git@example.com/a.git' }
			}
		})
	);
	if (!result.ok) throw new Error(result.message);
	expect(result.graph.nodes.find((node) => node.name === 'mirror')).toMatchObject({
		source: 'registry',
		resolvedHost: 'mirror.example'
	});
	expect(result.graph.nodes.find((node) => node.name === 'archive')).toMatchObject({
		source: 'other',
		resolvedHost: 'example.com'
	});
	expect(result.graph.nodes.find((node) => node.name === 'git')).not.toHaveProperty('resolvedHost');
	expect(JSON.stringify(result.graph)).not.toContain('secret');
	expect(graphMetrics(result.graph).nonDefaultHostInstances).toBe(2);
});

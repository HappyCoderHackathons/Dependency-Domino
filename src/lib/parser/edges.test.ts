import { describe, expect, it } from 'vitest';
import { buildEdges, markDirect } from '#lib/parser/edges.js';
import { buildPackageNodes } from '#lib/parser/lockfile.js';

function edgesFor(packages: Record<string, unknown>) {
	const { nodes } = buildPackageNodes({ lockfileVersion: 3, packages });
	return { nodes, ...buildEdges(packages, nodes) };
}

describe('buildEdges', () => {
	it('creates runtime edges consumer -> dependency with requestedRange', () => {
		const { edges, warnings } = edgesFor({
			'': { dependencies: { a: '^1.0.0' } },
			'node_modules/a': { version: '1.0.0', dependencies: { x: '^2.0.0' } },
			'node_modules/a/node_modules/x': { version: '2.0.0' },
			'node_modules/x': { version: '1.0.0' }
		});
		expect(edges).toEqual([
			{ source: '', target: 'node_modules/a', kind: 'runtime', requestedRange: '^1.0.0' },
			{ source: 'node_modules/a', target: 'node_modules/a/node_modules/x', kind: 'runtime', requestedRange: '^2.0.0' }
		]);
		expect(warnings).toEqual([]);
	});

	it('warns on unresolved dependencies without creating an edge', () => {
		const { edges, warnings } = edgesFor({
			'': { dependencies: { missing: '1.0.0' } },
			'node_modules/a': { dependencies: { gone: '1.0.0' } }
		});
		expect(edges).toEqual([]);
		expect(warnings).toEqual([
			'Could not resolve "missing" required by root',
			'Could not resolve "gone" required by node_modules/a'
		]);
	});

	it('does not create edges to entries that are not nodes', () => {
		const { edges } = edgesFor({ '': { dependencies: { bad: '1.0.0' } }, 'node_modules/bad': null });
		expect(edges).toEqual([]);
	});

	it('creates optional edges and a soft warning when one is missing', () => {
		const { edges, warnings } = edgesFor({
			'': { optionalDependencies: { o: '1.0.0', native: '1.0.0' } },
			'node_modules/o': { optional: true }
		});
		expect(edges).toEqual([{ source: '', target: 'node_modules/o', kind: 'optional', requestedRange: '1.0.0' }]);
		expect(warnings).toEqual(['Optional dependency "native" required by root is not installed']);
	});

	it('uses only root devDependencies', () => {
		const { edges } = edgesFor({
			'': { devDependencies: { d: '1.0.0' } },
			'node_modules/d': { dev: true, devDependencies: { e: '1.0.0' } },
			'node_modules/e': {}
		});
		expect(edges).toEqual([{ source: '', target: 'node_modules/d', kind: 'development', requestedRange: '1.0.0' }]);
	});

	it('collapses repeated edges but keeps different kinds', () => {
		const packages = {
			'': { dependencies: { a: '1.0.0' }, optionalDependencies: { a: '1.0.0' } },
			'node_modules/a': {}
		};
		const { nodes } = buildPackageNodes({ lockfileVersion: 3, packages });
		const { edges } = buildEdges(packages, [...nodes, ...nodes]);
		expect(edges.map((edge) => edge.kind)).toEqual(['runtime', 'optional']);
	});

	it('warns on unusual ranges, even when unresolved, and on links', () => {
		const { edges, warnings } = edgesFor({
			'': { dependencies: { alias: 'npm:lodash@3.10.1', web: 'file:packages/web', g: 'github:o/r' } },
			'node_modules/alias': { name: 'lodash', version: '3.10.1' },
			'node_modules/web': { resolved: 'packages/web', link: true }
		});
		expect(edges.map((edge) => edge.target)).toEqual(['node_modules/alias', 'node_modules/web']);
		expect(warnings).toEqual([
			'Unusual dependency range "npm:lodash@3.10.1" required by root',
			'Unusual dependency range "file:packages/web" required by root',
			'Unusual dependency range "github:o/r" required by root',
			'Could not resolve "g" required by root',
			'node_modules/web links to packages/web. Its dependencies are not traced.'
		]);
	});
});

describe('markDirect', () => {
	it('flags root dependency, devDependency, and optionalDependency targets only', () => {
		const { nodes, edges } = edgesFor({
			'': { dependencies: { a: '1.0.0' }, devDependencies: { d: '1.0.0' }, optionalDependencies: { o: '1.0.0' } },
			'node_modules/a': { dependencies: { b: '1.0.0' } },
			'node_modules/b': {},
			'node_modules/d': {},
			'node_modules/o': {}
		});
		expect(Object.fromEntries(markDirect(nodes, edges).map((node) => [node.id, node.direct]))).toEqual({
			'': false,
			'node_modules/a': true,
			'node_modules/b': false,
			'node_modules/d': true,
			'node_modules/o': true
		});
	});
});

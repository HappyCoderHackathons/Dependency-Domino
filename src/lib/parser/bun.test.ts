import { describe, expect, it } from 'vitest';
import { parseBunLockfile } from '#lib/parser/bun.js';
import { simulateCompromise } from '#lib/graph/impact.js';
import { advisoryQuery } from '#lib/osv/query.js';

describe('Bun text lockfiles', () => {
	it('reads JSONC, aliases, scoped nested copies, root flags, and reverse dependency paths', () => {
		const result = parseBunLockfile(`{
  // Bun text lockfiles allow comments and trailing commas.
  "lockfileVersion": 1,
  "workspaces": {"": {"name": "project", "dependencies": {"@scope/a": "1", "alias": "npm:real@1"}, "devDependencies": {"tool": "1"}}},
  "packages": {
    "@scope/a": ["@scope/a@1.0.0", "", {"dependencies": {"x": "2"}}, "hash"],
    "@scope/a/x": ["x@2.0.0", "", {}, "hash"],
    "x": ["x@1.0.0", "", {}, "hash"],
    "alias": ["real@1.0.0", "", {}, "hash"],
    "tool": ["tool@1.0.0", "", {"dependencies": {"x": "1"}}, "hash"],
  },
}`);
		if (!result.ok) throw new Error(result.message);
		expect(result.graph.nodes[0].name).toBe('project');
		expect(result.graph.nodes.filter((node) => node.name === 'x')).toHaveLength(2);
		expect(result.graph.edges).toContainEqual({
			source: 'bun:@scope/a',
			target: 'bun:@scope/a/x',
			kind: 'runtime',
			requestedRange: '2'
		});
		expect(result.graph.nodes.find((node) => node.name === 'tool')?.devOnly).toBe(true);
		expect(advisoryQuery(result.graph)).toContainEqual({ name: 'real', version: '1.0.0' });
		expect(simulateCompromise(result.graph, 'bun:@scope/a/x').samplePaths).toEqual([
			['', 'bun:@scope/a', 'bun:@scope/a/x']
		]);
	});

	it('traces workspace descriptors and silently skips missing optional peers', () => {
		const result = parseBunLockfile(
			JSON.stringify({
				lockfileVersion: 0,
				workspaces: { '': { dependencies: { local: 'workspace:*' } }, 'packages/local': { dependencies: { x: '^1' } } },
				packages: {
					local: ['local@workspace:packages/local'],
					x: ['x@1.0.0', '', { peerDependencies: { absent: '*' }, optionalPeers: ['absent'] }]
				}
			})
		);
		if (!result.ok) throw new Error(result.message);
		expect(result.graph.nodes.find((node) => node.name === 'local')?.source).toBe('link');
		expect(result.graph.edges).toHaveLength(2);
		expect(result.graph.warnings.some((warning) => warning.includes('absent'))).toBe(false);
	});

	it.each([
		'{}',
		'{"lockfileVersion": 99}',
		'{"lockfileVersion": 1, "packages": [], "workspaces": {}}',
		'{"lockfileVersion": 1, "packages": {"x": []}, "workspaces": {"": {}}}',
		'{"lockfileVersion":'
	])('rejects malformed or unsupported input', (text) => {
		expect(parseBunLockfile(text).ok).toBe(false);
	});
});

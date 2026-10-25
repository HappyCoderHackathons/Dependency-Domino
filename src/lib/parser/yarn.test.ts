import { describe, expect, it } from 'vitest';
import { parseYarnLockfile } from '#lib/parser/yarn.js';
import { simulateCompromise } from '#lib/graph/impact.js';

describe('Yarn lockfiles', () => {
	it('reads classic grouped selectors, scoped names, and separate versions without inventing root edges', () => {
		const result = parseYarnLockfile(`# yarn lockfile v1

app@^1:
  version "1.0.0"
  dependencies:
    "@scope/lib" "^1"
"@scope/lib@^1", "@scope/lib@~1":
  version "1.2.0"
"@scope/lib@^2":
  version "2.0.0"
`);
		if (!result.ok) throw new Error(result.message);
		expect(result.graph.nodes.filter((node) => node.name === '@scope/lib')).toHaveLength(2);
		expect(result.graph.edges).toHaveLength(1);
		expect(result.graph.edges[0]).toMatchObject({ source: 'yarn:app@^1', kind: 'runtime' });
		expect(result.graph.nodes.every((node) => !node.direct)).toBe(true);
		expect(result.graph.warnings.some((warning) => warning.includes('package.json'))).toBe(true);
	});

	it('uses Berry workspace roots and exact descriptor mappings including optional dependency metadata', () => {
		const result = parseYarnLockfile(`__metadata:
  version: 8
"project@workspace:.":
  version: 0.0.0-use.local
  resolution: "project@workspace:."
  dependencies:
    a: "npm:^1"
"a@npm:^1, a@npm:~1":
  version: 1.0.0
  resolution: "a@npm:1.0.0"
  dependencies:
    b: "npm:^2"
  dependenciesMeta:
    b: {optional: true}
"b@npm:^2":
  version: 2.0.0
  resolution: "b@npm:2.0.0"
`);
		if (!result.ok) throw new Error(result.message);
		expect(result.graph.nodes.find((node) => node.name === 'a')).toMatchObject({ direct: true, source: 'registry' });
		expect(result.graph.edges.find((edge) => edge.target === 'yarn:b@npm:2.0.0')?.kind).toBe('optional');
		expect(simulateCompromise(result.graph, 'yarn:b@npm:2.0.0').samplePaths).toEqual([
			['', 'yarn:a@npm:1.0.0', 'yarn:b@npm:2.0.0']
		]);
	});

	it('warns for unresolved descriptors and keeps Git sources out of registry lookups', () => {
		const result = parseYarnLockfile(`# yarn lockfile v1
"lib@git+https://example.com/lib.git":
  version "1.0.0"
  dependencies:
    missing "^1"
`);
		if (!result.ok) throw new Error(result.message);
		expect(result.graph.nodes[1].source).toBe('other');
		expect(result.graph.edges).toEqual([]);
		expect(result.graph.warnings.some((warning) => warning.startsWith('Could not resolve'))).toBe(true);
	});

	it.each(['not a lockfile', '__metadata: {version: 99}', '# yarn lockfile v1\n<<<<<<< HEAD\nx'])(
		'rejects unsupported input',
		(text) => {
			expect(parseYarnLockfile(text).ok).toBe(false);
		}
	);
});

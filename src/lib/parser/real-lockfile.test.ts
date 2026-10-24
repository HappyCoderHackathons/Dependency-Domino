import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLockfile } from '#lib/parser/lockfile.js';
import { simulateCompromise } from '#lib/graph/impact.js';

// Downloaded by `npm run fixtures` and not committed; skipped when missing.
const fixture = new URL('../fixtures/real/yargs/package-lock.json', import.meta.url);
const text = existsSync(fixture) ? readFileSync(fixture, 'utf8') : null;

describe.skipIf(text === null)('real-world lockfile (yargs)', () => {
	if (text === null) return;
	const result = parseLockfile(text);
	if (!result.ok) throw new Error(result.message);
	const { nodes, edges, warnings } = result.graph;

	it('parses every installed package with only alias caveats as warnings', () => {
		expect(nodes).toHaveLength(563);
		expect(edges.length).toBeGreaterThan(1000);
		expect(edges.filter((edge) => edge.kind === 'peer')).toHaveLength(44);
		expect(warnings).toHaveLength(3);
		expect(warnings.every((warning) => warning.startsWith('Unusual dependency range "npm:'))).toBe(true);
	});

	it('only creates edges between real nodes', () => {
		const ids = new Set(nodes.map((node) => node.id));
		expect(edges.every((edge) => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
	});

	it('finds a root path for a simulated compromise of every package', () => {
		const unreachable = nodes
			.filter((node) => simulateCompromise(result.graph, node.id).samplePaths.length === 0)
			.map((node) => node.id)
			.sort();
		expect(unreachable).toEqual([]);
	});
});

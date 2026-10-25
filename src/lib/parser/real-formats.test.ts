import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePnpmLockfile } from '#lib/parser/pnpm.js';
import { parseYarnLockfile } from '#lib/parser/yarn.js';
import { parseBunLockfile } from '#lib/parser/bun.js';
import { toElements } from '#lib/graph/normalize.js';
import { advisoryQuery } from '#lib/osv/query.js';

for (const [format, filename, parse] of [
	['pnpm', 'pnpm-lock.yaml', parsePnpmLockfile],
	['yarn', 'yarn.lock', parseYarnLockfile],
	['yarn-classic', 'yarn.lock', parseYarnLockfile],
	['bun', 'bun.lock', parseBunLockfile]
] as const) {
	const fixture = new URL(`../fixtures/real/${format}/${filename}`, import.meta.url);
	describe.skipIf(!existsSync(fixture))(`real ${format} lockfile`, () => {
		it('produces valid graph endpoints, unique identities, Cytoscape elements, and advisory queries', () => {
			const result = parse(readFileSync(fixture, 'utf8'));
			if (!result.ok) throw new Error(result.message);
			const graph = result.graph;
			const ids = new Set(graph.nodes.map((node) => node.id));
			expect(graph.nodes.length).toBeGreaterThan(20);
			expect(graph.edges.length).toBeGreaterThan(10);
			expect(ids.size).toBe(graph.nodes.length);
			expect(graph.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
			expect(toElements(graph)).toHaveLength(graph.nodes.length + graph.edges.length);
			expect(advisoryQuery(graph).length).toBeGreaterThan(10);
		});
	});
}

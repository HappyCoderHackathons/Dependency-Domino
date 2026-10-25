import { describe, expect, it } from 'vitest';
import { DEMOS } from '#lib/demos.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import { simulateCompromise } from '#lib/graph/impact.js';

describe('built-in demos', () => {
	it('parses every demo lockfile', async () => {
		for (const demo of DEMOS) {
			const result = parseLockfile(await demo.load());
			expect(result.ok, demo.id).toBe(true);
		}
	});

	it('gives the real project demo a deep chain to trace', async () => {
		const result = parseLockfile(await DEMOS.find((demo) => demo.id === 'real')!.load());
		if (!result.ok) throw new Error(result.message);
		expect(result.graph.nodes.length).toBe(563);

		const impact = simulateCompromise(result.graph, 'node_modules/is-number');
		expect(impact.ancestorIds.length).toBeGreaterThan(10);
		expect(impact.samplePaths[0]?.length).toBeGreaterThanOrEqual(11);
	});
});

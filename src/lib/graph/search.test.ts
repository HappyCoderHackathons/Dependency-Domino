import { expect, it } from 'vitest';
import { searchPackages } from './search';
import { parseLockfile } from '#lib/parser/lockfile.js';
import demo from '#lib/fixtures/demo-lockfile.json';

const parsed = parseLockfile(JSON.stringify(demo));
if (!parsed.ok) throw new Error(parsed.message);
const nodes = parsed.graph.nodes;

it('keeps prefix matches before substrings and never mixes fuzzy results into exact results', () => {
	const template = nodes[1];
	const result = searchPackages(
		[
			{ ...template, id: 'a', name: 'a-lodash' },
			{ ...template, id: 'b', name: 'lodash' },
			{ ...template, id: 'c', name: 'lodahs' }
		],
		'LODASH'
	);
	expect(result.matches.map((n) => n.id)).toEqual(['b', 'a']);
	expect(result.fuzzy).toBe(false);
});

it('finds scoped packages by a transposed unscoped name and retains installed copies', () => {
	expect(searchPackages(nodes, 'tiny-pda').matches.map((n) => n.name)).toEqual(['@domino-demo/tiny-pad']);
	expect(searchPackages(nodes, 'date-heplers').matches).toHaveLength(2);
	expect(searchPackages(nodes, 'date-heplers').fuzzy).toBe(true);
});

it('handles versions, empty input, unrelated text, and bounded query lengths', () => {
	expect(searchPackages(nodes, 'tiny-pad@1.0.4').matches).toHaveLength(1);
	for (const query of ['', '  ', 'xy', 'unrelated-package', 'a'.repeat(100)]) {
		expect(searchPackages(nodes, query)).toEqual({ matches: [], fuzzy: false });
	}
});

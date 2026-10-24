import { describe, expect, it } from 'vitest';
import { fromCyId, ROOT_ID, toCyId, toElements } from '#lib/graph/normalize.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import demo from '#lib/fixtures/demo-lockfile.json';
import type { DependencyGraph } from '#lib/types.js';

function demoGraph(): DependencyGraph {
	const result = parseLockfile(JSON.stringify(demo));
	if (!result.ok) throw new Error(result.message);
	return result.graph;
}

describe('toCyId and fromCyId', () => {
	it('maps the root to ROOT_ID and back, leaving other ids unchanged', () => {
		expect(toCyId('')).toBe(ROOT_ID);
		expect(fromCyId(ROOT_ID)).toBe('');
		expect(toCyId('node_modules/a')).toBe('node_modules/a');
		expect(fromCyId('node_modules/a')).toBe('node_modules/a');
	});
});

describe('toElements', () => {
	it('adds an advisory class independently of package dependency flags', () => {
		const graph = demoGraph();
		const node = graph.nodes.find((node) => node.devOnly)!;
		node.advisoryIds = ['GHSA-example'];
		const element = toElements(graph).find((element) => element.data.id === node.id);
		expect(element?.classes).toEqual(expect.arrayContaining(['dev', 'advisory']));
	});
	const elements = toElements(demoGraph());
	const byId = (id: string) => elements.find((element) => element.data.id === id);

	it('creates one element per node and edge', () => {
		expect(elements.filter((element) => element.group === 'nodes')).toHaveLength(14);
		expect(elements.filter((element) => element.group === 'edges')).toHaveLength(16);
	});

	it('labels nodes name@version and adds root, dev, and direct classes', () => {
		expect(byId(ROOT_ID)).toMatchObject({ data: { label: 'demo-app@1.0.0' }, classes: ['root'] });
		expect(byId('node_modules/@domino-demo/test-runner')?.classes).toEqual(['dev', 'direct']);
		expect(byId('node_modules/@domino-demo/tiny-pad')).toMatchObject({
			data: { label: '@domino-demo/tiny-pad@1.0.4' },
			classes: []
		});
	});

	it('adds optional and link classes and falls back to the name without a version', () => {
		const [optional, link] = toElements({
			nodes: [
				{
					id: 'node_modules/o',
					name: 'o',
					version: '1.0.0',
					direct: false,
					devOnly: false,
					optional: true,
					source: 'registry',
					advisoryIds: []
				},
				{
					id: 'node_modules/web',
					name: 'web',
					version: null,
					direct: false,
					devOnly: false,
					optional: false,
					source: 'link',
					advisoryIds: []
				}
			],
			edges: [],
			warnings: []
		});
		expect(optional.classes).toEqual(['optional']);
		expect(link).toMatchObject({ data: { label: 'web' }, classes: ['link'] });
	});

	it('gives edges a unique id, mapped endpoints, and a class per kind', () => {
		expect(byId(`${ROOT_ID}->node_modules/@domino-demo/test-runner:development`)).toEqual({
			group: 'edges',
			data: {
				id: `${ROOT_ID}->node_modules/@domino-demo/test-runner:development`,
				source: ROOT_ID,
				target: 'node_modules/@domino-demo/test-runner',
				kind: 'development'
			},
			classes: ['development']
		});
	});
});

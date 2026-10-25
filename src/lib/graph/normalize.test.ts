import { describe, expect, it } from 'vitest';
import { fromCyId, namesWithMultipleVersions, nodeLabel, ROOT_ID, toCyId, toElements } from '#lib/graph/normalize.js';
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
	it('shortens unambiguous labels while preserving versions for duplicate names and OSV markers', () => {
		const graph = demoGraph();
		const names = namesWithMultipleVersions(graph);
		const tinyPad = graph.nodes.find((node) => node.name === '@domino-demo/tiny-pad')!;
		const dateHelpers = graph.nodes.filter((node) => node.name === '@domino-demo/date-helpers');
		expect(nodeLabel(tinyPad, 'name', names)).toBe('@domino-demo/tiny-pad');
		expect(dateHelpers.map((node) => nodeLabel(node, 'name', names))).toEqual([
			'@domino-demo/date-helpers@1.3.0',
			'@domino-demo/date-helpers@2.0.1'
		]);
		expect(nodeLabel({ ...tinyPad, advisoryIds: ['GHSA-example'] }, 'name', names)).toBe(
			'OSV: @domino-demo/tiny-pad (1)'
		);
		expect(toElements(graph, 'name').map((element) => element.data.id)).toEqual(
			toElements(graph).map((element) => element.data.id)
		);
	});

	it('does not require version suffixes for same-version copies or a matching project name', () => {
		const graph = demoGraph();
		const node = graph.nodes[1];
		const copies = {
			...graph,
			nodes: [
				{ ...node, id: '', version: 'different-project-version' },
				node,
				{ ...node, id: 'node_modules/nested/copy' }
			]
		};
		expect(namesWithMultipleVersions(copies).size).toBe(0);
		expect(toElements(copies, 'name')[1].data.label).toBe(node.name);
		expect(nodeLabel({ ...node, version: null }, 'name')).toBe(node.name);
	});
	it('adds an advisory class independently of package dependency flags', () => {
		const graph = demoGraph();
		const node = graph.nodes.find((node) => node.devOnly)!;
		node.advisoryIds = ['GHSA-example'];
		const element = toElements(graph).find((element) => element.data.id === node.id);
		expect(element?.classes).toEqual(expect.arrayContaining(['dev', 'advisory']));
		expect(element?.data.label).toBe(`OSV: ${node.name}@${node.version} (1)`);
	});

	it('marks packages that run an install script', () => {
		const element = toElements({
			nodes: [
				{
					id: 'node_modules/scripted',
					name: 'scripted',
					version: '1.0.0',
					direct: false,
					devOnly: false,
					optional: false,
					source: 'registry',
					hasInstallScript: true,
					advisoryIds: []
				}
			],
			edges: [],
			warnings: []
		})[0];
		expect(element.classes).toEqual(['install-script']);
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

import { describe, expect, it } from 'vitest';
import { advisoryQuery } from './query';

describe('advisoryQuery', () => {
	it('should return an empty array for an empty graph', () => {
		const graph: Parameters<typeof advisoryQuery>[0] = { nodes: [], edges: [], warnings: [] };
		const result = advisoryQuery(graph);
		expect(result).toEqual([]);
	});
	it('keeps only registry nodes with a version', () => {
		const graph: Parameters<typeof advisoryQuery>[0] = {
			nodes: [
				{
					id: 'lodash',
					name: 'lodash',
					version: '4.17.21',
					source: 'registry',
					direct: true,
					devOnly: false,
					optional: false,
					advisoryIds: []
				},
				{
					id: 'express',
					name: 'express',
					version: null,
					source: 'registry',
					direct: true,
					devOnly: false,
					optional: false,
					advisoryIds: []
				},
				{
					id: 'react',
					name: 'react',
					version: '17.0.2',
					source: 'other',
					direct: true,
					devOnly: false,
					optional: false,
					advisoryIds: []
				}
			],
			edges: [],
			warnings: []
		};
		const result = advisoryQuery(graph);
		expect(result).toEqual([{ name: 'lodash', version: '4.17.21' }]);
	});
	it('removes duplicates based on name and version', () => {
		const graph: Parameters<typeof advisoryQuery>[0] = {
			nodes: [
				{
					id: 'lodash',
					name: 'lodash',
					version: '4.17.21',
					source: 'registry',
					direct: true,
					devOnly: false,
					optional: false,
					advisoryIds: []
				},
				{
					id: 'lodash',
					name: 'lodash',
					version: '4.17.21',
					source: 'registry',
					direct: true,
					devOnly: false,
					optional: false,
					advisoryIds: []
				},
				{
					id: 'express',
					name: 'express',
					version: '4.17.1',
					source: 'registry',
					direct: true,
					devOnly: false,
					optional: false,
					advisoryIds: []
				}
			],
			edges: [],
			warnings: []
		};
		const result = advisoryQuery(graph);
		expect(result).toEqual([
			{ name: 'lodash', version: '4.17.21' },
			{ name: 'express', version: '4.17.1' }
		]);
	});
});

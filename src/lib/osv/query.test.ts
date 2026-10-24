import { describe, expect, it } from 'vitest';
import { advisoryQuery } from './query';


describe('advisoryQuery', () => {
	it('should return an empty array for an empty graph', () => {
		const graph = { nodes: [] };
		const result = advisoryQuery(graph);
		expect(result).toEqual([]);
	});
    it('keeps only registry nodes with a version', () => {
        const graph = {
            nodes: [
                { name: 'lodash', version: '4.17.21', source: 'registry' },
                { name: 'express', version: null, source: 'registry' },
                { name: 'react', version: '17.0.2', source: 'git' }
            ]
        };
        const result = advisoryQuery(graph);
        expect(result).toEqual([{ name: 'lodash', version: '4.17.21' }]);
    });
    it('removes duplicates based on name and version', () => {
        const graph = {
            nodes: [
                { name: 'lodash', version: '4.17.21', source: 'registry' },
                { name: 'lodash', version: '4.17.21', source: 'registry' },
                { name: 'express', version: '4.17.1', source: 'registry' }
            ]
        };
        const result = advisoryQuery(graph);
        expect(result).toEqual([{ name: 'lodash', version: '4.17.21' }, { name: 'express', version: '4.17.1' }]);
    });
});
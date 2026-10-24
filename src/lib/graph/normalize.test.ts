import { describe, expect, it } from 'vitest';
import { fromCyId, toCyId, toElements, ROOT_ID } from '#lib/graph/normalize.js';

describe('toCyId', () => {
    it('returns a stand-in for the root', () => {
        expect(toCyId('')).toBe(ROOT_ID);
    });

    it('returns the same id for non-root nodes', () => {
        expect(toCyId('node_modules/a')).toBe('node_modules/a');
    });
});

describe('fromCyId', () => {
    it('returns the root for the stand-in', () => {
        expect(fromCyId(ROOT_ID)).toBe('');
    });

    it('returns the same id for non-root nodes', () => {
        expect(fromCyId('node_modules/a')).toBe('node_modules/a');
    });
});

describe('toElements', () => {
    it('converts a graph to Cytoscape elements', () => {
        const graph = {
            nodes: [
                { id: '', name: 'root', version: '1.0.0', direct: true },
                { id: 'node_modules/a', name: 'a', version: '1.0.0', direct: false }
            ],
            edges: [
                { source: '', target: 'node_modules/a', kind: 'runtime' }
            ],
            warnings: []
        };
        expect(toElements(graph)).toEqual([
            { data: { id: '', name: 'root', version: '1.0.0', direct: true } },
            { data: { id: 'node_modules/a', name: 'a', version: '1.0.0', direct: false } },
            { data: { source: '', target: 'node_modules/a', kind: 'runtime' } }
        ]);
    });
});
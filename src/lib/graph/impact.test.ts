import { describe, expect, it } from 'vitest';
import { buildReverseAdjacency } from '#lib/graph/impact.js';
import type { DependencyEdge } from '#lib/types.js';

function edges(...pairs: [string, string][]): DependencyEdge[] {
	return pairs.map(([source, target]) => ({ source, target, kind: 'runtime' }));
}

describe('buildReverseAdjacency', () => {
	it('builds a map of consumers for each dependency', () => {
        const graph = edges(
            ['a', 'b'],
            ['a', 'c'],
            ['b', 'c'],
            ['c', 'd']
        );
        const reverseAdjacency = buildReverseAdjacency(graph);
        expect(reverseAdjacency.get('b')).toEqual(new Set(['a']));
        expect(reverseAdjacency.get('c')).toEqual(new Set(['a', 'b']));
        expect(reverseAdjacency.get('d')).toEqual(new Set(['c']));
    });
});

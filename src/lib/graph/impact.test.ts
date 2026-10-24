import { describe, expect, it } from 'vitest';
import { buildReverseAdjacency, traverse } from '#lib/graph/impact.js';
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

describe('traverse', () => {
    it('performs a reverse BFS traversal from the origin', () => {
        const consumers = new Map<string, Set<string>>([
            ['a', new Set(['b', 'c'])],
            ['b', new Set(['c'])],
            ['c', new Set(['d'])],
            ['d', new Set()]
        ]);
        const result = traverse(consumers, 'd');
        expect(result.visited).toEqual(new Set(['d', 'c', 'b', 'a']));
        expect(result.layers).toEqual([['d'], ['c'], ['b'], ['a']]);
        expect(result.parents.get('c')).toBe('d');
        expect(result.parents.get('b')).toBe('c');
        expect(result.parents.get('a')).toBe('b');
    });
    it('terminates on a -> b -> c -> a and returns the correct ancestors', () => {
        const consumers = new Map<string, Set<string>>([
            ['a', new Set(['b'])],
            ['b', new Set(['c'])],
            ['c', new Set(['a'])]
        ]);
        const result = traverse(consumers, 'a');
        expect(result.visited).toEqual(new Set(['a', 'b', 'c']));
        expect(result.layers).toEqual([['a'], ['b'], ['c']]);
        expect(result.parents.get('b')).toBe('a');
        expect(result.parents.get('c')).toBe('b');
    });
});
import { describe, expect, it } from 'vitest';
import { LayoutCache } from './layoutCache.js';

const positions = (...ids: string[]) => new Map(ids.map((id, i) => [id, { x: i, y: i * 2 }]));

describe('LayoutCache', () => {
	it('returns stored positions when every id is present', () => {
		const cache = new LayoutCache();
		cache.set('TB|2', positions('a', 'b'));
		expect(cache.get('TB|2', ['a', 'b'])?.get('b')).toEqual({ x: 1, y: 2 });
	});

	it('misses on an unknown key or when any id has no position', () => {
		const cache = new LayoutCache();
		cache.set('TB|2', positions('a'));
		expect(cache.get('LR|2', ['a'])).toBeNull();
		expect(cache.get('TB|2', ['a', 'b'])).toBeNull();
	});

	it('evicts the least recently stored layout past its limit', () => {
		const cache = new LayoutCache(2);
		cache.set('one', positions('a'));
		cache.set('two', positions('a'));
		cache.set('three', positions('a'));
		expect(cache.size).toBe(2);
		expect(cache.get('one', ['a'])).toBeNull();
		expect(cache.get('three', ['a'])).not.toBeNull();
	});

	it('clears everything', () => {
		const cache = new LayoutCache();
		cache.set('k', positions('a'));
		cache.clear();
		expect(cache.get('k', ['a'])).toBeNull();
	});
});

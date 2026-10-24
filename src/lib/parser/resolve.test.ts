import { describe, expect, it } from 'vitest';
import { candidatePaths, resolveDependency } from '#lib/parser/resolve.js';

describe('candidatePaths', () => {
	it('lists candidates from nearest to root', () => {
		expect(candidatePaths('node_modules/a/node_modules/c', 'b')).toEqual([
			'node_modules/a/node_modules/c/node_modules/b',
			'node_modules/a/node_modules/b',
			'node_modules/b'
		]);
	});

	it('yields node_modules/b for the root consumer', () => {
		expect(candidatePaths('', 'b')).toEqual(['node_modules/b']);
	});

	it('handles scoped consumers and dependencies', () => {
		expect(candidatePaths('node_modules/@s/x/node_modules/@t/y', '@u/z')).toEqual([
			'node_modules/@s/x/node_modules/@t/y/node_modules/@u/z',
			'node_modules/@s/x/node_modules/@u/z',
			'node_modules/@u/z'
		]);
	});

	it('falls back to the root from a workspace folder', () => {
		expect(candidatePaths('packages/web/node_modules/ms', 'b')).toEqual([
			'packages/web/node_modules/ms/node_modules/b',
			'packages/web/node_modules/b',
			'node_modules/b'
		]);
	});
});

describe('resolveDependency', () => {
	const installed = new Set(['node_modules/a', 'node_modules/a/node_modules/x', 'node_modules/x', 'node_modules/y']);

	it('prefers a nested copy over a hoisted one', () => {
		expect(resolveDependency(installed, 'node_modules/a', 'x')).toBe('node_modules/a/node_modules/x');
	});

	it('falls back to the hoisted copy', () => {
		expect(resolveDependency(installed, 'node_modules/a', 'y')).toBe('node_modules/y');
	});

	it('returns null when no installed node matches', () => {
		expect(resolveDependency(installed, 'node_modules/a', 'missing')).toBeNull();
	});
});

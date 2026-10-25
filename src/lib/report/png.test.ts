import { expect, it } from 'vitest';
import { pngFilename } from './png';

it('includes a safe input label, origin, and export kind without creating paths', () => {
	expect(pngFilename('demo (bundled)', [{ name: '@scope/package' }], 'graph-view')).toBe(
		'dependency-domino-demo-bundled-scope-package-graph-view.png'
	);
	const filename = pngFilename('../../CON:<input>\\file?.json', [{ name: '../x' }, { name: 'other' }], 'summary');
	expect(filename).toBe('dependency-domino-con-input-file-json-x-plus-1-summary.png');
	expect(filename).not.toMatch(/[\\/:*?"<>|]/);
	expect(pngFilename(null, [], 'graph-full')).toBe('dependency-domino-lockfile-graph-full.png');
	expect(pngFilename('a'.repeat(500), [{ name: 'b'.repeat(500) }], 'summary').length).toBeLessThan(180);
});

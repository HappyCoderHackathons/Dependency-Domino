import { describe, expect, it } from 'vitest';
import { PREVIEW_IMAGE, SITE_NAME, pageTitle } from './meta.js';

describe('pageTitle', () => {
	it('is just the app name before anything is loaded', () => {
		expect(pageTitle(null)).toBe(SITE_NAME);
		expect(pageTitle('   ')).toBe(SITE_NAME);
	});

	it('includes the loaded lockfile name', () => {
		expect(pageTitle('package-lock.json')).toBe(`package-lock.json · ${SITE_NAME}`);
		expect(pageTitle('demo (bundled)')).toBe(`demo (bundled) · ${SITE_NAME}`);
	});

	it('shortens very long file names', () => {
		const title = pageTitle(`${'a'.repeat(200)}.json`);
		expect(title.startsWith(`${'a'.repeat(59)}…`)).toBe(true);
		expect(title.length).toBeLessThan(90);
	});
});

describe('preview image', () => {
	it('points at a root-relative path so the layout can make it absolute', () => {
		expect(PREVIEW_IMAGE.path.startsWith('/')).toBe(true);
	});
});
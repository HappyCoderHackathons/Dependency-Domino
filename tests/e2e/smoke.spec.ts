import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const yargsFixture = fileURLToPath(new URL('../../src/lib/fixtures/real/yargs/package-lock.json', import.meta.url));
let pageErrors: string[];
let externalRequests: string[];

test.beforeEach(async ({ context, page, baseURL }) => {
	pageErrors = [];
	externalRequests = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	await context.route('**/*', async (route) => {
		const url = new URL(route.request().url());
		if (url.origin === baseURL) return route.fallback();
		externalRequests.push(url.href);
		await route.abort();
	});
	await context.route('**/api/vulnerabilities', async (route) => {
		const { packages } = route.request().postDataJSON();
		await route.fulfill({
			json: {
				status: 'complete',
				results: packages.map((pkg: { name: string; version: string }) => ({ ...pkg, advisoryIds: [] })),
				warnings: []
			}
		});
	});
	await page.goto('/');
	// Cytoscape mounts after hydration and lazy loading, so SSR buttons are ready by this point.
	await expect(page.locator('canvas').first()).toBeVisible();
});

test.afterEach(() => {
	expect(pageErrors, 'No uncaught browser errors').toEqual([]);
	expect(externalRequests, 'Smoke tests must not contact external services').toEqual([]);
});

test('loads the demo, searches, simulates, and exports a report', async ({ page }) => {
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	await expect(page.locator('canvas').first()).toBeVisible();
	await expect(page.getByText('OSV lookup complete')).toBeVisible();

	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('tiny-pad');
	await expect(page.getByRole('option')).toHaveCount(1);
	await search.press('Enter');
	await expect(page.locator('#section-package')).toContainText('@domino-demo/tiny-pad');
	await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();

	const simulation = page.locator('#section-impact');
	await expect(simulation).toContainText('6 installed package instances depend on @domino-demo/tiny-pad');
	await expect(page.getByRole('list', { name: 'Dependency path from the project root' })).toContainText('demo-app');
	await expect(page.getByRole('button', { name: 'Frame the simulated impact' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Export Markdown', exact: true })).toBeVisible();

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/\.json$/);
	const report = JSON.parse(await readFile((await download.path())!, 'utf8'));
	expect(report).toMatchObject({
		origin: { name: '@domino-demo/tiny-pad', version: '1.0.4' },
		metrics: { impact: { affectedInstances: 6 } },
		advisoryLookupStatus: 'complete'
	});
});

test('imports the pinned yargs lockfile through the file picker', async ({ page }) => {
	await readFile(yargsFixture).catch(() => {
		throw new Error('Missing yargs fixture. Run npm run fixtures once before npm run test:e2e.');
	});
	const chooserPromise = page.waitForEvent('filechooser');
	await page.getByRole('banner').getByRole('button', { name: 'Import lockfile', exact: true }).click();
	await (await chooserPromise).setFiles(yargsFixture);

	await expect(page.getByRole('banner')).toContainText('package-lock.json (npm)');
	const instanceRow = page
		.locator('#section-summary dl > div')
		.filter({ has: page.getByText('Installed instances', { exact: true }) });
	await expect(instanceRow.locator('dd')).toHaveText('562');
	await expect(page.locator('canvas').first()).toBeVisible();
	await expect(page.getByText('OSV lookup complete')).toBeVisible();
});

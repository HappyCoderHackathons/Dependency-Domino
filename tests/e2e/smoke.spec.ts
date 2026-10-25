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
	await expect(page.getByRole('listbox', { name: 'Search results' }).getByRole('option')).toHaveCount(1);
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

	await page.getByRole('button', { name: 'Show only simulated impact', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('8 of 14 instances');
	await simulation.locator('summary').filter({ hasText: 'Affected packages by distance' }).click();
	const firstLayer = page.getByRole('list', { name: '1 hop from the simulation origins', exact: true });
	await expect(firstLayer.getByRole('button')).toHaveCount(3);
	await firstLayer.getByRole('button', { name: /format-core/ }).click();
	await expect(page.locator('#section-package')).toContainText('@domino-demo/format-core');
	await expect(simulation).toContainText('6 installed package instances depend on @domino-demo/tiny-pad');
	const directOnly = page.getByRole('switch', { name: /Direct dependencies only/ });
	await directOnly.focus();
	await directOnly.press('Space');
	await expect(directOnly).toBeChecked();
	await expect(page.getByRole('status')).toContainText('3 of 14 instances');
	await page.getByRole('button', { name: 'Back to overview', exact: true }).click();
	await expect(page.getByRole('combobox', { name: 'Canvas view', exact: true })).toHaveValue('all');
});

test('navigates direct neighbors and changes the neighborhood distance and direction', async ({ page }) => {
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('tiny-pad');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Explore neighborhood', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('4 of 14 instances');
	await page.getByRole('combobox', { name: 'Distance from selection', exact: true }).selectOption('2');
	await expect(page.getByRole('status')).toContainText('7 of 14 instances');
	await page.getByRole('combobox', { name: 'Follow edges toward', exact: true }).selectOption('dependencies');
	await expect(page.getByRole('status')).toContainText('1 of 14 instances');
	const directOnly = page.getByRole('switch', { name: /Direct dependencies only/ });
	await directOnly.focus();
	await directOnly.press('Space');
	await expect(page.getByRole('status')).toContainText('0 of 14 instances');
	await directOnly.press('Space');
	await page.getByRole('combobox', { name: 'Follow edges toward', exact: true }).selectOption('both');

	const details = page.locator('#section-package');
	await details.locator('summary').filter({ hasText: 'Direct dependents' }).click();
	const consumers = page.getByRole('list', { name: 'Direct dependents', exact: true });
	await expect(consumers).toContainText('requires ^1.0.0');
	await consumers.getByRole('button', { name: /format-core/ }).click();
	await expect(details.locator('p').first()).toHaveText('@domino-demo/format-core');
	await expect(page.getByRole('combobox', { name: 'Canvas view', exact: true })).toHaveValue('neighborhood');
	await page.getByRole('button', { name: 'Back to overview', exact: true }).click();
	await expect(page.getByRole('combobox', { name: 'Canvas view', exact: true })).toHaveValue('all');
});

test('paginates large affected sets instead of rendering every package', async ({ page }) => {
	const packages: Record<string, unknown> = {
		'': { name: 'large-demo', dependencies: { origin: '1.0.0' } },
		'node_modules/origin': { version: '1.0.0' }
	};
	for (let i = 0; i < 105; i++) {
		packages[`node_modules/consumer-${i}`] = { version: '1.0.0', dev: true, dependencies: { origin: '1.0.0' } };
	}
	await page.locator('input[type="file"]').setInputFiles({
		name: 'package-lock.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify({ lockfileVersion: 3, packages }))
	});
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await expect(search).toBeEnabled();
	await search.fill('origin');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
	await page.locator('summary').filter({ hasText: 'Affected packages by distance' }).click();
	const layer = page.getByRole('list', { name: '1 hop from the simulation origins', exact: true });
	await expect(layer.getByRole('button')).toHaveCount(50);
	await expect(layer).toContainText('Development only');
	const pages = page.getByRole('navigation', { name: 'Affected package pages' });
	await pages.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(pages).toContainText('51 to 100 of 105');
	await expect(layer.getByRole('button')).toHaveCount(50);
	await pages.getByRole('button', { name: 'Next', exact: true }).click();
	await expect(layer.getByRole('button')).toHaveCount(5);
	await expect(pages.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
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

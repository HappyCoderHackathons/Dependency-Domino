import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function chooseOption(page: Page, label: string, option: string) {
	await page.getByRole('combobox', { name: label, exact: true }).click();
	await page
		.getByRole('listbox', { name: `${label} options`, exact: true })
		.getByRole('option', { name: option, exact: true })
		.click();
}

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
		advisoryLookupStatus: 'complete',
		rootBranchCount: 2
	});
	expect(report.samplePaths).toHaveLength(2);
	expect(report.samplePathEdges[0][0]).toMatchObject({ requestedRange: '^2.1.0', kind: 'runtime' });
	await chooseOption(page, 'Sample path', 'Path 2 via @domino-demo/report-gen to @domino-demo/tiny-pad');
	const chosenPath = page.getByRole('list', { name: 'Dependency path from the project root' });
	await expect(chosenPath).toContainText('@domino-demo/report-gen');
	await expect(chosenPath).not.toContainText('@domino-demo/ui-kit');
	await expect(chosenPath).toContainText('requires ^1.4.0');
	await expect(simulation).toContainText("Reached through 2 of the project's direct dependencies.");

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
	await expect(page.getByRole('combobox', { name: 'Canvas view', exact: true })).toHaveText('Overview');
});

test('ranks the most depended-on packages and starts a simulation from a ranked instance', async ({ page }) => {
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	await page.getByRole('button', { name: 'Most dependents', exact: true }).click();
	const ranking = page.getByRole('list', { name: 'Packages with the most dependents', exact: true });
	await expect(ranking.getByRole('listitem')).toHaveCount(10);
	const first = ranking.getByRole('listitem').first();
	await expect(first).toContainText('@domino-demo/tiny-pad');
	await expect(first).toContainText('6 dependent instances');
	const directOnly = page.getByRole('switch', { name: /Direct dependencies only/ });
	await directOnly.focus();
	await directOnly.press('Space');
	await expect(first).toContainText('6 dependent instances');
	await directOnly.press('Space');
	await first.getByRole('button', { name: /^Simulate compromise/ }).click();
	await expect(page.locator('#section-impact')).toContainText(
		'6 installed package instances depend on @domino-demo/tiny-pad'
	);
});

test('navigates direct neighbors and changes the neighborhood distance and direction', async ({ page }) => {
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('tiny-pad');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Explore neighborhood', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('4 of 14 instances');
	await chooseOption(page, 'Distance from selection', '2 hops');
	await expect(page.getByRole('status')).toContainText('7 of 14 instances');
	await chooseOption(page, 'Follow edges toward', 'Dependencies');
	await expect(page.getByRole('status')).toContainText('1 of 14 instances');
	const directOnly = page.getByRole('switch', { name: /Direct dependencies only/ });
	await directOnly.focus();
	await directOnly.press('Space');
	await expect(page.getByRole('status')).toContainText('0 of 14 instances');
	await directOnly.press('Space');
	await chooseOption(page, 'Follow edges toward', 'Dependencies and dependents');

	const details = page.locator('#section-package');
	await details.locator('summary').filter({ hasText: 'Direct dependents' }).click();
	const consumers = page.getByRole('list', { name: 'Direct dependents', exact: true });
	await expect(consumers).toContainText('requires ^1.0.0');
	await consumers.getByRole('button', { name: /format-core/ }).click();
	await expect(details.locator('p').first()).toHaveText('@domino-demo/format-core');
	await expect(page.getByRole('combobox', { name: 'Canvas view', exact: true })).toHaveText('Selected neighborhood');
	await page.getByRole('button', { name: 'Back to overview', exact: true }).click();
	await expect(page.getByRole('combobox', { name: 'Canvas view', exact: true })).toHaveText('Overview');
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

test('shows dependency totals and navigates other installed versions with compact labels', async ({ page }) => {
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('ui-kit');
	await search.press('Enter');
	const details = page.locator('#section-package');
	const totalRow = details
		.locator('dl > div')
		.filter({ has: page.getByText('Direct and indirect dependencies', { exact: true }) });
	await expect(totalRow.locator('dd')).toHaveText(/^4\s+Unique installed instances/);

	const labels = page.getByRole('combobox', { name: 'Package labels', exact: true });
	await chooseOption(page, 'Package labels', 'Name only');
	await expect(labels).toHaveText('Name only');
	await search.fill('date-helpers');
	await page.getByRole('listbox', { name: 'Search results' }).getByRole('option').filter({ hasText: '2.0.1' }).click();
	const copies = page.getByRole('list', { name: 'Other installed copies', exact: true });
	await expect(copies.getByRole('button')).toHaveCount(1);
	await expect(copies).toContainText('1.3.0');
	await copies.getByRole('button').click();
	await expect(details).toContainText('node_modules/@domino-demo/chart-lite/node_modules/@domino-demo/date-helpers');
	await expect(totalRow.locator('dd')).toHaveText(/^1\s+Unique installed instances/);
	await expect(copies).toContainText('2.0.1');
	await chooseOption(page, 'Package labels', 'Name and version');
	await expect(labels).toHaveText('Name and version');
});

test('custom comboboxes support keyboard navigation, disabled options, and dismissal', async ({ page }) => {
	const labels = page.getByRole('combobox', { name: 'Package labels', exact: true });
	await expect(labels).toBeDisabled();
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	const view = page.getByRole('combobox', { name: 'Canvas view', exact: true });
	await view.click();
	const views = page.getByRole('listbox', { name: 'Canvas view options', exact: true });
	await expect(views.getByRole('option', { name: 'Selected neighborhood', exact: true })).toBeDisabled();
	await expect(views.getByRole('option', { name: 'Simulated impact only', exact: true })).toBeDisabled();
	await view.press('End');
	await view.press('Enter');
	await expect(view).toHaveText('Overview');

	await labels.focus();
	await labels.press('End');
	await expect(labels).toHaveAttribute('aria-expanded', 'true');
	await expect(labels).toBeFocused();
	await labels.press('Escape');
	await expect(labels).toHaveText('Name and version');
	await expect(labels).toHaveAttribute('aria-expanded', 'false');
	await labels.press('End');
	await labels.press('Enter');
	await expect(labels).toHaveText('Name only');
	await labels.press('Home');
	await labels.press('Tab');
	await expect(labels).toHaveText('Name and version');
	await expect(labels).not.toBeFocused();
	await labels.focus();
	await labels.press('n');
	await labels.press('Enter');
	await expect(labels).toHaveText('Name only');

	await labels.click();
	await page.getByRole('banner').getByRole('img', { name: 'Dependency Domino', exact: true }).click();
	await expect(labels).toHaveAttribute('aria-expanded', 'false');
	await view.click();
	const box = await views.boundingBox();
	expect(box).not.toBeNull();
	expect(box!.y).toBeGreaterThanOrEqual(0);
	expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
	await view.press('Escape');
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('ui-kit');
	await search.press('Enter');
	await chooseOption(page, 'Canvas view', 'Selected neighborhood');
	await view.press('Home');
	await view.press('Tab');
	await expect(view).toHaveText('Overview');
	await expect(page.getByRole('button', { name: 'Graph summary', exact: true })).toBeFocused();
	await labels.click();
	await page.setViewportSize({ width: 1280, height: 720 });
	await expect(labels).toHaveAttribute('aria-expanded', 'false');
});

test.describe('touch comboboxes', () => {
	test.use({ hasTouch: true });
	test('chooses an option by touch and restores focus to the control', async ({ page }) => {
		await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).tap();
		const labels = page.getByRole('combobox', { name: 'Package labels', exact: true });
		await labels.tap();
		await page
			.getByRole('listbox', { name: 'Package labels options', exact: true })
			.getByRole('option', { name: 'Name only', exact: true })
			.tap();
		await expect(labels).toHaveText('Name only');
		await expect(labels).toHaveAttribute('aria-expanded', 'false');
		await expect(labels).toBeFocused();
	});
});

test('custom severity control filters stubbed advisory results', async ({ page }) => {
	await page.route('**/api/vulnerabilities', async (route) => {
		const { packages } = route.request().postDataJSON();
		await route.fulfill({
			json: {
				status: 'complete',
				warnings: [],
				results: packages.map((pkg: { name: string; version: string }) => ({
					...pkg,
					advisoryIds: pkg.name === '@domino-demo/tiny-pad' ? ['TEST-ONLY-advisory'] : []
				}))
			}
		});
	});
	await page.route('**/api/vulnerabilities/TEST-ONLY-advisory', (route) =>
		route.fulfill({
			json: {
				id: 'TEST-ONLY-advisory',
				summary: 'Test fixture only',
				published: null,
				severity: 'HIGH',
				aliases: []
			}
		})
	);
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	const advisories = page.getByRole('list', { name: 'Packages with known advisories', exact: true });
	await expect(advisories).toContainText('High');
	await chooseOption(page, 'Severity', 'Low');
	await expect(page.getByText('No advisories match this severity filter.', { exact: true })).toBeVisible();
	await chooseOption(page, 'Severity', 'High');
	await expect(advisories.getByRole('button')).toHaveCount(1);
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

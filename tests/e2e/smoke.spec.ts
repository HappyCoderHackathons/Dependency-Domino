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

async function graphCamera(page: Page) {
	return page.evaluate(() => {
		const host = document.querySelector('.graph') as HTMLElement & {
			_cyreg: { cy: { zoom: () => number; pan: () => { x: number; y: number } } };
		};
		return { zoom: host._cyreg.cy.zoom(), pan: host._cyreg.cy.pan() };
	});
}

const yargsFixture = fileURLToPath(new URL('../../src/lib/fixtures/real/yargs/package-lock.json', import.meta.url));
const legacyFixture = fileURLToPath(new URL('../../src/lib/fixtures/minimal-v1.json', import.meta.url));
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
	await expect(page.getByRole('status', { name: 'Canvas view status' })).toContainText('8 of 14 instances');
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
	await expect(page.getByRole('status', { name: 'Canvas view status' })).toContainText('3 of 14 instances');
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
	await expect(advisories.getByRole('button')).toHaveCount(2);
	await advisories.getByRole('button', { name: /^Simulate hypothetical compromise of/ }).click();
	await expect(page.locator('#section-impact')).toContainText(
		'6 installed package instances depend on @domino-demo/tiny-pad'
	);
	await expect(page.locator('#section-package')).toContainText('@domino-demo/tiny-pad');
});

test('supports fuzzy search, guarded shortcuts, and confirmed lockfile closure', async ({ page }) => {
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Dismiss graph hint' })).toBeVisible();
	await page.keyboard.press('/');
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await expect(search).toBeFocused();
	await expect(search).toHaveValue('');
	await search.fill('tiny-pda');
	await expect(page.getByText('Closest matches', { exact: true })).toBeVisible();
	await search.press('Enter');
	await expect(page.getByRole('button', { name: 'Dismiss graph hint' })).toHaveCount(0);
	await search.press('s');
	await expect(page.getByRole('button', { name: 'Frame the simulated impact' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Fit graph to view', exact: true }).focus();
	await page.keyboard.press('s');
	await expect(page.locator('#section-impact')).toContainText('6 installed package instances depend on');
	await page.keyboard.press('i');
	await page.keyboard.press('f');
	await page.keyboard.press('[');
	await expect(page.getByRole('button', { name: 'Expand overview', exact: true })).toBeVisible();
	await page.keyboard.press('[');
	await expect(page.getByRole('button', { name: 'Collapse overview', exact: true })).toBeVisible();
	await page.keyboard.press(']');
	await expect(page.getByRole('button', { name: 'Expand package', exact: true })).toBeVisible();
	await page.keyboard.press(']');
	await page.getByRole('banner').getByRole('button', { name: 'Close lockfile', exact: true }).click();
	const confirmation = page.getByRole('dialog', { name: 'Close the current lockfile?' });
	await expect(confirmation).toBeVisible();
	await confirmation.getByRole('button', { name: 'Keep working' }).click();
	await expect(page.getByRole('button', { name: 'Frame the simulated impact' })).toBeVisible();
	await page.getByRole('banner').getByRole('button', { name: 'Close lockfile', exact: true }).click();
	await confirmation.getByRole('button', { name: 'Close lockfile', exact: true }).click();
	await expect(search).toBeDisabled();
	await expect(search).toHaveValue('');
	await expect(page.getByRole('button', { name: 'Frame the simulated impact' })).toHaveCount(0);
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Dismiss graph hint' })).toHaveCount(0);
	// Without an active simulation, closing is immediate.
	await page.getByRole('banner').getByRole('button', { name: 'Close lockfile', exact: true }).click();
	await expect(search).toBeDisabled();
	await expect(confirmation).not.toBeVisible();
});

test('explains the model in a modal and scopes Escape to the current interaction', async ({ page }) => {
	const help = page.getByRole('button', { name: 'How it works', exact: true });
	await help.click();
	const explanation = page.getByRole('dialog', { name: 'How it works', exact: true });
	await expect(explanation).toContainText('installed package instance');
	await expect(explanation).toContainText('Only validated package names and versions');
	await page.keyboard.press('Escape');
	await expect(explanation).not.toBeVisible();
	await expect(help).toBeFocused();
	await page.keyboard.press('?');
	const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts', exact: true });
	await expect(shortcuts).toContainText('Toggle overview sidebar');
	await page.keyboard.press('Escape');
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	await page.getByRole('button', { name: 'Dismiss graph hint' }).click();
	await page.keyboard.press('/');
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('tiny-pad');
	await search.press('Enter');
	await search.press('Escape');
	await expect(page.locator('#section-package')).toContainText('@domino-demo/tiny-pad');
	await page.getByRole('button', { name: 'Fit graph to view', exact: true }).focus();
	await page.keyboard.press('s');
	await page.keyboard.press('Escape');
	await expect(page.locator('#section-package')).toContainText('Select a package');
	await expect(page.getByRole('button', { name: 'Frame the simulated impact' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Frame the simulated impact' })).toHaveCount(0);
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

for (const viewport of [
	{ width: 390, height: 844 },
	{ width: 820, height: 1180 }
]) {
	test(`uses modal drawers without squeezing the canvas at ${viewport.width}px`, async ({ page }) => {
		await page.setViewportSize(viewport);
		await expect(page.getByRole('button', { name: 'Open overview drawer' })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
		const graph = page.locator('.graph');
		expect((await graph.boundingBox())!.width).toBeGreaterThan(viewport.width - 4);
		await page.getByRole('button', { name: 'Open overview drawer' }).click();
		const overview = page.getByRole('dialog', { name: 'Overview drawer', exact: true });
		await expect(overview).toBeVisible();
		await page.mouse.click(viewport.width - 8, 200);
		await expect(overview).not.toBeVisible();
		await page.getByRole('button', { name: 'Open overview drawer' }).click();
		const search = overview.getByRole('combobox', { name: 'Search packages by name' });
		await search.fill('tiny-pad');
		await search.press('Enter');
		const details = page.getByRole('dialog', { name: 'Package drawer', exact: true });
		await expect(details).toBeVisible();
		await expect(overview).not.toBeVisible();
		await details.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
		await expect(details).not.toBeVisible();
		await page.getByRole('button', { name: 'Open package drawer' }).click();
		await expect(details).toContainText('6 installed package instances depend on');
		await page.keyboard.press('Escape');
		await expect(details).not.toBeVisible();
		await expect(page.getByRole('button', { name: 'Open package drawer' })).toBeFocused();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});
}

test('recovers a canvas layout failure without losing the imported graph', async ({ page }) => {
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	await expect(page.getByRole('radio', { name: 'Auto' })).toBeVisible();
	await page.evaluate(() => {
		const host = document.querySelector('.graph') as HTMLElement & { _cyreg: { cy: { elements: () => object } } };
		const prototype = Object.getPrototypeOf(host._cyreg.cy.elements());
		const original = prototype.layout;
		prototype.layout = function () {
			prototype.layout = original;
			throw new Error('Intentional layout failure for recovery test');
		};
	});
	await page.getByRole('radio', { name: 'Left to right', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('workspace needs to restart');
	await expect(page.getByRole('banner')).toContainText('demo (bundled)');
	await page.getByRole('button', { name: 'Try again', exact: true }).click();
	await expect(page.locator('canvas').first()).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Search packages by name' })).toBeEnabled();
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('tiny-pad');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
	await expect(page.locator('#section-impact')).toContainText('6 installed package instances depend on');
});

test('imports an npm v1 tree and explains its unavailable root declarations', async ({ page }) => {
	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('banner').getByRole('button', { name: 'Import lockfile', exact: true }).click();
	await (await chooser).setFiles(legacyFixture);
	await expect(page.getByRole('contentinfo')).toContainText('Lockfile version: 1');
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('@scope/util');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
	await expect(page.locator('#section-impact')).toContainText('2 installed package instances depend on');
	await page
		.getByRole('button', { name: /warnings$/, exact: false })
		.first()
		.click();
	await expect(page.getByRole('region', { name: 'Parser warnings' })).toContainText('root manifest');
});

test('shows linked project members and resolved hosts from an npm import', async ({ page }) => {
	const lockfile = {
		lockfileVersion: 3,
		packages: {
			'': { name: 'workspace-example', workspaces: ['packages/*'], dependencies: { web: 'file:packages/web' } },
			'node_modules/web': { link: true, resolved: 'packages/web' },
			'packages/web': { name: 'web', version: '1.0.0', dependencies: { utility: '^1.0.0' } },
			'node_modules/utility': { version: '1.0.0', resolved: 'https://mirror.example/utility.tgz?private=value' }
		}
	};
	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('banner').getByRole('button', { name: 'Import lockfile', exact: true }).click();
	await (
		await chooser
	).setFiles({
		name: 'package-lock.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(lockfile))
	});
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('web');
	await search.press('Enter');
	await expect(page.locator('#section-package')).toContainText('Project member');
	await expect(page.locator('#section-package')).toContainText('packages/web');
	await search.fill('utility');
	await search.press('Enter');
	await expect(page.locator('#section-package')).toContainText('mirror.example');
	await expect(page.locator('#section-package')).toContainText('This host has not been contacted or assessed.');
	await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
	await expect(page.locator('#section-impact')).toContainText('1 installed package instance depends on utility');
	await expect(page.getByRole('list', { name: 'Packages on every root-to-origin path' })).toContainText('web');
	await expect(page.locator('#section-summary')).toContainText('Outside the default registry host');
});

test('uses the app theme and a working return link on an unknown route', async ({ page }) => {
	await page.goto('/missing-page-for-error-test');
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await page.getByRole('link', { name: 'Return to Dependency Domino' }).click();
	await expect(page.getByRole('banner')).toBeVisible();
	await expect(page.locator('canvas').first()).toBeVisible();
});

test('uses keyboard and node context actions for focused dependent views and removal previews', async ({ page }) => {
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('format-core');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Package actions', exact: true }).focus();
	await page.keyboard.press('Shift+F10');
	const menu = page.getByRole('menu', { name: 'Package quick actions' });
	await expect(menu).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(menu).not.toBeVisible();
	await expect(page.getByRole('button', { name: 'Package actions', exact: true })).toBeFocused();
	// A real Cytoscape cxttap uses the same menu as the keyboard route.
	await page.evaluate(() => {
		const host = document.querySelector('.graph') as HTMLElement & {
			_cyreg: { cy: { nodes: (selector: string) => { emit: (event: string) => void } } };
		};
		host._cyreg.cy.nodes('[name="@domino-demo/format-core"]').emit('cxttap');
	});
	await expect(menu).toBeVisible();
	await menu.getByRole('menuitem', { name: 'Show dependents only' }).click();
	await expect(page.getByRole('combobox', { name: 'Canvas view', exact: true })).toHaveText('Selected dependents only');
	await page.getByRole('button', { name: 'Package actions', exact: true }).click();
	await menu.getByRole('menuitem', { name: 'Preview removal', exact: true }).click();
	await expect(page.locator('#section-impact')).toContainText('Hypothetical removal preview');
	await expect(page.locator('#section-impact')).toContainText('original graph stays visible');
	await page.getByRole('button', { name: 'Clear removal preview', exact: true }).click();
	await expect(page.locator('#section-impact')).not.toContainText('Hypothetical removal preview');
});

test('steps and replays a cascade, then cancels playback when the origin changes', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('tiny-pad');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
	const playback = page.getByRole('group', { name: 'Cascade playback' });
	await playback.getByRole('button', { name: 'Pause cascade' }).click();
	await playback.getByRole('button', { name: 'Replay cascade' }).click();
	await playback.getByRole('button', { name: 'Pause cascade' }).click();
	await expect(playback).toContainText('Layer 1 of 4');
	await playback.getByRole('button', { name: 'Next cascade layer' }).click();
	await expect(playback).toContainText('Layer 2 of 4');
	await playback.getByRole('button', { name: 'Previous cascade layer' }).click();
	await expect(playback).toContainText('Layer 1 of 4');
	await playback.getByRole('button', { name: 'Play cascade', exact: true }).click();
	await expect(playback).toContainText('Layer 4 of 4');
	await playback.getByRole('button', { name: 'Replay cascade' }).click();
	await search.fill('string-utils');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
	await expect(page.locator('#section-impact')).toContainText(
		'3 installed package instances depend on @domino-demo/string-utils'
	);
	await page.getByRole('banner').getByRole('button', { name: 'Reset', exact: true }).click();
	await expect(playback).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Frame the simulated impact' })).toHaveCount(0);
});

test('keeps minimap geometry cached during pan and zoom and supports pointer and keyboard panning', async ({
	page
}) => {
	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('banner').getByRole('button', { name: 'Import lockfile', exact: true }).click();
	const dependencies = Object.fromEntries(Array.from({ length: 700 }, (_, i) => [`package-${i}`, '1.0.0']));
	const packages = {
		'': { name: 'minimap-fixture', dependencies },
		...Object.fromEntries(Object.keys(dependencies).map((name) => [`node_modules/${name}`, { version: '1.0.0' }]))
	};
	await (
		await chooser
	).setFiles({
		name: 'package-lock.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify({ lockfileVersion: 3, packages }))
	});
	const minimap = page.getByRole('button', { name: /^Graph minimap\./ });
	await expect(minimap).toBeVisible();
	await page.evaluate(async () => {
		await new Promise(requestAnimationFrame);
		await new Promise(requestAnimationFrame);
	});
	const counts = await page.evaluate(async () => {
		const view = document.querySelector('canvas[aria-label^="Graph minimap"]') as HTMLCanvasElement;
		const scene = view.previousElementSibling as HTMLCanvasElement;
		const sceneContext = scene.getContext('2d')!;
		const viewContext = view.getContext('2d')!;
		let scenes = 0,
			views = 0;
		const fill = sceneContext.fillRect.bind(sceneContext),
			stroke = viewContext.strokeRect.bind(viewContext);
		sceneContext.fillRect = (...args) => {
			scenes++;
			fill(...args);
		};
		viewContext.strokeRect = (...args) => {
			views++;
			stroke(...args);
		};
		const host = document.querySelector('.graph') as HTMLElement & {
			_cyreg: { cy: { panBy: (position: { x: number; y: number }) => void; zoom: (level?: number) => number } };
		};
		host._cyreg.cy.panBy({ x: 20, y: 10 });
		host._cyreg.cy.zoom(host._cyreg.cy.zoom() * 1.1);
		await new Promise(requestAnimationFrame);
		await new Promise(requestAnimationFrame);
		sceneContext.fillRect = fill;
		viewContext.strokeRect = stroke;
		return { scenes, views };
	});
	expect(counts.scenes).toBe(0);
	expect(counts.views).toBeGreaterThan(0);
	await minimap.click({ position: { x: 40, y: 40 } });
	await minimap.press('ArrowRight');
	await page.getByRole('button', { name: 'Toggle graph minimap' }).click();
	await expect(minimap).toHaveCount(0);
});

test('downloads bounded graph PNGs and a branded simulation summary', async ({ page }, testInfo) => {
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('tiny-pad');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
	await chooseOption(page, 'Sample path', 'Path 2 via @domino-demo/report-gen to @domino-demo/tiny-pad');
	const summaryDownload = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download summary PNG', exact: true }).click();
	const summary = await summaryDownload;
	expect(summary.suggestedFilename()).toBe('dependency-domino-demo-bundled-domino-demo-tiny-pad-summary.png');
	await summary.saveAs(testInfo.outputPath('summary.png'));
	const summaryBytes = await readFile((await summary.path())!);
	expect(summaryBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
	expect(summaryBytes.readUInt32BE(16)).toBe(1600);
	expect(summaryBytes.readUInt32BE(20)).toBe(900);
	// Decode the actual output and check an opaque app-background pixel.
	const color = await page.evaluate(async (encoded) => {
		const image = new Image();
		image.src = `data:image/png;base64,${encoded}`;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		const context = canvas.getContext('2d')!;
		context.drawImage(image, 0, 0);
		return [...context.getImageData(0, 0, 1, 1).data];
	}, summaryBytes.toString('base64'));
	expect(color).toEqual([15, 23, 42, 255]);
	const exportControl = page.getByText('Export PNG', { exact: true });
	await exportControl.click();
	const camera = await graphCamera(page);
	for (const [label, suffix] of [
		['Download current view PNG', 'graph-view'],
		['Download full graph PNG', 'graph-full']
	]) {
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: label, exact: true }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toBe(`dependency-domino-demo-bundled-domino-demo-tiny-pad-${suffix}.png`);
		const bytes = await readFile((await download.path())!);
		expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
		expect(bytes.readUInt32BE(16)).toBeGreaterThan(0);
		expect(bytes.readUInt32BE(16)).toBeLessThanOrEqual(4096);
		expect(bytes.readUInt32BE(20)).toBeGreaterThan(0);
		expect(bytes.readUInt32BE(20)).toBeLessThanOrEqual(4096);
		await download.saveAs(testInfo.outputPath(`${suffix}.png`));
		expect(await graphCamera(page)).toEqual(camera);
	}
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Download current view PNG' })).not.toBeVisible();
	await expect(page.getByRole('button', { name: 'Frame the simulated impact' })).toBeVisible();
});

test('recovers PNG export failures without discarding the analysis', async ({ page }) => {
	await page.getByRole('banner').getByRole('button', { name: 'Try demo', exact: true }).click();
	const camera = await graphCamera(page);
	await page.evaluate(() => {
		const host = document.querySelector('.graph') as HTMLElement & { _cyreg: { cy: { png: () => void } } };
		host._cyreg.cy.png = () => {
			throw new Error('Intentional export failure');
		};
	});
	await page.getByText('Export PNG', { exact: true }).click();
	await page.getByRole('button', { name: 'Download current view PNG', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Could not export the graph PNG');
	await page.getByRole('button', { name: 'Download full graph PNG', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Could not export the graph PNG');
	expect(await graphCamera(page)).toEqual(camera);
	await page.keyboard.press('Escape');
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('tiny-pad');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
	await page.evaluate(() => {
		HTMLCanvasElement.prototype.toBlob = function (callback) {
			callback(null);
		};
	});
	await page.getByRole('button', { name: 'Download summary PNG', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Could not export the summary PNG');
	await expect(page.locator('#section-impact')).toContainText('6 installed package instances depend on');
});

test('exports a folded summary for a deep path with a long package name', async ({ page }, testInfo) => {
	const packages: Record<string, object> = { '': { name: 'deep-project', dependencies: { p0: '1.0.0' } } };
	for (let i = 0; i < 9; i++)
		packages[`node_modules/p${i}`] = {
			name: i === 8 ? `@scope/${'long-origin-'.repeat(10)}package` : `package-${i}`,
			version: '1.0.0',
			...(i < 8 ? { dependencies: { [`p${i + 1}`]: '1.0.0' } } : {})
		};
	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('banner').getByRole('button', { name: 'Import lockfile', exact: true }).click();
	await (
		await chooser
	).setFiles({
		name: 'package-lock.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify({ lockfileVersion: 3, packages }))
	});
	const search = page.getByRole('combobox', { name: 'Search packages by name' });
	await search.fill('long-origin');
	await search.press('Enter');
	await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
	const pending = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download summary PNG', exact: true }).click();
	const download = await pending;
	await download.saveAs(testInfo.outputPath('folded-summary.png'));
	const bytes = await readFile((await download.path())!);
	expect(bytes.readUInt32BE(16)).toBe(1600);
	expect(bytes.readUInt32BE(20)).toBe(900);
});

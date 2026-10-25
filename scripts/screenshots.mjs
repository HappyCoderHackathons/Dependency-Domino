// Captures the README screenshots from a running dev server: node scripts/screenshots.mjs [base URL]
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = 'docs/screenshots';
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, colorScheme: 'dark' });
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });

await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /^Real project/ }).waitFor();
await shot('01-start');

await page.getByRole('button', { name: /^Real project/ }).click();
await page.getByText(/OSV lookup (complete|partial|failed)/).waitFor({ timeout: 60_000 });
await page.waitForTimeout(1500);
await shot('02-graph-overview');

const search = page.getByRole('combobox', { name: 'Search packages by name' });
await search.fill('is-number');
await search.press('Enter');
await page.getByRole('button', { name: 'Simulate compromise', exact: true }).click();
await page.waitForTimeout(700);
await shot('03-simulation-animating');
await page.waitForTimeout(5000);
await page.getByRole('button', { name: 'Details', exact: true }).click();
await page.keyboard.press('i');
await page.waitForTimeout(1000);
await shot('04-simulation-result');
await page.getByRole('button', { name: 'Details', exact: true }).click();

await page.getByRole('button', { name: 'Reset' }).click();
const advisory = page.locator('#section-advisories li button').first();
if (await advisory.count()) {
	await advisory.click();
	await page.getByRole('button', { name: 'Details', exact: true }).click();
	await page.waitForTimeout(1500);
	await shot('05-advisory-panel');
} else console.warn('No OSV advisories returned; skipped 05-advisory-panel');

await browser.close();

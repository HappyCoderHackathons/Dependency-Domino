// Writes the mdi icons used in src/ to src/lib/icons.json so the app never fetches icons at runtime.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getIcons } from '@iconify/utils';

const collection = JSON.parse(readFileSync('node_modules/@iconify-json/mdi/icons.json', 'utf8'));

function* files(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (/\.(svelte|ts)$/.test(entry.name) && !entry.name.includes('.test.')) yield path;
	}
}

const names = new Set();
for (const file of files('src')) {
	for (const match of readFileSync(file, 'utf8').matchAll(/mdi:([a-z0-9-]+)/g)) names.add(match[1]);
}

const subset = getIcons(collection, [...names].sort(), true);
if (!subset) throw new Error('No icons found');
const missing = [...names].filter((name) => !subset.icons[name] && !subset.aliases?.[name]);
if (missing.length) throw new Error(`Unknown mdi icons: ${missing.join(', ')}`);

writeFileSync('src/lib/icons.json', JSON.stringify(subset) + '\n');
console.log(`Wrote ${names.size} icons to src/lib/icons.json`);

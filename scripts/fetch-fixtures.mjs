// Downloads real-world lockfiles used by the parser tests. They are pinned to a commit and a
// SHA-256 hash, and kept out of git because of their size.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const fixtures = [
	{
		path: 'src/lib/fixtures/real/yargs/package-lock.json',
		url: 'https://raw.githubusercontent.com/yargs/yargs/8021675da05763e13d9744aef953be65c0fd878f/package-lock.json',
		sha256: '36dd6f0f2f39aa69328886a43ce43c4b8d9ce5315e8dcb726d9812686787fb6e'
	}
];

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

for (const fixture of fixtures) {
	const existing = await readFile(fixture.path).catch(() => null);
	if (existing && sha256(existing) === fixture.sha256) {
		console.log(`up to date: ${fixture.path}`);
		continue;
	}

	const response = await fetch(fixture.url);
	if (!response.ok) throw new Error(`Could not download ${fixture.url}: HTTP ${response.status}`);
	const data = Buffer.from(await response.arrayBuffer());
	if (sha256(data) !== fixture.sha256) throw new Error(`Hash mismatch for ${fixture.url}`);

	await mkdir(dirname(fixture.path), { recursive: true });
	await writeFile(fixture.path, data);
	console.log(`downloaded: ${fixture.path}`);
}

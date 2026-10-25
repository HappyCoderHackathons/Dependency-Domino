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
	},
	{
		path: 'src/lib/fixtures/real/pnpm/pnpm-lock.yaml',
		url: 'https://raw.githubusercontent.com/pnpm/pnpm/0b20affa4210172e9a43446dd8c864a73d66ba94/pnpm-lock.yaml',
		sha256: '7a0b00db61dbe228d144939205b0e18380171d49363d5f052a39519f227aebda'
	},
	{
		path: 'src/lib/fixtures/real/yarn/yarn.lock',
		url: 'https://raw.githubusercontent.com/yarnpkg/berry/ef16bb2e5826f2b4c342f387e4ac50fea86d4a51/yarn.lock',
		sha256: 'a42335d25c0a07524eda88f446be540ddf7852901e953aed81e2d9b337140d1a'
	},
	{
		path: 'src/lib/fixtures/real/yarn-classic/yarn.lock',
		url: 'https://raw.githubusercontent.com/yarnpkg/yarn/c2dda503f3759b5be5f0e24ecd9cf5c97a540147/yarn.lock',
		sha256: 'e71319d97083d9562b04b4bad9fe500e14cd36055db66ab9f06db82df9093dac'
	},
	{
		path: 'src/lib/fixtures/real/bun/bun.lock',
		url: 'https://raw.githubusercontent.com/oven-sh/bun/179664ea89f402c02af3fcd13b9bafeff1b7bcfd/bun.lock',
		sha256: 'd212e788d345c0b8db561d9884114d918ded0ade1e818eea3f9647b005c8be17'
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

import { describe, expect, it } from 'vitest';
import { parseDependencyLockfile } from '#lib/parser/import.js';
import { MANIFEST_MESSAGE, isManifestFilename, isPackageManifest } from '#lib/parser/manifest.js';

const manifest = JSON.stringify({
	name: 'app',
	version: '1.0.0',
	dependencies: { 'left-pad': '^1.3.0' },
	devDependencies: { vitest: '^4.0.0' }
});

describe('isPackageManifest', () => {
	it.each([
		[{ name: 'app', version: '1.0.0' }],
		[{ dependencies: { a: '1' } }],
		[{ scripts: { test: 'vitest' } }],
		[{ name: 'mono', workspaces: { packages: ['packages/*'] }, devDependencies: {} }]
	])('recognizes %j', (data) => {
		expect(isPackageManifest(data)).toBe(true);
	});

	it.each([
		[{ lockfileVersion: 3, packages: {} }],
		[{ lockfileVersion: 1, name: 'app', version: '1.0.0', dependencies: {} }],
		[{ lockfileVersion: 1, workspaces: { '': {} }, packages: {} }],
		[{ unrelated: true }],
		[[]],
		[null],
		['package.json']
	])('leaves %j alone', (data) => {
		expect(isPackageManifest(data)).toBe(false);
	});
});

describe('isManifestFilename', () => {
	it('matches package.json only, ignoring case', () => {
		expect(isManifestFilename('package.json')).toBe(true);
		expect(isManifestFilename('Package.JSON')).toBe(true);
		expect(isManifestFilename('package-lock.json')).toBe(false);
	});
});

describe('manifest input through the shared importer', () => {
	it('returns the new error code for a package.json file name', () => {
		expect(parseDependencyLockfile(manifest, 'package.json')).toEqual({
			ok: false,
			code: 'package_manifest',
			message: MANIFEST_MESSAGE
		});
	});

	it('also catches a renamed manifest or pasted content with no file name', () => {
		expect(parseDependencyLockfile(manifest, 'package (1).json')).toMatchObject({ code: 'package_manifest' });
		expect(parseDependencyLockfile(manifest)).toMatchObject({ code: 'package_manifest' });
	});

	it('does not mistake a yarn-style workspaces manifest for a bun lockfile', () => {
		const text = JSON.stringify({ name: 'mono', workspaces: { packages: ['packages/*'] }, private: true });
		expect(parseDependencyLockfile(text)).toMatchObject({ ok: false, code: 'package_manifest' });
	});

	it('still imports real lockfiles', () => {
		const npm = '{"lockfileVersion":3,"packages":{"":{}}}';
		const bun = '{"lockfileVersion":1,"workspaces":{"":{}},"packages":{},}';
		expect(parseDependencyLockfile(npm, 'package-lock.json')).toMatchObject({ ok: true, format: 'npm' });
		expect(parseDependencyLockfile(bun, 'bun.lock')).toMatchObject({ ok: true, format: 'bun' });
		expect(parseDependencyLockfile(npm)).toMatchObject({ ok: true });
	});

	it('names every lockfile and how to create it', () => {
		for (const text of ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'npm install', 'pnpm install'])
			expect(MANIFEST_MESSAGE).toContain(text);
	});
});
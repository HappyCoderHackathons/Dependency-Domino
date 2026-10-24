import { describe, expect, it, vi } from 'vitest';
import {
	buildPackageNodes,
	classifySource,
	inferPackageName,
	MAX_LOCKFILE_BYTES,
	validateLockfile,
	validateLockfileFile,
	type ValidatedLockfile
} from '#lib/parser/lockfile.js';
import v2 from '#lib/fixtures/minimal-v2.json';
import v3 from '#lib/fixtures/minimal-v3.json';

describe('validateLockfile', () => {
	it.each([v2, v3])('accepts a minimal fixture (v$lockfileVersion)', (fixture) => {
		expect(validateLockfile(JSON.stringify(fixture))).toEqual({ ok: true, lockfile: fixture });
	});

	it.each(['', '{', '{"private-content":'])('returns a safe error for malformed JSON: %j', (text) => {
		const result = validateLockfile(text);
		expect(result).toEqual({
			ok: false,
			code: 'invalid_json',
			message: 'Could not parse this file. Choose a valid package-lock.json.'
		});
	});

	it.each([null, [], 'text', 1, true])('rejects a non-object top level: %j', (value) => {
		expect(validateLockfile(JSON.stringify(value))).toMatchObject({ ok: false, code: 'not_object' });
	});

	it.each([undefined, null, '2', '3', true, {}, [], 0, 1, 4, 2.5])('rejects version %j', (lockfileVersion) => {
		expect(validateLockfile(JSON.stringify({ lockfileVersion, packages: {} }))).toMatchObject({
			ok: false,
			code: 'unsupported_version'
		});
	});

	it('explains how to replace a v1 lockfile', () => {
		expect(validateLockfile('{"lockfileVersion":1}')).toEqual({
			ok: false,
			code: 'unsupported_version',
			message: 'Lockfile version 1 is not supported. Use npm 7 or later to generate lockfile version 2 or 3.'
		});
	});

	it.each([undefined, null, [], 'packages', 1, false])('rejects an invalid packages map: %j', (packages) => {
		expect(validateLockfile(JSON.stringify({ lockfileVersion: 3, packages }))).toMatchObject({
			ok: false,
			code: 'missing_packages'
		});
	});

	it('accepts an empty packages map for later root fallback handling', () => {
		expect(validateLockfile('{"lockfileVersion":3,"packages":{}}')).toMatchObject({ ok: true });
	});

	it('does not substitute the legacy dependencies tree for packages', () => {
		expect(validateLockfile('{"lockfileVersion":2,"dependencies":{}}')).toMatchObject({
			ok: false,
			code: 'missing_packages'
		});
	});
});

describe('lockfile size limit', () => {
	it('rejects an oversized file before reading it', async () => {
		const text = vi.fn<() => Promise<string>>();
		expect(await validateLockfileFile({ size: MAX_LOCKFILE_BYTES + 1, text })).toEqual({
			ok: false,
			code: 'too_large',
			message: 'Lockfiles must be 10 MiB or smaller.'
		});
		expect(text).not.toHaveBeenCalled();
	});

	it('accepts text exactly at the limit and rejects one byte more', () => {
		const json = JSON.stringify(v3);
		const text = json.padEnd(MAX_LOCKFILE_BYTES, ' ');
		expect(validateLockfile(text)).toMatchObject({ ok: true });
		expect(validateLockfile(text + ' ')).toMatchObject({ ok: false, code: 'too_large' });
	});

	it('measures UTF-8 bytes as well as string length', () => {
		const text = JSON.stringify({ ...v3, name: 'é'.repeat(MAX_LOCKFILE_BYTES / 2) });
		expect(text.length).toBeLessThan(MAX_LOCKFILE_BYTES);
		expect(validateLockfile(text)).toMatchObject({ ok: false, code: 'too_large' });
	});

	it('validates file contents after an allowed size check', async () => {
		const text = JSON.stringify(v3);
		expect(await validateLockfileFile({ size: text.length, text: async () => text })).toMatchObject({ ok: true });
		expect(await validateLockfileFile({ size: 1, text: async () => '{' })).toMatchObject({
			ok: false,
			code: 'invalid_json'
		});
	});
});

function lockfile(packages: Record<string, unknown>, extra: Record<string, unknown> = {}): ValidatedLockfile {
	return { lockfileVersion: 3, ...extra, packages };
}

describe('buildPackageNodes root', () => {
	it('uses the root descriptor name', () => {
		const { nodes, warnings } = buildPackageNodes(lockfile({ '': { name: 'app', version: '1.0.0' } }, { name: 'top' }));
		expect(nodes[0]).toMatchObject({ id: '', name: 'app', version: '1.0.0', direct: false, source: 'unknown' });
		expect(warnings).toEqual([]);
	});

	it('falls back to the top-level name, then "root", and warns when the root entry is missing', () => {
		expect(buildPackageNodes(lockfile({ '': {} }, { name: 'top' })).nodes[0].name).toBe('top');

		const { nodes, warnings } = buildPackageNodes(lockfile({}));
		expect(nodes).toEqual([expect.objectContaining({ id: '', name: 'root', version: null })]);
		expect(warnings).toHaveLength(1);
	});
});

describe('inferPackageName', () => {
	it.each([
		['node_modules/a', 'a'],
		['node_modules/@s/b', '@s/b'],
		['node_modules/a/node_modules/@s/b', '@s/b'],
		['packages/web/node_modules/c', 'c'],
		['packages/web', null],
		['node_modules/@s', null]
	])('%s -> %s', (path, expected) => {
		expect(inferPackageName(path)).toBe(expected);
	});

	it('prefers the explicit name field for aliased installs', () => {
		expect(inferPackageName('node_modules/alias', 'real-package')).toBe('real-package');
	});
});

describe('buildPackageNodes instances', () => {
	it('keeps duplicate package names at different paths as separate nodes', () => {
		const { nodes, warnings } = buildPackageNodes(
			lockfile({
				'': { name: 'app' },
				'node_modules/b': { version: '2.0.0' },
				'node_modules/a': { version: '1.0.0' },
				'node_modules/a/node_modules/b': { version: '1.0.0' }
			})
		);
		expect(nodes.filter((node) => node.name === 'b')).toEqual([
			expect.objectContaining({ id: 'node_modules/b', version: '2.0.0' }),
			expect.objectContaining({ id: 'node_modules/a/node_modules/b', version: '1.0.0' })
		]);
		expect(nodes).toHaveLength(4);
		expect(warnings).toEqual([]);
	});

	it('skips workspace folders and invalid entries with warnings', () => {
		const { nodes, warnings } = buildPackageNodes(
			lockfile({ '': {}, 'packages/web': { version: '1.0.0' }, 'node_modules/x': null })
		);
		expect(nodes.map((node) => node.id)).toEqual(['']);
		expect(warnings).toHaveLength(2);
	});
});

describe('classifySource', () => {
	it.each([
		[{ resolved: 'packages/web', link: true }, 'link'],
		[{ resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz' }, 'registry'],
		[{ resolved: 'https://npm.example.com/a/-/a-1.0.0.tgz?token=x' }, 'registry'],
		[{ resolved: 'git+ssh://git@github.com/o/r.git#abc' }, 'other'],
		[{ resolved: 'github:o/r' }, 'other'],
		[{ resolved: 'file:../a' }, 'other'],
		[{ resolved: 'https://' }, 'other'],
		[{}, 'unknown']
	])('%j -> %s', (descriptor, expected) => {
		expect(classifySource(descriptor)).toBe(expected);
	});
});

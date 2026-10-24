import { describe, expect, it, vi } from 'vitest';
import { parseDependencyFile, parseDependencyLockfile } from '#lib/parser/import.js';
import { MAX_LOCKFILE_BYTES } from '#lib/parser/lockfile.js';

describe('shared lockfile import', () => {
	it.each([
		['package-lock.json', '{"lockfileVersion":3,"packages":{"":{}}}', 'npm'],
		['pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters: {'.': {}}", 'pnpm'],
		['yarn.lock', '# yarn lockfile v1\n', 'yarn'],
		['bun.lock', '{"lockfileVersion":1,"workspaces":{"":{}},"packages":{},}', 'bun']
	])('imports %s through the same graph contract', (filename, text, format) => {
		expect(parseDependencyLockfile(text, filename)).toMatchObject({
			ok: true,
			format,
			graph: { nodes: [expect.objectContaining({ id: '' })] }
		});
	});

	it('detects recognizable content when no filename is provided', () => {
		expect(parseDependencyLockfile("lockfileVersion: '9.0'\nimporters: {'.': {}}")).toMatchObject({
			ok: true,
			format: 'pnpm'
		});
	});

	it('rejects binary Bun and oversized files before reading their contents', async () => {
		const text = vi.fn();
		expect(await parseDependencyFile({ name: 'bun.lockb', size: 12, text })).toMatchObject({
			ok: false,
			code: 'unsupported_format'
		});
		expect(await parseDependencyFile({ name: 'yarn.lock', size: MAX_LOCKFILE_BYTES + 1, text })).toMatchObject({
			ok: false,
			code: 'too_large'
		});
		expect(text).not.toHaveBeenCalled();
	});

	it('reports read failures and unsupported files without throwing', async () => {
		expect(
			await parseDependencyFile({
				name: 'yarn.lock',
				size: 1,
				text: vi.fn().mockRejectedValue(new Error('read failed'))
			})
		).toMatchObject({ ok: false });
		expect(parseDependencyLockfile('not a lockfile', 'unknown.txt')).toMatchObject({
			ok: false,
			code: 'unsupported_format'
		});
	});
});

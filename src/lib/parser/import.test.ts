import { describe, expect, it, vi } from 'vitest';
import {
	fetchGitHubPackageLockfile,
	parseDependencyFile,
	parseDependencyLockfile,
	parseGitHubRepositoryUrl
} from '#lib/parser/import.js';
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

	it('parses only GitHub repository URLs', () => {
		expect(parseGitHubRepositoryUrl('https://github.com/octo/project')).toEqual({
			owner: 'octo',
			repository: 'project'
		});
		expect(parseGitHubRepositoryUrl('https://github.com/octo/project.git')).toEqual({
			owner: 'octo',
			repository: 'project'
		});
		expect(parseGitHubRepositoryUrl('https://example.com/octo/project')).toBeNull();
		expect(parseGitHubRepositoryUrl('https://github.com/octo/project/issues')).toBeNull();
	});

	it('fetches the package lockfile from the default branch and reuses the shared parser', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: 'main' }), { status: 200 }))
			.mockResolvedValueOnce(
				new Response('{"lockfileVersion":3,"packages":{"":{}}}', {
					status: 200,
					headers: { 'content-length': '35' }
				})
			);

		expect(await fetchGitHubPackageLockfile('https://github.com/octo/project', fetchFn)).toMatchObject({
			ok: true,
			format: 'npm',
			lockfileVersion: 3
		});
		expect(fetchFn).toHaveBeenNthCalledWith(2, 'https://raw.githubusercontent.com/octo/project/main/package-lock.json');
	});

	it('rejects a remote lockfile over the shared size limit', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: 'main' }), { status: 200 }))
			.mockResolvedValueOnce(
				new Response('', {
					status: 200,
					headers: { 'content-length': String(MAX_LOCKFILE_BYTES + 1) }
				})
			);
		expect(await fetchGitHubPackageLockfile('https://github.com/octo/project', fetchFn)).toMatchObject({
			ok: false,
			code: 'too_large'
		});
	});
});

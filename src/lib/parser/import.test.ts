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
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});

	it.each([
		['npm-shrinkwrap.json', '{"lockfileVersion":3,"packages":{"":{}}}', 'npm'],
		['pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters: {'.': {}}", 'pnpm'],
		['pnpm-lock.yml', "lockfileVersion: '9.0'\nimporters: {'.': {}}", 'pnpm'],
		['yarn.lock', '# yarn lockfile v1\n', 'yarn'],
		['bun.lock', '{"lockfileVersion":1,"workspaces":{"":{}},"packages":{},}', 'bun']
	])('discovers and imports %s when earlier candidates are missing', async (filename, text, format) => {
		const fetchFn = vi.fn(async (url: string | URL | Request) => {
			if (String(url).startsWith('https://api.github.com/')) {
				return Response.json({ default_branch: 'release/next' });
			}
			return new Response(String(url).endsWith(`/${filename}`) ? text : '', {
				status: String(url).endsWith(`/${filename}`) ? 200 : 404
			});
		});
		expect(await fetchGitHubPackageLockfile('https://github.com/octo/project', fetchFn)).toMatchObject({
			ok: true,
			format,
			filename,
			graph: { nodes: [expect.objectContaining({ id: '' })] }
		});
		expect(fetchFn).toHaveBeenLastCalledWith(
			`https://raw.githubusercontent.com/octo/project/release%2Fnext/${filename}`
		);
	});

	it('reports when no supported root lockfile exists', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => new Response('', { status: 404 }));
		fetchFn.mockResolvedValueOnce(Response.json({ default_branch: 'main' }));
		expect(await fetchGitHubPackageLockfile('https://github.com/octo/project', fetchFn)).toMatchObject({
			ok: false,
			message: expect.stringContaining('No supported lockfile was found at the repository root')
		});
	});

	it('explains how to convert a binary-only Bun lockfile', async () => {
		const fetchFn = vi.fn(async (url: string | URL | Request) => {
			if (String(url).startsWith('https://api.github.com/')) return Response.json({ default_branch: 'main' });
			return new Response('', { status: String(url).endsWith('/bun.lockb') ? 200 : 404 });
		});
		expect(await fetchGitHubPackageLockfile('https://github.com/octo/project', fetchFn)).toMatchObject({
			ok: false,
			code: 'unsupported_format',
			message: expect.stringContaining('Generate bun.lock')
		});
	});

	it.each([403, 429, 500])('does not treat HTTP %s as a missing lockfile', async (status) => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ default_branch: 'main' }))
			.mockResolvedValueOnce(new Response('', { status: 404 }))
			.mockResolvedValueOnce(new Response('', { status }));
		expect(await fetchGitHubPackageLockfile('https://github.com/octo/project', fetchFn)).toMatchObject({
			ok: false,
			message: `Lockfile download failed (HTTP ${status}).`
		});
		expect(fetchFn).toHaveBeenCalledTimes(3);
	});

	it('reports a parse error instead of silently switching to another lockfile', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ default_branch: 'main' }))
			.mockResolvedValueOnce(new Response('invalid JSON'));
		expect(await fetchGitHubPackageLockfile('https://github.com/octo/project', fetchFn)).toMatchObject({ ok: false });
		expect(fetchFn).toHaveBeenCalledTimes(2);
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

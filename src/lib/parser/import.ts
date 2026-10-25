import { parseLockfile, MAX_LOCKFILE_BYTES } from '#lib/parser/lockfile.js';
import { parsePnpmLockfile } from '#lib/parser/pnpm.js';
import { parseYarnLockfile } from '#lib/parser/yarn.js';
import { parseBunLockfile } from '#lib/parser/bun.js';
import { failure, object, tooLarge } from '#lib/parser/shared.js';
import type { ParseResult } from '#lib/types.js';
import { SUPPORTED_LOCKFILES, parseGitHubRepositoryUrl } from '#lib/parser/formats.js';

export { LOCKFILE_ACCEPT, SUPPORTED_LOCKFILES, parseGitHubRepositoryUrl } from '#lib/parser/formats.js';

export type LockfileFormat = 'npm' | 'pnpm' | 'yarn' | 'bun';
export type ImportResult =
	| Extract<ParseResult, { ok: false }>
	| (Extract<ParseResult, { ok: true }> & {
			format: LockfileFormat;
			lockfileVersion: number | null;
	  });

/** Single import entry point; npm callers can continue using parseLockfile unchanged. */
export function parseDependencyLockfile(text: string, filename?: string): ImportResult {
	if (filename?.toLowerCase().endsWith('.lockb')) {
		return failure(
			'Binary bun.lockb is not supported. Generate bun.lock with bun install --save-text-lockfile --frozen-lockfile --lockfile-only.',
			'unsupported_format'
		);
	}
	if (tooLarge(text)) return failure('Lockfiles must be 10 MiB or smaller.', 'too_large');
	const name = filename?.split(/[/\\]/).pop()?.toLowerCase();
	let format: LockfileFormat;
	if (name === 'pnpm-lock.yaml' || name === 'pnpm-lock.yml') format = 'pnpm';
	else if (name === 'yarn.lock') format = 'yarn';
	else if (name === 'bun.lock') format = 'bun';
	else if (name === 'package-lock.json' || name === 'npm-shrinkwrap.json') format = 'npm';
	else if (/^lockfileVersion:\s*['"]?[69](?:\.|['"]?\s*$)/m.test(text)) format = 'pnpm';
	else if (/^# yarn lockfile v1\s*$|^__metadata:/m.test(text)) format = 'yarn';
	else {
		try {
			const data: unknown = JSON.parse(text);
			format = object(data) && object(data.workspaces) ? 'bun' : 'npm';
		} catch {
			return failure(`Choose ${SUPPORTED_LOCKFILES}.`, 'unsupported_format');
		}
	}
	const parsers = { npm: parseLockfile, pnpm: parsePnpmLockfile, yarn: parseYarnLockfile, bun: parseBunLockfile };
	const result = parsers[format](text);
	if (!result.ok) return result;
	let version: number | null = null;
	if (format === 'npm') {
		const data = JSON.parse(text);
		version = data.lockfileVersion;
	}
	return { ...result, format, lockfileVersion: version };
}

export async function parseDependencyFile(file: Pick<File, 'name' | 'size' | 'text'>): Promise<ImportResult> {
	if (file.size > MAX_LOCKFILE_BYTES) return failure('Lockfiles must be 10 MiB or smaller.', 'too_large');
	if (file.name.toLowerCase().endsWith('.lockb')) return parseDependencyLockfile('', file.name);
	try {
		return parseDependencyLockfile(await file.text(), file.name);
	} catch {
		return failure('Could not read this lockfile.');
	}
}

export async function fetchGitHubPackageLockfile(
	repositoryUrl: string,
	fetchFn: typeof fetch = fetch
): Promise<ImportResult> {
	const repository = parseGitHubRepositoryUrl(repositoryUrl);
	if (!repository) return failure('Enter a GitHub repository URL such as https://github.com/owner/repository.');

	const apiUrl = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`;
	try {
		const metadata = await fetchFn(apiUrl, { headers: { Accept: 'application/vnd.github+json' } });
		if (!metadata.ok) {
			return failure(
				metadata.status === 404
					? 'GitHub repository was not found or is not publicly accessible.'
					: `GitHub repository lookup failed (HTTP ${metadata.status}).`
			);
		}
		const data: unknown = await metadata.json();
		if (
			typeof data !== 'object' ||
			data === null ||
			!('default_branch' in data) ||
			typeof data.default_branch !== 'string' ||
			!data.default_branch
		) {
			return failure('GitHub did not provide a default branch for this repository.');
		}

		const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/${encodeURIComponent(data.default_branch)}/package-lock.json`;
		const lockfile = await fetchFn(rawUrl);
		if (!lockfile.ok) {
			return failure(
				lockfile.status === 404
					? 'No package-lock.json was found on the repository default branch.'
					: `Lockfile download failed (HTTP ${lockfile.status}).`
			);
		}
		const contentLength = lockfile.headers.get('content-length');
		if (contentLength && Number(contentLength) > MAX_LOCKFILE_BYTES) {
			return failure('Lockfiles must be 10 MiB or smaller.', 'too_large');
		}
		return parseDependencyLockfile(await lockfile.text(), 'package-lock.json');
	} catch {
		return failure('Could not reach GitHub. Check your connection and try again.');
	}
}

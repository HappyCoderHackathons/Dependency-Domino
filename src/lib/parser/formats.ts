// Lightweight import metadata kept apart from the parsers so the UI can show it without loading them.

export const LOCKFILE_ACCEPT = '.json,.yaml,.yml,.lock,.lockb';
export const SUPPORTED_LOCKFILES = 'package-lock.json, pnpm-lock.yaml, yarn.lock, or bun.lock';

export function parseGitHubRepositoryUrl(value: string): { owner: string; repository: string } | null {
	try {
		const url = new URL(value.trim());
		if (url.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(url.hostname)) return null;
		const parts = url.pathname.split('/').filter(Boolean);
		if (parts.length !== 2 || url.search || url.hash) return null;
		const repository = parts[1].endsWith('.git') ? parts[1].slice(0, -4) : parts[1];
		if (!parts[0] || !repository) return null;
		return { owner: parts[0], repository };
	} catch {
		return null;
	}
}

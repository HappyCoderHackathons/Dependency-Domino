/** Detects a package.json dropped in place of a lockfile. Detection only: nothing in the manifest is read. */

export const MANIFEST_MESSAGE =
	'This is a package.json. It lists the versions your project asks for, not the versions that were installed, ' +
	'so Dependency Domino needs the lockfile instead: package-lock.json (npm install), pnpm-lock.yaml (pnpm install), ' +
	'yarn.lock (yarn install) or bun.lock (bun install). Run the command in your project folder, then choose the file it creates.';

const MANIFEST_KEYS = [
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies',
	'scripts',
	'engines',
	'main',
	'bin',
	'exports',
	'workspaces',
	'private'
];

export function isManifestFilename(name: string): boolean {
	return name.toLowerCase() === 'package.json';
}

/**
 * Parsed JSON that looks like a manifest. Every lockfile format carries `lockfileVersion` or a `packages`
 * map, which a manifest does not, so those are never mistaken for one (including bun.lock, whose
 * `workspaces` object also appears in yarn-style manifests).
 */
export function isPackageManifest(data: unknown): boolean {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
	if (Object.hasOwn(data, 'lockfileVersion') || Object.hasOwn(data, 'packages')) return false;
	const record = data as Record<string, unknown>;
	return (
		MANIFEST_KEYS.some((key) => Object.hasOwn(record, key)) ||
		(typeof record.name === 'string' && typeof record.version === 'string')
	);
}
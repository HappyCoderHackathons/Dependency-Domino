import type { PackageNode, ParseResult } from '#lib/types.js';
import { buildEdges, markDirect } from '#lib/parser/edges.js';

export type ParseFailure = Extract<ParseResult, { ok: false }>;

export interface ValidatedLockfile extends Record<string, unknown> {
	lockfileVersion: 2 | 3;
	packages: Record<string, unknown>;
}

export type LockfileValidationResult = { ok: true; lockfile: ValidatedLockfile } | ParseFailure;

export const MAX_LOCKFILE_BYTES = 10 * 1024 * 1024;

function sizeError(): ParseFailure {
	return { ok: false, code: 'too_large', message: 'Lockfiles must be 10 MiB or smaller.' };
}

/** Checks the upload size before reading; graph construction remains a separate step. */
export async function validateLockfileFile(file: Pick<File, 'size' | 'text'>): Promise<LockfileValidationResult> {
	if (file.size > MAX_LOCKFILE_BYTES) return sizeError();
	return validateLockfile(await file.text());
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseLockfile(text: string): ParseResult {
	const validation = validateLockfile(text);
	if (!validation.ok) return validation;

	const nodeResult = buildPackageNodes(validation.lockfile);
	const { edges, warnings } = buildEdges(validation.lockfile.packages, nodeResult.nodes);
	return {
		ok: true,
		graph: { nodes: markDirect(nodeResult.nodes, edges), edges, warnings: [...nodeResult.warnings, ...warnings] }
	};
}

export function validateLockfile(text: string): LockfileValidationResult {
	if (text.length > MAX_LOCKFILE_BYTES || new TextEncoder().encode(text).byteLength > MAX_LOCKFILE_BYTES) {
		return sizeError();
	}

	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return { ok: false, code: 'invalid_json', message: 'Could not parse this file. Choose a valid package-lock.json.' };
	}

	if (!isObject(value)) {
		return { ok: false, code: 'not_object', message: 'The lockfile must contain a JSON object.' };
	}

	const lockfile = value;
	const version = lockfile.lockfileVersion;
	if (version !== 2 && version !== 3) {
		const label = typeof version === 'number' ? String(version) : 'missing or invalid';
		return {
			ok: false,
			code: 'unsupported_version',
			message: `Lockfile version ${label} is not supported. Use npm 7 or later to generate lockfile version 2 or 3.`
		};
	}

	if (!Object.hasOwn(lockfile, 'packages') || !isObject(lockfile.packages)) {
		return {
			ok: false,
			code: 'missing_packages',
			message: 'The lockfile must include a packages object keyed by installed package path.'
		};
	}

	return { ok: true, lockfile: { ...lockfile, lockfileVersion: version, packages: lockfile.packages } };
}

export interface PackageNodesResult {
	nodes: PackageNode[];
	warnings: string[];
}

function stringField(value: unknown): string | null {
	return typeof value === 'string' && value !== '' ? value : null;
}

export function resolvedHost(descriptor: Record<string, unknown>): string | undefined {
	if (typeof descriptor.resolved !== 'string') return;
	try {
		const url = new URL(descriptor.resolved);
		if (url.protocol === 'https:' || url.protocol === 'http:') return url.hostname.toLowerCase();
	} catch {
		// Non-URL locators have no host metadata.
	}
}

export function projectLink(packages: Record<string, unknown>, descriptor: Record<string, unknown>): string | null {
	const target = descriptor.link === true ? stringField(descriptor.resolved)?.replace(/^\.\//, '') : null;
	if (
		!target ||
		target.startsWith('/') ||
		target.includes('\\') ||
		target.includes(':') ||
		target.split('/').some((part) => !part || part === '..' || part === 'node_modules')
	)
		return null;
	return Object.hasOwn(packages, target) && isObject(packages[target]) ? target : null;
}

function installScriptFlag(descriptor: Record<string, unknown>): Pick<PackageNode, 'hasInstallScript'> | object {
	return descriptor.hasInstallScript === true ? { hasInstallScript: true } : {};
}

const NODE_MODULES = 'node_modules/';

/** Returns the installed package name for a lockfile key, preferring an explicit descriptor name (aliases). */
export function inferPackageName(path: string, name?: unknown): string | null {
	const explicit = stringField(name);
	if (explicit) return explicit;

	const index = path.lastIndexOf(NODE_MODULES);
	if (index === -1) return null;

	const [first, second] = path.slice(index + NODE_MODULES.length).split('/');
	if (!first) return null;
	if (first.startsWith('@')) return second ? `${first}/${second}` : null;
	return first;
}

export function classifySource(descriptor: Record<string, unknown>): PackageNode['source'] {
	if (descriptor.link === true) return 'link';

	const resolved = stringField(descriptor.resolved);
	if (!resolved) return 'unknown';
	if (resolved.startsWith('https://registry.npmjs.org/')) return 'registry';
	if (resolved.startsWith('https://') && resolved.split(/[?#]/)[0].endsWith('.tgz')) return 'registry';
	return 'other';
}

/** Links carry no version; npm records it on the linked folder's own entry. */
function linkedVersion(packages: Record<string, unknown>, descriptor: Record<string, unknown>): string | null {
	const target = descriptor.link === true ? stringField(descriptor.resolved) : null;
	const folder = target && Object.hasOwn(packages, target) ? packages[target] : null;
	return isObject(folder) ? stringField(folder.version) : null;
}

function createRootNode(lockfile: ValidatedLockfile, warnings: string[]): PackageNode {
	const descriptor = lockfile.packages[''];
	const root = isObject(descriptor) ? descriptor : {};
	if (!isObject(descriptor)) warnings.push('The lockfile has no root package entry. Using a placeholder root.');

	return {
		id: '',
		name: stringField(root.name) ?? stringField(lockfile.name) ?? 'root',
		version: stringField(root.version) ?? stringField(lockfile.version),
		direct: false,
		devOnly: false,
		optional: false,
		source: 'unknown',
		...installScriptFlag(root),
		advisoryIds: []
	};
}

export function buildPackageNodes(lockfile: ValidatedLockfile): PackageNodesResult {
	const warnings: string[] = [];
	const nodes = [createRootNode(lockfile, warnings)];
	const linkedFolders = new Set(
		Object.values(lockfile.packages).flatMap((entry) => {
			const target = isObject(entry) ? projectLink(lockfile.packages, entry) : null;
			return target ? [target] : [];
		})
	);

	for (const [path, descriptor] of Object.entries(lockfile.packages)) {
		if (path === '') continue;
		if (!path.includes(NODE_MODULES)) {
			if (linkedFolders.has(path)) continue;
			warnings.push(`Skipped "${path}": local folders outside node_modules are not shown as installed packages.`);
			continue;
		}
		const name = isObject(descriptor) ? inferPackageName(path, descriptor.name) : null;
		if (!isObject(descriptor) || !name) {
			warnings.push(`Skipped "${path}": the package entry is invalid.`);
			continue;
		}

		const workspacePath = projectLink(lockfile.packages, descriptor);
		const metadata = workspacePath ? (lockfile.packages[workspacePath] as Record<string, unknown>) : descriptor;
		const host = resolvedHost(descriptor);
		nodes.push({
			id: path,
			name: stringField(metadata.name) ?? name,
			version: stringField(descriptor.version) ?? linkedVersion(lockfile.packages, descriptor),
			direct: false,
			// `devOptional` alone means dev or optional, so it sets neither flag.
			devOnly: descriptor.dev === true,
			optional: descriptor.optional === true,
			source: classifySource(descriptor),
			...(host ? { resolvedHost: host } : {}),
			...(workspacePath ? { workspacePath } : {}),
			...installScriptFlag(metadata),
			advisoryIds: []
		});
	}

	return { nodes, warnings };
}

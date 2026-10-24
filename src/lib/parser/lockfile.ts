import type { PackageNode, ParseResult } from '#lib/types.js';

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
		advisoryIds: []
	};
}

export function buildPackageNodes(lockfile: ValidatedLockfile): PackageNodesResult {
	const warnings: string[] = [];
	const nodes = [createRootNode(lockfile, warnings)];
	return { nodes, warnings };
}

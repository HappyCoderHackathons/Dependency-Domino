import type { ParseResult } from '#lib/types.js';

export type ParseFailure = Extract<ParseResult, { ok: false }>;

export interface ValidatedLockfile extends Record<string, unknown> {
	lockfileVersion: 2 | 3;
	packages: Record<string, unknown>;
}

export type LockfileValidationResult = { ok: true; lockfile: ValidatedLockfile } | ParseFailure;

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateLockfile(text: string): LockfileValidationResult {
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

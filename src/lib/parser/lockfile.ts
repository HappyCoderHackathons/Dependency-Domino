import type { ParseResult } from '#lib/types.js';

export type ParseFailure = Extract<ParseResult, { ok: false }>;

export interface ValidatedLockfile extends Record<string, unknown> {
	lockfileVersion: 2 | 3;
}

export type LockfileValidationResult = { ok: true; lockfile: ValidatedLockfile } | ParseFailure;

export function validateLockfile(text: string): LockfileValidationResult {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return { ok: false, code: 'invalid_json', message: 'Could not parse this file. Choose a valid package-lock.json.' };
	}

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return { ok: false, code: 'not_object', message: 'The lockfile must contain a JSON object.' };
	}

	const lockfile = value as Record<string, unknown>;
	const version = lockfile.lockfileVersion;
	if (version !== 2 && version !== 3) {
		const label = typeof version === 'number' ? String(version) : 'missing or invalid';
		return {
			ok: false,
			code: 'unsupported_version',
			message: `Lockfile version ${label} is not supported. Use npm 7 or later to generate lockfile version 2 or 3.`
		};
	}

	return { ok: true, lockfile: { ...lockfile, lockfileVersion: version } };
}

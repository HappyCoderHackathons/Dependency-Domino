import type { ParseResult } from '#lib/types.js';

export type ParseFailure = Extract<ParseResult, { ok: false }>;

export type LockfileValidationResult = { ok: true; lockfile: Record<string, unknown> } | ParseFailure;

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

	return { ok: true, lockfile: value as Record<string, unknown> };
}

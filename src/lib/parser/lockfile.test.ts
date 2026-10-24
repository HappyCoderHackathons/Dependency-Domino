import { describe, expect, it } from 'vitest';
import { validateLockfile } from '#lib/parser/lockfile.js';
import v2 from '#lib/fixtures/minimal-v2.json';
import v3 from '#lib/fixtures/minimal-v3.json';

describe('validateLockfile', () => {
	it.each([v2, v3])('accepts a minimal fixture (v$lockfileVersion)', (fixture) => {
		expect(validateLockfile(JSON.stringify(fixture))).toEqual({ ok: true, lockfile: fixture });
	});

	it.each(['', '{', '{"private-content":'])('returns a safe error for malformed JSON: %j', (text) => {
		const result = validateLockfile(text);
		expect(result).toEqual({
			ok: false,
			code: 'invalid_json',
			message: 'Could not parse this file. Choose a valid package-lock.json.'
		});
	});

	it.each([null, [], 'text', 1, true])('rejects a non-object top level: %j', (value) => {
		expect(validateLockfile(JSON.stringify(value))).toMatchObject({ ok: false, code: 'not_object' });
	});
});

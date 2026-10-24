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

	it.each([undefined, null, '2', '3', true, {}, [], 0, 1, 4, 2.5])('rejects version %j', (lockfileVersion) => {
		expect(validateLockfile(JSON.stringify({ lockfileVersion, packages: {} }))).toMatchObject({
			ok: false,
			code: 'unsupported_version'
		});
	});

	it('explains how to replace a v1 lockfile', () => {
		expect(validateLockfile('{"lockfileVersion":1}')).toEqual({
			ok: false,
			code: 'unsupported_version',
			message: 'Lockfile version 1 is not supported. Use npm 7 or later to generate lockfile version 2 or 3.'
		});
	});

	it.each([undefined, null, [], 'packages', 1, false])('rejects an invalid packages map: %j', (packages) => {
		expect(validateLockfile(JSON.stringify({ lockfileVersion: 3, packages }))).toMatchObject({
			ok: false,
			code: 'missing_packages'
		});
	});

	it('accepts an empty packages map for later root fallback handling', () => {
		expect(validateLockfile('{"lockfileVersion":3,"packages":{}}')).toMatchObject({ ok: true });
	});

	it('does not substitute the legacy dependencies tree for packages', () => {
		expect(validateLockfile('{"lockfileVersion":2,"dependencies":{}}')).toMatchObject({
			ok: false,
			code: 'missing_packages'
		});
	});
});

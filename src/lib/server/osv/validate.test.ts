import { describe, it, expect } from 'vitest';
import { MAX_PACKAGES, validateQuery } from '#lib/server/osv/validate.js';

describe('validateQuery', () => {
	it('accepts plain and scoped names with semver versions', () => {
		const result = validateQuery(
			JSON.stringify({
				packages: [
					{ name: 'lodash', version: '4.17.21' },
					{ name: '@types/lodash', version: '4.14.178' }
				]
			})
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.message);
		expect(result.packages).toEqual([
			{ name: 'lodash', version: '4.17.21' },
			{ name: '@types/lodash', version: '4.14.178' }
		]);
	});
	it('rejects uppercase, overlong, or malformed names', () => {
		const invalidNames = [
			'Lodash', // uppercase
			'a'.repeat(215), // overlong
			'invalid/name' // malformed
		];
		for (const name of invalidNames) {
			const result = validateQuery(
				JSON.stringify({
					packages: [{ name, version: '4.17.21' }]
				})
			);
			expect(result.ok).toBe(false);
		}
	});
	it('rejects ranges such as ^1.0.0 and overlong versions', () => {
		const invalidVersions = [
			'^1.0.0', // range
			'a'.repeat(65) // overlong
		];
		for (const version of invalidVersions) {
			const result = validateQuery(
				JSON.stringify({
					packages: [{ name: 'lodash', version }]
				})
			);
			expect(result.ok).toBe(false);
		}
	});
	it.each(['not json', '', '123', 'null', '[]', '"text"', '{}', '{"packages":{}}'])(
		'rejects a body that is not an object with a packages array: %j',
		(text) => {
			expect(validateQuery(text).ok).toBe(false);
		}
	);
	it('rejects more than MAX_PACKAGES packages', () => {
		const packages = Array.from({ length: MAX_PACKAGES + 1 }, () => ({ name: 'lodash', version: '4.17.21' }));
		expect(validateQuery(JSON.stringify({ packages })).ok).toBe(false);
	});
	it('drops extra fields from package entries', () => {
		const result = validateQuery(
			JSON.stringify({
				packages: [{ name: 'lodash', version: '4.17.21', extra: 'field' }]
			})
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.message);
		expect(result.packages).toEqual([{ name: 'lodash', version: '4.17.21' }]);
	});
});

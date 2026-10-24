import { describe, expect, it } from 'vitest';
import { candidatePaths } from '#lib/parser/resolve.js';

describe('candidatePaths', () => {
    it('should return candidate paths for a given consumer path and dependency name', () => {
        const consumerPath = '/project/src/node_modules/some-package/index.js';
        const dep_name = 'some-dependency';
        const expectedPaths = [
            '/project/src/node_modules/some-package/node_modules/some-dependency',
            '/project/src/node_modules/some-dependency',
            '/project/node_modules/some-dependency',
            '/node_modules/some-dependency'
        ];
        const actualPaths = candidatePaths(consumerPath, dep_name);
        expect(actualPaths).toEqual(expectedPaths);
    });
});
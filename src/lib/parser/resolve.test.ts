import { describe, expect, it } from 'vitest';
import { candidatePaths, resolveDependency } from '#lib/parser/resolve.js';

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

describe('resolveDependency', () => {
    it('should return the first installed candidate path for a given consumer path and dependency name', () => {
        const installed = new Set([
            '/project/src/node_modules/some-package/node_modules/some-dependency',
            '/project/src/node_modules/some-dependency'
        ]);
        const consumerPath = '/project/src/node_modules/some-package/index.js';
        const depName = 'some-dependency';
        const expectedPath = '/project/src/node_modules/some-package/node_modules/some-dependency';
        const actualPath = resolveDependency(installed, consumerPath, depName);
        expect(actualPath).toEqual(expectedPath);
    });

    it('should return null if no installed candidate path is found', () => {
        const installed = new Set([
            '/project/src/node_modules/some-package/node_modules/other-dependency'
        ]);
        const consumerPath = '/project/src/node_modules/some-package/index.js';
        const depName = 'some-dependency';
        const actualPath = resolveDependency(installed, consumerPath, depName);
        expect(actualPath).toBeNull();
    });

    it('should return null if the consumer path does not contain node_modules', () => {
        const installed = new Set([
            '/project/src/node_modules/some-package/node_modules/some-dependency'
        ]);
        const consumerPath = '/project/src/some-package/index.js';
        const depName = 'some-dependency';
        const actualPath = resolveDependency(installed, consumerPath, depName);
        expect(actualPath).toBeNull();
    });
});
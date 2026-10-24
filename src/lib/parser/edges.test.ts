import { describe, expect, it } from 'vitest';
import { buildEdges } from '#lib/parser/edges.js';

describe('buildEdges', () => {
    it('should build edges for runtime dependencies', () => {
        const packages = {
            '/project/src/node_modules/package-a/index.js': {
                dependencies: {
                    'package-b': '^1.0.0'
                }
            },
            '/project/src/node_modules/package-b/index.js': {
                dependencies: {}
            }
        } as Parameters<typeof buildEdges>[0];

        const nodes = {
            '/project/src/node_modules/package-a/index.js': [
                { id: '/project/src/node_modules/package-a/index.js' }
            ],
            '/project/src/node_modules/package-b/index.js': [
                { id: '/project/src/node_modules/package-b/index.js' }
            ]
        } as unknown as Parameters<typeof buildEdges>[1];

        const result = buildEdges(packages, nodes);

        expect(result.edges).toEqual([
            {
                source: '/project/src/node_modules/package-a/index.js',
                target: '/project/src/node_modules/package-b/index.js',
                kind: 'runtime',
                requestedRange: '^1.0.0'
            }
        ]);
    });

    it('should generate warnings for unresolved dependencies', () => {
        const packages = {
            '/project/src/node_modules/package-a/index.js': {
                dependencies: {
                    'package-c': '^1.0.0'
                }
            }
        } as Parameters<typeof buildEdges>[0];

        const nodes = {
            '/project/src/node_modules/package-a/index.js': [
                { id: '/project/src/node_modules/package-a/index.js' }
            ]
        } as unknown as Parameters<typeof buildEdges>[1];

        const result = buildEdges(packages, nodes);

        expect(result.warnings).toEqual([
            'Could not resolve "package-c" required by /project/src/node_modules/package-a/index.js'
        ]);
    });
});
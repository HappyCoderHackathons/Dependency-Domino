import { describe, expect, it } from 'vitest';
import { buildEdges, markDirect } from '#lib/parser/edges.js';
import type { PackageNode } from '#lib';

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
    it('should generate warnings for optional dependencies that are not marked as optional', () => {
        const packages = {
            '/project/src/node_modules/package-a/index.js': {
                optionalDependencies: {
                    'package-b': '^1.0.0'
                },
                dependencies: {}
            }
        } as Parameters<typeof buildEdges>[0];

        const nodes = {
            '/project/src/node_modules/package-a/index.js': [
                { id: '/project/src/node_modules/package-a/index.js' }
            ]
        } as unknown as Parameters<typeof buildEdges>[1];
        const result = buildEdges(packages, nodes);

        expect(result.warnings).toEqual([
            'Optional dependency "package-b" required by /project/src/node_modules/package-a/index.js is not marked as optional in its package.json'
        ]);
    });

    it('should handle root package dependencies', () => {
        const packages = {
            '': {
                devDependencies: {
                    'package-a': '^1.0.0'
                }
            },
        } as Parameters<typeof buildEdges>[0];

        const nodes = {
            '': [
                { id: '' }
            ],
            '/project/src/node_modules/package-a/index.js': [
                { id: '/project/src/node_modules/package-a/index.js' }
            ]
        } as unknown as Parameters<typeof buildEdges>[1];

        const result = buildEdges(packages, nodes);

        expect(result.edges).toEqual([
            {
                source: '',
                target: '/project/src/node_modules/package-a/index.js',
                kind: 'development',
                requestedRange: '^1.0.0'
            }
        ]);
        expect(result.warnings).toEqual([]);
    });

    it('should not add duplicate edges', () => {
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
        expect(result.warnings).toEqual([]);
    });
    it('should generate warnings for unusual dependency ranges', () => {
        const packages = {
            '/project/src/node_modules/package-a/index.js': {
                dependencies: {
                    'package-b': 'file:../package-b'
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

        expect(result.warnings).toEqual(['Unusual dependency range "file:../package-b" required by root']);
    });
});


describe('markDirect', () => {
    it('should mark direct dependencies', () => {
        const nodes = [
            { id: '/project/src/node_modules/package-a/index.js' },
            { id: '/project/src/node_modules/package-b/index.js' }
        ] as PackageNode[];
        const edges = [
            {
                source: '',
                target: '/project/src/node_modules/package-a/index.js',
                kind: 'runtime',
                requestedRange: '^1.0.0'
            },
            {
                source: '',
                target: '/project/src/node_modules/package-b/index.js',
                kind: 'runtime',
                requestedRange: '^1.0.0'
            }
        ] as unknown as Parameters<typeof markDirect>[1];

        const result = markDirect(nodes, edges);

        expect(result).toEqual([
            { id: '/project/src/node_modules/package-a/index.js', direct: true },
            { id: '/project/src/node_modules/package-b/index.js', direct: true }
        ]);
    });
});
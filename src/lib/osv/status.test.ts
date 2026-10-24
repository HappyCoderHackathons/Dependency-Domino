import { describe, expect, it } from 'vitest';
import { packageAdvisories } from '#lib/osv/status.js';
import type { PackageNode, VulnerabilityResponse } from '#lib/types.js';

const node: PackageNode = {
	id: 'node_modules/example',
	name: 'example',
	version: '1.0.0',
	source: 'registry',
	direct: true,
	devOnly: false,
	optional: false,
	advisoryIds: []
};
const partial: VulnerabilityResponse = {
	status: 'partial',
	warnings: ['Some packages could not be checked.'],
	results: [
		{ name: 'example', version: '1.0.0', advisoryIds: ['GHSA-example', 'GHSA-example'] },
		{ name: 'empty', version: '1.0.0', advisoryIds: [] }
	]
};

describe('packageAdvisories', () => {
	it('distinguishes successful matches and explicit empty results in a partial response', () => {
		expect(packageAdvisories(node, 'partial', partial)).toEqual({ status: 'found', advisoryIds: ['GHSA-example'] });
		expect(packageAdvisories({ ...node, name: 'empty' }, 'partial', partial)).toEqual({
			status: 'none',
			advisoryIds: []
		});
		expect(packageAdvisories({ ...node, name: 'missing' }, 'partial', partial)).toEqual({
			status: 'failed',
			advisoryIds: []
		});
	});

	it('matches exact versions and applies a result to duplicate installed instances', () => {
		expect(packageAdvisories({ ...node, version: '2.0.0' }, 'partial', partial).status).toBe('failed');
		expect(
			packageAdvisories({ ...node, id: 'node_modules/a/node_modules/example' }, 'partial', partial).advisoryIds
		).toEqual(['GHSA-example']);
	});

	it('keeps unsupported packages and the root not checked even when another instance matches', () => {
		for (const patch of [{ source: 'link' as const }, { source: 'unknown' as const }, { version: null }, { id: '' }]) {
			expect(packageAdvisories({ ...node, ...patch }, 'partial', partial)).toEqual({
				status: 'not_checked',
				advisoryIds: []
			});
		}
	});

	it('reports idle, loading, and failed requests without treating empty node IDs as a successful lookup', () => {
		expect(packageAdvisories(node, 'idle', null).status).toBe('not_checked');
		expect(packageAdvisories(node, 'loading', partial)).toEqual({ status: 'loading', advisoryIds: [] });
		expect(packageAdvisories(node, 'unavailable', null)).toEqual({ status: 'failed', advisoryIds: [] });
		expect(packageAdvisories(node, 'complete', { status: 'complete', results: [], warnings: [] }).status).toBe(
			'failed'
		);
	});
});

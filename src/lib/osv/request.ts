import { advisoryQuery } from '#lib/osv/query.js';
import type { DependencyGraph, VulnerabilityResponse } from '#lib/types.js';

const UNAVAILABLE: VulnerabilityResponse = {
	status: 'unavailable',
	results: [],
	warnings: ['Known advisories could not be checked.']
};

/** Asks our endpoint for advisories. Never throws: failures come back as status 'unavailable'. */
export async function requestAdvisories(
	graph: DependencyGraph,
	fetchFn: typeof fetch = fetch
): Promise<VulnerabilityResponse> {
	const packages = advisoryQuery(graph);
	if (packages.length === 0) return { status: 'complete', results: [], warnings: [] };

	try {
		const response = await fetchFn('/api/vulnerabilities', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ packages })
		});
		return response.ok ? await response.json() : UNAVAILABLE;
	} catch {
		return UNAVAILABLE;
	}
}

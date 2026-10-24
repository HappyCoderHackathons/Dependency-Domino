import type { PackageNode, VulnerabilityResponse } from '#lib/types.js';

export type OsvStatus = 'idle' | 'loading' | VulnerabilityResponse['status'];
export type PackageAdvisoryStatus = 'not_checked' | 'loading' | 'found' | 'none' | 'failed';

export interface PackageAdvisories {
	status: PackageAdvisoryStatus;
	advisoryIds: string[];
}

/** Only an explicit successful result can establish that no advisories were returned. */
export function packageAdvisories(
	node: PackageNode,
	status: OsvStatus,
	response: VulnerabilityResponse | null
): PackageAdvisories {
	if (node.id === '' || node.source !== 'registry' || node.version === null || status === 'idle') {
		return { status: 'not_checked', advisoryIds: [] };
	}
	if (status === 'loading') return { status: 'loading', advisoryIds: [] };
	const result = response?.results.find((result) => result.name === node.name && result.version === node.version);
	if (!result) return { status: 'failed', advisoryIds: [] };
	const advisoryIds = [...new Set(result.advisoryIds)];
	return { status: advisoryIds.length > 0 ? 'found' : 'none', advisoryIds };
}

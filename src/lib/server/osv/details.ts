import type { AdvisoryDetails } from '#lib/types.js';
import { fetchWithRetry, TIMEOUT_MS, UpstreamError, type LookupOptions } from '#lib/server/osv/client.js';

export const OSV_VULN_URL = 'https://api.osv.dev/v1/vulns/';
export const ADVISORY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,99}$/;

interface OsvRecord {
	id: string;
	summary?: string;
	published?: string;
	aliases?: string[];
	severity?: { type: string; score: string }[];
	database_specific?: { severity?: unknown };
}

export function toAdvisoryDetails(record: OsvRecord): AdvisoryDetails {
	const label = record.database_specific?.severity;
	return {
		id: record.id,
		summary: record.summary ?? null,
		published: record.published ?? null,
		severity: (typeof label === 'string' && label) || record.severity?.[0]?.score || null,
		aliases: record.aliases ?? []
	};
}

/** null when OSV has no record with this id. Throws when OSV cannot be reached. */
export async function fetchAdvisoryDetails(id: string, options: LookupOptions = {}): Promise<AdvisoryDetails | null> {
	try {
		const response = await fetchWithRetry(
			options.fetch ?? fetch,
			OSV_VULN_URL + encodeURIComponent(id),
			{ method: 'GET' },
			options.timeoutMs ?? TIMEOUT_MS
		);
		return toAdvisoryDetails(await response.json());
	} catch (error) {
		if (error instanceof UpstreamError && error.status === 404) return null;
		throw error;
	}
}

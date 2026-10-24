import type { VulnerabilityQuery, VulnerabilityResponse } from '#lib/types.js';

type Package = VulnerabilityQuery['packages'][number];

export const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
export const CHUNK_SIZE = 100;
const CONCURRENCY = 2;

interface OsvResult {
	vulns?: { id: string }[];
	next_page_token?: string;
}

export interface LookupOptions {
	fetch?: typeof fetch;
	timeoutMs?: number;
}

function chunk<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
	return chunks;
}

// Runs task over items with at most `limit` in flight, keeping results in input order.
async function runPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;
	async function worker() {
		while (next < items.length) {
			const index = next++;
			results[index] = await task(items[index]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

function toQuery(pkg: Package, pageToken?: string) {
	return { package: { ecosystem: 'npm', name: pkg.name }, version: pkg.version, page_token: pageToken };
}

async function queryBatch(fetchFn: typeof fetch, queries: ReturnType<typeof toQuery>[]): Promise<OsvResult[]> {
	const response = await fetchFn(OSV_BATCH_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ queries })
	});
    if (!response.ok) {
		throw new Error(`OSV API error: ${response.status} ${response.statusText}`);
	}
	return (await response.json()).results;
}

export async function lookupAdvisories(packages: Package[], options: LookupOptions = {}): Promise<VulnerabilityResponse> {
	const fetchFn = options.fetch ?? fetch;
	const chunks = chunk(packages, CHUNK_SIZE);
	const chunkResults = await runPool(chunks, CONCURRENCY, (pkgs) => queryBatch(fetchFn, pkgs.map((pkg) => toQuery(pkg))));
    const results = chunkResults.flat().map((result) => result.vulns?.map((v) => v.id) ?? []);
	return { status: 'complete', results: [], warnings: [] };
}

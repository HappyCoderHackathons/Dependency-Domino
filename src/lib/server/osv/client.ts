import type { VulnerabilityQuery, VulnerabilityResponse } from '#lib/types.js';

type Package = VulnerabilityQuery['packages'][number];

export const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
export const CHUNK_SIZE = 100;
export const MAX_PAGES = 10;
export const TIMEOUT_MS = 8000;
const CONCURRENCY = 2;

class UpstreamError extends Error {
	constructor(readonly retryable: boolean) {
		super('OSV request failed');
	}
}

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

function idsOf(result: OsvResult | undefined): string[] {
	return result?.vulns?.map((vulnerability) => vulnerability.id) ?? [];
}

async function postWithRetry(fetchFn: typeof fetch, body: string, timeoutMs: number): Promise<Response> {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const response = await fetchFn(OSV_BATCH_URL, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body,
				signal: AbortSignal.timeout(timeoutMs)
			});

			if (response.ok) return response;
			if (response.status >= 400 && response.status < 500) {
				throw new UpstreamError(false);
			}
		} catch (error) {
			if (error instanceof UpstreamError && !error.retryable) throw error;
		}
	}
	throw new UpstreamError(true);
}

async function queryBatch(
	fetchFn: typeof fetch,
	queries: ReturnType<typeof toQuery>[],
	timeoutMs: number
): Promise<OsvResult[]> {
	const response = await postWithRetry(fetchFn, JSON.stringify({ queries }), timeoutMs);
	const data = await response.json();
	if (!Array.isArray(data?.results) || data.results.length !== queries.length) throw new UpstreamError(false);
	return data.results;
}

async function followPages(
	fetchFn: typeof fetch,
	pkg: Package,
	result: OsvResult,
	timeoutMs: number
): Promise<string[]> {
	const ids = idsOf(result);
	let pageToken = result.next_page_token;
	for (let page = 0; pageToken && page < MAX_PAGES; page++) {
		const [nextResult] = await queryBatch(fetchFn, [toQuery(pkg, pageToken)], timeoutMs);
		ids.push(...idsOf(nextResult));
		pageToken = nextResult.next_page_token;
	}
	return ids;
}

/** Advisory ids per package in the chunk, or null for a package that could not be checked. */
async function lookupChunk(fetchFn: typeof fetch, pkgs: Package[], timeoutMs: number): Promise<(string[] | null)[]> {
	let results: OsvResult[];
	try {
		results = await queryBatch(
			fetchFn,
			pkgs.map((pkg) => toQuery(pkg)),
			timeoutMs
		);
	} catch {
		return pkgs.map(() => null);
	}

	const ids: (string[] | null)[] = [];
	for (const [index, pkg] of pkgs.entries()) {
		try {
			ids.push(await followPages(fetchFn, pkg, results[index], timeoutMs));
		} catch {
			ids.push(null);
		}
	}
	return ids;
}

export async function lookupAdvisories(
	packages: Package[],
	options: LookupOptions = {}
): Promise<VulnerabilityResponse> {
	const fetchFn = options.fetch ?? fetch;
	const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
	const chunks = chunk(packages, CHUNK_SIZE);
	const chunkIds = await runPool(chunks, CONCURRENCY, (pkgs) => lookupChunk(fetchFn, pkgs, timeoutMs));

	const results: VulnerabilityResponse['results'] = [];
	chunks.forEach((pkgs, chunkIndex) =>
		pkgs.forEach((pkg, index) => {
			const advisoryIds = chunkIds[chunkIndex][index];
			if (advisoryIds) results.push({ name: pkg.name, version: pkg.version, advisoryIds });
		})
	);

	const failed = packages.length - results.length;
	if (failed === 0) return { status: 'complete', results, warnings: [] };
	return {
		status: failed === packages.length ? 'unavailable' : 'partial',
		results,
		warnings: [`Could not check ${failed} of ${packages.length} packages. Known advisories may be missing.`]
	};
}

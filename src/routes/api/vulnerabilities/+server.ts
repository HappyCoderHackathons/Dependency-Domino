import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { VulnerabilityQuery, VulnerabilityResponse } from '#lib/types.js';

export const POST: RequestHandler = async ({ request }) => {
    const { packages } = (await request.json()) as VulnerabilityQuery;
    const response: VulnerabilityResponse = {
        status: 'complete',
        warnings: [],
        results: packages.map((pkg) => ({
            name: pkg.name,
            version: pkg.version,
            advisoryIds: [] // Placeholder for actual vulnerability data
        }))
    };
    return json(response);
}
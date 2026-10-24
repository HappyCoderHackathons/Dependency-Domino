import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { VulnerabilityResponse } from '#lib/types.js';
import { validateQuery } from '#lib/server/osv/validate.js';

export const POST: RequestHandler = async ({ request }) => {
	const validation = validateQuery(await request.text());
	if (!validation.ok) return json({ error: validation.message }, { status: 400 });

	const response: VulnerabilityResponse = {
		status: 'complete',
		warnings: [],
		results: validation.packages.map((pkg) => ({
			name: pkg.name,
			version: pkg.version,
			advisoryIds: []
		}))
	};
	return json(response);
};

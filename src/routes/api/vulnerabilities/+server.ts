import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { lookupAdvisories } from '#lib/server/osv/client.js';
import { validateQuery } from '#lib/server/osv/validate.js';

export const POST: RequestHandler = async ({ request, fetch }) => {
	const validation = validateQuery(await request.text());
	if (!validation.ok) return json({ error: validation.message }, { status: 400 });

	return json(await lookupAdvisories(validation.packages, { fetch }));
};

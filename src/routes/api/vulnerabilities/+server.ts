import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { CHUNK_SIZE, lookupAdvisories } from '#lib/server/osv/client.js';
import { batchLimiter } from '#lib/server/osv/limits.js';
import { validateQuery } from '#lib/server/osv/validate.js';
import { tooManyRequests } from '#lib/server/rate-limit.js';

export const POST: RequestHandler = async ({ request, fetch, getClientAddress }) => {
	const validation = validateQuery(await request.text());
	if (!validation.ok) return json({ error: validation.message }, { status: 400 });

	const cost = Math.max(1, Math.ceil(validation.packages.length / CHUNK_SIZE));
	const limit = batchLimiter.check(getClientAddress(), cost);
	if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

	return json(await lookupAdvisories(validation.packages, { fetch }));
};

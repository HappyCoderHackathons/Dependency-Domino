import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { ADVISORY_ID, fetchAdvisoryDetails } from '#lib/server/osv/details.js';
import { detailsLimiter } from '#lib/server/osv/limits.js';
import { tooManyRequests } from '#lib/server/rate-limit.js';

export const GET: RequestHandler = async ({ params, fetch, getClientAddress }) => {
	const id = params.id ?? '';
	if (!ADVISORY_ID.test(id)) return json({ error: 'Invalid advisory id' }, { status: 400 });

	const limit = detailsLimiter.check(getClientAddress());
	if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

	try {
		const details = await fetchAdvisoryDetails(id, { fetch });
		if (!details) return json({ error: 'Advisory not found' }, { status: 404 });
		return json(details);
	} catch {
		return json({ error: 'Advisory details are unavailable' }, { status: 502 });
	}
};

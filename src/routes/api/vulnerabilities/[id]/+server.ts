import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { ADVISORY_ID, fetchAdvisoryDetails } from '#lib/server/osv/details.js';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const id = params.id ?? '';
	if (!ADVISORY_ID.test(id)) return json({ error: 'Invalid advisory id' }, { status: 400 });

	try {
		const details = await fetchAdvisoryDetails(id, { fetch });
		if (!details) return json({ error: 'Advisory not found' }, { status: 404 });
		return json(details);
	} catch {
		return json({ error: 'Advisory details are unavailable' }, { status: 502 });
	}
};

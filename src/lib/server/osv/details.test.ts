import { describe, expect, it, vi } from 'vitest';
import { fetchAdvisoryDetails, OSV_VULN_URL, toAdvisoryDetails } from '#lib/server/osv/details.js';

const record = {
	id: 'GHSA-35jh-r3h4-6jhm',
	summary: 'Command Injection in lodash',
	published: '2021-05-06T16:05:51Z',
	aliases: ['CVE-2021-23337'],
	severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H' }],
	database_specific: { severity: 'HIGH' }
};

describe('toAdvisoryDetails', () => {
	it('prefers the plain severity label over the CVSS vector', () => {
		expect(toAdvisoryDetails(record)).toEqual({
			id: 'GHSA-35jh-r3h4-6jhm',
			summary: 'Command Injection in lodash',
			published: '2021-05-06T16:05:51Z',
			severity: 'HIGH',
			aliases: ['CVE-2021-23337']
		});
	});

	it('falls back to the CVSS score, then to null when severity is missing', () => {
		expect(toAdvisoryDetails({ ...record, database_specific: {} }).severity).toBe(record.severity[0].score);
		expect(toAdvisoryDetails({ id: 'MAL-2024-1' }).severity).toBeNull();
	});

	it('uses null and [] for missing summary, published, and aliases', () => {
		expect(toAdvisoryDetails({ id: 'MAL-2024-1' })).toEqual({
			id: 'MAL-2024-1',
			summary: null,
			published: null,
			severity: null,
			aliases: []
		});
	});
});

describe('fetchAdvisoryDetails', () => {
	it('requests the record by id and normalizes it', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(record)));
		expect(await fetchAdvisoryDetails(record.id, { fetch })).toMatchObject({ severity: 'HIGH' });
		expect(fetch.mock.calls[0][0]).toBe(`${OSV_VULN_URL}GHSA-35jh-r3h4-6jhm`);
		expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'GET' });
	});

	it('returns null for a 404', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
		expect(await fetchAdvisoryDetails('GHSA-0000-0000-0000', { fetch })).toBeNull();
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('throws when OSV cannot be reached', async () => {
		const fetch = vi.fn().mockRejectedValue(new TypeError('network'));
		await expect(fetchAdvisoryDetails(record.id, { fetch })).rejects.toThrow('OSV request failed');
		expect(fetch).toHaveBeenCalledTimes(2);
	});
});

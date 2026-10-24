import { describe, expect, it, vi } from 'vitest';
import { lookupAdvisories, CHUNK_SIZE } from '#lib/server/osv/client.js';

const pkg = (i: number) => ({ name: `pkg-${i}`, version: '1.0.0' });
const okResponse = (results: unknown[]) => new Response(JSON.stringify({ results }), { status: 200 });

describe('lookupAdvisories', () => {
    it('returns a VulnerabilityResponse with the correct structure', async () => {
        const packages = [pkg(1), pkg(2)];
        const fetch = vi.fn().mockResolvedValue(okResponse([{ vulns: [{ id: 'CVE-123' }] }, { vulns: [] }]));
        const response = await lookupAdvisories(packages, { fetch });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(response).toEqual({
            status: 'complete',
            warnings: [],
            results: [['CVE-123'], []]
        });
    });
    it('splits 250 packages into 3 chunks and returns results in order', async () => {
        const packages = Array.from({ length: 250 }, (_, i) => pkg(i));
        const fetch = vi.fn().mockResolvedValue(okResponse(Array.from({ length: 3 }, () => ({ vulns: [] }))));
        const response = await lookupAdvisories(packages, { fetch });
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(response).toEqual({
            status: 'complete',
            warnings: [],
            results: Array.from({ length: 250 }, () => [])
        });
    });
    it('maps each result back to its original package', async () => {
        const packages = [pkg(1), pkg(2), pkg(3)];
        const fetch = vi.fn().mockResolvedValue(okResponse([
            { vulns: [{ id: 'CVE-123' }] },
            { vulns: [] },
            { vulns: [{ id: 'CVE-456' }] }
        ]));
        const response = await lookupAdvisories(packages, { fetch });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(response).toEqual({
            status: 'complete',
            warnings: [],
            results: [['CVE-123'], [], ['CVE-456']]
        });
    });
    it('never has more than 2 concurrent requests', async () => {
        const packages = Array.from({ length: 10 }, (_, i) => pkg(i));
        let inFlight = 0;
        const fetch = vi.fn().mockImplementation(async () => {
            inFlight++;
            expect(inFlight).toBeLessThanOrEqual(2);
            await new Promise((resolve) => setTimeout(resolve, 100));
            inFlight--;
            return okResponse([{ vulns: [] }]);
        });
        const response = await lookupAdvisories(packages, { fetch });
        expect(fetch).toHaveBeenCalledTimes(10);
        expect(response).toEqual({
            status: 'complete',
            warnings: [],
            results: Array.from({ length: 10 }, () => [])
        });
    });
});
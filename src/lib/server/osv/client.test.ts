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
    it('follows the next_page_token for each package up to 10 pages', async () => {
        const packages = [pkg(1)];
        const fetch = vi.fn()
            .mockResolvedValueOnce(okResponse([{ vulns: [{ id: 'CVE-123' }], next_page_token: 'token1' }]))
            .mockResolvedValueOnce(okResponse([{ vulns: [{ id: 'CVE-456' }], next_page_token: 'token2' }]))
            .mockResolvedValueOnce(okResponse([{ vulns: [{ id: 'CVE-789' }] }]));
        const response = await lookupAdvisories(packages, { fetch });
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(response).toEqual({
            status: 'complete',
            warnings: [],
            results: [['CVE-123', 'CVE-456', 'CVE-789']]
        });
    });
    it('stops after MAX_PAGES even if next_page_token is present', async () => {
        const packages = [pkg(1)];
        const fetch = vi.fn().mockResolvedValue(okResponse([{ vulns: [{ id: 'CVE-123' }], next_page_token: 'token' }]));
        const response = await lookupAdvisories(packages, { fetch });
        expect(fetch).toHaveBeenCalledTimes(10);
        expect(response).toEqual({
            status: 'complete',
            warnings: [],
            results: [Array.from({ length: 10 }, () => 'CVE-123')]
        });
    });
});

describe('lookupAdvisories retries with postWithRetry', () => {
    it('retries once on a network error', async () => {
        const packages = [pkg(1)];
        const fetch = vi.fn()
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValue(okResponse([{ vulns: [] }]));
        const response = await lookupAdvisories(packages, { fetch });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(response).toEqual({
            status: 'complete',
            warnings: [],
            results: [[]]
        });
    });
    it('does not retry on a 400 error', async () => {
        const packages = [pkg(1)];
        const fetch = vi.fn().mockResolvedValue(new Response('Bad Request', { status: 400 }));
        await expect(lookupAdvisories(packages, { fetch })).rejects.toThrow('OSV API error: 400 Bad Request');
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('retries once on a 500 error', async () => {
        const packages = [pkg(1)];
        const fetch = vi.fn()
            .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }))
            .mockResolvedValue(okResponse([{ vulns: [] }]));
        const response = await lookupAdvisories(packages, { fetch });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(response).toEqual({
            status: 'complete',
            warnings: [],
            results: [[]]
        });
    });
    it('gives up after 2 retries on a 500 error', async () => {
        const packages = [pkg(1)];
        const fetch = vi.fn()
            .mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
        await expect(lookupAdvisories(packages, { fetch })).rejects.toThrow('OSV API error: 500 Internal Server Error');
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
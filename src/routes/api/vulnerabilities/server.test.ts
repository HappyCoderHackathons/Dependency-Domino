import { describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

function call(body: unknown, fetch = vi.fn()) {
	const request = new Request('http://localhost/api/vulnerabilities', {
		method: 'POST',
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
	return POST({ request, fetch } as unknown as Parameters<typeof POST>[0]);
}

describe('POST /api/vulnerabilities', () => {
    it('returns a VulnerabilitiesResponse with the correct structure', async () => {
        const packages = [
            { name: 'package-a', version: '1.0.0' },
            { name: 'package-b', version: '2.0.0' }
        ];
        const response = await call({ packages });
        const jsonResponse = await response.json();
        expect(jsonResponse).toEqual({
            status: 'complete',
            warnings: [],
            results: [
                { name: 'package-a', version: '1.0.0', advisoryIds: [] },
                { name: 'package-b', version: '2.0.0', advisoryIds: [] }
            ]
        });
    });
    it('handles an empty packages array', async () => {
        const response = await call({ packages: [] });
        const jsonResponse = await response.json();
        expect(jsonResponse).toEqual({
            status: 'complete',
            warnings: [],
            results: []
        });
    });
    it('returns a 400 error for invalid request body', async () => {
        const response = await call({ invalid: 'data' });
        expect(response.status).toBe(400);
    });
});
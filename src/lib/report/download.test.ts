import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadReport } from '#lib/report/download.js';

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('report downloads', () => {
	it('downloads the chosen content locally and releases the temporary URL after starting the download', async () => {
		vi.useFakeTimers();
		const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
		vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(link), body: { appendChild: vi.fn() } });
		const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		downloadReport('{"example":true}', 'json');
		expect(link.download).toBe('dependency-domino-report.json');
		expect(link.click).toHaveBeenCalledOnce();
		expect(link.remove).toHaveBeenCalledOnce();
		const blob = create.mock.calls[0][0] as Blob;
		expect(blob.type).toBe('application/json;charset=utf-8');
		expect(await blob.text()).toBe('{"example":true}');
		expect(revoke).not.toHaveBeenCalled();
		vi.runAllTimers();
		expect(revoke).toHaveBeenCalledWith('blob:report');
	});

	it('also removes the link and releases its URL if the browser cannot start a download', () => {
		vi.useFakeTimers();
		const link = {
			href: '',
			download: '',
			click: vi.fn(() => {
				throw new Error('download blocked');
			}),
			remove: vi.fn()
		};
		vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(link), body: { appendChild: vi.fn() } });
		vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed');
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		expect(() => downloadReport('report', 'markdown')).toThrow('download blocked');
		expect(link.download).toBe('dependency-domino-report.md');
		expect(link.remove).toHaveBeenCalledOnce();
		vi.runAllTimers();
		expect(revoke).toHaveBeenCalledWith('blob:failed');
	});
});

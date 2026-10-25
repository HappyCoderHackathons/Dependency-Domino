import { afterEach, expect, it, vi } from 'vitest';
import { importLockfile } from './client';

afterEach(() => vi.unstubAllGlobals());

it('returns a recoverable import error if a worker cannot start', async () => {
	vi.stubGlobal(
		'Worker',
		class {
			constructor() {
				throw new Error('worker unavailable');
			}
		}
	);
	expect(await importLockfile({ kind: 'repository', url: 'https://github.com/example/repo' })).toMatchObject({
		ok: false,
		message: expect.stringContaining('Try importing it again')
	});
});

it('discards a worker that fails to accept a request so a later import can retry', async () => {
	const terminate = vi.fn();
	vi.stubGlobal(
		'Worker',
		class {
			terminate = terminate;
			postMessage() {
				throw new Error('clone failed');
			}
		}
	);
	expect(await importLockfile({ kind: 'repository', url: 'https://github.com/example/repo' })).toMatchObject({
		ok: false
	});
	expect(terminate).toHaveBeenCalledOnce();
	vi.stubGlobal('Worker', undefined);
	expect(
		await importLockfile({
			kind: 'file',
			file: { name: 'package-lock.json', size: 37, text: async () => '{"lockfileVersion":3,"packages":{}}' } as File
		})
	).toMatchObject({ ok: true });
});

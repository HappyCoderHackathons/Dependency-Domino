import type { ImportResult } from '#lib/parser/import.js';

export type ImportRequest = { kind: 'file'; file: File } | { kind: 'repository'; url: string };

// Parsing runs in a worker so large lockfiles do not freeze the page, and the parsers stay out of the main bundle.
let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, (result: ImportResult) => void>();

function settleAll(result: ImportResult) {
	for (const resolve of pending.values()) resolve(result);
	pending.clear();
}

function getWorker(): Worker {
	if (worker) return worker;
	worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' });
	worker.onmessage = ({ data }: MessageEvent<{ id: number; result: ImportResult }>) => {
		pending.get(data.id)?.(data.result);
		pending.delete(data.id);
	};
	worker.onerror = () => {
		worker?.terminate();
		worker = undefined;
		settleAll({ ok: false, code: 'invalid_lockfile', message: 'Could not read this lockfile.' });
	};
	return worker;
}

async function importOnMainThread(request: ImportRequest): Promise<ImportResult> {
	const { fetchGitHubPackageLockfile, parseDependencyFile } = await import('#lib/parser/import.js');
	return request.kind === 'file' ? parseDependencyFile(request.file) : fetchGitHubPackageLockfile(request.url);
}

export function importLockfile(request: ImportRequest): Promise<ImportResult> {
	if (typeof Worker === 'undefined') return importOnMainThread(request);
	const id = nextId++;
	return new Promise((resolve) => {
		pending.set(id, resolve);
		getWorker().postMessage({ ...request, id });
	});
}

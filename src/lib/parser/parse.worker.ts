import { fetchGitHubPackageLockfile, parseDependencyFile } from '#lib/parser/import.js';
import type { ImportRequest } from '#lib/parser/client.js';

self.onmessage = async ({ data }: MessageEvent<ImportRequest & { id: number }>) => {
	const result =
		data.kind === 'file' ? await parseDependencyFile(data.file) : await fetchGitHubPackageLockfile(data.url);
	self.postMessage({ id: data.id, result });
};

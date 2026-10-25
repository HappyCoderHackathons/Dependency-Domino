import { MAX_LOCKFILE_BYTES, parseLockfile, buildPackageNodes } from './lockfile';
import { buildEdges, markDirect } from './edges';
import type { ParseResult } from '#lib/types.js';

function object(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** v1 uses a nested installation tree; v2/v3 continue through the packages-only parser. */
export function parseNpmLockfile(text: string): ParseResult {
	if (text.length > MAX_LOCKFILE_BYTES || new TextEncoder().encode(text).length > MAX_LOCKFILE_BYTES) {
		return { ok: false, code: 'too_large', message: 'Lockfiles must be 10 MiB or smaller.' };
	}
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return parseLockfile(text);
	}
	if (!object(data) || data.lockfileVersion !== 1) return parseLockfile(text);
	if (!object(data.dependencies)) {
		return { ok: false, code: 'invalid_lockfile', message: 'An npm v1 lockfile must include a dependencies object.' };
	}
	const packages: Record<string, unknown> = Object.create(null);
	packages[''] = { name: data.name, version: data.version };
	const warnings = [
		'npm v1 does not record the root manifest. Direct dependencies and paths from the root are unavailable; root edges are not inferred from hoisted packages.',
		'npm v1 development and optional flags reflect recorded instance metadata only. Peer dependencies and install-script metadata are unavailable.'
	];
	const queue = [{ path: '', dependencies: data.dependencies }];
	for (let cursor = 0; cursor < queue.length; cursor++) {
		const parent = queue[cursor];
		for (const [name, entry] of Object.entries(parent.dependencies)) {
			if (!/^(?:@[^/\\]+\/)?[^/\\]+$/.test(name) || name === '.' || name === '..' || !object(entry)) {
				warnings.push(`Skipped invalid npm v1 dependency "${name}".`);
				continue;
			}
			const path = `${parent.path ? parent.path + '/' : ''}node_modules/${name}`;
			packages[path] = {
				name,
				version: entry.version,
				resolved: entry.resolved,
				dev: entry.dev,
				optional: entry.optional,
				dependencies: object(entry.requires) ? entry.requires : {}
			};
			if (entry.bundled === true)
				warnings.push(`Bundled dependency "${path}" may have incomplete dependency metadata.`);
			if (object(entry.dependencies)) queue.push({ path, dependencies: entry.dependencies });
		}
	}
	const result = buildPackageNodes({ lockfileVersion: 2, packages });
	const edges = buildEdges(packages, result.nodes);
	return {
		ok: true,
		graph: {
			nodes: markDirect(result.nodes, edges.edges),
			edges: edges.edges,
			warnings: [...warnings, ...result.warnings, ...edges.warnings]
		}
	};
}

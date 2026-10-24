import {
	failure,
	GraphBuilder,
	identity,
	object,
	packageNode,
	readYamlDocuments,
	record,
	tooLarge
} from '#lib/parser/shared.js';
import type { DependencyKind, ParseResult } from '#lib/types.js';

export function parsePnpmLockfile(text: string): ParseResult {
	if (tooLarge(text)) return failure('Lockfiles must be 10 MiB or smaller.', 'too_large');
	let data: unknown;
	let documents: unknown[];
	try {
		documents = readYamlDocuments(text);
		data = documents.at(-1);
	} catch {
		return failure('Could not parse pnpm-lock.yaml. Choose valid YAML.');
	}
	if (!object(data)) return failure('The pnpm lockfile must contain an object.');
	const major = Number(String(data.lockfileVersion).split('.')[0]);
	if (major !== 6 && major !== 9)
		return failure('Supported pnpm lockfile versions are 6 and 9.', 'unsupported_version');
	if (data.packages !== undefined && !object(data.packages)) return failure('Invalid pnpm packages map.');
	if (major === 9 && data.snapshots !== undefined && !object(data.snapshots))
		return failure('Invalid pnpm snapshots map.');
	const builder = new GraphBuilder();
	if (documents.length > 1)
		builder.graph.warnings.push(
			'pnpm configuration lockfile documents are excluded; the project document is analyzed.'
		);
	const metadata = record(data.packages);
	const snapshots = major === 9 ? record(data.snapshots) : metadata;
	if (major === 9 && Object.keys(metadata).length > 0 && !object(data.snapshots)) {
		return failure('The pnpm v9 lockfile must include dependency snapshots.');
	}
	const ids = new Map<string, string>();
	for (const [key, descriptor] of Object.entries(snapshots)) {
		const normalized = key.replace(/^\//, '');
		const info = identity(normalized);
		if (!info || !object(descriptor)) {
			builder.graph.warnings.push(`Skipped unsupported pnpm resolution "${key}".`);
			continue;
		}
		const id = `pnpm:${key}`;
		ids.set(normalized, id);
		const meta = record(metadata[major === 9 ? `${info.name}@${info.version}` : key]);
		const resolution = record(meta.resolution);
		const node = packageNode(
			id,
			info.name,
			info.version,
			typeof resolution.tarball === 'string' ? 'other' : 'registry'
		);
		node.optional = meta.optional === true || descriptor.optional === true;
		builder.add(node);
	}
	if (data.importers !== undefined && !object(data.importers)) return failure('Invalid pnpm importers map.');
	const importers = object(data.importers) ? data.importers : major === 6 ? { '.': data } : null;
	if (importers === null) return failure('The pnpm lockfile must include an importers map.');
	for (const [path, descriptor] of Object.entries(importers)) {
		if (!object(descriptor)) return failure(`Invalid pnpm importer "${path}".`);
		if (path !== '.') builder.add(packageNode(`pnpm:workspace:${path}`, path, null, 'link'));
	}
	const resolve = (name: string, ref: string, consumer: string): string | null => {
		if (ref.startsWith('link:')) {
			const parts = (consumer === '.' ? [] : consumer.split('/')).concat(ref.slice(5).split('/'));
			const normalized: string[] = [];
			for (const part of parts) {
				if (part === '..') {
					if (normalized.length === 0) return null;
					normalized.pop();
				} else if (part && part !== '.') normalized.push(part);
			}
			const path = normalized.join('/') || '.';
			return Object.hasOwn(importers, path) ? (path === '.' ? '' : `pnpm:workspace:${path}`) : null;
		}
		const key = ref.replace(/^\//, '');
		return ids.get(key) ?? ids.get(`${name}@${key}`) ?? null;
	};
	const addFields = (
		source: string,
		descriptor: Record<string, unknown>,
		importerPath?: string,
		peers = new Set<string>()
	) => {
		for (const [field, kind] of [
			['dependencies', 'runtime'],
			['optionalDependencies', 'optional'],
			['devDependencies', 'development']
		] as const) {
			if (field === 'devDependencies' && importerPath === undefined) continue;
			if (descriptor[field] !== undefined && !object(descriptor[field])) {
				builder.graph.warnings.push(`Skipped invalid pnpm ${field} map for ${source || 'root'}.`);
				continue;
			}
			for (const [name, value] of Object.entries(record(descriptor[field]))) {
				const ref = object(value) ? value.version : value;
				if (typeof ref !== 'string') {
					builder.graph.warnings.push(`Skipped invalid pnpm dependency "${name}".`);
					continue;
				}
				const range = object(value) && typeof value.specifier === 'string' ? value.specifier : ref;
				const edgeKind: DependencyKind = peers.has(name) ? 'peer' : kind;
				builder.edge(source, resolve(name, ref, importerPath ?? '.'), edgeKind, name, range);
			}
		}
	};
	for (const [path, descriptor] of Object.entries(importers))
		addFields(path === '.' ? '' : `pnpm:workspace:${path}`, record(descriptor), path);
	for (const [key, descriptor] of Object.entries(snapshots)) {
		const id = ids.get(key.replace(/^\//, ''));
		if (!id) continue;
		const info = identity(key.replace(/^\//, ''))!;
		const meta = record(metadata[major === 9 ? `${info.name}@${info.version}` : key]);
		addFields(id, record(descriptor), undefined, new Set(Object.keys(record(meta.peerDependencies))));
	}
	builder.graph.warnings.push(
		'pnpm nodes represent lockfile resolutions, including peer contexts, rather than npm installed paths.'
	);
	return builder.finish();
}

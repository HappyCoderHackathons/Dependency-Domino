import { parse, type ParseError } from 'jsonc-parser';
import { failure, GraphBuilder, identity, object, packageNode, record, tooLarge } from '#lib/parser/shared.js';
import type { ParseResult } from '#lib/types.js';

export function parseBunLockfile(text: string): ParseResult {
	if (tooLarge(text)) return failure('Lockfiles must be 10 MiB or smaller.', 'too_large');
	const errors: ParseError[] = [];
	let data: unknown;
	try {
		data = parse(text, errors, { allowTrailingComma: true });
	} catch {
		return failure('Could not parse bun.lock. Choose a text JSONC lockfile.');
	}
	if (errors.length > 0 || !object(data)) return failure('Could not parse bun.lock. Choose a text JSONC lockfile.');
	if (data.lockfileVersion !== 0 && data.lockfileVersion !== 1)
		return failure('Supported Bun text lockfile versions are 0 and 1.', 'unsupported_version');
	if (!object(data.packages) || !object(data.workspaces) || !object(data.workspaces['']))
		return failure('The Bun lockfile must include packages and a root workspace.');
	const builder = new GraphBuilder();
	const root = data.workspaces[''];
	builder.graph.nodes[0].name = typeof root.name === 'string' ? root.name : 'root';
	builder.graph.nodes[0].version = typeof root.version === 'string' ? root.version : null;
	const descriptors = new Map<string, Record<string, unknown>>();
	const keys = new Set<string>();
	for (const [key, value] of Object.entries(data.packages)) {
		if (!Array.isArray(value) || typeof value[0] !== 'string') return failure(`Invalid Bun package entry "${key}".`);
		const info = identity(value[0]);
		const workspace = value[0].match(/^(.+)@workspace:(.+)$/);
		const name = info?.name ?? value[0].slice(0, value[0].indexOf('@', value[0].startsWith('@') ? 1 : 0));
		if (!name) return failure(`Invalid Bun resolution "${key}".`);
		const node = packageNode(
			`bun:${key}`,
			name,
			info?.version ?? null,
			info ? 'registry' : workspace ? 'link' : 'other'
		);
		const descriptor = workspace ? record(data.workspaces[workspace[2]]) : record(value[2]);
		node.optional = descriptor.optional === true;
		builder.add(node);
		keys.add(key);
		descriptors.set(key, descriptor);
		if (!info && !workspace)
			builder.graph.warnings.push(`Bun resolution "${key}" has an unsupported source; advisory lookup is skipped.`);
	}
	const resolve = (consumer: string, name: string): string | null => {
		const parts = consumer.match(/(?:@[^/]+\/)?[^/]+/g) ?? [];
		for (let length = parts.length; length >= 0; length--) {
			const key = [...parts.slice(0, length), name].join('/');
			if (keys.has(key)) return `bun:${key}`;
		}
		return null;
	};
	const addFields = (consumer: string, descriptor: Record<string, unknown>, workspace: boolean) => {
		for (const [field, kind] of [
			['dependencies', 'runtime'],
			['devDependencies', 'development'],
			['optionalDependencies', 'optional'],
			['peerDependencies', 'peer']
		] as const) {
			if (field === 'devDependencies' && !workspace) continue;
			if (descriptor[field] !== undefined && !object(descriptor[field])) return false;
			for (const [name, range] of Object.entries(record(descriptor[field]))) {
				if (typeof range !== 'string') return false;
				const optional =
					record(record(descriptor.peerDependenciesMeta)[name]).optional === true ||
					(Array.isArray(descriptor.optionalPeers) && descriptor.optionalPeers.includes(name));
				builder.edge(
					consumer ? `bun:${consumer}` : '',
					resolve(consumer, name),
					kind,
					name,
					range,
					kind === 'peer' && optional
				);
			}
		}
		return true;
	};
	if (!addFields('', root, true)) return failure('Invalid Bun root dependency declaration.');
	for (const [key, descriptor] of descriptors) {
		const entry = data.packages[key] as unknown[];
		if (!addFields(key, descriptor, String(entry[0]).includes('@workspace:')))
			return failure(`Invalid Bun dependencies for "${key}".`);
	}
	builder.graph.warnings.push(
		'Bun nodes are keyed by lockfile package paths. Resolution uses the recorded nesting; isolated linker layouts and platform-specific installation are not reconstructed.'
	);
	return builder.finish();
}

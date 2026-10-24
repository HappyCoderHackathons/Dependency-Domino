import { parseSyml } from '@yarnpkg/parsers';
import {
	failure,
	GraphBuilder,
	identity,
	object,
	packageNode,
	readYaml,
	record,
	tooLarge
} from '#lib/parser/shared.js';
import type { ParseResult } from '#lib/types.js';

function descriptorName(descriptor: string): string | null {
	const at = descriptor.indexOf('@', descriptor.startsWith('@') ? 1 : 0);
	return at > 0 ? descriptor.slice(0, at) : null;
}

export function parseYarnLockfile(text: string): ParseResult {
	if (tooLarge(text)) return failure('Lockfiles must be 10 MiB or smaller.', 'too_large');
	const classic = /^# yarn lockfile v1\s*$/m.test(text);
	let data: unknown;
	try {
		data = classic ? parseSyml(text.replace(/^\uFEFF/, '')) : readYaml(text);
	} catch {
		return failure('Could not parse yarn.lock. Resolve syntax errors or merge conflicts first.');
	}
	if (!object(data)) return failure('The Yarn lockfile must contain an object.');
	if (!classic) {
		const version = Number(record(data.__metadata).version);
		if (!Number.isInteger(version) || version < 2 || version > 10)
			return failure('Unsupported Yarn lockfile metadata version.', 'unsupported_version');
	}
	const builder = new GraphBuilder();
	const descriptors = new Map<string, string>();
	const entries: { id: string; descriptor: Record<string, unknown> }[] = [];
	const classicObjects = new Map<object, string>();
	for (const [key, value] of Object.entries(data)) {
		if (key === '__metadata') continue;
		if (!object(value) || typeof value.version !== 'string') return failure(`Invalid Yarn package entry "${key}".`);
		const selectors = key.split(/,\s+/);
		const resolution = typeof value.resolution === 'string' ? value.resolution : key;
		const name = descriptorName(resolution) ?? descriptorName(selectors[0]);
		if (!name) return failure(`Invalid Yarn descriptor "${key}".`);
		const root = !classic && resolution.endsWith('@workspace:.');
		const existing = classic ? classicObjects.get(value) : undefined;
		const id = existing ?? (root ? '' : `yarn:${classic ? key : resolution}`);
		for (const selector of selectors) descriptors.set(selector, id);
		if (existing !== undefined) continue;
		classicObjects.set(value, id);
		const alias = classic ? selectors[0].match(/@npm:((?:@[^/]+\/)?[^@]+)@/)?.[1] : undefined;
		const version = identity(`${alias ?? name}@${value.version}`)?.version ?? null;
		const registry = classic
			? selectors.every((selector) => !/@(?:git|https?:|file:|link:)/.test(selector))
			: /@npm:/.test(resolution);
		const node = packageNode(
			id,
			alias ?? name,
			version,
			registry ? 'registry' : /@(?:workspace|link|portal):/.test(resolution) ? 'link' : 'other'
		);
		if (root) Object.assign(builder.graph.nodes[0], node);
		else builder.add(node);
		entries.push({ id, descriptor: value });
	}
	for (const { id, descriptor } of entries) {
		for (const [field, defaultKind] of [
			['dependencies', 'runtime'],
			['optionalDependencies', 'optional']
		] as const) {
			if (descriptor[field] !== undefined && !object(descriptor[field])) return failure(`Invalid Yarn ${field} map.`);
			for (const [name, range] of Object.entries(record(descriptor[field]))) {
				if (typeof range !== 'string') return failure(`Invalid Yarn dependency "${name}".`);
				const target =
					descriptors.get(`${name}@${range}`) ??
					(!classic && !range.includes(':') ? descriptors.get(`${name}@npm:${range}`) : undefined);
				const optional = record(record(descriptor.dependenciesMeta)[name]).optional;
				builder.edge(
					id,
					target ?? null,
					optional === true || optional === 'true' ? 'optional' : defaultKind,
					name,
					range
				);
			}
		}
	}
	if (!entries.some((entry) => entry.id === ''))
		builder.graph.warnings.push(
			'Yarn lockfile has no root dependency declarations. Direct dependencies and root paths require package.json; none are inferred.'
		);
	builder.graph.warnings.push(
		'Yarn nodes represent locked resolutions, not installed copies. Development-only flags and resolved peer contexts are not available from this lockfile.'
	);
	return builder.finish();
}

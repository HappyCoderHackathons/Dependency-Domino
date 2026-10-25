const NODE_MODULES = '/node_modules/';

/** Lookup paths from nearest to root for `depName` required by `consumerPath`. */
export function candidatePaths(consumerPath: string, depName: string): string[] {
	const candidates: string[] = [];
	let prefix = consumerPath;

	while (true) {
		candidates.push(prefix === '' ? `node_modules/${depName}` : `${prefix}/node_modules/${depName}`);
		if (prefix === '') break;

		const index = prefix.lastIndexOf(NODE_MODULES);
		prefix =
			index === -1
				? prefix.startsWith('node_modules/')
					? ''
					: prefix.slice(0, Math.max(0, prefix.lastIndexOf('/')))
				: prefix.slice(0, index);
	}

	return candidates;
}

/** First candidate that is an installed node, or null. */
export function resolveDependency(
	installed: ReadonlySet<string>,
	consumerPath: string,
	depName: string
): string | null {
	for (const candidate of candidatePaths(consumerPath, depName)) {
		if (installed.has(candidate)) return candidate;
	}
	return null;
}

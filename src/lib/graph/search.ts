import type { PackageNode } from '#lib/types.js';

/** Bounded optimal-string-alignment distance, including adjacent transpositions. */
function distance(a: string, b: string, limit: number): number {
	if (Math.abs(a.length - b.length) > limit) return limit + 1;
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	let beforePrevious = previous;
	for (let i = 1; i <= a.length; i++) {
		const row = Array<number>(b.length + 1).fill(limit + 1);
		row[0] = i;
		for (let j = Math.max(1, i - limit); j <= Math.min(b.length, i + limit); j++) {
			row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				row[j] = Math.min(row[j], beforePrevious[j - 2] + 1);
			}
		}
		beforePrevious = previous;
		previous = row;
	}
	return previous[b.length];
}

export function searchPackages(nodes: PackageNode[], query: string): { matches: PackageNode[]; fuzzy: boolean } {
	const q = query.trim().toLowerCase();
	if (!q) return { matches: [], fuzzy: false };
	const order = (a: PackageNode, b: PackageNode) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
	const exact = nodes.filter((node) => `${node.name}@${node.version ?? ''}`.toLowerCase().includes(q));
	if (exact.length) {
		exact.sort(
			(a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)) || order(a, b)
		);
		return { matches: exact, fuzzy: false };
	}
	if (q.length < 3 || q.length > 80) return { matches: [], fuzzy: false };
	const limit = q.length < 6 ? 1 : 2;
	const scored = nodes
		.map((node) => {
			const name = node.name.toLowerCase();
			return { node, score: Math.min(distance(q, name, limit), distance(q, name.split('/').at(-1)!, limit)) };
		})
		.filter(({ score }) => score <= limit);
	scored.sort((a, b) => a.score - b.score || order(a.node, b.node));
	return { matches: scored.map(({ node }) => node), fuzzy: scored.length > 0 };
}

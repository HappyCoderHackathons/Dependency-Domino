import type { GraphIndex } from '#lib/graph/exploration.js';

export const MAX_SAMPLE_PATHS = 5;

function distancesTo(index: GraphIndex, origins: string[]): Map<string, number> {
	const distances = new Map(origins.filter((id) => id !== '' && index.nodes.has(id)).map((id) => [id, 0]));
	const queue = [...distances.keys()];
	for (let at = 0; at < queue.length; at++) {
		for (const edge of index.dependents.get(queue[at]) ?? []) {
			if (edge.source === '' || distances.has(edge.source)) continue;
			distances.set(edge.source, distances.get(queue[at])! + 1);
			queue.push(edge.source);
		}
	}
	return distances;
}

/** Enumerate a few shortest routes from one direct dependency; decreasing distance rules out cycles. */
function branchPaths(
	index: GraphIndex,
	start: string,
	origin: string,
	distances: Map<string, number>,
	limit: number
): string[][] {
	const results: string[][] = [];
	const choices = new Map<string, string[]>();
	const path = [start];
	const cursors = [0];
	while (path.length > 0 && results.length < limit) {
		const id = path[path.length - 1];
		if (id === origin) {
			results.push(['', ...path]);
			path.pop();
			cursors.pop();
			continue;
		}
		if (!choices.has(id))
			choices.set(id, [
				...new Set(
					(index.dependencies.get(id) ?? [])
						.filter((edge) => distances.has(edge.target) && distances.get(edge.target) === distances.get(id)! - 1)
						.map((edge) => edge.target)
				)
			]);
		const next = choices.get(id)![cursors[cursors.length - 1]++];
		if (next === undefined) {
			path.pop();
			cursors.pop();
		} else {
			path.push(next);
			cursors.push(0);
		}
	}
	return results;
}

/** Diverse short samples, capped globally across origins. Branch coverage is counted independently of this cap. */
export function sampleRootPaths(index: GraphIndex, origins: string[], limit = MAX_SAMPLE_PATHS) {
	const targets = [...new Set((index.dependencies.get('') ?? []).map((edge) => edge.target).filter((id) => id !== ''))];
	const reached = distancesTo(index, origins);
	const rootBranchCount = targets.filter((id) => reached.has(id)).length;
	const samplePaths: string[][] = [];
	const samplers: { origin: string; distances: Map<string, number>; branches: string[] }[] = [];
	for (const origin of origins) {
		if (samplePaths.length >= limit) break;
		if (origin === '') {
			samplePaths.push(['']);
			continue;
		}
		const distances = distancesTo(index, [origin]);
		const branches = targets.filter((id) => distances.has(id)).sort((a, b) => distances.get(a)! - distances.get(b)!);
		if (branches.length === 0) continue;
		samplePaths.push(...branchPaths(index, branches[0], origin, distances, 1));
		samplers.push({ origin, distances, branches });
	}
	// Include other direct branches before additional alternatives within a branch.
	for (const { origin, distances, branches } of samplers) {
		for (const branch of branches.slice(1)) {
			if (samplePaths.length >= limit) break;
			samplePaths.push(...branchPaths(index, branch, origin, distances, 1));
		}
	}
	const seen = new Set(samplePaths.map((path) => JSON.stringify(path)));
	for (const { origin, distances, branches } of samplers) {
		for (const branch of branches) {
			if (samplePaths.length >= limit) break;
			for (const path of branchPaths(index, branch, origin, distances, limit)) {
				const key = JSON.stringify(path);
				if (seen.has(key)) continue;
				seen.add(key);
				samplePaths.push(path);
				if (samplePaths.length >= limit) break;
			}
		}
	}
	return { samplePaths, rootBranchCount };
}

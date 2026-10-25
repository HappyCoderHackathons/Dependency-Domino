import type { DependencyGraph } from '#lib/types.js';
import { indexGraph, type GraphIndex } from './exploration';

function fromRoot(index: GraphIndex, excluded?: string): Set<string> {
	const seen = new Set<string>();
	if (!index.nodes.has('') || excluded === '') return seen;
	seen.add('');
	const queue = [''];
	for (let at = 0; at < queue.length; at++) {
		for (const { target } of index.dependencies.get(queue[at]) ?? []) {
			if (target === excluded || seen.has(target)) continue;
			seen.add(target);
			queue.push(target);
		}
	}
	return seen;
}

export interface RemovalPreview {
	removedId: string;
	graph: DependencyGraph;
	unreachableIds: string[];
	rootReachableBefore: boolean;
}

/** Compare reachability against the original so already disconnected nodes are never counted as new losses. */
export function previewRemoval(graph: DependencyGraph, removedId: string): RemovalPreview {
	const index = indexGraph(graph);
	if (removedId === '' || !index.nodes.has(removedId)) throw new Error('Choose an installed package to remove.');
	const before = fromRoot(index);
	const after = fromRoot(index, removedId);
	return {
		removedId,
		graph: {
			nodes: graph.nodes.filter((node) => node.id !== removedId),
			edges: graph.edges.filter((edge) => edge.source !== removedId && edge.target !== removedId),
			warnings: [...graph.warnings]
		},
		unreachableIds: graph.nodes
			.filter((node) => node.id !== removedId && node.id !== '' && before.has(node.id) && !after.has(node.id))
			.map((node) => node.id),
		rootReachableBefore: before.has(removedId)
	};
}

const cache = new WeakMap<DependencyGraph, Map<string, string>>();

function immediateDominators(graph: DependencyGraph): Map<string, string> {
	const cached = cache.get(graph);
	if (cached) return cached;
	const index = indexGraph(graph);
	const seen = new Set(['']);
	const postorder: string[] = [];
	const stack = [{ id: '', next: 0 }];
	while (stack.length) {
		const top = stack[stack.length - 1];
		const edges = index.dependencies.get(top.id) ?? [];
		if (top.next >= edges.length) {
			postorder.push(top.id);
			stack.pop();
			continue;
		}
		const target = edges[top.next++].target;
		if (!seen.has(target)) {
			seen.add(target);
			stack.push({ id: target, next: 0 });
		}
	}
	const order = postorder.reverse();
	const rank = new Map(order.map((id, i) => [id, i]));
	const parents = new Map([['', '']]);
	function intersect(a: string, b: string): string {
		while (a !== b) {
			while (rank.get(a)! > rank.get(b)!) a = parents.get(a)!;
			while (rank.get(b)! > rank.get(a)!) b = parents.get(b)!;
		}
		return a;
	}
	let changed = true;
	while (changed) {
		changed = false;
		for (const id of order.slice(1)) {
			const predecessors = (index.dependents.get(id) ?? [])
				.map((edge) => edge.source)
				.filter((source) => parents.has(source));
			if (!predecessors.length) continue;
			const next = predecessors
				.slice(1)
				.reduce((parent, predecessor) => intersect(parent, predecessor), predecessors[0]);
			if (parents.get(id) !== next) {
				parents.set(id, next);
				changed = true;
			}
		}
	}
	cache.set(graph, parents);
	return parents;
}

/** Strict dominators, ordered from root toward the origin. Root and origin are excluded. */
export function everyPathPackages(graph: DependencyGraph, originId: string): string[] {
	const parents = immediateDominators(graph);
	const result: string[] = [];
	let id = parents.get(originId);
	while (id) {
		result.push(id);
		id = parents.get(id);
	}
	return result.reverse();
}

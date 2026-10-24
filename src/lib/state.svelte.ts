// src/lib/state.svelte.ts
// The .svelte.ts extension is required: runes only work in .svelte and .svelte.ts/.svelte.js files.

import type { DependencyGraph, ImpactResult, PackageNode } from './types';

class AppState {
	// Large objects use $state.raw: they are replaced wholesale, never mutated in place,
	// so we skip deep proxying (faster, and friendlier to Cytoscape).
	graph = $state.raw<DependencyGraph | null>(null);
	impact = $state.raw<ImpactResult | null>(null);
	warnings = $state.raw<string[]>([]);

	selectedId = $state<string | null>(null);
	error = $state<string | null>(null); // parser/validation error shown in the UI
	sourceLabel = $state<string | null>(null); // e.g. "demo" or the uploaded file name

	// Derived values
	hasGraph = $derived(this.graph !== null);

	nodesById = $derived.by(() => {
		const map = new Map<string, PackageNode>();
		for (const node of this.graph?.nodes ?? []) map.set(node.id, node);
		return map;
	});

	selectedNode = $derived.by(() => (this.selectedId ? (this.nodesById.get(this.selectedId) ?? null) : null));

	originNode = $derived.by(() => (this.impact ? (this.nodesById.get(this.impact.originId) ?? null) : null));

	// Actions: components call these instead of assigning fields directly.

	/** Replace everything with a freshly parsed graph (import or Try Demo). */
	loadGraph(graph: DependencyGraph, label: string) {
		this.graph = graph;
		this.warnings = graph.warnings;
		this.sourceLabel = label;
		this.error = null;
		this.selectedId = null;
		this.impact = null;
	}

	/** Parser or validation failure. Keeps any existing graph on screen. */
	setError(message: string) {
		this.error = message;
	}

	clearError() {
		this.error = null;
	}

	select(id: string | null) {
		this.selectedId = id;
	}

	/** Store the result of simulateCompromise(). */
	setImpact(impact: ImpactResult | null) {
		this.impact = impact;
	}

	/** Clear only the simulation, keep the graph and selection. */
	clearSimulation() {
		this.impact = null;
	}

	/** Reset button: clear simulation and selection, keep the loaded graph. */
	reset() {
		this.impact = null;
		this.selectedId = null;
		this.error = null;
	}
}

export const app = new AppState();

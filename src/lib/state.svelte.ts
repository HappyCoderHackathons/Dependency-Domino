// src/lib/state.svelte.ts
// The .svelte.ts extension is required: runes only work in .svelte and .svelte.ts/.svelte.js files.

import type { DependencyGraph, ImpactResult, PackageNode, VulnerabilityResponse } from './types';
import { attachAdvisories } from './osv/attach';
import { requestAdvisories } from './osv/request';
import { packageAdvisories } from '#lib/osv/status.js';
import type { OsvStatus } from '#lib/osv/status.js';

export type { OsvStatus } from '#lib/osv/status.js';

export class AppState {
	private advisoryRequest = 0;
	// Large objects use $state.raw: they are replaced wholesale, never mutated in place,
	// so we skip deep proxying (faster, and friendlier to Cytoscape).
	graph = $state.raw<DependencyGraph | null>(null);
	impact = $state.raw<ImpactResult | null>(null);
	warnings = $state.raw<string[]>([]);

	selectedId = $state<string | null>(null);
	error = $state<string | null>(null); // parser/validation error shown in the UI
	sourceLabel = $state<string | null>(null); // e.g. "demo" or the uploaded file name
	osvStatus = $state<OsvStatus>('idle'); // known advisory lookup, separate from the simulation
	osvResponse = $state.raw<VulnerabilityResponse | null>(null);

	lockfileVersion = $state<number | null>(null);

	// Derived values
	hasGraph = $derived(this.graph !== null);

	nodesById = $derived.by(() => {
		const map = new Map<string, PackageNode>();
		for (const node of this.graph?.nodes ?? []) map.set(node.id, node);
		return map;
	});

	selectedNode = $derived.by(() => (this.selectedId !== null ? (this.nodesById.get(this.selectedId) ?? null) : null));
	selectedAdvisories = $derived.by(() =>
		this.selectedNode ? packageAdvisories(this.selectedNode, this.osvStatus, this.osvResponse) : null
	);
	advisoryInstanceCount = $derived(this.graph?.nodes.filter((node) => node.advisoryIds.length > 0).length ?? 0);

	originNode = $derived.by(() => (this.impact ? (this.nodesById.get(this.impact.originId) ?? null) : null));

	// Actions: components call these instead of assigning fields directly.

	/** Replace everything with a freshly parsed graph (import or Try Demo). */
	loadGraph(graph: DependencyGraph, label: string, lockfileVersion: number | null = null) {
		this.graph = graph;
		this.warnings = graph.warnings;
		this.sourceLabel = label;
		this.error = null;
		this.selectedId = null;
		this.impact = null;
		this.osvResponse = null;
		this.lockfileVersion = lockfileVersion;
		void this.checkAdvisories();
	}

	/** Looks up known advisories in the background. A failed lookup never touches the simulation. */
	async checkAdvisories(fetchFn: typeof fetch = fetch) {
		const graph = this.graph;
		if (!graph) return;

		const request = ++this.advisoryRequest;
		this.osvStatus = 'loading';
		const response = await requestAdvisories(graph, fetchFn);
		if (this.graph !== graph || request !== this.advisoryRequest) return;

		const cleared = { ...graph, nodes: graph.nodes.map((node) => ({ ...node, advisoryIds: [] })) };
		const attached = attachAdvisories(cleared, response);
		this.graph = {
			...attached,
			nodes: attached.nodes.map((node) =>
				node.id !== '' && node.source === 'registry' ? node : { ...node, advisoryIds: [] }
			)
		};
		this.osvResponse = response;
		this.warnings = [...graph.warnings, ...response.warnings];
		this.osvStatus = response.status;
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

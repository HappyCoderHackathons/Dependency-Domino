// src/lib/state.svelte.ts
// The .svelte.ts extension is required: runes only work in .svelte and .svelte.ts/.svelte.js files.

import type { AdvisoryDetails, DependencyGraph, ImpactResult, PackageNode, VulnerabilityResponse } from './types';
import { attachAdvisories } from './osv/attach';
import { requestAdvisories, requestAdvisoryDetails } from './osv/request';
import { packageAdvisories } from '#lib/osv/status.js';
import type { OsvStatus } from '#lib/osv/status.js';
import { DEFAULT_FILTERS, rankFromRoot, visibleNodeIds } from '#lib/graph/view.js';
import type { LayoutDirection, ViewFilters } from '#lib/graph/view.js';
import {
	INITIAL_REVEAL,
	deepen,
	isProgressive,
	pinPath,
	revealKey as keyOfReveal,
	revealedNodeIds
} from '#lib/graph/reveal.js';
import type { RevealState } from '#lib/graph/reveal.js';

export type { OsvStatus } from '#lib/osv/status.js';

export type AdvisoryDetailState =
	{ status: 'loading' } | { status: 'loaded'; details: AdvisoryDetails } | { status: 'failed' };

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
	advisoryDetails = $state<Record<string, AdvisoryDetailState>>({});

	lockfileVersion = $state<number | null>(null);

	// View-only settings. The simulation always runs on the full graph.
	filters = $state<ViewFilters>({ ...DEFAULT_FILTERS });
	layoutDirection = $state<LayoutDirection>('auto');

	// Progressive reveal of large graphs: root plus `revealDepth` levels, plus pinned search results.
	revealDepth = $state(INITIAL_REVEAL.depth);
	pinnedIds = $state.raw<ReadonlySet<string>>(INITIAL_REVEAL.pinned);

	focusToken = $state(0);
	/** Select a node and ask the canvas to bring it into view (search results). Reveals it first if hidden. */
	focus(id: string) {
		this.revealNode(id);
		this.selectedId = id;
		this.focusToken++;
	}

	/** Reveals one more depth level of a large graph. */
	showMore() {
		const next = deepen(this.ranks, this.reveal);
		this.revealDepth = next.depth;
		this.pinnedIds = next.pinned;
	}

	/** Reveals a node and its path to the root when progressive reveal is hiding it. */
	revealNode(id: string) {
		if (!this.graph || !this.revealedIds || this.revealedIds.has(id)) return;
		this.pinnedIds = pinPath(this.graph, this.ranks, this.reveal, id).pinned;
	}

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
	advisoryNodes = $derived(
		(this.graph?.nodes.filter((node) => node.advisoryIds.length > 0) ?? []).toSorted(
			(a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
		)
	);
	advisoryInstanceCount = $derived(this.advisoryNodes.length);
	advisoryIds = $derived([...new Set(this.advisoryNodes.flatMap((node) => node.advisoryIds))]);

	ranks = $derived(this.graph ? rankFromRoot(this.graph) : new Map<string, number>());
	/** True when the graph is large enough that only part of it is shown until the person asks for more. */
	progressive = $derived(this.graph !== null && isProgressive(this.graph));
	reveal = $derived<RevealState>({ depth: this.revealDepth, pinned: this.pinnedIds });
	/** Ids progressive reveal puts on the canvas before filters apply. Null means the whole graph. */
	revealedIds = $derived(this.graph && this.progressive ? revealedNodeIds(this.graph, this.ranks, this.reveal) : null);
	/** Identity of what is revealed. Together with the layout direction it keys the layout cache. */
	revealKey = $derived(this.progressive ? keyOfReveal(this.reveal) : 'all');
	canShowMore = $derived(
		this.revealedIds !== null && this.graph !== null && this.revealedIds.size < this.graph.nodes.length
	);
	/** How many more instances the next "Show more" adds. */
	nextRevealCount = $derived.by(() => {
		if (!this.graph || !this.revealedIds) return 0;
		return revealedNodeIds(this.graph, this.ranks, deepen(this.ranks, this.reveal)).size - this.revealedIds.size;
	});

	/** Ids on the canvas: inside the revealed set and passing the filters. The simulation uses the full graph. */
	visibleIds = $derived.by(() => {
		if (!this.graph) return new Set<string>();
		const ids = visibleNodeIds(this.graph, this.filters);
		const revealed = this.revealedIds;
		if (revealed) for (const id of ids) if (!revealed.has(id)) ids.delete(id);
		return ids;
	});
	/** Affected instances (excluding the origin) that the current filters or reveal depth hide from the canvas. */
	hiddenAffectedCount = $derived(
		this.impact
			? this.impact.ancestorIds.filter((id) => !this.impact!.originIds.includes(id) && !this.visibleIds.has(id)).length
			: 0
	);

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
		this.revealDepth = INITIAL_REVEAL.depth;
		this.pinnedIds = INITIAL_REVEAL.pinned;
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

	/** Starts uncached detail lookups without blocking the graph or advisory summary. */
	async loadAdvisoryDetails(ids: string[], fetchFn: typeof fetch = fetch) {
		const uncached = ids.filter((id) => !this.advisoryDetails[id]);
		for (const id of uncached) this.advisoryDetails[id] = { status: 'loading' };
		await Promise.all(
			uncached.map(async (id) => {
				const details = await requestAdvisoryDetails(id, fetchFn);
				this.advisoryDetails[id] = details ? { status: 'loaded', details } : { status: 'failed' };
			})
		);
	}

	advisoryDetail(id: string): AdvisoryDetailState | undefined {
		return this.advisoryDetails[id];
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

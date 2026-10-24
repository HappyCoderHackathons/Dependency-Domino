<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Core } from 'cytoscape';
	import cytoscape from 'cytoscape';
	import dagre from 'cytoscape-dagre';
	import Icon from '@iconify/svelte';
	import { app } from '#lib/state.svelte.ts';
	import type { DependencyGraph } from '#lib/types.ts';
	import { fromCyId, toCyId, toElements } from '#lib/graph/normalize.js';
	import { COLORS } from '#lib/graph/theme.ts';

	cytoscape.use(dagre);

	let container: HTMLDivElement;
	let cy = $state.raw<Core | null>(null);
	let renderedInstance: Core | null = null;
	let renderedEdges: DependencyGraph['edges'] | null = null;

	const MAX_STEP_MS = 350; // delay between layers
	const MAX_TOTAL_MS = 3000; // cap so deep graphs don't take forever

	// Create once on mount, destroy on teardown.
	onMount(() => {
		const instance = cytoscape({
			container,
			minZoom: 0.05,
			maxZoom: 3,
			elements: [],
			// Later rules win, so state styles (origin, affected, path, picked) come last.
			style: [
				{
					selector: 'node',
					style: {
						shape: 'ellipse',
						'background-color': COLORS.node,
						width: 20,
						height: 20,
						label: 'data(label)',
						'font-size': 12, // readable on a projector
						'text-valign': 'bottom',
						'text-margin-y': 4,
						'text-max-width': '130px',
						'text-wrap': 'ellipsis',
						'text-background-color': '#ffffff',
						'text-background-opacity': 0.85,
						'text-background-padding': '2px'
					}
				},
				{
					selector: 'node.root',
					style: {
						shape: 'round-rectangle',
						width: 44,
						height: 28,
						'background-color': COLORS.root,
						'font-size': 14,
						'font-weight': 'bold'
					}
				},
				{
					// #47: link or other sources are caveats, so dashed border and muted fill
					selector: 'node.link, node.unsupported',
					style: {
						'background-color': COLORS.unsupportedFill,
						'border-width': 2,
						'border-style': 'dashed',
						'border-color': COLORS.unresolved,
						'text-opacity': 0.8
					}
				},
				{
					selector: 'edge',
					style: {
						width: 1.5,
						'line-color': COLORS.edge,
						'curve-style': 'bezier',
						'target-arrow-shape': 'triangle',
						'target-arrow-color': COLORS.edge
					}
				},
				{
					selector: 'edge[kind = "development"]',
					style: { 'line-style': 'dotted', 'line-color': COLORS.devEdge, 'target-arrow-color': COLORS.devEdge }
				},
				{
					selector: 'edge.unresolved',
					style: { 'line-style': 'dashed', 'line-color': COLORS.unresolved, 'target-arrow-color': COLORS.unresolved }
				},
				{
					selector: 'edge.path',
					style: { width: 3.5, 'line-style': 'solid', 'line-color': COLORS.pathEdge, 'target-arrow-color': COLORS.pathEdge }
				},
				{
					selector: 'node.origin',
					style: { 'background-color': COLORS.origin, 'border-width': 3, 'border-color': COLORS.originBorder }
				},
				{
					selector: 'node.affected',
					style: { 'background-color': COLORS.affected, 'border-width': 2, 'border-color': COLORS.affectedBorder }
				},
				{ selector: 'node.path', style: { 'border-width': 4 } },
				{
					selector: 'node.picked',
					style: { 'border-width': 5, 'border-color': COLORS.picked, 'border-opacity': 1 }
				}
			]
		});

		// Click a node to select it; click the background to clear. Root maps back to "".
		instance.on('tap', 'node', (evt) => app.select(fromCyId(evt.target.id())));
		instance.on('tap', (evt) => {
			if (evt.target === instance) app.select(null); // background only; node taps bubble up too
		});

		cy = instance;

		return () => {
			instance.destroy();
			cy = null;
		};
	});

	// Same nodes and the same number of edges means the same layout.
	let lastKey = '';
	function structureKey(graph: DependencyGraph): string {
		return `${graph.nodes.map((n) => n.id).join('\n')}|${graph.edges.length}`;
	}

	// Replace elements when the graph in shared state changes.
	$effect(() => {
		const instance = cy;
		const graph = app.graph;
		if (!instance || !graph) return;

		const key = structureKey(graph);

		// Same structure (for example known advisories were attached after the import): update node data
		// in place. No relayout, so the viewport, selection and simulation colors all stay as they are.
		if (key === lastKey) {
			instance.batch(() => {
				for (const el of toElements(graph)) {
					if (el.group !== 'nodes' || !el.data?.id) continue;
					const node = instance.getElementById(el.data.id);
					if (node.empty()) continue;
					node.data(el.data);
					const classes = Array.isArray(el.classes) ? el.classes.join(' ') : (el.classes ?? '');
					if (classes) node.addClass(classes); // additive: keeps origin, affected, picked, path
				}
			});
			return;
		}
		lastKey = key;

		instance.batch(() => {
			instance.elements().remove();
			instance.add(toElements(graph));
		});

		instance
			.layout({
				name: 'dagre',
				rankDir: 'TB',
				nodeSep: 30,
				rankSep: 60,
				nodeDimensionsIncludeLabels: true,
				animate: false,
				fit: true,
				padding: 30
			} as cytoscape.LayoutOptions)
			.run();
	});

	// Selection outline follows app.selectedId (clicks and search results both go through state).
	$effect(() => {
		const instance = cy;
		const id = app.selectedId;
		if (!instance) return;

		instance.batch(() => {
			instance.nodes('.picked').removeClass('picked');
			if (id !== null) instance.getElementById(toCyId(id)).addClass('picked');
		});
	});

	// #65: search results bring the node into view. app.focus() bumps focusToken; plain canvas clicks
	// only call select(), so clicking a node never moves the viewport.
	$effect(() => {
		const instance = cy;
		const token = app.focusToken;
		if (!instance || token === 0) return;

		const id = untrack(() => app.selectedId);
		if (id === null) return;
		const target = instance.getElementById(toCyId(id));
		if (target.empty()) return;

		// Zoom in to 1.2 at least, but never zoom out if the user is already closer
		instance.animate(
			{ center: { eles: target }, zoom: Math.max(instance.zoom(), 1.2) },
			{ duration: 300 }
		);
	});

	// Simulation styling and animation. Svelte runs the returned cleanup before every re-run, so changing
	// or clearing app.impact always cancels pending timers and strips old classes first.
	$effect(() => {
		const instance = cy;
		const impact = app.impact;
		if (!instance) return;

		instance.batch(() => {
			instance.elements().removeClass('origin affected path');
			if (impact) instance.getElementById(toCyId(impact.originId)).addClass('origin');
		});
		if (!impact) return;

		const step = Math.min(MAX_STEP_MS, MAX_TOTAL_MS / Math.max(impact.layers.length - 1, 1));
		const timers: ReturnType<typeof setTimeout>[] = [];

		impact.layers.forEach((layer, i) => {
			if (i === 0) return; // layer 0 is the origin, already styled
			timers.push(
				setTimeout(() => {
					instance.batch(() => {
						for (const id of layer) instance.getElementById(toCyId(id)).addClass('affected');
					});
				}, i * step)
			);
		});

		// Finale: emphasize the sample path one step after the last layer lands
		const path = impact.samplePaths[0] ?? [];
		if (path.length > 1) {
			timers.push(
				setTimeout(() => {
					instance.batch(() => {
						path.forEach((id, i) => {
							const node = instance.getElementById(toCyId(id));
							node.addClass('path');
							const next = path[i + 1];
							if (next !== undefined) {
								node.edgesTo(instance.getElementById(toCyId(next))).addClass('path');
							}
						});
					});
				}, impact.layers.length * step)
			);
		}

		return () => timers.forEach(clearTimeout); // cancel token
	});

	// Zoom controls (#48)
	const ctrl =
		'flex size-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

	function zoomBy(factor: number) {
		if (!cy) return;
		cy.zoom({
			level: cy.zoom() * factor,
			renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } // zoom around the view's center
		});
	}

	function fitView() {
		cy?.fit(undefined, 40);
	}
</script>

<div class="relative h-full w-full">
	<div class="graph" bind:this={container}></div>

	<div class="absolute right-4 bottom-4 z-10 flex flex-col gap-1">
		<button type="button" class={ctrl} aria-label="Zoom in" disabled={!app.hasGraph} onclick={() => zoomBy(1.25)}>
			<Icon icon="mdi:plus" width="20" height="20" />
		</button>
		<button type="button" class={ctrl} aria-label="Zoom out" disabled={!app.hasGraph} onclick={() => zoomBy(0.8)}>
			<Icon icon="mdi:minus" width="20" height="20" />
		</button>
		<button type="button" class={ctrl} aria-label="Fit graph to view" disabled={!app.hasGraph} onclick={fitView}>
			<Icon icon="mdi:fit-to-screen-outline" width="20" height="20" />
		</button>
	</div>
</div>

<style>
	.graph {
		width: 100%;
		height: 100%;
		min-height: 400px; /* a Cytoscape container with no height renders blank */
	}
</style>

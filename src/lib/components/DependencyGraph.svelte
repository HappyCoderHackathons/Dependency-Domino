<script lang="ts">
	import { onMount } from 'svelte';
	import type { Core, ElementDefinition } from 'cytoscape';
	import { app } from '#lib/state.svelte.ts';
  	import type { DependencyGraph } from '#lib/types.ts';
	import cytoscape from 'cytoscape';
	import dagre from 'cytoscape-dagre';
	import { toElements } from '#lib/graph/normalize.js';
	import Icon from '@iconify/svelte';

	cytoscape.use(dagre);


	// The plan keys the root project as "" but Cytoscape rejects empty-string IDs,
	// so the root gets a stand-in ID on the canvas.
	const ROOT_ID = '__root__';
	const toStateId = (id: string) => (id === ROOT_ID ? '' : id);
	const toCyId = (id: string) => (id === '' ? ROOT_ID : id);

	let container: HTMLDivElement;
	let cy = $state.raw<Core | null>(null);

	const MAX_STEP_MS = 350; // delay between layers
	const MAX_TOTAL_MS = 3000; // cap so deep graphs don't take forever

	// Create once on mount, destroy on teardown.
	onMount(() => {
		const instance = cytoscape({
			container,
			minZoom: 0.05,
			maxZoom: 3,
			elements: [],
			style: [
				{
					selector: 'node',
					style: {
						shape: 'ellipse',
						'background-color': '#8892a6',
						width: 20,
						height: 20,
						label: 'data(label)',
						'font-size': 10,
						'text-valign': 'bottom',
						'text-margin-y': 4,
						'text-max-width': '110px',
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
						'background-color': '#334155',
						'font-size': 12,
						'font-weight': 'bold'
					}
				},
				{
					selector: 'edge',
					style: {
						width: 1.5,
						'line-color': '#b8bfcc',
						'curve-style': 'bezier',
						'target-arrow-shape': 'triangle',
						'target-arrow-color': '#b8bfcc'
					}
				},
				{
					selector: 'edge[kind = "development"]',
					style: {
						'line-style': 'dotted',
						'line-color': '#d5dae3',
						'target-arrow-color': '#d5dae3'
					}
				},
				{
					selector: 'edge.path',
					style: { width: 3.5, 'line-style': 'solid', 'line-color': '#c2410c', 'target-arrow-color': '#c2410c' }
				},
				{
					selector: 'node.origin',
					style: { 'background-color': '#2563eb', 'border-width': 3, 'border-color': '#1d4ed8' }
				},
				{
					selector: 'node.affected',
					style: { 'background-color': '#f97316', 'border-width': 2, 'border-color': '#c2410c' }
				},
				{ 	selector: 'node.path', 
					style: { 'border-width': 4 } },
				{
					selector: 'node.picked',
					style: { 'border-width': 5, 'border-color': '#0f172a', 'border-opacity': 1 }
				}
			]
		});
		cy = instance;
		instance.on('tap', 'node', (evt) => app.select(toStateId(evt.target.id())));
		instance.on('tap', (evt) => {
			if (evt.target === instance) app.select(null); // background tap only
		});

		return () => {
			instance.destroy();
			cy = null;
		};
	});

	// Replace elements whenever the graph in shared state changes.
	$effect(() => {
		const instance = cy;
		const graph = app.graph;
		if (!instance || !graph) return;

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

	$effect(() => {
		const instance = cy;
		const id = app.selectedId;
		if (!instance) return;

		instance.batch(() => {
			instance.nodes('.picked').removeClass('picked');
			if (id !== null) instance.getElementById(toCyId(id)).addClass('picked');
		});

		// Pan to the node if a search result is off screen
		if (id !== null) {
			const target = instance.getElementById(toCyId(id));
			if (target.empty()) return;
			const ext = instance.extent();
			const p = target.position();
			const inView = p.x >= ext.x1 && p.x <= ext.x2 && p.y >= ext.y1 && p.y <= ext.y2;
			if (!inView) instance.animate({ center: { eles: target }, duration: 200 });
		}
	});
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


	// Accessability
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
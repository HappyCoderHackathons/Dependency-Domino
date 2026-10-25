<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Core, StylesheetJson } from 'cytoscape';
	import cytoscape from 'cytoscape';
	import dagre from 'cytoscape-dagre';
	import Icon from '@iconify/svelte';
	import { app } from '#lib/state.svelte.ts';
	import type { DependencyGraph } from '#lib/types.ts';
	import { fromCyId, nodeLabel, toCyId, toElements } from '#lib/graph/normalize.js';
	import { chooseRankDir, LARGE_GRAPH_NODES } from '#lib/graph/view.js';
	import type { LayoutDirection, RankDir } from '#lib/graph/view.js';
	import { COLORS } from '#lib/graph/theme.ts';

	cytoscape.use(dagre);

	let container: HTMLDivElement;
	let cy = $state.raw<Core | null>(null);
	let rankDir = $state<RankDir>('TB');
	let noticeDismissed = $state(false);

	const MAX_STEP_MS = 350; // delay between layers
	const MAX_TOTAL_MS = 3000; // cap so deep graphs don't take forever
	const MAX_FRAME_ZOOM = 1.2;
	const FONT = 'Geist Variable, ui-sans-serif, system-ui, sans-serif';

	const nodeCount = $derived(app.graph?.nodes.length ?? 0);
	const large = $derived(nodeCount > LARGE_GRAPH_NODES);

	function reducedMotion() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/**
	 * Labels of emphasized nodes (root, origin, path, selection, hover) grow as the view zooms out, so a
	 * long chain stays readable even when the whole graph is in view. Everything else hides its label
	 * once it would render too small to read.
	 */
	function buildStyle(labelScale: number, largeGraph: boolean, lr: boolean): StylesheetJson {
		return [
			{
				selector: 'node',
				style: {
					shape: 'ellipse',
					'background-color': COLORS.node,
					'border-width': 1.5,
					'border-color': COLORS.nodeBorder,
					width: 18,
					height: 18,
					label: 'data(label)',
					color: COLORS.label,
					'font-family': FONT,
					'font-size': 11,
					'min-zoomed-font-size': 8,
					// Left to right, labels sit beside the node so each rank stays a tight column.
					'text-valign': lr ? 'center' : 'bottom',
					'text-halign': lr ? 'right' : 'center',
					'text-margin-x': lr ? 6 : 0,
					'text-margin-y': lr ? 0 : 5,
					'text-max-width': '140px',
					'text-wrap': 'ellipsis',
					'text-background-color': COLORS.canvas,
					'text-background-opacity': 0.85,
					'text-background-padding': '2px',
					'text-background-shape': 'roundrectangle',
					'overlay-opacity': 0,
					'transition-property': 'opacity',
					'transition-duration': largeGraph ? 0 : 0.2
				}
			},
			{
				selector: 'node.root',
				style: {
					shape: 'round-rectangle',
					width: 40,
					height: 24,
					'background-color': COLORS.root,
					'border-color': COLORS.rootBorder,
					'font-weight': 600,
					color: '#f8fafc'
				}
			},
			{
				// #47: link or other sources are caveats, so dashed border and muted fill
				selector: 'node.link, node.unsupported',
				style: {
					'background-color': COLORS.unsupportedFill,
					'border-width': 2,
					'border-style': 'dashed',
					'border-color': COLORS.unresolved
				}
			},
			{
				selector: 'node.advisory',
				style: {
					width: 24,
					height: 24,
					'border-width': 6,
					'border-style': 'double',
					'border-color': COLORS.advisory,
					color: COLORS.advisory,
					'font-weight': 600
				}
			},
			{
				selector: 'edge',
				style: {
					width: 1.25,
					'line-color': COLORS.edge,
					'curve-style': largeGraph ? 'straight' : 'bezier',
					'target-arrow-shape': 'triangle',
					'target-arrow-color': COLORS.edge,
					'arrow-scale': 0.8,
					'overlay-opacity': 0
				}
			},
			{
				selector: 'edge[kind = "development"]',
				style: { 'line-style': 'dotted' }
			},
			{
				selector: 'edge.unresolved',
				style: { 'line-style': 'dashed', 'line-color': COLORS.unresolved, 'target-arrow-color': COLORS.unresolved }
			},
			{
				selector: 'edge.cascade',
				style: { width: 2, 'line-color': COLORS.cascadeEdge, 'target-arrow-color': COLORS.cascadeEdge, 'z-index': 5 }
			},
			{
				selector: 'edge.path',
				style: {
					width: 4,
					'line-style': 'solid',
					'line-color': COLORS.pathEdge,
					'target-arrow-color': COLORS.pathEdge,
					'z-index': 10
				}
			},
			{
				selector: 'edge.hover-edge',
				style: { width: 2, 'line-color': COLORS.root, 'target-arrow-color': COLORS.root, 'z-index': 20 }
			},
			{
				selector: 'node.affected',
				style: { 'background-color': COLORS.affected, 'border-color': COLORS.affectedBorder, 'border-width': 2 }
			},
			{
				selector: 'node.origin',
				style: {
					width: 28,
					height: 28,
					'background-color': COLORS.origin,
					'border-width': 3,
					'border-color': COLORS.originBorder,
					'underlay-color': COLORS.origin,
					'underlay-opacity': 0.3,
					'underlay-padding': 10,
					'underlay-shape': 'ellipse',
					color: COLORS.originBorder,
					'font-weight': 600
				}
			},
			{ selector: 'node.path', style: { 'border-width': 3, 'z-index': 10 } },
			{
				selector: 'node.picked',
				style: {
					'border-width': 4,
					'border-color': COLORS.picked,
					'underlay-color': COLORS.root,
					'underlay-opacity': 0.25,
					'underlay-padding': 8,
					'underlay-shape': 'ellipse',
					'z-index': 20
				}
			},
			{ selector: 'node.origin.picked', style: { 'underlay-color': COLORS.origin, 'underlay-opacity': 0.35 } },
			{
				selector: 'node.root, node.origin, node.path, node.picked, node.hover',
				style: {
					'min-zoomed-font-size': 0,
					'font-size': 11 * labelScale,
					'text-margin-x': lr ? 6 * labelScale : 0,
					'text-margin-y': lr ? 0 : 5 * labelScale,
					'text-max-width': `${220 * labelScale}px`,
					'text-background-padding': `${3 * labelScale}px`,
					'text-background-opacity': 1,
					'z-index': 30
				}
			},
			{ selector: 'node.hover', style: { 'z-index': 40 } },
			{ selector: '.dimmed', style: { opacity: 0.25 } },
			{ selector: '.faded', style: { opacity: 0.1 } },
			{ selector: '.filtered', style: { display: 'none' } }
		];
	}

	// Zoom is quantized so the stylesheet is rebuilt only when the label size meaningfully changes.
	let labelScale = 1;
	let largeStyle = false;
	let lrStyle = false;
	function scaleForZoom(zoom: number) {
		if (zoom >= 1) return 1;
		const step = Math.round(Math.log(1 / zoom) / Math.log(1.25));
		return Math.min(Math.pow(1.25, step), 8);
	}

	function restyle(instance: Core, force = false) {
		const next = scaleForZoom(instance.zoom());
		const lr = rankDir === 'LR';
		if (!force && next === labelScale && largeStyle === large && lrStyle === lr) return;
		labelScale = next;
		largeStyle = large;
		lrStyle = lr;
		instance.style(buildStyle(labelScale, largeStyle, lrStyle));
	}

	onMount(() => {
		const instance = cytoscape({
			container,
			minZoom: 0.03,
			maxZoom: 3,
			elements: [],
			style: buildStyle(1, false, false)
		});

		// Click a node to select it; click the background to clear. Root maps back to "".
		instance.on('tap', 'node', (evt) => app.select(fromCyId(evt.target.id())));
		instance.on('tap', (evt) => {
			if (evt.target === instance) app.select(null); // background only; node taps bubble up too
		});

		instance.on('mouseover', 'node', (evt) => {
			evt.target.addClass('hover');
			evt.target.connectedEdges().addClass('hover-edge');
			container.style.cursor = 'pointer';
		});
		instance.on('mouseout', 'node', (evt) => {
			evt.target.removeClass('hover');
			evt.target.connectedEdges().removeClass('hover-edge');
			container.style.cursor = '';
		});

		let frame = 0;
		instance.on('zoom', () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => restyle(instance));
		});

		// Sidebars collapse and expand without a window resize, so watch the container itself.
		const observer = new ResizeObserver(() => instance.resize());
		observer.observe(container);

		cy = instance;

		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
			instance.destroy();
			cy = null;
		};
	});

	// Same nodes and the same number of edges means the same layout.
	let lastKey = '';
	let lastViewKey = '';
	function structureKey(graph: DependencyGraph): string {
		return `${graph.nodes.map((n) => n.id).join('\n')}|${graph.edges.length}`;
	}

	function visibleGraph(graph: DependencyGraph, visible: Set<string>, hideDev: boolean): DependencyGraph {
		return {
			...graph,
			nodes: graph.nodes.filter((n) => visible.has(n.id)),
			edges: graph.edges.filter(
				(e) => visible.has(e.source) && visible.has(e.target) && !(hideDev && e.kind === 'development')
			)
		};
	}

	function runLayout(instance: Core, graph: DependencyGraph, direction: LayoutDirection) {
		rankDir =
			direction === 'auto' ? chooseRankDir(graph, { width: instance.width(), height: instance.height() }) : direction;
		const lr = rankDir === 'LR';
		instance.style(buildStyle(1, large, lr)); // label placement feeds node dimensions in the layout
		instance
			.elements()
			.not('.filtered')
			.layout({
				name: 'dagre',
				rankDir,
				nodeSep: lr ? 4 : 24,
				rankSep: lr ? 48 : 56,
				edgeSep: 6,
				nodeDimensionsIncludeLabels: true,
				animate: false,
				fit: true,
				padding: 40
			} as cytoscape.LayoutOptions)
			.run();
		restyle(instance, true);
	}

	// Rebuild on a new graph, update data in place on advisory changes, relayout when filters or direction change.
	$effect(() => {
		const instance = cy;
		const graph = app.graph;
		const visible = app.visibleIds;
		const { hideDev, directOnly } = app.filters;
		const direction = app.layoutDirection;
		if (!instance || !graph) return;

		const key = structureKey(graph);
		const viewKey = `${hideDev}|${directOnly}|${direction}`;
		let needsLayout = viewKey !== lastViewKey;
		lastViewKey = viewKey;

		if (key === lastKey) {
			// For example known advisories were attached after the import. No relayout, so the viewport,
			// selection and simulation colors all stay as they are.
			instance.batch(() => {
				for (const node of graph.nodes) {
					instance
						.getElementById(toCyId(node.id))
						.data('label', nodeLabel(node))
						.toggleClass('advisory', node.advisoryIds.length > 0);
				}
			});
		} else {
			lastKey = key;
			needsLayout = true;
			noticeDismissed = false;
			instance.batch(() => {
				instance.elements().remove();
				instance.add(toElements(graph));
			});
		}

		instance.batch(() => {
			instance.nodes().forEach((n) => {
				n.toggleClass('filtered', !visible.has(fromCyId(n.id())));
			});
			instance.edges('[kind = "development"]').toggleClass('filtered', hideDev);
		});

		if (needsLayout) untrack(() => runLayout(instance, visibleGraph(graph, visible, hideDev), direction));
	});

	// Selection outline follows app.selectedId (clicks and search results both go through state). Without a
	// simulation, the selected package's direct dependencies and dependents stay bright and the rest dims.
	$effect(() => {
		const instance = cy;
		const id = app.selectedId;
		const simulating = app.impact !== null;
		void app.graph;
		if (!instance) return;

		instance.batch(() => {
			instance.nodes('.picked').removeClass('picked');
			instance.elements('.dimmed').removeClass('dimmed');
			if (id === null) return;
			const target = instance.getElementById(toCyId(id));
			target.addClass('picked');
			if (!simulating && target.nonempty()) instance.elements().not(target.closedNeighborhood()).addClass('dimmed');
		});
	});

	function collect(instance: Core, ids: string[]) {
		return ids.reduce((eles, id) => eles.union(instance.getElementById(toCyId(id))), instance.collection());
	}

	/** Centers on the elements, zoomed to fit them but never past a comfortable reading size. */
	function frame(eles: cytoscape.CollectionArgument, minZoom = 0) {
		if (!cy) return;
		const visible = cy.collection(eles).not('.filtered');
		if (visible.empty()) return;
		const box = visible.boundingBox();
		const pad = 60;
		const fitZoom = Math.min((cy.width() - pad * 2) / box.w, (cy.height() - pad * 2) / box.h);
		const zoom = Math.min(Math.max(fitZoom, cy.minZoom()), Math.max(MAX_FRAME_ZOOM, minZoom, cy.zoom()));
		cy.stop();
		cy.animate({ zoom, center: { eles: visible } }, { duration: reducedMotion() ? 0 : 400 });
	}

	// #65: search results bring the node into view. app.focus() bumps focusToken; plain canvas clicks
	// only call select(), so clicking a node never moves the viewport.
	$effect(() => {
		const instance = cy;
		const token = app.focusToken;
		if (!instance || token === 0) return;

		const id = untrack(() => app.selectedId);
		if (id === null) return;
		const target = instance.getElementById(toCyId(id));
		if (target.nonempty()) frame(target, 1.2);
	});

	// Simulation styling and animation. Svelte runs the returned cleanup before every re-run, so changing
	// or clearing app.impact always cancels pending timers and strips old classes first.
	$effect(() => {
		const instance = cy;
		const impact = app.impact;
		void app.graph;
		if (!instance) return;

		instance.batch(() => {
			instance.elements().removeClass('origin affected path cascade faded');
			if (!impact) return;
			const origin = instance.getElementById(toCyId(impact.originId));
			origin.addClass('origin');
			const reached = collect(instance, [impact.originId, ...impact.ancestorIds]);
			instance.elements().not(reached).not(reached.edgesWith(reached)).addClass('faded');
		});
		if (!impact) return;

		// Frame the whole cascade so long chains are in view while it plays.
		untrack(() => frame(collect(instance, [impact.originId, ...impact.ancestorIds]), 1));

		const step = Math.min(MAX_STEP_MS, MAX_TOTAL_MS / Math.max(impact.layers.length - 1, 1));
		const timers: ReturnType<typeof setTimeout>[] = [];
		const revealed = new Set<string>([toCyId(impact.originId)]);

		impact.layers.forEach((layer, i) => {
			if (i === 0) return; // layer 0 is the origin, already styled
			timers.push(
				setTimeout(() => {
					instance.batch(() => {
						for (const id of layer) {
							const node = instance.getElementById(toCyId(id));
							node.addClass('affected');
							node
								.outgoers('edge')
								.filter((e) => revealed.has(e.data('target')))
								.addClass('cascade');
						}
						for (const id of layer) revealed.add(toCyId(id));
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

	function zoomBy(factor: number) {
		if (!cy) return;
		cy.zoom({
			level: cy.zoom() * factor,
			renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } // zoom around the view's center
		});
	}

	function fitView() {
		if (!cy) return;
		cy.stop();
		cy.animate({ fit: { eles: cy.elements().not('.filtered'), padding: 40 } }, { duration: reducedMotion() ? 0 : 300 });
	}

	function frameImpact() {
		if (!cy || !app.impact) return;
		frame(collect(cy, [app.impact.originId, ...app.impact.ancestorIds]), 1);
	}

	const directions: { value: LayoutDirection; label: string; icon: string }[] = [
		{ value: 'auto', label: 'Auto', icon: 'mdi:auto-fix' },
		{ value: 'TB', label: 'Top down', icon: 'mdi:arrow-down' },
		{ value: 'LR', label: 'Left to right', icon: 'mdi:arrow-right' }
	];

	const ctrl =
		'flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-layer-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<div class="graph-well relative h-full w-full">
	<div class="graph" bind:this={container}></div>

	{#if app.hasGraph}
		<div class="absolute top-3 left-3 z-10 flex items-center gap-2">
			<div
				role="radiogroup"
				aria-label="Layout direction"
				class="flex items-center gap-0.5 rounded-lg bg-chassis/85 p-0.5 ring-1 ring-seam backdrop-blur"
			>
				{#each directions as d (d.value)}
					<button
						type="button"
						role="radio"
						aria-checked={app.layoutDirection === d.value}
						title={d.value === 'auto' ? `Auto (${rankDir === 'TB' ? 'top down' : 'left to right'})` : d.label}
						onclick={() => (app.layoutDirection = d.value)}
						class="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors {app.layoutDirection ===
						d.value
							? 'bg-layer-3 text-ink'
							: 'text-ink-muted hover:bg-layer-2 hover:text-ink'}"
					>
						<Icon icon={d.icon} width="15" height="15" />
						<span class={d.value === 'auto' ? '' : 'sr-only'}>{d.label}</span>
					</button>
				{/each}
			</div>

			{#if large && !noticeDismissed}
				<div
					role="status"
					class="flex items-center gap-2 rounded-lg bg-chassis/85 py-1.5 pr-1.5 pl-3 text-xs text-ink-muted ring-1 ring-seam backdrop-blur"
				>
					<Icon icon="mdi:graph-outline" width="15" height="15" class="shrink-0 text-cascade" />
					<span>
						Large graph: {nodeCount.toLocaleString()} installed instances. Zoom in or search to read labels.
					</span>
					<button
						type="button"
						aria-label="Dismiss large graph notice"
						onclick={() => (noticeDismissed = true)}
						class="rounded p-0.5 hover:bg-layer-3 hover:text-ink"
					>
						<Icon icon="mdi:close" width="14" height="14" />
					</button>
				</div>
			{/if}
		</div>
	{/if}

	{#if app.hasGraph}
		<div
			class="absolute right-3 bottom-3 z-10 flex flex-col gap-0.5 rounded-lg bg-chassis/85 p-0.5 ring-1 ring-seam backdrop-blur"
		>
			<button type="button" class={ctrl} aria-label="Zoom in" title="Zoom in" onclick={() => zoomBy(1.25)}>
				<Icon icon="mdi:plus" width="18" height="18" />
			</button>
			<button type="button" class={ctrl} aria-label="Zoom out" title="Zoom out" onclick={() => zoomBy(0.8)}>
				<Icon icon="mdi:minus" width="18" height="18" />
			</button>
			<button type="button" class={ctrl} aria-label="Fit graph to view" title="Fit graph to view" onclick={fitView}>
				<Icon icon="mdi:fit-to-screen-outline" width="18" height="18" />
			</button>
			{#if app.impact}
				<button
					type="button"
					class="{ctrl} text-origin"
					aria-label="Frame the simulated impact"
					title="Frame the simulated impact"
					onclick={frameImpact}
				>
					<Icon icon="mdi:target" width="18" height="18" />
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Pip grid: a quiet nod to the domino tiles, and a sense of scale while panning. */
	.graph-well {
		background-color: var(--color-well);
		background-image: radial-gradient(circle, var(--color-seam) 1px, transparent 1.4px);
		background-size: 22px 22px;
	}

	.graph {
		width: 100%;
		height: 100%;
		min-height: 400px; /* a Cytoscape container with no height renders blank */
	}
</style>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Core, ElementDefinition, StylesheetJson } from 'cytoscape';
	import type cytoscape from 'cytoscape';
	import Icon from '#lib/icons.js';
	import { app } from '#lib/state.svelte.ts';
	import type { DependencyGraph, ImpactResult } from '#lib/types.ts';
	import { fromCyId, namesWithMultipleVersions, nodeLabel, toCyId, toElements } from '#lib/graph/normalize.js';
	import { chooseRankDir, LARGE_GRAPH_NODES } from '#lib/graph/view.js';
	import type { LayoutDirection, RankDir } from '#lib/graph/view.js';
	import { subgraph } from '#lib/graph/reveal.js';
	import { LayoutCache } from '#lib/graph/layoutCache.js';
	import type { Position } from '#lib/graph/layoutCache.js';
	import { COLORS, EDGE_DASH } from '#lib/graph/theme.ts';
	import NodeActions from './NodeActions.svelte';
	import GraphMinimap from './GraphMinimap.svelte';
	import GraphPngExport from './GraphPngExport.svelte';

	// Cytoscape and dagre are the largest part of the bundle, so they load after first paint.
	let library: Promise<typeof cytoscape> | undefined;
	function loadCytoscape() {
		library ??= Promise.all([import('cytoscape'), import('cytoscape-dagre')]).then(
			([{ default: cytoscape }, { default: dagre }]) => {
				cytoscape.use(dagre);
				return cytoscape;
			}
		);
		return library;
	}

	let container: HTMLDivElement;
	let nodeActions: ReturnType<typeof NodeActions>;
	function openActions(id: string, position?: { x: number; y: number }) {
		if (!cy) return;
		const point = position ?? cy.getElementById(toCyId(id)).renderedPosition();
		const box = container.getBoundingClientRect();
		void nodeActions.show(id, box.left + point.x, box.top + point.y);
	}
	function actionShortcut(event: KeyboardEvent) {
		if (event.key !== 'F10' || !event.shiftKey || app.selectedId === null || event.defaultPrevented) return;
		if (document.querySelector('dialog[open], [popover]:popover-open')) return;
		if (
			event.target instanceof Element &&
			event.target.closest('input, textarea, [contenteditable="true"], [role="combobox"]')
		)
			return;
		event.preventDefault();
		openActions(app.selectedId);
	}
	let cy = $state.raw<Core | null>(null);
	function guardCanvas(action: () => void) {
		try {
			action();
		} catch {
			app.runtimeError = 'The graph could not finish this operation. Your lockfile is still loaded.';
		}
	}
	function canvasTimeout(action: () => void, delay: number) {
		return setTimeout(() => guardCanvas(action), delay);
	}
	let hoveredId = $state<string | null>(null);
	let rankDir = $state<RankDir>('TB');

	const MAX_STEP_MS = 350; // delay between layers
	const MAX_TOTAL_MS = 3000; // cap so deep graphs don't take forever
	const MAX_FRAME_ZOOM = 1.2;
	const FONT = 'Geist Variable, ui-sans-serif, system-ui, sans-serif';

	const nodeCount = $derived(app.graph?.nodes.length ?? 0);
	const large = $derived(nodeCount > LARGE_GRAPH_NODES);
	let minimapOverride = $state<boolean | null>(null);
	const minimapVisible = $derived(minimapOverride ?? large);
	const shownCount = $derived(app.revealedIds?.size ?? nodeCount);

	function reducedMotion() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/**
	 * Labels of emphasized nodes (root, origin, path, selection, hover) grow as the view zooms out, so a
	 * long chain stays readable even when the whole graph is in view. Everything else hides its label
	 * once it would render too small to read. Zoom dependent values are functions of labelScale and
	 * showArrows, so a zoom step restyles only the elements that use them instead of the whole graph.
	 */
	function buildStyle(largeGraph: boolean, lr: boolean): StylesheetJson {
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
				selector: 'node.install-script',
				style: {
					shape: 'diamond',
					'border-width': 2.5,
					'border-color': COLORS.installScriptBorder,
					'background-color': COLORS.installScript
				}
			},
			{
				selector: 'node.workspace',
				style: { shape: 'hexagon', width: 28, height: 26, 'border-style': 'solid', 'border-color': COLORS.root }
			},
			{
				selector: 'edge',
				style: {
					width: 1.25,
					'line-color': COLORS.edge,
					'curve-style': largeGraph ? 'straight' : 'bezier',
					'target-arrow-shape': () => (showArrows ? 'triangle' : 'none'),
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
				selector: 'edge[kind = "peer"]',
				style: {
					'line-style': 'dashed',
					'line-dash-pattern': [...EDGE_DASH.peer],
					'line-color': COLORS.peerEdge,
					'target-arrow-color': COLORS.peerEdge
				}
			},
			{
				selector: 'edge[kind = "optional"]',
				style: {
					'line-style': 'dashed',
					'line-dash-pattern': [...EDGE_DASH.optional],
					'line-color': COLORS.optionalEdge,
					'target-arrow-color': COLORS.optionalEdge
				}
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
					'target-arrow-shape': 'triangle',
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
				selector: EMPHASIZED,
				style: {
					'min-zoomed-font-size': 0,
					'font-size': () => 11 * labelScale,
					'text-margin-x': () => (lr ? 6 * labelScale : 0),
					'text-margin-y': () => (lr ? 0 : 5 * labelScale),
					'text-max-width': () => `${220 * labelScale}px`,
					'text-background-padding': () => `${3 * labelScale}px`,
					'text-background-opacity': 1,
					'z-index': 30
				}
			},
			{ selector: 'node.hover', style: { 'z-index': 40 } },
			{ selector: '.dimmed', style: { opacity: 0.25 } },
			{ selector: '.faded', style: { opacity: 0.1 } },
			{
				selector: 'node.same-name',
				style: {
					'outline-color': COLORS.root,
					'outline-width': 3,
					'outline-offset': 3,
					'outline-style': 'dashed',
					opacity: 1
				}
			},
			{
				selector: 'node.every-path',
				style: {
					'outline-color': COLORS.root,
					'outline-width': 4,
					'outline-offset': 5,
					'outline-style': 'solid',
					opacity: 1
				}
			},
			{ selector: 'node.removed-preview', style: { opacity: 0.2, 'border-style': 'dashed', 'border-width': 3 } },
			{
				selector: 'node.newly-unreachable',
				style: {
					'border-color': COLORS.root,
					'border-style': 'dashed',
					'border-width': 4,
					'background-color': COLORS.unsupportedFill,
					opacity: 1
				}
			},
			{ selector: '.filtered', style: { display: 'none' } }
		];
	}

	const EMPHASIZED = 'node.root, node.origin, node.path, node.picked, node.hover';
	// Below this zoom, arrowheads on a large graph are a few pixels wide but still cost about a third of
	// every redraw.
	const ARROW_MIN_ZOOM = 0.5;

	// Zoom is quantized so emphasized labels restyle only when their size meaningfully changes.
	let labelScale = 1;
	let showArrows = true;
	let largeStyle = false;
	let lrStyle = false;
	function scaleForZoom(zoom: number) {
		if (zoom >= 1) return 1;
		const step = Math.round(Math.log(1 / zoom) / Math.log(1.25));
		return Math.min(Math.pow(1.25, step), 8);
	}

	// Collections have updateStyle at runtime, but the type definitions leave it out.
	function restyleOnly(eles: cytoscape.CollectionReturnValue | cytoscape.NodeCollection | cytoscape.EdgeCollection) {
		(eles as unknown as { updateStyle(): void }).updateStyle();
	}

	function restyle(instance: Core, force = false) {
		const zoom = instance.zoom();
		const scale = scaleForZoom(zoom);
		const arrows = !large || zoom >= ARROW_MIN_ZOOM;
		const lr = rankDir === 'LR';
		if (force || largeStyle !== large || lrStyle !== lr) {
			[labelScale, showArrows, largeStyle, lrStyle] = [scale, arrows, large, lr];
			instance.style(buildStyle(largeStyle, lrStyle));
			return;
		}
		if (scale !== labelScale) {
			labelScale = scale;
			restyleOnly(instance.nodes(EMPHASIZED));
		}
		if (arrows !== showArrows) {
			showArrows = arrows;
			restyleOnly(instance.edges());
		}
	}

	onMount(() => {
		let disposed = false;
		let observer: ResizeObserver | undefined;
		let instance: Core | undefined;
		let frame = 0;

		void loadCytoscape()
			.then((cytoscape) => {
				if (disposed) return;
				instance = mount(cytoscape);
				observer = new ResizeObserver(() => guardCanvas(() => instance?.resize()));
				observer.observe(container);
				cy = instance;
			})
			.catch(() => {
				if (!disposed) app.runtimeError = 'The graph could not start. Try again to reload the canvas.';
			});

		return () => {
			disposed = true;
			observer?.disconnect();
			cancelAnimationFrame(frame);
			instance?.destroy();
			cy = null;
		};

		function mount(cytoscape: Awaited<ReturnType<typeof loadCytoscape>>): Core {
			const instance = cytoscape({
				container,
				minZoom: 0.03,
				maxZoom: 3,
				elements: [],
				style: buildStyle(false, false)
			});

			// Click a node to select it; click the background to clear. Root maps back to "".
			instance.on('tap', 'node', (evt) => app.select(fromCyId(evt.target.id())));
			instance.on('cxttap', 'node', (evt) => openActions(fromCyId(evt.target.id()), evt.renderedPosition));
			instance.on('tap', (evt) => {
				if (evt.target === instance) app.select(null); // background only; node taps bubble up too
			});

			instance.on('mouseover', 'node', (evt) => {
				hoveredId = fromCyId(evt.target.id());
				evt.target.addClass('hover');
				evt.target.connectedEdges().addClass('hover-edge');
				container.style.cursor = 'pointer';
			});
			instance.on('mouseout', 'node', (evt) => {
				if (hoveredId === fromCyId(evt.target.id())) hoveredId = null;
				evt.target.removeClass('hover');
				evt.target.connectedEdges().removeClass('hover-edge');
				container.style.cursor = '';
			});
			instance.on('remove', 'node', (evt) =>
				untrack(() => {
					if (hoveredId === fromCyId(evt.target.id())) {
						hoveredId = null;
						container.style.cursor = '';
					}
				})
			);

			instance.on('zoom', () => {
				cancelAnimationFrame(frame);
				frame = requestAnimationFrame(() => guardCanvas(() => restyle(instance)));
			});

			// Labels measured before the web font loads come out too narrow and get cut off.
			void document.fonts.ready.then(() => {
				if (!instance.destroyed()) guardCanvas(() => restyle(instance, true));
			});

			return instance;
		}
	});

	// Same nodes and the same number of edges means the same graph.
	let lastKey = '';
	let lastViewKey = '';
	let lastLayoutKey = '';
	let wasExploring = false;
	let overview: {
		positions: Map<string, Position>;
		zoom: number;
		pan: Position;
		layoutKey: string;
		viewKey: string;
	} | null = null;
	function structureKey(graph: DependencyGraph): string {
		return `${graph.nodes.map((n) => n.id).join('\n')}|${graph.edges.length}`;
	}

	// Overview filters only toggle visibility. Focused views key their smaller layouts by visible ids.
	const layoutCache = new LayoutCache();

	/** Nodes left on the canvas by the filters and reveal depth, plus the edges between them. */
	function shown(instance: Core) {
		const nodes = instance.nodes().not('.filtered');
		return nodes.union(nodes.edgesWith(nodes).not('.filtered'));
	}

	function runLayout(instance: Core, graph: DependencyGraph, direction: LayoutDirection, revealKey: string) {
		rankDir =
			direction === 'auto' ? chooseRankDir(graph, { width: instance.width(), height: instance.height() }) : direction;
		const lr = rankDir === 'LR';

		// Everything on the canvas gets a position, including nodes the filters currently hide.
		const eles = app.exploring ? shown(instance) : instance.elements();
		const nodes = eles.nodes();
		if (nodes.empty()) return;
		const key = `${rankDir}|${revealKey}`;
		lastLayoutKey = key;
		const cached = layoutCache.get(
			key,
			nodes.map((n) => n.id())
		);
		if (!cached) {
			// Label placement feeds node dimensions in the layout.
			[labelScale, showArrows, largeStyle, lrStyle] = [1, true, large, lr];
			instance.style(buildStyle(largeStyle, lrStyle));
		}

		// Hidden elements have no measurable label, so lay out with the filters off and restore them after.
		const filtered = eles.filter('.filtered');
		instance.batch(() => filtered.removeClass('filtered'));
		if (cached) {
			nodes.positions((n) => cached.get(n.id())!);
		} else {
			eles
				.layout({
					name: 'dagre',
					rankDir,
					// Network simplex ranking grows far worse than linear on dense graphs (over 30 s at 1,200 nodes);
					// tight tree stays around a second.
					ranker: nodes.length > LARGE_GRAPH_NODES ? 'tight-tree' : 'network-simplex',
					nodeSep: lr ? 4 : 24,
					rankSep: lr ? 48 : 56,
					edgeSep: 6,
					nodeDimensionsIncludeLabels: true,
					animate: false,
					fit: false,
					padding: 40
				} as cytoscape.LayoutOptions)
				.run();
			const positions = new Map<string, Position>();
			nodes.forEach((n) => {
				positions.set(n.id(), { ...n.position() });
			});
			layoutCache.set(key, positions);
		}
		instance.batch(() => filtered.addClass('filtered'));

		const onCanvas = shown(instance).nodes();
		if (onCanvas.nonempty()) instance.fit(onCanvas, app.exploring ? 64 : 40);
		restyle(instance);
	}

	// Rebuild on a new graph, update data in place on advisory changes, and relayout only when the graph,
	// the direction or the mounted set changes. Overview filters only show and hide.
	$effect(() => {
		const instance = cy;
		const graph = app.graph;
		const visible = app.visibleIds;
		const revealed = app.canvasIds;
		const revealKey = app.canvasKey;
		const exploring = app.exploring;
		const { hideDev } = app.filters;
		const direction = app.layoutDirection;
		const labelMode = app.labelMode;
		if (!instance || !graph) return;

		const key = structureKey(graph);
		const labelKey = `${labelMode}|${revealKey}`;
		const viewKey = `${direction}|${labelKey}`;
		if (viewKey !== lastViewKey || key !== lastKey) instance.stop();
		if (key === lastKey && exploring && !wasExploring) {
			const positions = new Map<string, Position>();
			instance.nodes().forEach((node) => {
				positions.set(node.id(), { ...node.position() });
			});
			overview = {
				positions,
				zoom: instance.zoom(),
				pan: { ...instance.pan() },
				layoutKey: lastLayoutKey,
				viewKey: lastViewKey
			};
		}
		const restore = !exploring && wasExploring && key === lastKey && overview?.viewKey === viewKey ? overview : null;
		if (restore) layoutCache.set(restore.layoutKey, restore.positions);
		wasExploring = exploring;
		let needsLayout = viewKey !== lastViewKey;
		lastViewKey = viewKey;

		if (key === lastKey) {
			const ambiguousNames = namesWithMultipleVersions(graph);
			// For example known advisories were attached after the import. No relayout, so the viewport,
			// selection and simulation colors all stay as they are.
			instance.batch(() => {
				for (const node of graph.nodes) {
					instance
						.getElementById(toCyId(node.id))
						.data('label', nodeLabel(node, labelMode, ambiguousNames))
						.toggleClass('advisory', node.advisoryIds.length > 0);
				}
			});
		} else {
			overview = null;
			lastKey = key;
			needsLayout = true;
			layoutCache.clear();
			instance.elements().remove();
		}

		// Unrevealed packages stay off the canvas entirely: every style pass costs time per element, hidden or not.
		const wanted = (id: string) => revealed === null || revealed.has(id);
		const filteredClass = (el: ElementDefinition) =>
			el.group === 'nodes' ? !visible.has(fromCyId(el.data.id!)) : hideDev && el.data.kind === 'development';
		const added = toElements(graph, labelMode)
			.filter((el) =>
				el.group === 'nodes'
					? wanted(fromCyId(el.data.id!))
					: wanted(fromCyId(el.data.source)) && wanted(fromCyId(el.data.target))
			)
			.filter((el) => instance.getElementById(el.data.id!).empty())
			.map((el) => (filteredClass(el) ? { ...el, classes: [...(el.classes as string[]), 'filtered'] } : el));

		instance.batch(() => {
			instance
				.nodes()
				.filter((n) => !wanted(fromCyId(n.id())))
				.remove();
			instance.nodes().forEach((n) => {
				n.toggleClass('filtered', !visible.has(fromCyId(n.id())));
			});
			instance.edges('[kind = "development"]').toggleClass('filtered', hideDev);
			instance.add(added);
		});

		if (needsLayout) {
			untrack(() => runLayout(instance, revealed ? subgraph(graph, revealed) : graph, direction, labelKey));
			if (restore) instance.viewport({ zoom: restore.zoom, pan: restore.pan });
		}
	});

	// Selection outline follows app.selectedId (clicks and search results both go through state). Without a
	// simulation, the selected package's direct dependencies and dependents stay bright and the rest dims.
	$effect(() => {
		const instance = cy;
		const id = app.selectedId;
		const simulating = app.impact !== null;
		const hidden = id !== null && !app.visibleIds.has(id);
		const exploring = app.exploring;
		if (!instance) return;

		instance.batch(() => {
			instance.nodes('.picked').removeClass('picked');
			const target = id === null ? instance.collection() : instance.getElementById(toCyId(id));
			target.addClass('picked');
			const dim =
				!simulating && !exploring && !hidden && target.nonempty()
					? instance.elements().not(target.closedNeighborhood())
					: instance.collection();
			// Touch only elements whose state changes; restyling every element on each click is slow on large graphs.
			instance.elements('.dimmed').not(dim).removeClass('dimmed');
			dim.not('.dimmed').addClass('dimmed');
		});
	});

	// Other copies retain their advisory and simulation styling; the name match adds only an outline.
	$effect(() => {
		const instance = cy;
		const index = app.graphIndex;
		const selected = app.selectedId;
		const hovered = hoveredId;
		void app.canvasKey;
		if (!instance) return;
		const id = hovered !== null && instance.getElementById(toCyId(hovered)).nonempty() ? hovered : selected;
		const node = id !== null ? index?.nodes.get(id) : null;
		const copies = node && node.id !== '' ? (index?.byName.get(node.name) ?? []) : [];
		let matches = instance.collection();
		for (const copy of copies) {
			if (copy.id !== id) matches = matches.union(instance.getElementById(toCyId(copy.id)));
		}
		instance.batch(() => {
			instance.nodes('.same-name').not(matches).removeClass('same-name');
			matches.not('.same-name').addClass('same-name');
		});
	});

	function collect(instance: Core, ids: string[]) {
		return ids.reduce((eles, id) => eles.union(instance.getElementById(toCyId(id))), instance.collection());
	}

	/** Centers on the elements, zoomed to fit them but never past a comfortable reading size. */
	function frame(eles: cytoscape.CollectionArgument, minZoom = 0) {
		if (!cy) return;
		const visible = cy.collection(eles).intersection(shown(cy).nodes());
		if (visible.empty()) return;
		const box = visible.boundingBox();
		const pad = 80;
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

	let playbackLayer = $state(0);
	let playbackPlaying = $state(false);
	const lastLayer = $derived(Math.max(0, (app.impact?.layers.length ?? 1) - 1));
	$effect(() => {
		const impact = app.impact;
		playbackLayer = impact && reducedMotion() ? impact.layers.length - 1 : 0;
		playbackPlaying = !!impact && !reducedMotion() && impact.layers.length > 1;
	});
	$effect(() => {
		if (!app.impact || !playbackPlaying) return;
		if (playbackLayer >= lastLayer) {
			playbackPlaying = false;
			return;
		}
		// Bound automatic updates on deep chains; manual stepping always moves exactly one layer.
		const advance = Math.max(1, Math.ceil(lastLayer / 75));
		const delay = Math.max(40, Math.min(MAX_STEP_MS, (MAX_TOTAL_MS * advance) / Math.max(1, lastLayer)));
		const timer = canvasTimeout(() => {
			playbackLayer = Math.min(lastLayer, playbackLayer + advance);
		}, delay);
		return () => clearTimeout(timer);
	});
	function stepPlayback(delta: number) {
		playbackPlaying = false;
		playbackLayer = Math.max(0, Math.min(lastLayer, playbackLayer + delta));
	}
	function replay() {
		playbackLayer = 0;
		playbackPlaying = lastLayer > 0;
	}

	let animatedImpact: ImpactResult | null = null;
	$effect(() => {
		const instance = cy;
		const impact = app.impact;
		const path = app.activeSamplePath;
		const layer = playbackLayer;
		void app.graph;
		void app.canvasKey;
		if (!instance) return;
		const newImpact = impact !== animatedImpact;
		animatedImpact = impact;
		function sync(name: string, wanted: cytoscape.CollectionReturnValue) {
			const old = instance!.elements(`.${name}`);
			old.not(wanted).removeClass(name);
			wanted.not(old).addClass(name);
		}
		instance.batch(() => {
			if (!impact) {
				instance.elements().removeClass('origin affected path cascade faded');
				return;
			}
			const origins = impact.originIds ?? [impact.originId];
			const origin = collect(instance, origins);
			const reached = collect(instance, [...origins, ...impact.ancestorIds]);
			sync('origin', origin);
			sync('faded', instance.elements().not(reached).not(reached.edgesWith(reached)));
			const visibleIds = new Set([...origins, ...impact.layers.slice(1, layer + 1).flat()]);
			const affected = collect(
				instance,
				[...visibleIds].filter((id) => !origins.includes(id))
			);
			sync('affected', affected);
			sync(
				'cascade',
				affected.outgoers('edge').filter((edge) => visibleIds.has(fromCyId(edge.data('target'))))
			);
			let pathElements = instance.collection();
			if (layer >= impact.layers.length - 1) {
				pathElements = collect(instance, path);
				for (let i = 0; i < path.length - 1; i++) {
					pathElements = pathElements.union(
						instance.getElementById(toCyId(path[i])).edgesTo(instance.getElementById(toCyId(path[i + 1])))
					);
				}
			}
			sync('path', pathElements);
		});
		if (newImpact && impact) untrack(() => frame(collect(instance, [...impact.originIds, ...impact.ancestorIds]), 1));
	});
	$effect(() => {
		const instance = cy;
		const ids = app.everyPathIds;
		const removal = app.removal;
		void app.canvasKey;
		if (!instance) return;
		instance.batch(() => {
			instance.nodes().removeClass('every-path removed-preview newly-unreachable');
			collect(instance, ids).addClass('every-path');
			if (removal) {
				collect(instance, [removal.removedId]).addClass('removed-preview');
				collect(instance, removal.unreachableIds).addClass('newly-unreachable');
			}
		});
	});

	function zoomBy(factor: number) {
		if (!cy) return;
		cy.zoom({
			level: cy.zoom() * factor,
			renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } // zoom around the view's center
		});
	}

	export function fitView() {
		if (!cy) return;
		cy.stop();
		cy.animate({ fit: { eles: shown(cy).nodes(), padding: 40 } }, { duration: reducedMotion() ? 0 : 300 });
	}

	export function frameImpact() {
		if (!cy || !app.impact) return;
		frame(collect(cy, [...(app.impact.originIds ?? [app.impact.originId]), ...app.impact.ancestorIds]), 1);
	}

	const directions: { value: LayoutDirection; label: string; icon: string }[] = [
		{ value: 'auto', label: 'Auto', icon: 'mdi:auto-fix' },
		{ value: 'TB', label: 'Top down', icon: 'mdi:arrow-down' },
		{ value: 'LR', label: 'Left to right', icon: 'mdi:arrow-right' }
	];

	const ctrl =
		'flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-layer-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<svelte:window onkeydown={actionShortcut} />
<NodeActions bind:this={nodeActions} />
<div class="graph-well relative h-full w-full">
	<div
		class="graph"
		bind:this={container}
		oncontextmenu={(event) => event.preventDefault()}
		role="img"
		aria-label="Dependency graph. Select a package, then use Shift F10 for quick actions."
	></div>
	{#if app.hasGraph}
		<div class="absolute top-3 right-3 left-3 z-10 flex flex-wrap items-start gap-2">
			{#if cy}<GraphPngExport {cy} />{/if}
			{#if app.selectedId !== null}<button
					type="button"
					class="rounded-lg bg-chassis/95 px-3 py-2 text-xs text-ink ring-1 ring-seam"
					onclick={() => openActions(app.selectedId!)}>Package actions</button
				>{/if}
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

			{#if app.exploring}
				<div
					class="flex max-w-sm items-center gap-2 rounded-lg bg-chassis/95 px-3 py-2 text-xs text-ink-muted ring-1 ring-seam"
				>
					<span role="status" aria-label="Canvas view status">
						{app.viewMode === 'impact'
							? 'Simulated impact only'
							: app.viewMode === 'dependents'
								? 'Selected dependents only'
								: `Neighborhood · ${app.neighborhoodHops} ${app.neighborhoodHops === 1 ? 'hop' : 'hops'}`}
						· {app.visibleIds.size.toLocaleString()} of {nodeCount.toLocaleString()} instances
					</span>
					<button
						type="button"
						onclick={() => (app.viewMode = 'all')}
						class="shrink-0 rounded-md bg-layer-3 px-2 py-1 font-medium text-ink hover:bg-layer-2"
					>
						Back to overview
					</button>
				</div>
			{:else if app.progressive}
				<div
					role="status"
					class="flex items-center gap-2 rounded-lg bg-chassis/85 py-1.5 pr-1.5 pl-3 text-xs text-ink-muted ring-1 ring-seam backdrop-blur"
				>
					<Icon icon="mdi:graph-outline" width="15" height="15" class="shrink-0 text-cascade" />
					<span>
						Large graph: showing {shownCount.toLocaleString()} of {nodeCount.toLocaleString()} installed instances. Search
						to reveal a package.
					</span>
					{#if app.canShowMore}
						<button
							type="button"
							onclick={() => app.showMore()}
							class="flex h-7 items-center gap-1 rounded-md bg-layer-3 px-2 font-medium text-ink transition-colors hover:bg-layer-2"
						>
							<Icon icon="mdi:plus" width="14" height="14" />
							Show more ({app.nextRevealCount.toLocaleString()})
						</button>
					{/if}
				</div>
			{/if}
			{#if app.impact}
				<div
					role="group"
					aria-label="Cascade playback"
					class="flex flex-wrap items-center gap-1 rounded-lg bg-chassis/95 p-1 text-xs text-ink ring-1 ring-seam"
				>
					<button type="button" class={ctrl} aria-label="Replay cascade" onclick={replay}
						><Icon icon="mdi:replay" width="18" height="18" /></button
					>
					<button
						type="button"
						class={ctrl}
						aria-label="Previous cascade layer"
						disabled={playbackLayer === 0}
						onclick={() => stepPlayback(-1)}><Icon icon="mdi:skip-previous" width="18" height="18" /></button
					>
					<button
						type="button"
						class={ctrl}
						aria-label={playbackPlaying ? 'Pause cascade' : 'Play cascade'}
						disabled={lastLayer === 0}
						onclick={() => {
							if (playbackLayer === lastLayer) playbackLayer = 0;
							playbackPlaying = !playbackPlaying;
						}}><Icon icon={playbackPlaying ? 'mdi:pause' : 'mdi:play'} width="18" height="18" /></button
					>
					<button
						type="button"
						class={ctrl}
						aria-label="Next cascade layer"
						disabled={playbackLayer === lastLayer}
						onclick={() => stepPlayback(1)}><Icon icon="mdi:skip-next" width="18" height="18" /></button
					>
					<span role="status" class="px-2 tabular-nums">Layer {playbackLayer + 1} of {lastLayer + 1}</span>
				</div>
			{/if}
			{#if !app.hintDismissed}
				<div class="basis-full">
					<div
						class="flex max-w-sm items-start gap-3 rounded-xl bg-chassis p-3 text-sm text-ink shadow-xl ring-1 ring-seam"
					>
						<Icon icon="mdi:cursor-default-click-outline" width="20" height="20" class="shrink-0 text-downstream" />
						<p>Select a package on the graph or in search, then choose <strong>Simulate compromise</strong>.</p>
						<button
							type="button"
							aria-label="Dismiss graph hint"
							onclick={() => (app.hintDismissed = true)}
							class="rounded p-1 text-ink-muted hover:bg-layer-2"
							><Icon icon="mdi:close" width="16" height="16" /></button
						>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if app.hasGraph}
		{#if cy && minimapVisible}<GraphMinimap {cy} />{/if}
		<div
			class="absolute right-3 bottom-3 z-10 flex flex-col gap-0.5 rounded-lg bg-chassis/85 p-0.5 ring-1 ring-seam backdrop-blur"
		>
			<button type="button" class={ctrl} aria-label="Zoom in" title="Zoom in" onclick={() => zoomBy(1.25)}>
				<Icon icon="mdi:plus" width="18" height="18" />
			</button>
			<button
				type="button"
				class={ctrl}
				aria-label="Toggle graph minimap"
				aria-pressed={minimapVisible}
				title="Graph minimap"
				onclick={() => (minimapOverride = !minimapVisible)}
				><Icon icon="mdi:map-outline" width="18" height="18" /></button
			>
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

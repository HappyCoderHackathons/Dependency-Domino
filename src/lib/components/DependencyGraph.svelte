<script lang="ts">
	import { onMount } from 'svelte';
	import cytoscape from 'cytoscape';
	import type { Core, ElementDefinition } from 'cytoscape';
    import { app } from '#lib/state.svelte.ts';
    import type { DependencyGraph } from '#lib/types.ts';

	// The plan keys the root project as "" but Cytoscape rejects empty-string IDs,
	// so the root gets a stand-in ID on the canvas.
	const ROOT_ID = '__root__';

	let container: HTMLDivElement;
	let cy = $state.raw<Core | null>(null);

	// TEMPORARY: replace with the converter from #33 once it merges.
	function toElements(graph: DependencyGraph | null): ElementDefinition[] {
		if (!graph) return [];
		const cyId = (id: string) => (id === '' ? ROOT_ID : id);
		const nodes: ElementDefinition[] = graph.nodes.map((n) => ({
			group: 'nodes',
			data: {
				id: cyId(n.id),
				label: n.version ? `${n.name}@${n.version}` : n.name,
				isRoot: n.id === '',
				direct: n.direct,
				devOnly: n.devOnly
			}
		}));
		const edges: ElementDefinition[] = graph.edges.map((e) => ({
			group: 'edges',
			data: { source: cyId(e.source), target: cyId(e.target), kind: e.kind }
		}));
		return [...nodes, ...edges];
	}

	// Create once on mount, destroy on teardown.
	onMount(() => {
		const instance = cytoscape({
			container,
			elements: [],
			style: [
				{
					selector: 'node',
					style: {
						label: 'data(label)',
						'font-size': 10,
						'background-color': '#8892a6'
					}
				},
				{
					selector: 'edge',
					style: { width: 1, 'line-color': '#b8bfcc' }
				}
			]
		});
		cy = instance;

		return () => {
			instance.destroy();
			cy = null;
		};
	});

	// Replace elements whenever the graph in shared state changes.
	$effect(() => {
		const instance = cy;
		if (!instance) return;
		const elements = toElements(app.graph);

		instance.batch(() => {
			instance.elements().remove();
			instance.add(elements);
		});

		if (elements.length > 0) {
			instance
				.layout({
					name: 'breadthfirst',
					directed: true,
					roots: instance.nodes('[?isRoot]'),
					fit: true,
					padding: 30
				})
				.run();
		}
	});
</script>

<div class="graph" bind:this={container}></div>

<style>
	.graph {
		width: 100%;
		height: 100%;
		min-height: 400px; /* a Cytoscape container with no height renders blank */
	}
</style>
<script lang="ts">
	import { onMount } from 'svelte';
	import cytoscape from 'cytoscape';
	import type { Core } from 'cytoscape';
  import { app } from '#lib/state.svelte.ts';
  import { toElements } from '#lib/graph/normalize.js';

	// The plan keys the root project as "" but Cytoscape rejects empty-string IDs,
	// so the root gets a stand-in ID on the canvas.
	const ROOT_ID = '__root__';

	let container: HTMLDivElement;
	let cy = $state.raw<Core | null>(null);

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
		const graph = app.graph;
		if (!graph) return;
		const elements = toElements(graph);

		instance.batch(() => {
			instance.elements().remove();
			instance.add(elements);
		});

		if (elements.length > 0) {
			instance
				.layout({
					name: 'breadthfirst',
					directed: true,
					roots: instance.nodes('.root').map((node) => node.id()),
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
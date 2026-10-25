<script lang="ts">
	import type { Core } from 'cytoscape';
	import { app } from '#lib/state.svelte.js';
	import Icon from '#lib/icons.js';
	import { createGraphPng } from '#lib/report/graph-image.js';
	import { downloadPng, pngFilename } from '#lib/report/png.js';
	let { cy }: { cy: Core } = $props();
	let details: HTMLDetailsElement;
	let busy = $state(false);
	let error = $state<string | null>(null);
	$effect(() => {
		void app.graph?.edges;
		error = null;
	});
	async function exportGraph(full: boolean) {
		if (busy || !app.graph) return;
		const graph = app.graph,
			impact = app.impact;
		const origins = (impact?.originIds ?? []).flatMap((id) => app.nodesById.get(id) ?? []);
		const filename = pngFilename(app.sourceLabel, origins, full ? 'graph-full' : 'graph-view');
		busy = true;
		error = null;
		try {
			await document.fonts.ready;
			if (cy.destroyed() || app.graph?.edges !== graph.edges || app.impact !== impact)
				throw new Error('The graph changed.');
			const blob = await createGraphPng(cy, full);
			if (cy.destroyed()) return;
			downloadPng(blob, filename);
		} catch {
			error = 'Could not export the graph PNG. Try again when the graph is ready.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (details?.open && event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			details.open = false;
			details.querySelector('summary')?.focus();
		}
	}}
	onpointerdown={(event) => {
		if (details?.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
	}}
/>
<details bind:this={details} class="relative">
	<summary
		aria-label="Export graph PNG"
		title="Export graph PNG"
		class="flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-chassis/95 px-3 py-2 text-xs text-ink ring-1 ring-seam hover:bg-layer-2"
		><Icon icon="mdi:image-outline" width="16" height="16" /><span class="hidden min-[1100px]:inline">Export PNG</span
		></summary
	>
	<div
		class="absolute top-full left-0 z-30 mt-2 w-60 max-w-[calc(100vw_-_2rem)] space-y-2 rounded-xl bg-chassis p-3 text-xs text-ink shadow-xl ring-1 ring-seam"
	>
		<button
			type="button"
			disabled={busy || app.visibleIds.size === 0}
			class="w-full rounded-lg bg-layer-2 px-3 py-2 text-left font-medium hover:bg-layer-3 disabled:opacity-50"
			onclick={() => exportGraph(false)}>Download current view PNG</button
		>
		<button
			type="button"
			disabled={busy || app.visibleIds.size === 0}
			class="w-full rounded-lg bg-layer-2 px-3 py-2 text-left font-medium hover:bg-layer-3 disabled:opacity-50"
			onclick={() => exportGraph(true)}>Download full graph PNG</button
		>
		<p class="text-ink-muted">
			Full graph includes displayed packages outside the viewport. Filters, focused views, and reveal depth apply.
			Images capture the current styling and playback layer.
		</p>
		{#if busy}<p role="status">Preparing PNG…</p>{/if}
		{#if error}<p role="alert" class="text-rose-300">{error}</p>{/if}
	</div>
</details>

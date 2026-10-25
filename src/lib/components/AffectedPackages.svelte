<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import type { PackageNode } from '#lib/types.js';

	const PAGE_SIZE = 50;
	let open = $state(false);
	let page = $state(0);
	const rows = $derived.by(() => {
		const origins = new Set(app.impact?.originIds ?? []);
		return (app.impact?.layers ?? []).flatMap((ids, distance) =>
			distance === 0
				? []
				: ids.flatMap((id) => {
						const node = app.nodesById.get(id);
						return node && id !== '' && !origins.has(id) ? [{ node, distance }] : [];
					})
		);
	});
	const groups = $derived.by(() => {
		const grouped = new Map<number, PackageNode[]>();
		for (const { node, distance } of rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
			if (!grouped.has(distance)) grouped.set(distance, []);
			grouped.get(distance)!.push(node);
		}
		return [...grouped];
	});
	const rootDistance = $derived(app.impact?.layers.findIndex((ids) => ids.includes('')) ?? -1);
	$effect(() => {
		void app.impact;
		page = 0;
	});
</script>

<details bind:open class="rounded-lg bg-layer-1 p-3">
	<summary class="cursor-pointer text-sm font-medium text-ink-muted">
		Affected packages by distance <span class="text-ink-faint tabular-nums">({rows.length.toLocaleString()})</span>
	</summary>
	{#if open}
		{#if rootDistance > 0}
			<p class="mt-2 text-xs text-ink-faint">
				The project root is also reached in {rootDistance}
				{rootDistance === 1 ? 'hop' : 'hops'}.
			</p>
		{/if}
		{#if rows.length === 0}
			<p class="mt-2 text-xs text-ink-faint">No other installed packages are reached.</p>
		{/if}
		<div class="mt-3 space-y-3">
			{#each groups as [distance, nodes] (distance)}
				<div>
					<h4 class="mb-1 text-xs font-medium text-cascade">
						{distance}
						{distance === 1 ? 'hop' : 'hops'} from the simulation origins
					</h4>
					<ul
						class="space-y-1"
						aria-label={`${distance} ${distance === 1 ? 'hop' : 'hops'} from the simulation origins`}
					>
						{#each nodes as node (node.id)}
							<li>
								<button
									type="button"
									onclick={() => app.focus(node.id)}
									title={node.id}
									class="w-full rounded-md px-2 py-1.5 text-left hover:bg-layer-2 focus-visible:outline-2 focus-visible:outline-downstream"
								>
									<span class="block text-sm wrap-break-word text-ink">{node.name}</span>
									<span class="block font-mono text-xs text-ink-muted">{node.version ?? 'unknown version'}</span>
									{#if node.devOnly}<span class="text-xs text-ink-faint">Development only</span>{/if}
									<span class="block truncate font-mono text-[11px] text-ink-faint">{node.id}</span>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
		{#if rows.length > PAGE_SIZE}
			<nav aria-label="Affected package pages" class="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
				<button
					type="button"
					disabled={page === 0}
					onclick={() => page--}
					class="rounded bg-layer-2 px-2 py-1 disabled:opacity-40">Previous</button
				>
				<span aria-live="polite"
					>{page * PAGE_SIZE + 1} to {Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length.toLocaleString()}</span
				>
				<button
					type="button"
					disabled={(page + 1) * PAGE_SIZE >= rows.length}
					onclick={() => page++}
					class="rounded bg-layer-2 px-2 py-1 disabled:opacity-40">Next</button
				>
			</nav>
		{/if}
	{/if}
</details>

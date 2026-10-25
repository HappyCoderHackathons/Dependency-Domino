<script lang="ts">
	import { app } from '#lib/state.svelte.ts';

	let page = $state(0);
	const PAGE_SIZE = 10;
	const others = $derived(app.selectedCopies.filter((node) => node.id !== app.selectedId));
</script>

{#if others.length > 0}
	<details open class="rounded-lg bg-layer-1 px-3 py-2">
		<summary class="cursor-pointer text-sm font-medium text-ink-muted">
			Other installed copies <span class="text-ink-faint tabular-nums">({others.length.toLocaleString()})</span>
		</summary>
		<p class="mt-2 text-xs text-ink-faint">Other visible copies have a blue outline on hover or selection.</p>
		<ul class="mt-2 space-y-1" aria-label="Other installed copies">
			{#each others.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) as node (node.id)}
				<li>
					<button
						type="button"
						onclick={() => app.focus(node.id)}
						title={node.id}
						class="w-full rounded-md px-2 py-1.5 text-left hover:bg-layer-2 focus-visible:outline-2 focus-visible:outline-downstream"
					>
						<span class="block text-sm wrap-break-word text-ink">{node.name}</span>
						<span class="block font-mono text-xs text-ink-muted">{node.version ?? 'unknown version'}</span>
						<span class="block truncate font-mono text-[11px] text-ink-faint">{node.id}</span>
						{#if !app.visibleIds.has(node.id)}<span class="text-xs text-ink-faint">Hidden from the canvas</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
		{#if others.length > PAGE_SIZE}
			<nav aria-label="Installed copy pages" class="mt-2 flex items-center gap-2 text-xs text-ink-muted">
				<button
					type="button"
					disabled={page === 0}
					onclick={() => page--}
					class="rounded bg-layer-2 px-2 py-1 disabled:opacity-40">Previous</button
				>
				<span>{page + 1} of {Math.ceil(others.length / PAGE_SIZE)}</span>
				<button
					type="button"
					disabled={(page + 1) * PAGE_SIZE >= others.length}
					onclick={() => page++}
					class="rounded bg-layer-2 px-2 py-1 disabled:opacity-40">Next</button
				>
			</nav>
		{/if}
	</details>
{/if}

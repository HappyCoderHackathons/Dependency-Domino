<script lang="ts">
	import { app } from '#lib/state.svelte.ts';

	const MAX_RESULTS = 20;

	let query = $state('');

	// Case-insensitive substring match on "name@version"; name-prefix matches come first.
	const matches = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q || !app.graph) return [];
		const startsWith = (name: string) => Number(name.toLowerCase().startsWith(q));
		return app.graph.nodes
			.filter((n) => `${n.name}@${n.version ?? ''}`.toLowerCase().includes(q))
			.sort((a, b) => startsWith(b.name) - startsWith(a.name) || a.name.localeCompare(b.name));
	});

	const shown = $derived(matches.slice(0, MAX_RESULTS));
</script>

<div class="mt-2">
	<input
		type="search"
		bind:value={query}
		disabled={!app.hasGraph}
		placeholder={app.hasGraph ? 'Search packages' : 'Load a graph to search'}
		aria-label="Search packages by name"
		class="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
	/>

	{#if query.trim() && app.hasGraph}
		{#if shown.length === 0}
			<p class="mt-2 text-sm text-slate-400">No packages match.</p>
		{:else}
			<ul class="mt-2 max-h-72 space-y-1 overflow-y-auto">
				{#each shown as n (n.id)}
					<li>
						<button
							type="button"
							onclick={() => app.select(n.id)}
							class="w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-100 {app.selectedId === n.id
								? 'bg-slate-100 ring-1 ring-slate-400'
								: ''}"
						>
							<span class="block text-sm font-medium text-slate-800">
								{n.name}@{n.version ?? 'unknown'}
							</span>
							<span class="block font-mono text-xs break-all text-slate-500">
								{n.id === '' ? '(root project)' : n.id}
							</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if matches.length > MAX_RESULTS}
				<p class="mt-1 text-xs text-slate-400">Showing {MAX_RESULTS} of {matches.length}. Refine the search.</p>
			{/if}
		{/if}
	{/if}
</div>
<script lang="ts">
	import Icon from '#lib/icons.js';
	import { app } from '#lib/state.svelte.ts';
	import { searchPackages } from '#lib/graph/search.js';

	const MAX_RESULTS = 20;

	let query = $state('');
	let activeIndex = $state(0);

	const result = $derived(searchPackages(app.graph?.nodes ?? [], query));
	const matches = $derived(result.matches);

	const shown = $derived(matches.slice(0, MAX_RESULTS));
	const activeId = $derived(shown[activeIndex] ? `search-result-${activeIndex}` : undefined);

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			query = '';
			activeIndex = 0;
			return;
		}
		if (!shown.length) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % shown.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = (activeIndex - 1 + shown.length) % shown.length;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			app.focus(shown[activeIndex].id);
		}
	}

	function selectResult(index: number) {
		activeIndex = index;
		app.focus(shown[index].id);
	}

	$effect(() => {
		matches.length;
		activeIndex = Math.min(activeIndex, Math.max(shown.length - 1, 0));
	});
</script>

<div class="relative">
	<Icon
		icon="mdi:magnify"
		width="18"
		height="18"
		class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint"
	/>
	<input
		id="package-search"
		type="search"
		bind:value={query}
		disabled={!app.hasGraph}
		placeholder={app.hasGraph ? 'Find a package' : 'Load a lockfile to search'}
		aria-label="Search packages by name"
		role="combobox"
		aria-expanded={query.trim().length > 0 && shown.length > 0}
		aria-controls="search-results"
		aria-activedescendant={activeId}
		aria-autocomplete="list"
		onkeydown={onKeydown}
		class="w-full rounded-lg border-0 bg-layer-2 py-2 pr-3 pl-9 text-sm text-ink ring-1 ring-transparent transition placeholder:text-ink-faint hover:bg-layer-3 focus:bg-layer-2 focus:ring-downstream disabled:cursor-not-allowed disabled:opacity-50"
	/>
</div>

{#if query.trim() && app.hasGraph}
	<p class="sr-only" aria-live="polite">
		{shown.length === 0
			? `No packages match ${query.trim()}.`
			: `${matches.length} search result${matches.length === 1 ? '' : 's'}.`}
	</p>
	{#if shown.length === 0}
		<p class="mt-2 px-2 text-sm text-ink-faint">No packages match "{query.trim()}".</p>
	{:else}
		{#if result.fuzzy}<p class="mt-2 px-2 text-xs text-downstream">Closest matches</p>{/if}
		<ul
			id="search-results"
			role="listbox"
			class="mt-2 max-h-72 space-y-0.5 overflow-y-auto"
			aria-label="Search results"
		>
			{#each shown as n, index (n.id)}
				{@const hidden = !app.visibleIds.has(n.id)}
				<li>
					<button
						type="button"
						id={`search-result-${index}`}
						role="option"
						data-search-result
						onclick={() => selectResult(index)}
						aria-selected={activeIndex === index}
						class="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-layer-2 aria-selected:bg-layer-3"
					>
						<span class="flex items-baseline gap-1.5 text-sm">
							<span class="truncate font-medium text-ink">{n.id === '' ? `${n.name} (project)` : n.name}</span>
							<span class="shrink-0 font-mono text-xs text-ink-muted">{n.version ?? 'unknown'}</span>
							{#if n.advisoryIds.length > 0}
								<Icon
									icon="mdi:shield-alert-outline"
									width="14"
									height="14"
									class="shrink-0 self-center text-advisory"
								/>
							{/if}
							{#if n.hasInstallScript === true}
								<span
									title="Runs a script at install time"
									class="shrink-0 rounded bg-amber-400/15 px-1 py-0.5 text-[10px] font-medium text-amber-300"
								>
									install script
								</span>
							{/if}
						</span>
						<span class="block truncate font-mono text-[11px] text-ink-faint" title={n.id}>
							{hidden ? 'Hidden by filters' : n.id === '' ? 'project root' : n.id}
						</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if matches.length > MAX_RESULTS}
			<p class="mt-1 px-2 text-xs text-ink-faint">Showing {MAX_RESULTS} of {matches.length}. Keep typing to narrow.</p>
		{/if}
	{/if}
{/if}

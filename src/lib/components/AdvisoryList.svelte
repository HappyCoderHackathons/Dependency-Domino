<script lang="ts">
	import Icon from '#lib/icons.js';
	import { app } from '#lib/state.svelte.ts';

	type Severity = 'critical' | 'high' | 'moderate' | 'low' | 'unknown';
	const severityOrder: Severity[] = ['critical', 'high', 'moderate', 'low', 'unknown'];
	const severityLabels: { value: Severity; label: string }[] = [
		{ value: 'critical', label: 'Critical' },
		{ value: 'high', label: 'High' },
		{ value: 'moderate', label: 'Moderate' },
		{ value: 'low', label: 'Low' },
		{ value: 'unknown', label: 'Unknown' }
	];

	let severityFilter = $state<Severity | 'all'>('all');

	function severityOf(id: string): Severity {
		const severity = app.advisoryDetail(id);
		if (severity?.status !== 'loaded') return 'unknown';
		const label = severity.details.severity?.trim().toLowerCase();
		if (label === 'critical') return 'critical';
		if (label === 'high') return 'high';
		if (label === 'moderate' || label === 'medium') return 'moderate';
		if (label === 'low') return 'low';
		return 'unknown';
	}

	const sortedNodes = $derived.by(() => {
		const nodes = app.advisoryNodes
			.map((node) => ({
				node,
				severity: node.advisoryIds.reduce<Severity>(
					(best, id) => (severityOrder.indexOf(severityOf(id)) < severityOrder.indexOf(best) ? severityOf(id) : best),
					'unknown'
				)
			}))
			.filter(({ severity }) => severityFilter === 'all' || severity === severityFilter)
			.toSorted(
				(a, b) =>
					severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity) ||
					a.node.name.localeCompare(b.node.name) ||
					a.node.id.localeCompare(b.node.id)
			);
		return nodes;
	});

	$effect(() => {
		if (app.advisoryIds.length > 0) void app.loadAdvisoryDetails(app.advisoryIds);
	});
</script>

<div aria-live="polite">
	{#if !app.hasGraph}
		<p class="px-2 text-sm text-ink-faint">Advisories are looked up on OSV.dev after a lockfile loads.</p>
	{:else if app.osvStatus === 'loading' && app.advisoryNodes.length === 0}
		<p class="flex items-center gap-2 px-2 text-sm text-ink-muted">
			<Icon icon="mdi:loading" width="16" height="16" class="animate-spin motion-reduce:animate-none" />
			Checking OSV.dev
		</p>
	{:else if app.advisoryNodes.length === 0}
		<p class="px-2 text-sm text-ink-muted">
			{app.osvStatus === 'unavailable'
				? 'The advisory lookup failed. Try again from the status bar.'
				: 'No known advisories returned for these package versions.'}
		</p>
	{:else}
		{#if app.osvStatus === 'loading'}
			<p class="mb-1 px-2 text-xs text-ink-faint">Rechecking. These matches are from the previous lookup.</p>
		{:else if app.osvStatus === 'partial'}
			<p class="mb-1 px-2 text-xs text-ink-faint">Lookup is partial. Additional advisories may be missing.</p>
		{/if}
		<div class="mb-2 flex items-center gap-2 px-2">
			<label class="text-xs text-ink-faint" for="advisory-severity-filter">Severity</label>
			<select
				id="advisory-severity-filter"
				class="min-w-0 flex-1 rounded-md border-0 bg-layer-2 px-2 py-1 text-xs text-ink ring-1 ring-seam focus:ring-downstream"
				bind:value={severityFilter}
			>
				<option value="all">All severities</option>
				{#each severityLabels as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
		{#if sortedNodes.length === 0}
			<p class="px-2 text-xs text-ink-faint">No advisories match this severity filter.</p>
		{:else}
			<ul class="max-h-56 space-y-0.5 overflow-y-auto" aria-label="Packages with known advisories">
				{#each sortedNodes as item (item.node.id)}
					<li>
						<button
							type="button"
							onclick={() => app.focus(item.node.id)}
							aria-current={app.selectedId === item.node.id}
							class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-layer-2 aria-[current=true]:bg-layer-3"
						>
							<Icon icon="mdi:shield-alert-outline" width="16" height="16" class="shrink-0 text-advisory" />
							<span class="min-w-0 flex-1 truncate text-sm text-ink">
								{item.node.name}<span class="font-mono text-xs text-ink-muted">@{item.node.version}</span>
							</span>
							<span class="shrink-0 text-xs text-advisory uppercase"
								>{severityLabels.find((label) => label.value === item.severity)?.label}</span
							>
							<span class="shrink-0 text-xs text-advisory tabular-nums">{item.node.advisoryIds.length}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
	<p class="mt-2 px-2 text-xs text-ink-faint">
		A matching advisory does not mean the vulnerable code is used by this project.
	</p>
</div>

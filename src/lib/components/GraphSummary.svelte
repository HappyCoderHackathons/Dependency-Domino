<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import { graphMetrics } from '#lib/graph/metrics.js';

	const metrics = $derived(app.graph ? graphMetrics(app.graph) : null);

	const rows = $derived<[string, number][]>(
		metrics
			? [
					['Installed instances', metrics.installedInstances],
					['Packages with install scripts', metrics.installScriptInstances],
					['Outside the default registry host', metrics.nonDefaultHostInstances],
					['Distinct name@version pairs', metrics.distinctPackageVersions],
					['Direct dependencies', metrics.directDependencies],
					['Unresolved dependencies', metrics.unresolvedDependencies],
					['Other parser warnings', metrics.otherWarnings]
				]
			: []
	);
</script>

{#if metrics}
	<dl class="space-y-0.5 text-sm">
		{#each rows as [label, value] (label)}
			<div class="flex items-baseline justify-between gap-3 rounded-md px-2 py-1">
				<dt class="text-ink-muted">{label}</dt>
				<dd class="font-medium tabular-nums {value === 0 ? 'text-ink-faint' : 'text-ink'}">
					{value.toLocaleString()}
				</dd>
			</div>
		{/each}
	</dl>
{:else}
	<p class="px-2 text-sm text-ink-faint">Counts appear once a lockfile is loaded.</p>
{/if}

<script lang="ts">
	import Icon from '@iconify/svelte';
	import { app } from '#lib/state.svelte.ts';

	const impact = $derived(app.impact);
	const count = $derived(impact?.ancestorIds.length ?? 0);
	const isRootOrigin = $derived(impact?.originId === '');
	const path = $derived(impact?.samplePaths[0] ?? []);

	function label(id: string): string {
		const node = app.nodesById.get(id);
		if (!node) return id === '' ? 'project root' : id;
		return node.version ? `${node.name}@${node.version}` : node.name;
	}

	const originLabel = $derived(impact ? label(impact.originId) : '');
</script>

{#if impact}
	<div class="mt-2 space-y-3 text-sm text-slate-700">
		<p class="text-xs text-slate-500">
			Hypothetical origin: <span class="font-medium text-slate-800">{originLabel}</span>
		</p>

		{#if count === 0}
			<p>No installed package instances depend on this package.</p>
		{:else}
			<p>
				<strong>
					{count} installed package {count === 1 ? 'instance depends' : 'instances depend'} on this package.
				</strong>
				A compromise could expose these dependency paths, depending on how the package is used and which build
				or runtime environments load it.
			</p>
		{/if}

		<div>
			<h3 class="text-xs font-semibold text-slate-500">Sample path from the project root</h3>
			{#if isRootOrigin}
				<p class="mt-1 text-slate-600">This is the project root itself.</p>
			{:else if path.length === 0}
				<p class="mt-1 text-slate-600">
					The project root does not reach this package through resolved dependencies.
				</p>
			{:else}
				<ol class="mt-1 flex flex-wrap items-center gap-1" aria-label="Dependency path from the project root">
					{#each path as id, i (id)}
						{#if i > 0}
							<li aria-hidden="true" class="text-slate-400">
								<Icon icon="mdi:arrow-right" width="14" height="14" />
							</li>
						{/if}
						<li class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs break-all text-slate-800">
							{label(id)}
						</li>
					{/each}
				</ol>
			{/if}
		</div>

		<p class="text-xs text-slate-500">This is a hypothetical exposure model, not a vulnerability finding.</p>
	</div>
{:else}
	<p class="mt-2 text-sm text-slate-400">Select a package and run a simulation to see its impact.</p>
{/if}
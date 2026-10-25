<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import Icon from '@iconify/svelte';
	import { simulateCompromise } from '#lib/graph/impact.ts';
	import { DEFAULT_FILTERS } from '#lib/graph/view.js';

	const pkg = $derived(app.selectedNode);
	const isRoot = $derived(pkg?.id === '');
	const isOrigin = $derived(pkg !== null && app.impact?.originId === pkg.id);
	const hidden = $derived(pkg !== null && !app.visibleIds.has(pkg.id));

	// Works for any node, regardless of advisory status. Replaces any earlier result.
	function simulate() {
		if (!pkg || !app.graph) return;
		app.setImpact(simulateCompromise(app.graph, pkg.id));
	}

	// Outgoing edges = what this package depends on; incoming edges = what depends on it.
	const counts = $derived.by(() => {
		let dependencies = 0;
		let dependents = 0;
		if (pkg && app.graph) {
			for (const e of app.graph.edges) {
				if (e.source === pkg.id) dependencies++;
				if (e.target === pkg.id) dependents++;
			}
		}
		return { dependencies, dependents };
	});

	const tags = $derived.by(() => {
		if (!pkg || isRoot) return ['Project root'];
		const list = [
			pkg.direct ? 'Direct' : 'Transitive',
			pkg.devOnly ? 'Development' : pkg.optional ? 'Optional' : 'Runtime'
		];
		if (pkg.source !== 'registry') list.push(`Source: ${pkg.source}`);
		return list;
	});

	const tag = 'rounded-md bg-layer-2 px-1.5 py-0.5 text-xs text-ink-muted';
</script>

{#if pkg}
	<div class="space-y-4">
		<div>
			<p class="text-lg leading-snug font-semibold wrap-break-word text-ink">{pkg.name}</p>
			<p class="font-mono text-sm text-ink-muted">{pkg.version ?? 'unknown version'}</p>
			<ul class="mt-2 flex flex-wrap gap-1" aria-label="Package type">
				{#each tags as t (t)}<li class={tag}>{t}</li>{/each}
			</ul>
		</div>

		{#if hidden}
			<div class="flex items-start gap-2 rounded-lg bg-layer-1 p-2.5 text-xs text-ink-muted">
				<Icon icon="mdi:eye-off-outline" width="16" height="16" class="mt-px shrink-0" />
				<p class="flex-1">
					Hidden on the canvas by the current filters.
					<button
						type="button"
						class="text-downstream underline"
						onclick={() => (app.filters = { ...DEFAULT_FILTERS })}
					>
						Show all packages
					</button>
				</p>
			</div>
		{/if}

		<dl class="grid grid-cols-2 gap-2 text-sm">
			<div class="rounded-lg bg-layer-1 px-3 py-2">
				<dt class="text-xs text-ink-faint">Depends on</dt>
				<dd class="font-medium text-ink tabular-nums">{counts.dependencies.toLocaleString()}</dd>
			</div>
			<div class="rounded-lg bg-layer-1 px-3 py-2">
				<dt class="text-xs text-ink-faint">Depended on by</dt>
				<dd class="font-medium text-ink tabular-nums">{counts.dependents.toLocaleString()}</dd>
			</div>
			{#if !isRoot}
				<div class="col-span-2 px-1">
					<dt class="text-xs text-ink-faint">Lockfile identity</dt>
					<dd class="font-mono text-xs break-all text-ink-muted">{pkg.id}</dd>
				</div>
			{/if}
		</dl>

		{#if isOrigin}
			<button
				type="button"
				onclick={() => app.clearSimulation()}
				class="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-layer-2 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-layer-3"
			>
				<Icon icon="mdi:close-circle-outline" width="18" height="18" />
				Clear simulation
			</button>
		{:else}
			<button
				type="button"
				onclick={simulate}
				class="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-origin px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
			>
				<Icon icon="mdi:alert-octagon-outline" width="18" height="18" />
				Simulate compromise
			</button>
		{/if}
		<p class="-mt-2 text-xs text-ink-faint">
			Assumes this package is untrustworthy and traces everything that depends on it. A hypothetical exposure model, not
			a vulnerability finding.
		</p>
	</div>
{:else}
	<div class="flex flex-col items-start gap-2 py-2 text-sm text-ink-muted">
		<Icon icon="mdi:cursor-default-click-outline" width="22" height="22" class="text-ink-faint" />
		<p>Select a package on the graph or find one by name to inspect it and simulate a compromise.</p>
	</div>
{/if}

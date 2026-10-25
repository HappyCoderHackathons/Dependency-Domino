<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import Icon from '#lib/icons.js';
	import { simulateCompromise } from '#lib/graph/impact.ts';
	import { DEFAULT_FILTERS } from '#lib/graph/view.js';
	import PackageNeighbors from '#lib/components/PackageNeighbors.svelte';

	const pkg = $derived(app.selectedNode);
	const isRoot = $derived(pkg?.id === '');
	const copies = $derived(
		pkg ? (app.graph?.nodes.filter((node) => node.id !== '' && node.name === pkg.name) ?? []) : []
	);
	const isOrigin = $derived(pkg !== null && (app.impact?.originIds ?? [app.impact?.originId]).includes(pkg.id));
	const hidden = $derived(pkg !== null && !app.visibleIds.has(pkg.id));

	// Works for any node, regardless of advisory status. Replaces any earlier result.
	function simulate() {
		if (!pkg || !app.graph) return;
		app.setImpact(simulateCompromise(app.graph, pkg.id));
	}

	function simulateAllCopies() {
		if (!pkg || !app.graph) return;
		app.setImpact(
			simulateCompromise(
				app.graph,
				copies.map((node) => node.id)
			)
		);
	}

	// Outgoing edges = what this package depends on; incoming edges = what depends on it.
	const counts = $derived.by(() => {
		return {
			dependencies: pkg ? (app.graphIndex?.dependencies.get(pkg.id)?.length ?? 0) : 0,
			dependents: pkg ? (app.graphIndex?.dependents.get(pkg.id)?.length ?? 0) : 0
		};
	});

	const tags = $derived.by(() => {
		if (!pkg || isRoot) return ['Project root'];
		const list = [
			pkg.direct ? 'Direct' : 'Transitive',
			pkg.devOnly ? 'Development' : pkg.optional ? 'Optional' : 'Runtime'
		];
		if (pkg.hasInstallScript === true) list.push('Runs install script');
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
			{#if copies.length > 1}
				<div class="col-span-2 flex items-center justify-between gap-3 rounded-lg bg-layer-1 px-3 py-2">
					<div>
						<dt class="text-xs text-ink-faint">Installed</dt>
						<dd class="font-medium text-ink tabular-nums">{copies.length} times</dd>
					</div>
					<button
						type="button"
						onclick={simulateAllCopies}
						class="rounded-md bg-layer-2 px-2 py-1 text-xs font-medium text-ink hover:bg-layer-3"
					>
						Simulate all copies
					</button>
				</div>
			{/if}
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
		<button
			type="button"
			onclick={() => app.showNeighborhood()}
			class="w-full rounded-lg bg-layer-2 px-3 py-2 text-sm font-medium text-downstream hover:bg-layer-3"
		>
			Explore neighborhood
		</button>

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
		{#key pkg.id}<PackageNeighbors id={pkg.id} />{/key}
	</div>
{:else}
	<div class="flex flex-col items-start gap-2 py-2 text-sm text-ink-muted">
		<Icon icon="mdi:cursor-default-click-outline" width="22" height="22" class="text-ink-faint" />
		<p>Select a package on the graph or find one by name to inspect it and simulate a compromise.</p>
	</div>
{/if}

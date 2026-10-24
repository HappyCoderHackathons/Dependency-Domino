<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
    import Icon from '@iconify/svelte';
    import { simulateCompromise } from '#lib/graph/impact.ts';

    // Works for any node, regardless of advisory status. Replaces any earlier result.
    function simulate() {
        if (!pkg || !app.graph) return;
        app.setImpact(simulateCompromise(app.graph, pkg.id));
    }

	const pkg = $derived(app.selectedNode);
	const isRoot = $derived(pkg?.id === '');

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

	const kind = $derived(isRoot ? '-' : pkg?.devOnly ? 'Development' : pkg?.optional ? 'Optional' : 'Runtime');
	const position = $derived(isRoot ? 'Root project' : pkg?.direct ? 'Direct' : 'Transitive');

	const rows = $derived<[string, string][]>(
		pkg
			? [
					['Name', pkg.name],
					['Version', pkg.version ?? 'unknown'],
					['Dependency type', kind],
					['Position', position],
					['Lockfile path', isRoot ? '(root project)' : pkg.id],
					['Source', pkg.source],
					['Direct dependencies', String(counts.dependencies)],
					['Dependents', String(counts.dependents)]
				]
			: []
	);
</script>

{#if pkg}
	<dl class="mt-2 space-y-2 text-sm">
		{#each rows as [label, value] (label)}
			<div>
				<dt class="text-xs text-slate-500">{label}</dt>
				<dd class="font-medium break-all text-slate-800">{value}</dd>
			</div>
		{/each}
	</dl>
    <button
        type="button"
        onclick={simulate}
        class="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
    >
        <Icon icon="mdi:alert-octagon-outline" width="18" height="18" />
        Simulate Compromise
    </button>
    <p class="mt-2 text-xs text-slate-500">
        Assumes this package is untrustworthy. A hypothetical exposure model, not a vulnerability finding.
    </p>
{:else}
	<p class="mt-2 text-sm text-slate-400">Select a package on the graph or search for one.</p>
{/if}
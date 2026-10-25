<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import type { DependencyEdge } from '#lib/types.js';

	let { id }: { id: string } = $props();
	let expanded = $state<Record<string, boolean>>({});
	$effect(() => {
		void id;
		expanded = {};
	});
	const groups = $derived([
		{ key: 'dependencies', label: 'Direct dependencies', edges: app.graphIndex?.dependencies.get(id) ?? [] },
		{ key: 'dependents', label: 'Direct dependents', edges: app.graphIndex?.dependents.get(id) ?? [] }
	]);
	function neighbor(edge: DependencyEdge, key: string) {
		return app.nodesById.get(key === 'dependencies' ? edge.target : edge.source)!;
	}
</script>

<div class="space-y-2">
	{#each groups as group (group.key)}
		<details class="rounded-lg bg-layer-1 px-3 py-2">
			<summary class="cursor-pointer text-sm font-medium text-ink-muted">
				{group.label} <span class="text-ink-faint tabular-nums">({group.edges.length.toLocaleString()})</span>
			</summary>
			{#if group.edges.length === 0}
				<p class="mt-2 text-xs text-ink-faint">None recorded in this lockfile.</p>
			{:else}
				<ul class="mt-2 space-y-1" aria-label={group.label}>
					{#each group.edges.slice(0, expanded[group.key] ? undefined : 10) as edge, i (i)}
						{@const node = neighbor(edge, group.key)}
						<li>
							<button
								type="button"
								onclick={() => app.focus(node.id)}
								title={node.id || 'Project root'}
								class="w-full rounded-md px-2 py-1.5 text-left hover:bg-layer-2 focus-visible:outline-2 focus-visible:outline-downstream"
							>
								<span class="block text-sm wrap-break-word text-ink"
									>{node.name}{node.id === '' ? ' (project)' : ''}</span
								>
								<span class="block font-mono text-xs text-ink-muted">{node.version ?? 'unknown version'}</span>
								<span class="block text-xs text-ink-faint">
									{edge.kind}{edge.requestedRange ? ` · requires ${edge.requestedRange}` : ''}
								</span>
								<span class="block truncate font-mono text-[11px] text-ink-faint">{node.id || 'project root'}</span>
							</button>
						</li>
					{/each}
				</ul>
				{#if group.edges.length > 10}
					<button
						type="button"
						onclick={() => (expanded[group.key] = !expanded[group.key])}
						class="mt-2 rounded px-2 py-1 text-xs text-downstream hover:bg-layer-2"
					>
						{expanded[group.key] ? 'Show fewer' : `Show all ${group.edges.length.toLocaleString()}`}
						{group.label.toLowerCase()}
					</button>
				{/if}
			{/if}
		</details>
	{/each}
</div>

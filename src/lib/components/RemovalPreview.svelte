<script lang="ts">
	import { app } from '#lib/state.svelte.js';
	let limit = $state(20);
</script>

{#if app.removal}
	<div class="space-y-3 text-sm">
		<h3 class="font-semibold text-downstream">Hypothetical removal preview</h3>
		<p class="text-ink">
			Removing <strong>{app.nodesById.get(app.removal.removedId)?.name}</strong> makes
			<strong>{app.removal.unreachableIds.length}</strong> other installed instances newly unreachable from the project root.
		</p>
		<p class="text-xs text-ink-muted">
			Calculated on a copy with this node and its edges removed. The original graph stays visible for comparison.
			Already disconnected packages are excluded. This does not establish that removal is safe or that consumers will
			still work.
		</p>
		{#if !app.removal.rootReachableBefore}<p class="text-xs text-cascade">
				This package had no recorded path from root before removal, so no new root reachability is lost.
			</p>{/if}
		<ul aria-label="Packages newly unreachable after removal" class="max-h-64 space-y-1 overflow-auto">
			{#each app.removal.unreachableIds.slice(0, limit) as id (id)}
				<li>
					<button
						type="button"
						class="w-full rounded-md bg-layer-1 p-2 text-left text-downstream hover:bg-layer-2"
						onclick={() => app.focus(id)}
						>{app.nodesById.get(id)?.name}<span class="block font-mono text-xs text-ink-muted">{id}</span></button
					>
				</li>
			{/each}
		</ul>
		{#if app.removal.unreachableIds.length > limit}<button
				type="button"
				class="text-xs text-downstream underline"
				onclick={() => (limit += 20)}>Show 20 more</button
			>{/if}
		<button type="button" class="w-full rounded-lg bg-layer-2 px-3 py-2 text-ink" onclick={() => (app.removal = null)}
			>Clear removal preview</button
		>
	</div>
{/if}

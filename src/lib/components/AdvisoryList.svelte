<script lang="ts">
	import Icon from '@iconify/svelte';
	import { app } from '#lib/state.svelte.ts';
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
		<ul class="max-h-56 space-y-0.5 overflow-y-auto" aria-label="Packages with known advisories">
			{#each app.advisoryNodes as node (node.id)}
				<li>
					<button
						type="button"
						onclick={() => app.focus(node.id)}
						aria-current={app.selectedId === node.id}
						class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-layer-2 aria-[current=true]:bg-layer-3"
					>
						<Icon icon="mdi:shield-alert-outline" width="16" height="16" class="shrink-0 text-advisory" />
						<span class="min-w-0 flex-1 truncate text-sm text-ink">
							{node.name}<span class="font-mono text-xs text-ink-muted">@{node.version}</span>
						</span>
						<span class="shrink-0 text-xs text-advisory tabular-nums">{node.advisoryIds.length}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="mt-2 px-2 text-xs text-ink-faint">
		A matching advisory does not mean the vulnerable code is used by this project.
	</p>
</div>

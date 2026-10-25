<script lang="ts">
	import Icon from '@iconify/svelte';
	import { app } from '#lib/state.svelte.ts';
	const result = $derived(app.selectedAdvisories);
</script>

<div class="text-sm text-ink-muted" aria-live="polite">
	{#if result?.status === 'not_checked'}
		<p>Not checked. OSV lookup requires a registry package with an exact name and version.</p>
	{:else if result?.status === 'loading'}
		<p class="flex items-center gap-2">
			<Icon icon="mdi:loading" width="16" height="16" class="animate-spin motion-reduce:animate-none" />
			Checking known advisories
		</p>
	{:else if result?.status === 'failed'}
		<p>Lookup failed for this package. Known advisories could not be determined.</p>
	{:else if result?.status === 'none'}
		<p>No known advisories returned for this version. This does not establish that it is safe.</p>
	{:else if result?.status === 'found'}
		<ul class="space-y-0.5">
			{#each result.advisoryIds as id (id)}
				<li>
					<a
						class="flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-xs break-all text-advisory transition-colors hover:bg-layer-2"
						href={`https://osv.dev/vulnerability/${encodeURIComponent(id)}`}
						target="_blank"
						rel="noopener noreferrer"
					>
						<Icon icon="mdi:shield-alert-outline" width="16" height="16" class="shrink-0" />
						<span class="flex-1">{id}</span>
						<Icon icon="mdi:open-in-new" width="14" height="14" class="shrink-0 text-ink-faint" />
					</a>
				</li>
			{/each}
		</ul>
		<p class="mt-2 text-xs text-ink-faint">Known advisories are separate from hypothetical simulations.</p>
	{/if}
</div>

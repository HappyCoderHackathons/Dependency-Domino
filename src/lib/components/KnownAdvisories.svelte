<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	const result = $derived(app.selectedAdvisories);
</script>

<div class="mt-2 space-y-2 text-sm text-slate-700" aria-live="polite">
	{#if !app.selectedNode}
		<p>Select a package to view known advisories.</p>
	{:else if result?.status === 'not_checked'}
		<p>Not checked. OSV lookup requires a registry package with an exact name and version.</p>
	{:else if result?.status === 'loading'}
		<p>Checking known advisories…</p>
	{:else if result?.status === 'failed'}
		<p>Lookup failed for this package. Known advisories could not be determined.</p>
	{:else if result?.status === 'none'}
		<p>No known advisories returned for this package version. This does not establish that it is safe.</p>
	{:else if result?.status === 'found'}
		<ul class="space-y-1">
			{#each result.advisoryIds as id (id)}
				<li>
					<a
						class="break-all text-purple-700 underline"
						href={`https://osv.dev/vulnerability/${encodeURIComponent(id)}`}
						target="_blank"
						rel="noopener noreferrer">{id}</a
					>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="text-xs text-slate-500">
		A matching advisory does not mean the vulnerable code is used by this project. Known advisories are separate from
		hypothetical simulations.
	</p>
</div>

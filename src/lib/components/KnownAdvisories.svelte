<script lang="ts">
	import Icon from '@iconify/svelte';
	import { app } from '#lib/state.svelte.ts';
	const result = $derived(app.selectedAdvisories);
</script>

<div class="mt-2 space-y-2 text-sm text-slate-700" aria-live="polite">
	{#if app.advisoryNodes.length > 0}
		<div class="rounded-md border-2 border-purple-600 bg-purple-50 p-3">
			<p class="flex items-center gap-2 font-semibold text-purple-900">
				<Icon icon="mdi:shield-alert-outline" width="20" height="20" />
				{app.advisoryNodes.length} installed {app.advisoryNodes.length === 1 ? 'instance has' : 'instances have'} known advisories
			</p>
			<p class="mt-1 text-xs">Select an instance to locate it on the graph and view its advisory links.</p>
			{#if app.osvStatus === 'loading'}
				<p class="mt-1 text-xs">Rechecking. These matches are from the previous lookup.</p>
			{:else if app.osvStatus === 'partial'}
				<p class="mt-1 text-xs">Lookup is partial. Additional advisories may be missing.</p>
			{/if}
			<ul class="mt-2 max-h-56 space-y-2 overflow-y-auto" aria-label="Packages with known advisories">
				{#each app.advisoryNodes as node (node.id)}
					<li>
						<button
							type="button"
							onclick={() => app.select(node.id)}
							aria-pressed={app.selectedId === node.id}
							class="w-full rounded border border-purple-200 bg-white p-2 text-left hover:bg-purple-100 focus-visible:outline-2 focus-visible:outline-purple-700"
						>
							<span class="block font-semibold break-all text-purple-900">{node.name}@{node.version}</span>
							<span class="block text-xs"
								>{node.advisoryIds.length} {node.advisoryIds.length === 1 ? 'advisory' : 'advisories'}</span
							>
							<span class="block font-mono text-xs break-all text-slate-500">{node.id}</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
	{#if app.selectedNode}
		<p class="font-semibold break-all">Selected: {app.selectedNode.name}@{app.selectedNode.version ?? 'unknown'}</p>
	{/if}
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

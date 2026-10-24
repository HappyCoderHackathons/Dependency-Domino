<script lang="ts">
	import Icon from '@iconify/svelte';
	import { app } from '#lib/state.svelte.ts';

	let open = $state(false);

	const warningCount = $derived(app.warnings.length);
	const instanceCount = $derived(app.graph?.nodes.length ?? 0);

	// Close the panel when there is nothing to list (for example after loading a new graph).
	$effect(() => {
		if (warningCount === 0) open = false;
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<footer
	class="relative col-span-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500"
>
	<span>Lockfile: {app.sourceLabel ?? 'none loaded'}</span>
	<span>lockfileVersion: {app.lockfileVersion ?? '-'}</span>
	<span>Installed instances: {app.hasGraph ? instanceCount : '-'}</span>

	{#if warningCount > 0}
		<button
			type="button"
			aria-expanded={open}
			aria-controls="warnings-panel"
			onclick={() => (open = !open)}
			class="inline-flex items-center gap-1 rounded px-1 font-medium text-amber-700 hover:bg-amber-50"
		>
			<Icon icon="mdi:alert-outline" width="14" height="14" />
			Warnings: {warningCount}
		</button>
	{:else}
		<span>Warnings: 0</span>
	{/if}

	<span>OSV: not checked</span>
	<span class="ml-auto">Simulations are hypothetical.</span>

	{#if open}
		<div
			id="warnings-panel"
			role="region"
			aria-label="Parser warnings"
			class="absolute bottom-full left-4 z-40 mb-2 w-[28rem] max-w-[calc(100vw-2rem)] rounded-md border border-slate-300 bg-white shadow-lg"
		>
			<div class="flex items-center justify-between border-b border-slate-200 px-3 py-2">
				<h2 class="text-xs font-semibold tracking-wide text-slate-600 uppercase">
					Parser warnings ({warningCount})
				</h2>
				<button
					type="button"
					aria-label="Close warnings"
					onclick={() => (open = false)}
					class="rounded p-0.5 hover:bg-slate-100"
				>
					<Icon icon="mdi:close" width="16" height="16" />
				</button>
			</div>
			<!-- Warning text can contain package names from the lockfile: plain interpolation only. -->
			<ul class="max-h-64 space-y-1 overflow-y-auto px-3 py-2 text-xs text-slate-700">
				{#each app.warnings as warning, i (i)}
					<li class="break-words">{warning}</li>
				{/each}
			</ul>
		</div>
	{/if}
</footer>
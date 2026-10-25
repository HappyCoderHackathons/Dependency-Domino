<script lang="ts">
	import Icon from '@iconify/svelte';
	import { app } from '#lib/state.svelte.ts';

	let open = $state(false);

	const warningCount = $derived(app.warnings.length);
	const instanceCount = $derived(app.graph?.nodes.length ?? 0);
	const osvLabels = {
		idle: 'not checked',
		loading: 'checking',
		complete: 'complete',
		partial: 'partial',
		unavailable: 'failed'
	};

	// Close the panel when there is nothing to list (for example after loading a new graph).
	$effect(() => {
		if (warningCount === 0) open = false;
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<footer class="relative col-span-full flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5 text-xs text-ink-faint">
	<span>Lockfile version: {app.lockfileVersion ?? '-'}</span>

	{#if warningCount > 0}
		<button
			type="button"
			aria-expanded={open}
			aria-controls="warnings-panel"
			onclick={() => (open = !open)}
			class="inline-flex items-center gap-1 rounded px-1 font-medium text-cascade transition-colors hover:bg-layer-2"
		>
			<Icon icon="mdi:alert-outline" width="14" height="14" />
			{warningCount}
			{warningCount === 1 ? 'warning' : 'warnings'}
		</button>
	{:else}
		<span>No warnings</span>
	{/if}

	<span aria-live="polite" class="inline-flex items-center gap-1.5">
		<span
			aria-hidden="true"
			class="size-1.5 rounded-full {app.osvStatus === 'complete'
				? 'bg-emerald-400'
				: app.osvStatus === 'loading'
					? 'animate-pulse bg-downstream motion-reduce:animate-none'
					: app.osvStatus === 'idle'
						? 'bg-ink-faint'
						: 'bg-cascade'}"
		></span>
		OSV lookup {osvLabels[app.osvStatus]}
		{#if app.osvStatus !== 'idle' && app.osvStatus !== 'loading'}
			<span class="text-ink-faint">({app.advisoryInstanceCount} with known advisories)</span>
		{/if}
	</span>
	<button
		type="button"
		class="rounded px-1 underline-offset-2 transition-colors hover:bg-layer-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
		disabled={!app.hasGraph || app.osvStatus === 'loading'}
		onclick={() => void app.checkAdvisories()}
	>
		Check again
	</button>
	<span class="ml-auto">Simulations are hypothetical.</span>

	{#if open}
		<div
			id="warnings-panel"
			role="region"
			aria-label="Parser warnings"
			class="absolute bottom-full left-4 z-40 mb-2 w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl bg-chassis shadow-2xl ring-1 ring-stroke"
		>
			<div class="flex items-center justify-between px-3 py-2">
				<h2 class="text-[13px] font-medium text-ink">Parser warnings ({warningCount})</h2>
				<button
					type="button"
					aria-label="Close warnings"
					onclick={() => (open = false)}
					class="rounded p-0.5 text-ink-faint hover:bg-layer-2 hover:text-ink"
				>
					<Icon icon="mdi:close" width="16" height="16" />
				</button>
			</div>
			<!-- Warning text can contain package names from the lockfile: plain interpolation only. -->
			<ul class="max-h-64 space-y-1.5 overflow-y-auto px-3 pb-3 text-xs text-ink-muted">
				{#each app.warnings as warning, i (i)}
					<li class="break-words">{warning}</li>
				{/each}
			</ul>
		</div>
	{/if}
</footer>

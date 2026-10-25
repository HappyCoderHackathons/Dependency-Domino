<script lang="ts">
	import Icon from '#lib/icons.js';
	import BrandLogo from '#lib/components/BrandLogo.svelte';
	import { app } from '#lib/state.svelte.ts';

	interface Props {
		canReset: boolean;
		onimport: () => void;
		onrepository: () => void;
		ondemo: () => void;
		onreset: () => void;
		onclose: () => void;
		onhelp: () => void;
		onshortcuts: () => void;
		mobile?: boolean;
		onoverview: () => void;
		onpackage: () => void;
	}

	let {
		canReset,
		onimport,
		onrepository,
		ondemo,
		onreset,
		onclose,
		onhelp,
		onshortcuts,
		mobile = false,
		onoverview,
		onpackage
	}: Props = $props();

	const ghost =
		'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-layer-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<header class="top-bar col-span-full flex items-center gap-3 px-4 py-2">
	<BrandLogo
		variant={mobile ? 'mark' : 'full'}
		class={mobile ? 'size-8 shrink-0 text-ink' : 'h-10 w-auto shrink-0 text-ink'}
	/>
	<h1 class="sr-only">Dependency Domino</h1>

	{#if app.sourceLabel && !mobile}
		<p
			class="hidden min-w-0 items-center gap-2 rounded-lg bg-layer-1 px-2.5 py-1 text-xs text-ink-muted md:flex"
			title={app.sourceLabel}
		>
			<Icon icon="mdi:file-tree-outline" width="15" height="15" class="shrink-0 text-ink-faint" />
			<span class="truncate">{app.sourceLabel}</span>
			<span class="shrink-0 text-ink-faint tabular-nums">{app.graph?.nodes.length.toLocaleString()} instances</span>
		</p>
	{/if}

	<div class="ml-auto flex items-center gap-1">
		{#if mobile}
			<button type="button" class={ghost} onclick={onoverview} aria-label="Open overview drawer" title="Overview"
				><Icon icon="mdi:menu" width="18" height="18" /></button
			>
			<button type="button" class={ghost} onclick={onpackage} aria-label="Open package drawer" title="Package details"
				><Icon icon="mdi:package-variant-closed" width="18" height="18" /></button
			>
		{/if}
		<button type="button" class={ghost} onclick={onhelp} aria-label="How it works" title="How it works">
			<Icon icon="mdi:help-circle-outline" width="18" height="18" />
		</button>
		<button
			type="button"
			class={ghost}
			onclick={onshortcuts}
			aria-label="Keyboard shortcuts"
			title="Keyboard shortcuts (?)"
		>
			<Icon icon="mdi:keyboard-outline" width="18" height="18" />
		</button>
		<button
			type="button"
			class={ghost}
			onclick={onclose}
			disabled={!canReset}
			aria-label="Close lockfile"
			title="Close lockfile"
		>
			<Icon icon="mdi:file-remove-outline" width="18" height="18" />
		</button>
		<button
			type="button"
			class={ghost}
			onclick={onreset}
			disabled={!canReset}
			title="Clear the selection and simulation"
			aria-label="Reset"
		>
			<Icon icon="mdi:restore" width="18" height="18" />
			<span class="hidden sm:inline">Reset</span>
		</button>
		<button type="button" class={ghost} onclick={ondemo} aria-label="Try demo">
			<Icon icon="mdi:play-outline" width="18" height="18" />
			<span class="hidden sm:inline">Try demo</span>
		</button>
		<button type="button" class={ghost} onclick={onrepository} aria-label="GitHub URL">
			<Icon icon="mdi:github" width="18" height="18" />
			<span class="hidden sm:inline">GitHub URL</span>
		</button>
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-chassis transition-colors hover:bg-white"
			onclick={onimport}
			aria-label="Import lockfile"
			title="Import lockfile"
		>
			<Icon icon="mdi:tray-arrow-up" width="18" height="18" />
			<span class="import-label">Import lockfile</span>
		</button>
	</div>
</header>

<style>
	@media (max-width: 899px) {
		.top-bar {
			gap: 4px;
			padding-inline: 8px;
		}
		.top-bar :global(button) {
			padding: 8px;
			min-width: 32px;
		}
		.top-bar :global(button span) {
			display: none;
		}
		.top-bar > div {
			gap: 0;
		}
	}
</style>

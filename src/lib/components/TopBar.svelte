<script lang="ts">
	import Icon from '@iconify/svelte';
	import BrandLogo from '#lib/components/BrandLogo.svelte';
	import { app } from '#lib/state.svelte.ts';

	interface Props {
		canReset: boolean;
		onimport: () => void;
		ondemo: () => void;
		onreset: () => void;
	}

	let { canReset, onimport, ondemo, onreset }: Props = $props();

	const ghost =
		'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-layer-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<header class="col-span-full flex items-center gap-3 px-4 py-2">
	<BrandLogo variant="full" class="h-10 w-auto text-ink" />
	<h1 class="sr-only">Dependency Domino</h1>

	{#if app.sourceLabel}
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
		<button
			type="button"
			class={ghost}
			onclick={onreset}
			disabled={!canReset}
			title="Clear the selection and simulation"
		>
			<Icon icon="mdi:restore" width="18" height="18" />
			<span class="hidden sm:inline">Reset</span>
		</button>
		<button type="button" class={ghost} onclick={ondemo}>
			<Icon icon="mdi:play-outline" width="18" height="18" />
			<span class="hidden sm:inline">Try demo</span>
		</button>
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-chassis transition-colors hover:bg-white"
			onclick={onimport}
		>
			<Icon icon="mdi:tray-arrow-up" width="18" height="18" />
			Import lockfile
		</button>
	</div>
</header>

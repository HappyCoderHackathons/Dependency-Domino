<script lang="ts">
	import Icon from '@iconify/svelte';
    import BrandLogo from '#lib/components/BrandLogo.svelte';

	interface Props {
		canReset: boolean;
		onimport: () => void;
		ondemo: () => void;
		onreset: () => void;
	}

	let { canReset, onimport, ondemo, onreset }: Props = $props();

	const btn =
		'inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
</script>

<header class="col-span-3 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
	<!-- Logo (#36) already exists: import it and render it here, next to the title. -->
	<BrandLogo variant="full" class="h-12 w-auto" />
	<h1 class="sr-only">Dependency Domino</h1>

	<div class="ml-auto flex items-center gap-2">
		<button type="button" class={btn} onclick={onimport}>
			<Icon icon="mdi:upload" width="18" height="18" />
			Import Lockfile
		</button>
		<button type="button" class={btn} onclick={ondemo}>
			<Icon icon="mdi:play" width="18" height="18" />
			Try Demo
		</button>
		<button type="button" class={btn} onclick={onreset} disabled={!canReset}>
			<Icon icon="mdi:restore" width="18" height="18" />
			Reset
		</button>
	</div>
</header>
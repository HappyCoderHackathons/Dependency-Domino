<script lang="ts" module>
	export interface RailItem {
		id: string;
		icon: string;
		label: string;
		/** Small count shown on the rail icon, for example advisories found. */
		badge?: number;
		tone?: 'advisory' | 'origin';
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/icons.js';

	interface Props {
		side: 'left' | 'right';
		label: string;
		open: boolean;
		items: RailItem[];
		/** Expands the sidebar to one section. */
		onpick: (id: string) => void;
		children: Snippet;
		mobile?: boolean;
	}

	let { side, label, open = $bindable(), items, onpick, children, mobile = false }: Props = $props();
	let drawer = $state<HTMLDialogElement>();
	$effect(() => {
		if (!drawer) return;
		if (mobile && open && !drawer.open) drawer.showModal();
		else if ((!mobile || !open) && drawer.open) drawer.close();
	});

	const left = $derived(side === 'left');
	const collapseIcon = $derived(left ? 'mdi:chevron-double-left' : 'mdi:chevron-double-right');
	const expandIcon = $derived(left ? 'mdi:chevron-double-right' : 'mdi:chevron-double-left');
	const tone = { advisory: 'bg-advisory text-chassis', origin: 'bg-origin text-white' };

	const iconBtn =
		'relative flex size-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-layer-2 hover:text-ink';
</script>

<aside aria-label={label} class="flex min-h-0 min-w-0 flex-col overflow-hidden">
	{#if mobile}
		<dialog
			bind:this={drawer}
			aria-label={`${label} drawer`}
			onclose={() => (open = false)}
			onclick={(event) => {
				if (event.target !== drawer || !drawer) return;
				const box = drawer.getBoundingClientRect();
				if (
					event.clientX < box.left ||
					event.clientX > box.right ||
					event.clientY < box.top ||
					event.clientY > box.bottom
				)
					open = false;
			}}
			class="drawer fixed inset-y-0 m-0 h-dvh max-h-dvh w-[min(340px,calc(100vw_-_2rem))] max-w-none overflow-hidden border-0 bg-chassis p-0 text-ink shadow-2xl backdrop:bg-well/70 backdrop:backdrop-blur-sm"
			class:right-drawer={!left}
		>
			<div class="flex h-full min-h-0 flex-col">
				<div class="flex items-center justify-between px-4 py-3">
					<h2 class="text-sm font-semibold">{label}</h2>
					<button
						type="button"
						aria-label={`Close ${label.toLowerCase()} drawer`}
						onclick={() => (open = false)}
						class="rounded-lg p-2 text-ink-muted hover:bg-layer-2"
						><Icon icon="mdi:close" width="20" height="20" /></button
					>
				</div>
				<div class="min-h-0 flex-1 overflow-y-auto pb-6">{@render children()}</div>
			</div>
		</dialog>
	{:else if open}
		<div class="flex min-h-0 flex-1 flex-col">
			<div class="flex items-center gap-2 pt-2 pr-2 pb-1 pl-4">
				<span class="flex-1 text-sm font-semibold text-ink">{label}</span>
				<button
					type="button"
					class="flex size-7 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-layer-2 hover:text-ink"
					aria-expanded="true"
					aria-label="Collapse {label.toLowerCase()}"
					title="Collapse"
					onclick={() => (open = false)}
				>
					<Icon icon={collapseIcon} width="16" height="16" />
				</button>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto pb-4">
				{@render children()}
			</div>
		</div>
	{:else}
		<nav aria-label="{label} sections" class="flex w-full flex-col items-center gap-1 py-1">
			<button
				type="button"
				class={iconBtn}
				aria-expanded="false"
				aria-label="Expand {label.toLowerCase()}"
				title="Expand"
				onclick={() => (open = true)}
			>
				<Icon icon={expandIcon} width="16" height="16" />
			</button>
			<span class="my-1 h-px w-6 bg-seam" aria-hidden="true"></span>
			{#each items as item (item.id)}
				<button
					type="button"
					class={iconBtn}
					aria-label={item.label}
					title={item.label}
					onclick={() => onpick(item.id)}
				>
					<Icon icon={item.icon} width="19" height="19" />
					{#if item.badge}
						<span
							class="absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold tabular-nums {tone[
								item.tone ?? 'advisory'
							]}"
						>
							{item.badge > 99 ? '99+' : item.badge}
						</span>
					{/if}
				</button>
			{/each}
		</nav>
	{/if}
</aside>

<style>
	.drawer {
		left: 0;
		right: auto;
	}
	.right-drawer {
		left: auto;
		right: 0;
	}
</style>

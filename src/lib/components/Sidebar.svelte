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
	}

	let { side, label, open = $bindable(), items, onpick, children }: Props = $props();

	const left = $derived(side === 'left');
	const collapseIcon = $derived(left ? 'mdi:chevron-double-left' : 'mdi:chevron-double-right');
	const expandIcon = $derived(left ? 'mdi:chevron-double-right' : 'mdi:chevron-double-left');
	const tone = { advisory: 'bg-advisory text-chassis', origin: 'bg-origin text-white' };

	const iconBtn =
		'relative flex size-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-layer-2 hover:text-ink';
</script>

<aside aria-label={label} class="flex min-h-0 min-w-0 flex-col overflow-hidden">
	{#if open}
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

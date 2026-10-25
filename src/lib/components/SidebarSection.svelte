<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/icons.js';

	interface Props {
		/** Used by the collapsed rail to scroll an expanded section into view. */
		id: string;
		title: string;
		icon: string;
		/** Short trailing text next to the title, such as a count. */
		meta?: string;
		open?: boolean;
		children: Snippet;
	}

	let { id, title, icon, meta, open = $bindable(true), children }: Props = $props();
</script>

<section id="section-{id}" class="scroll-mt-2 px-2">
	<h2>
		<button
			type="button"
			aria-expanded={open}
			aria-controls="section-{id}-body"
			onclick={() => (open = !open)}
			class="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-ink-muted transition-colors hover:bg-layer-1 hover:text-ink"
		>
			<Icon {icon} width="16" height="16" class="shrink-0 text-ink-faint group-hover:text-ink-muted" />
			<span class="flex-1 truncate">{title}</span>
			{#if meta}<span class="text-xs text-ink-faint tabular-nums">{meta}</span>{/if}
			<Icon
				icon="mdi:chevron-down"
				width="16"
				height="16"
				class="shrink-0 text-ink-faint transition-transform duration-200 motion-reduce:transition-none {open
					? ''
					: '-rotate-90'}"
			/>
		</button>
	</h2>
	<div id="section-{id}-body" hidden={!open} class="px-1 pt-0.5 pb-3">
		{@render children()}
	</div>
</section>

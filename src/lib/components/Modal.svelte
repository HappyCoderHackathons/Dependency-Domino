<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/icons.js';
	let { open = $bindable(false), title, children }: { open: boolean; title: string; children: Snippet } = $props();
	let dialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-label={title}
	onclose={() => (open = false)}
	class="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-chassis p-6 text-ink shadow-2xl ring-1 ring-seam backdrop:bg-well/80 backdrop:backdrop-blur-sm"
>
	<div class="mb-5 flex items-center justify-between gap-4">
		<h2 class="text-lg font-semibold">{title}</h2>
		<button
			type="button"
			aria-label={`Close ${title}`}
			onclick={() => (open = false)}
			class="rounded-lg p-2 text-ink-muted hover:bg-layer-2"
		>
			<Icon icon="mdi:close" width="18" height="18" />
		</button>
	</div>
	{@render children()}
</dialog>

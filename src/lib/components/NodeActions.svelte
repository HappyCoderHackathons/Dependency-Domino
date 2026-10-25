<script lang="ts">
	import { tick } from 'svelte';
	import { app } from '#lib/state.svelte.js';
	let menu: HTMLDivElement;
	let id = $state<string | null>(null);
	let point = $state({ x: 0, y: 0 });
	let restore: HTMLElement | null = null;
	let message = $state('');
	const node = $derived(id === null ? null : app.nodesById.get(id));
	export async function show(nodeId: string, x: number, y: number) {
		id = nodeId;
		point = { x, y };
		message = '';
		restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		await tick();
		if (!menu?.isConnected || !app.nodesById.has(nodeId)) return;
		menu.showPopover();
		const box = menu.getBoundingClientRect();
		point = {
			x: Math.max(8, Math.min(x, window.innerWidth - box.width - 8)),
			y: Math.max(8, Math.min(y, window.innerHeight - box.height - 8))
		};
		menu.querySelector<HTMLButtonElement>('button')?.focus();
	}
	function close(focus = false) {
		menu?.hidePopover();
		if (focus) restore?.focus();
	}
	function run(action: () => void) {
		close();
		action();
	}
	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			close(true);
			return;
		}
		const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			event.key === 'ArrowDown'
				? (at + 1) % buttons.length
				: event.key === 'ArrowUp'
					? (at - 1 + buttons.length) % buttons.length
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? buttons.length - 1
							: -1;
		if (next !== -1) {
			event.preventDefault();
			buttons[next]?.focus();
		}
		if (event.key === 'Tab') close();
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (menu?.matches(':popover-open') && event.target instanceof Node && !menu.contains(event.target)) close();
	}}
	onresize={() => close()}
/>
<div
	bind:this={menu}
	popover="manual"
	role="menu"
	aria-label="Package quick actions"
	tabindex="-1"
	onkeydown={keydown}
	style:left={`${point.x}px`}
	style:top={`${point.y}px`}
	class="node-menu fixed m-0 w-60 rounded-xl border-0 bg-chassis p-1.5 text-ink shadow-2xl ring-1 ring-seam"
>
	{#if node}
		<p class="truncate px-2 py-2 text-xs font-semibold text-ink-muted">{node.name}</p>
		<button
			role="menuitem"
			type="button"
			onclick={() =>
				run(() => {
					app.focus(node.id);
					app.simulate(node.id);
				})}>Simulate compromise</button
		>
		<button role="menuitem" type="button" onclick={() => run(() => app.focus(node.id))}>Focus package</button>
		<button
			role="menuitem"
			type="button"
			onclick={async () => {
				try {
					await navigator.clipboard.writeText(node.version ? `${node.name}@${node.version}` : node.name);
					message = 'Copied package identifier.';
				} catch {
					message = 'Copy failed. Clipboard access is unavailable.';
				}
			}}>Copy name@version</button
		>
		<button
			role="menuitem"
			type="button"
			onclick={() =>
				run(() => {
					app.focus(node.id);
					app.viewMode = 'dependents';
				})}>Show dependents only</button
		>
		<button
			role="menuitem"
			type="button"
			disabled={node.id === ''}
			onclick={() =>
				run(() => {
					app.focus(node.id);
					app.previewRemoval(node.id);
				})}>Preview removal</button
		>
		{#if message}<p role="status" class="px-2 py-2 text-xs text-downstream">{message}</p>{/if}
	{/if}
</div>

<style>
	.node-menu button {
		display: block;
		width: 100%;
		border-radius: 6px;
		padding: 8px;
		text-align: left;
		font-size: 13px;
	}
	.node-menu button:hover,
	.node-menu button:focus-visible {
		background: var(--color-layer-2);
		outline: 2px solid var(--color-downstream);
		outline-offset: -2px;
	}
	.node-menu button:disabled {
		opacity: 0.4;
	}
</style>

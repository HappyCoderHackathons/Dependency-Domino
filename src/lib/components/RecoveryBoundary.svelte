<script lang="ts">
	import type { Snippet } from 'svelte';
	import { app } from '#lib/state.svelte.js';
	import RecoveryPanel from './RecoveryPanel.svelte';
	let { children, onretry, ondemo }: { children: Snippet; onretry: () => void; ondemo: () => void } = $props();
</script>

{#if app.runtimeError}
	<RecoveryPanel message={app.runtimeError} {onretry} {ondemo} />
{:else}
	<svelte:boundary>
		{@render children()}
		{#snippet failed(_error, reset)}
			<RecoveryPanel
				message="The graph or a panel encountered an unexpected error. Your lockfile is still loaded."
				onretry={() => {
					onretry();
					reset();
				}}
				ondemo={() => {
					ondemo();
					reset();
				}}
			/>
		{/snippet}
	</svelte:boundary>
{/if}

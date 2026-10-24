<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '@iconify/svelte';
	import { app } from '#lib/state.svelte.ts';

    import { MAX_LOCKFILE_BYTES, parseLockfile } from '#lib/parser/lockfile.ts';

	let { children }: { children: Snippet } = $props();

	const MAX_BYTES = 10 * 1024 * 1024; // 10 MB; raise it if real lockfiles get rejected

	let input: HTMLInputElement;
	let dragDepth = $state(0); // counter avoids flicker when dragging over child elements
	let dragging = $derived(dragDepth > 0);

	/** Called by the top bar and empty state Import buttons. */
	export function open() {
		input.click();
	}

	function messageFrom(err: unknown): string {
		if (err instanceof SyntaxError) return "That file isn't valid JSON.";
		if (err instanceof Error) return err.message;
		if (typeof err === 'string') return err;
		return 'Could not read that file.';
	}

    async function importFile(file: File) {
        app.clearError();

        if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
            app.setError(`"${file.name}" is not a .json file. Choose a package-lock.json.`);
            return;
        }
        if (file.size > MAX_LOCKFILE_BYTES) {
            const mb = (file.size / 1024 / 1024).toFixed(1);
            app.setError(`That file is ${mb} MB, over the ${MAX_LOCKFILE_BYTES / 1024 / 1024} MB limit.`);
            return;
        }

        try {
            const text = await file.text(); // read in the browser; nothing is uploaded
            const result = parseLockfile(text);
            if (!result.ok) {
                app.setError(result.message); // previous graph stays on screen
                return;
            }
            const version = (JSON.parse(text) as { lockfileVersion?: number }).lockfileVersion ?? null;
            app.loadGraph(result.graph, file.name, version);
        } catch {
            app.setError('Could not read that file.');
        }
    }


	async function onPick(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = ''; // lets the user pick the same file again
		if (file) await importFile(file);
	}

	function hasFiles(e: DragEvent) {
		return e.dataTransfer?.types.includes('Files') ?? false;
	}

	function onDragEnter(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		dragDepth++;
	}

	function onDragOver(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault(); // required, otherwise the drop event never fires
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
	}

	function onDragLeave(e: DragEvent) {
		if (!hasFiles(e)) return;
		dragDepth = Math.max(0, dragDepth - 1);
	}

	function onDrop(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		dragDepth = 0;
		const file = e.dataTransfer?.files[0];
		if (file) importFile(file);
	}
</script>

<!-- Stops a file dropped outside the canvas from navigating the tab away and losing the graph. -->
<svelte:window
	ondragover={(e) => e.preventDefault()}
	ondrop={(e) => e.preventDefault()}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative h-full min-h-0 w-full min-w-0"
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	{@render children()}

	<input
		bind:this={input}
		type="file"
		accept=".json,application/json"
		class="hidden"
		onchange={onPick}
	/>

	{#if dragging}
		<div
			class="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-sky-500 bg-sky-50/90"
		>
			<p class="flex items-center gap-2 text-lg font-medium text-sky-700">
				<Icon icon="mdi:file-upload-outline" width="28" height="28" />
				Drop package-lock.json to import
			</p>
		</div>
	{/if}

	{#if app.error}
		<div
			role="alert"
			class="absolute inset-x-4 top-4 z-30 flex items-start gap-3 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 shadow"
		>
			<Icon icon="mdi:alert-circle-outline" width="20" height="20" class="mt-0.5 shrink-0" />
			<p class="flex-1">{app.error}</p>
			<button
				type="button"
				aria-label="Dismiss error"
				class="shrink-0 rounded p-0.5 hover:bg-rose-100"
				onclick={() => app.clearError()}
			>
				<Icon icon="mdi:close" width="18" height="18" />
			</button>
		</div>
	{/if}
</div>
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/icons.js';
	import { app } from '#lib/state.svelte.ts';
	import { LOCKFILE_ACCEPT, parseGitHubRepositoryUrl, SUPPORTED_LOCKFILES } from '#lib/parser/formats.js';
	import { importLockfile } from '#lib/parser/client.js';

	let { children }: { children: Snippet } = $props();

	let input: HTMLInputElement;
	let dragDepth = $state(0); // counter avoids flicker when dragging over child elements
	let dragging = $derived(dragDepth > 0);
	let repositoryUrl = $state('');
	let repositoryOpen = $state(false);
	let repositoryLoading = $state(false);
	let importing = $state<string | null>(null); // file name while the worker parses it
	let importRequest = 0; // only the latest import may replace the graph

	export function cancelPending() {
		importRequest++;
		importing = null;
		repositoryLoading = false;
		repositoryOpen = false;
		repositoryUrl = '';
		dragDepth = 0;
	}

	export function isRepositoryOpen() {
		return repositoryOpen;
	}

	/** Called by the top bar and empty state Import buttons. */
	export function open() {
		input.click();
	}

	export function openRepository() {
		repositoryOpen = true;
		repositoryUrl = '';
		app.clearError();
	}

	async function importFile(file: File) {
		app.clearError();
		const request = ++importRequest;
		importing = file.name;
		const result = await importLockfile({ kind: 'file', file });
		if (request !== importRequest) return;
		importing = null;
		if (!result.ok) {
			app.setError(result.message); // previous graph stays on screen
			return;
		}
		app.loadGraph(result.graph, `${file.name} (${result.format})`, result.lockfileVersion);
	}

	async function onPick(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = ''; // lets the user pick the same file again
		if (file) await importFile(file);
	}

	async function importRepository() {
		const repository = parseGitHubRepositoryUrl(repositoryUrl);
		if (!repository) {
			app.setError('Enter a GitHub repository URL such as https://github.com/owner/repository.');
			return;
		}
		repositoryLoading = true;
		app.clearError();
		const request = ++importRequest;
		importing = null;
		const result = await importLockfile({ kind: 'repository', url: repositoryUrl });
		if (request !== importRequest) return;
		repositoryLoading = false;
		if (!result.ok) {
			app.setError(result.message);
			return;
		}
		repositoryOpen = false;
		app.loadGraph(
			result.graph,
			`${repository.owner}/${repository.repository} (${result.filename})`,
			result.lockfileVersion
		);
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
<svelte:window ondragover={(e) => e.preventDefault()} ondrop={(e) => e.preventDefault()} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative h-full min-h-0 w-full min-w-0"
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	{@render children()}

	<input bind:this={input} type="file" accept={LOCKFILE_ACCEPT} class="hidden" onchange={onPick} />

	{#if repositoryOpen}
		<div class="absolute inset-0 z-30 flex items-center justify-center bg-well/80 p-6 backdrop-blur-sm">
			<form
				class="w-full max-w-lg rounded-xl bg-chassis p-5 shadow-2xl ring-1 ring-seam"
				onsubmit={(event) => {
					event.preventDefault();
					void importRepository();
				}}
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<h2 class="text-base font-semibold text-ink">Import from GitHub</h2>
						<p class="mt-1 text-sm text-ink-muted">
							Looks for npm, pnpm, Yarn, or Bun lockfiles at the repository root on its default branch.
						</p>
					</div>
					<button
						type="button"
						aria-label="Close GitHub import"
						class="rounded p-1 text-ink-faint hover:bg-layer-2 hover:text-ink"
						onclick={() => (repositoryOpen = false)}
					>
						<Icon icon="mdi:close" width="18" height="18" />
					</button>
				</div>
				<label class="mt-5 block text-sm font-medium text-ink" for="github-repository-url">Repository URL</label>
				<input
					id="github-repository-url"
					class="mt-1.5 w-full rounded-lg border-0 bg-layer-2 px-3 py-2 text-sm text-ink ring-1 ring-seam placeholder:text-ink-faint focus:ring-downstream"
					type="url"
					bind:value={repositoryUrl}
					placeholder="https://github.com/owner/repository"
					autocomplete="url"
					disabled={repositoryLoading}
					required
				/>
				<p class="mt-2 text-xs text-ink-faint">
					Only a public GitHub repository URL is accepted. The file stays in browser memory.
				</p>
				<div class="mt-5 flex justify-end gap-2">
					<button
						type="button"
						class="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-layer-2 hover:text-ink"
						onclick={() => (repositoryOpen = false)}
						disabled={repositoryLoading}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-chassis hover:bg-white disabled:cursor-wait disabled:opacity-60"
						disabled={repositoryLoading}
					>
						{#if repositoryLoading}
							<Icon icon="mdi:loading" width="18" height="18" class="animate-spin" />
							Fetching...
						{:else}
							<Icon icon="mdi:github" width="18" height="18" />
							Fetch lockfile
						{/if}
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if importing}
		<div
			role="status"
			class="absolute inset-x-4 top-4 z-20 mx-auto flex w-fit max-w-xl items-center gap-2 rounded-full bg-chassis px-4 py-2 text-sm text-ink-muted shadow-2xl ring-1 ring-seam"
		>
			<Icon icon="mdi:loading" width="16" height="16" class="animate-spin text-downstream" />
			Reading <span class="max-w-64 truncate font-medium text-ink">{importing}</span>
		</div>
	{/if}

	{#if dragging}
		<div
			class="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-downstream bg-well/90 backdrop-blur-sm"
		>
			<p class="flex items-center gap-2 text-lg font-medium text-downstream">
				<Icon icon="mdi:file-upload-outline" width="28" height="28" />
				Drop {SUPPORTED_LOCKFILES} to import
			</p>
		</div>
	{/if}

	{#if app.error}
		<div
			role="alert"
			class="absolute inset-x-4 top-16 z-30 mx-auto flex max-w-xl items-start gap-3 rounded-xl bg-chassis p-3 text-sm text-ink shadow-2xl ring-1 ring-origin/60"
		>
			<Icon icon="mdi:alert-circle-outline" width="20" height="20" class="mt-0.5 shrink-0 text-origin" />
			<p class="flex-1">{app.error}</p>
			<button
				type="button"
				aria-label="Dismiss error"
				class="shrink-0 rounded p-0.5 text-ink-faint hover:bg-layer-2 hover:text-ink"
				onclick={() => app.clearError()}
			>
				<Icon icon="mdi:close" width="18" height="18" />
			</button>
		</div>
	{/if}
</div>

<script lang="ts">
	import Modal from './Modal.svelte';
	let { howOpen = $bindable(false), shortcutsOpen = $bindable(false) }: { howOpen: boolean; shortcutsOpen: boolean } =
		$props();
	const shortcuts = [
		['/', 'Focus package search'],
		['S', 'Simulate the selected package'],
		['Esc', 'Clear selection, then simulation'],
		['F', 'Fit graph to view'],
		['I', 'Frame simulated impact'],
		['[', 'Toggle overview sidebar'],
		[']', 'Toggle package sidebar'],
		['?', 'Show keyboard shortcuts']
	];
</script>

<Modal bind:open={howOpen} title="How it works">
	<div class="space-y-4 text-sm leading-relaxed text-ink-muted">
		<p>
			<strong class="text-ink">Start with a lockfile.</strong> Each node represents an installed package instance. Two copies
			of the same package can have different dependencies and appear separately. Arrows point from a consumer to its dependency.
		</p>
		<p>
			<strong class="text-ink">Try a hypothetical compromise.</strong> Select a package and simulate assuming it is untrustworthy.
			The trace follows recorded dependencies in reverse to find packages that rely on it. This does not prove vulnerable
			code is reachable or exploitable.
		</p>
		<p>
			<strong class="text-advisory">Known advisories are separate.</strong> OSV matches exact package names and versions against
			published records. An advisory match does not establish that your project uses the vulnerable code. A failed lookup
			does not mean a package is safe.
		</p>
		<p>
			<strong class="text-ink">Your lockfile stays in browser memory.</strong> Only validated package names and versions go
			to the advisory endpoint. Public GitHub imports download lockfiles directly from GitHub. Closing the lockfile clears
			the current analysis.
		</p>
		<div class="flex flex-wrap gap-4 text-downstream">
			<a
				class="underline"
				href="https://github.com/YoyoJesus/Dependency-Domino/blob/main/docs/lockfile-formats.md"
				target="_blank"
				rel="noreferrer">Supported formats and limitations</a
			>
			<a
				class="underline"
				href="https://github.com/YoyoJesus/Dependency-Domino/blob/main/docs/reports.md"
				target="_blank"
				rel="noreferrer">Report documentation</a
			>
		</div>
	</div>
</Modal>

<Modal bind:open={shortcutsOpen} title="Keyboard shortcuts">
	<dl class="space-y-2">
		{#each shortcuts as [key, description]}
			<div class="flex items-center justify-between gap-6 rounded-lg bg-layer-1 px-3 py-2">
				<dt class="text-sm text-ink-muted">{description}</dt>
				<dd><kbd class="rounded bg-layer-3 px-2 py-1 font-mono text-xs">{key}</kbd></dd>
			</div>
		{/each}
	</dl>
	<p class="mt-4 text-xs text-ink-muted">
		Shortcuts pause while typing or using menus and dialogs. Escape closes an open menu or dialog first.
	</p>
</Modal>

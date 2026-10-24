<script lang="ts">
	import Icon from '@iconify/svelte';

	interface Props {
		onimport: () => void;
		ondemo: () => void;
	}

	let { onimport, ondemo }: Props = $props();
</script>

<!-- Overlays the canvas until a graph is loaded; the parent region must be `relative`. -->
<div class="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 p-6">
	<div class="max-w-md text-center">
		<h2 class="text-xl font-semibold text-slate-900">One compromised package. How far does it fall?</h2>
		<p class="mt-3 text-slate-600">
			Import an npm, pnpm, Yarn, or Bun text lockfile to see how far a hypothetical compromise of one package could
			spread.
		</p>

		<div class="mt-6 flex justify-center gap-3">
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
				onclick={onimport}
			>
				<Icon icon="mdi:upload" width="18" height="18" />
				Import Lockfile
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
				onclick={ondemo}
			>
				<Icon icon="mdi:play" width="18" height="18" />
				Try Demo
			</button>
		</div>

		<p class="mt-6 text-xs text-slate-500">
			Uploaded lockfiles stay in browser memory. Nothing is stored, and the app never installs or executes package code.
		</p>
	</div>
</div>

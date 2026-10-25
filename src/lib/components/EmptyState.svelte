<script lang="ts">
	import Icon from '#lib/icons.js';
	import BrandLogo from '#lib/components/BrandLogo.svelte';
	import { SUPPORTED_LOCKFILES } from '#lib/parser/formats.js';
	import { DEMOS, type DemoId } from '#lib/demos.js';

	interface Props {
		onimport: () => void;
		onrepository: () => void;
		ondemo: (id: DemoId) => void;
	}

	let { onimport, onrepository, ondemo }: Props = $props();
</script>

<!-- Overlays the canvas until a graph is loaded; the parent region must be `relative`. -->
<div class="absolute inset-0 z-10 flex items-center justify-center p-6">
	<div class="w-full max-w-md min-w-0 text-center">
		<BrandLogo variant="mark" class="mx-auto size-20" />
		<h2 class="mt-5 text-2xl font-semibold tracking-tight text-balance text-ink">
			One compromised package. How far does it fall?
		</h2>
		<p class="mt-3 text-pretty text-ink-muted">
			Import a lockfile to map every installed package, then pick one and watch everything that depends on it light up.
		</p>

		<div class="mt-7 flex flex-wrap justify-center gap-2">
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-chassis transition-colors hover:bg-white"
				onclick={onimport}
			>
				<Icon icon="mdi:tray-arrow-up" width="18" height="18" />
				Import lockfile
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-lg bg-layer-2 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-layer-3"
				onclick={onrepository}
			>
				<Icon icon="mdi:github" width="18" height="18" />
				GitHub URL
			</button>
		</div>

		<div class="mt-5 grid gap-2 sm:grid-cols-2" role="group" aria-label="Try a demo">
			{#each DEMOS as demo (demo.id)}
				<button
					type="button"
					class="flex items-start gap-2 rounded-lg bg-layer-1 px-3 py-2.5 text-left ring-1 ring-seam transition-colors hover:bg-layer-2"
					onclick={() => ondemo(demo.id)}
				>
					<Icon icon="mdi:play-outline" width="18" height="18" class="mt-px shrink-0 text-ink-muted" />
					<span class="min-w-0">
						<span class="block text-sm font-medium text-ink">{demo.label}</span>
						<span class="block text-xs text-ink-faint">{demo.description}</span>
					</span>
				</button>
			{/each}
		</div>

		<p class="mt-4 text-xs text-ink-faint">Accepts {SUPPORTED_LOCKFILES}, or drop one anywhere on the canvas.</p>
		<p class="mt-8 flex items-start justify-center gap-1.5 text-xs text-ink-faint">
			<Icon icon="mdi:lock-outline" width="14" height="14" class="mt-px shrink-0" />
			Lockfiles stay in browser memory. Nothing is stored, and no package code is installed or run.
		</p>
	</div>
</div>

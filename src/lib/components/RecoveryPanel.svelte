<script lang="ts">
	import Icon from '#lib/icons.js';
	let { message, onretry, ondemo }: { message: string; onretry: () => void; ondemo: () => void } = $props();
</script>

<div role="alert" class="col-span-full flex min-h-0 items-center justify-center overflow-auto rounded-xl bg-well p-6">
	<div class="max-w-md space-y-4 rounded-xl bg-chassis p-6 ring-1 ring-seam">
		<Icon icon="mdi:alert-circle-outline" width="28" height="28" class="text-cascade" />
		<h2 class="text-lg font-semibold text-ink">The workspace needs to restart</h2>
		<p class="text-sm text-ink-muted">{message}</p>
		<p class="text-xs text-ink-muted">
			Try again keeps the current lockfile and clears the simulation. Reload demo replaces the current analysis with the
			bundled example.
		</p>
		<div class="flex flex-wrap gap-2">
			<button type="button" class="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-chassis" onclick={onretry}
				>Try again</button
			>
			<button type="button" class="rounded-lg bg-layer-2 px-3 py-2 text-sm font-medium text-ink" onclick={ondemo}
				>Reload demo</button
			>
		</div>
	</div>
</div>

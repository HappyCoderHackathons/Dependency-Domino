<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import ComboBox from '#lib/components/ComboBox.svelte';

	const options = [
		{ key: 'hideDev', label: 'Hide development packages', hint: 'Show the runtime picture only' },
		{ key: 'directOnly', label: 'Direct dependencies only', hint: 'What the project chose, not what it inherited' }
	] as const;

	const hiddenCount = $derived(app.hasGraph ? (app.graph?.nodes.length ?? 0) - app.visibleIds.size : 0);
</script>

<ul class="space-y-1">
	{#each options as option (option.key)}
		<li>
			<label
				class="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-layer-1 has-disabled:cursor-not-allowed has-disabled:opacity-50"
			>
				<input
					type="checkbox"
					role="switch"
					bind:checked={app.filters[option.key]}
					disabled={!app.hasGraph}
					class="peer sr-only"
				/>
				<span
					aria-hidden="true"
					class="relative mt-0.5 h-4 w-7 shrink-0 rounded-full bg-layer-3 transition-colors peer-checked:bg-downstream peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-downstream after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-ink after:transition-transform peer-checked:after:translate-x-3 peer-checked:after:bg-chassis"
				></span>
				<span class="min-w-0">
					<span class="block text-sm text-ink">{option.label}</span>
					<span class="block text-xs text-ink-faint">{option.hint}</span>
				</span>
			</label>
		</li>
	{/each}
</ul>
<div class="mt-3 space-y-2 rounded-lg bg-layer-1 p-3">
	<label for="graph-labels" class="block text-xs font-medium text-ink-muted">Package labels</label>
	<ComboBox
		id="graph-labels"
		label="Package labels"
		bind:value={app.labelMode}
		disabled={!app.hasGraph}
		options={[
			{ value: 'name-version', label: 'Name and version' },
			{ value: 'name', label: 'Name only' }
		] as const}
	/>
	<p class="text-xs text-ink-faint">Different versions of the same name keep their versions.</p>
</div>
<div class="mt-3 space-y-2 rounded-lg bg-layer-1 p-3">
	<label for="graph-view" class="block text-xs font-medium text-ink-muted">Canvas view</label>
	<ComboBox
		id="graph-view"
		label="Canvas view"
		bind:value={app.viewMode}
		disabled={!app.hasGraph}
		options={[
			{ value: 'all', label: 'Overview' },
			{ value: 'neighborhood', label: 'Selected neighborhood', disabled: !app.selectedNode },
			{ value: 'dependents', label: 'Selected dependents only', disabled: !app.selectedNode },
			{ value: 'impact', label: 'Simulated impact only', disabled: !app.impact }
		] as const}
	/>
	{#if app.viewMode === 'neighborhood'}
		<label for="neighborhood-hops" class="block text-xs text-ink-muted">Distance from selection</label>
		<ComboBox
			id="neighborhood-hops"
			label="Distance from selection"
			bind:value={app.neighborhoodHops}
			options={[1, 2, 3, 4].map((value) => ({ value, label: `${value} ${value === 1 ? 'hop' : 'hops'}` }))}
		/>
		<label for="neighborhood-direction" class="block text-xs text-ink-muted">Follow edges toward</label>
		<ComboBox
			id="neighborhood-direction"
			label="Follow edges toward"
			bind:value={app.neighborhoodDirection}
			options={[
				{ value: 'both', label: 'Dependencies and dependents' },
				{ value: 'dependencies', label: 'Dependencies' },
				{ value: 'dependents', label: 'Dependents' }
			] as const}
		/>
	{/if}
</div>
{#if hiddenCount > 0}
	<p class="mt-2 px-2 text-xs text-ink-faint">
		{hiddenCount.toLocaleString()} hidden from the canvas. Simulations still use every package.
	</p>
{/if}

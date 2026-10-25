<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import type { ImpactRank } from '#lib/graph/ranking.js';

	let results = $state.raw<ImpactRank[]>([]);
	let status = $state<'loading' | 'complete' | 'failed'>('loading');
	let retry = $state(0);
	// Advisory updates replace nodes but keep the edge array. Cache counts across those metadata changes.
	const cache = new WeakMap<object, { ids: string; results: ImpactRank[] }>();
	$effect(() => {
		const graph = app.graph;
		void retry;
		if (!graph) {
			results = [];
			status = 'complete';
			return;
		}
		const ids = JSON.stringify(graph.nodes.map((node) => node.id));
		const cached = cache.get(graph.edges);
		if (cached?.ids === ids) {
			results = cached.results;
			status = 'complete';
			return;
		}
		results = [];
		status = 'loading';
		let worker: Worker;
		try {
			worker = new Worker(new URL('../graph/ranking.worker.ts', import.meta.url), { type: 'module' });
		} catch {
			status = 'failed';
			return;
		}
		worker.onmessage = ({ data }: MessageEvent<ImpactRank[]>) => {
			cache.set(graph.edges, { ids, results: data });
			results = data;
			status = 'complete';
			worker.terminate();
		};
		worker.onerror = () => {
			status = 'failed';
			worker.terminate();
		};
		worker.postMessage(graph);
		return () => worker.terminate();
	});

	function simulate(id: string) {
		if (!app.graph) return;
		app.focus(id);
		app.simulate(id);
	}
</script>

{#if !app.hasGraph}
	<p class="px-2 text-sm text-ink-faint">Load a lockfile to find packages with the most dependents.</p>
{:else if status === 'loading'}
	<p role="status" class="px-2 text-sm text-ink-muted">Counting dependent instances…</p>
{:else if status === 'failed'}
	<p class="px-2 text-sm text-ink-muted">Dependent counts could not be calculated.</p>
	<button
		type="button"
		onclick={() => retry++}
		class="mt-2 rounded bg-layer-2 px-3 py-1.5 text-xs text-ink hover:bg-layer-3">Try again</button
	>
{:else}
	<p class="mb-2 px-2 text-xs text-ink-faint">
		Top 10 by direct or indirect dependent instances. Counts use the full graph.
	</p>
	<ol aria-label="Packages with the most dependents" class="space-y-1">
		{#each results as result (result.id)}
			{@const node = app.nodesById.get(result.id)}
			<li class="flex items-center gap-1 rounded-md hover:bg-layer-1">
				<button
					type="button"
					onclick={() => app.focus(result.id)}
					class="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left"
					title={result.id}
				>
					<span class="block truncate text-sm text-ink">{node?.name ?? result.id}</span>
					<span class="block font-mono text-xs text-ink-faint">{node?.version ?? 'unknown version'}</span>
					<span class="text-xs text-ink-muted"
						>{result.dependentCount.toLocaleString()}
						{result.dependentCount === 1 ? 'dependent instance' : 'dependent instances'}</span
					>
				</button>
				<button
					type="button"
					onclick={() => simulate(result.id)}
					aria-label={`Simulate compromise of ${node?.name ?? result.id} at ${result.id}`}
					class="shrink-0 rounded-md bg-layer-2 px-2 py-1.5 text-xs text-origin hover:bg-layer-3">Simulate</button
				>
			</li>
		{/each}
	</ol>
	{#if results.length === 0}<p class="px-2 text-sm text-ink-faint">
			No installed package instances were recorded.
		</p>{/if}
{/if}

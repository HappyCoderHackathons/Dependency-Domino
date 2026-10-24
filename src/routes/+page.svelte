<script lang="ts">
	import { app } from '#lib/state.svelte.ts';
	import TopBar from '#lib/components/TopBar.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import DependencyGraph from '#lib/components/DependencyGraph.svelte';
	import UploadPanel from '#lib/components/UploadPanel.svelte';
	import demoLockfile from '#lib/fixtures/demo-lockfile.json';
	import { parseLockfile } from '#lib/parser/lockfile.js';
	import PackageDetails from '#lib/components/PackageDetails.svelte';
	import SearchPanel from '#lib/components/SearchPanel.svelte';
	import ImpactSummary from '#lib/components/ImpactSummary.svelte';
	import Legend from '#lib/components/Legend.svelte';
	import StatusBar from '#lib/components/StatusBar.svelte';

	// Stub handlers. Replaced by #39/#40 (import) and #42 (demo).
	let upload: ReturnType<typeof UploadPanel>;

	function handleImport() {
		upload?.open();
	}
	
	function handleDemo() {
		const result = parseLockfile(JSON.stringify(demoLockfile));
		if (result.ok) app.loadGraph(result.graph, 'demo (bundled)');
		else app.setError(result.message);
	}

	function handleReset() {
		app.reset();
	}


	const sectionTitle = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
</script>

<!--
	Rows: top bar | body (fills remaining space) | footer.
	Columns: left sidebar | canvas | right sidebar.
	`min-h-0` / `min-w-0` let the middle row and canvas shrink, so Cytoscape gets a real height.
-->
<div class="grid h-screen grid-cols-[300px_minmax(0,1fr)_300px] grid-rows-[auto_minmax(0,1fr)_auto] bg-slate-100 text-slate-800">
	<TopBar
		canReset={app.hasGraph}
		onimport={handleImport}
		ondemo={handleDemo}
		onreset={handleReset}
	/>

	<!-- Left sidebar -->
	<aside class="min-h-0 space-y-6 overflow-y-auto border-r border-slate-200 bg-white p-4">
		<section>
			<h2 class={sectionTitle}>Search</h2>
			<SearchPanel />
		</section>
		<section>
			<h2 class={sectionTitle}>Filters</h2>
			<p class="mt-2 text-sm text-slate-400">Filters placeholder</p>
		</section>
		<section>
			<h2 class={sectionTitle}>Summary</h2>
			<p class="mt-2 text-sm text-slate-400">Graph summary placeholder</p>
		</section>
		<section>
			<h2 class={sectionTitle}>Legend</h2>
			<Legend />
		</section>
	</aside>

	<!-- Main canvas -->
	<main class="min-h-0 min-w-0 bg-white">
		<UploadPanel bind:this={upload}>
			<DependencyGraph />
			{#if !app.hasGraph}
				<EmptyState onimport={handleImport} ondemo={handleDemo} />
			{/if}
		</UploadPanel>
	</main>

	<!-- Right sidebar -->
	<aside class="min-h-0 space-y-6 overflow-y-auto border-l border-slate-200 bg-white p-4">
		<section>
			<h2 class={sectionTitle}>Package details</h2>
			<PackageDetails />
		</section>
	<section>
		<h2 class={sectionTitle}>Results</h2>
		<ImpactSummary />
	</section>
		<section>
			<h2 class={sectionTitle}>Known advisories</h2>
			<p class="mt-2 text-sm text-slate-400">Advisories placeholder (P1)</p>
		</section>
	</aside>

	<!-- Footer -->
	<StatusBar />
</div>
<script lang="ts">
	import { onMount, tick } from 'svelte';
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
	import KnownAdvisories from '#lib/components/KnownAdvisories.svelte';
	import AdvisoryList from '#lib/components/AdvisoryList.svelte';
	import GraphSummary from '#lib/components/GraphSummary.svelte';
	import ImpactRanking from '#lib/components/ImpactRanking.svelte';
	import ViewFilters from '#lib/components/ViewFilters.svelte';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import type { RailItem } from '#lib/components/Sidebar.svelte';
	import SidebarSection from '#lib/components/SidebarSection.svelte';
	import { filtersActive } from '#lib/graph/view.js';
	import { simulateCompromise } from '#lib/graph/impact.js';
	import Modal from '#lib/components/Modal.svelte';
	import ExplorationHelp from '#lib/components/ExplorationHelp.svelte';

	let upload = $state<ReturnType<typeof UploadPanel>>();
	let graphCanvas = $state<ReturnType<typeof DependencyGraph>>();
	let howOpen = $state(false);
	let shortcutsOpen = $state(false);
	let closeOpen = $state(false);
	let workspaceEpoch = $state(0);

	function closeLockfile() {
		upload?.cancelPending();
		app.closeGraph();
		workspaceEpoch++;
		closeOpen = false;
	}

	function requestClose() {
		if (app.impact) closeOpen = true;
		else closeLockfile();
	}

	async function onShortcut(event: KeyboardEvent) {
		if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
			return;
		const target = event.target;
		if (
			target instanceof Element &&
			target.closest(
				'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="listbox"], [role="menu"]'
			)
		)
			return;
		if (document.querySelector('dialog[open], [popover]:popover-open') || upload?.isRepositoryOpen()) return;
		const key = event.key.toLowerCase();
		if (key === '?') shortcutsOpen = true;
		else if (key === '[') leftOpen = !leftOpen;
		else if (key === ']') rightOpen = !rightOpen;
		else if (!app.hasGraph) return;
		else if (key === '/') {
			event.preventDefault();
			leftOpen = true;
			left.search = true;
			await tick();
			document.getElementById('package-search')?.focus();
		} else if (key === 's' && app.selectedId !== null && app.graph) {
			app.setImpact(simulateCompromise(app.graph, app.selectedId));
		} else if (key === 'escape') {
			if (app.selectedId !== null) app.select(null);
			else app.clearSimulation();
		} else if (key === 'f') graphCanvas?.fitView();
		else if (key === 'i') graphCanvas?.frameImpact();
		else return;
		event.preventDefault();
	}

	function handleImport() {
		upload?.open();
	}

	function handleRepositoryImport() {
		upload?.openRepository();
	}

	function handleDemo() {
		const result = parseLockfile(JSON.stringify(demoLockfile));
		if (result.ok) app.loadGraph(result.graph, 'demo (bundled)');
		else app.setError(result.message);
	}

	function handleReset() {
		app.reset();
	}

	let leftOpen = $state(true);
	let rightOpen = $state(true);
	const left = $state({ search: true, view: true, summary: true, ranking: false, advisories: true, legend: false });
	const right = $state({ package: true, 'pkg-advisories': true, impact: true });

	// Narrow screens start with both sidebars on the icon rail so the graph gets the room.
	onMount(() => {
		if (window.innerWidth < 1100) leftOpen = rightOpen = false;
	});

	async function pick(sections: Record<string, boolean>, id: string, setOpen: () => void) {
		setOpen();
		sections[id] = true;
		await tick();
		document.getElementById(`section-${id}`)?.scrollIntoView({ block: 'start' });
		document.querySelector<HTMLInputElement>(`#section-${id} input`)?.focus();
	}

	const leftRail = $derived<RailItem[]>([
		{ id: 'search', icon: 'mdi:magnify', label: 'Search' },
		{ id: 'view', icon: 'mdi:filter-variant', label: 'View filters', badge: filtersActive(app.filters) ? 1 : 0 },
		{ id: 'summary', icon: 'mdi:counter', label: 'Graph summary' },
		{ id: 'ranking', icon: 'mdi:counter', label: 'Most dependents' },
		{ id: 'advisories', icon: 'mdi:shield-alert-outline', label: 'Known advisories', badge: app.advisoryInstanceCount },
		{ id: 'legend', icon: 'mdi:palette-swatch-outline', label: 'Legend' }
	]);

	const rightRail = $derived<RailItem[]>([
		{ id: 'package', icon: 'mdi:package-variant-closed', label: 'Package' },
		{
			id: 'pkg-advisories',
			icon: 'mdi:shield-search',
			label: 'Package advisories',
			badge: app.selectedNode?.advisoryIds.length ?? 0
		},
		{
			id: 'impact',
			icon: 'mdi:alert-octagon-outline',
			label: 'Simulation',
			badge: app.impact
				? app.impact.ancestorIds.filter((id) => !(app.impact?.originIds ?? [app.impact?.originId]).includes(id)).length
				: 0,
			tone: 'origin'
		}
	]);

	const impactMeta = $derived(
		app.impact
			? `${app.impact.ancestorIds.filter((id) => !(app.impact?.originIds ?? [app.impact?.originId]).includes(id)).length} affected`
			: ''
	);
</script>

<svelte:window onkeydown={onShortcut} />

<ExplorationHelp bind:howOpen bind:shortcutsOpen />
<Modal bind:open={closeOpen} title="Close the current lockfile?">
	<p class="text-sm text-ink-muted">
		This clears the active simulation and current analysis from browser memory. Export a report first if you want to
		keep the result.
	</p>
	<div class="mt-5 flex justify-end gap-2">
		<button type="button" class="rounded-lg bg-layer-2 px-3 py-2 text-sm text-ink" onclick={() => (closeOpen = false)}
			>Keep working</button
		>
		<button
			type="button"
			class="rounded-lg bg-origin px-3 py-2 text-sm font-semibold text-white"
			onclick={closeLockfile}>Close lockfile</button
		>
	</div>
</Modal>

<!--
	Rows: top bar | body (fills remaining space) | footer.
	Columns: overview sidebar | canvas | package sidebar. A collapsed sidebar becomes a 52px icon rail.
	`min-h-0` / `min-w-0` let the middle row and canvas shrink, so Cytoscape gets a real height.
-->
<div
	class="shell grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto]"
	style:--left={leftOpen ? '272px' : '52px'}
	style:--right={rightOpen ? '320px' : '52px'}
>
	<TopBar
		canReset={app.hasGraph}
		onimport={handleImport}
		onrepository={handleRepositoryImport}
		ondemo={handleDemo}
		onreset={handleReset}
		onclose={requestClose}
		onhelp={() => (howOpen = true)}
		onshortcuts={() => (shortcutsOpen = true)}
	/>

	{#key workspaceEpoch}
		<Sidebar
			side="left"
			label="Overview"
			bind:open={leftOpen}
			items={leftRail}
			onpick={(id) => pick(left, id, () => (leftOpen = true))}
		>
			<SidebarSection id="search" title="Search" icon="mdi:magnify" bind:open={left.search}>
				<SearchPanel />
			</SidebarSection>
			<SidebarSection
				id="view"
				title="View"
				icon="mdi:filter-variant"
				meta={filtersActive(app.filters) ? 'Filtered' : undefined}
				bind:open={left.view}
			>
				<ViewFilters />
			</SidebarSection>
			<SidebarSection id="summary" title="Graph summary" icon="mdi:counter" bind:open={left.summary}>
				<GraphSummary />
			</SidebarSection>
			<SidebarSection id="ranking" title="Most dependents" icon="mdi:counter" bind:open={left.ranking}>
				<ImpactRanking />
			</SidebarSection>
			<SidebarSection
				id="advisories"
				title="Known advisories"
				icon="mdi:shield-alert-outline"
				meta={app.advisoryInstanceCount > 0 ? String(app.advisoryInstanceCount) : undefined}
				bind:open={left.advisories}
			>
				<AdvisoryList />
			</SidebarSection>
			<SidebarSection id="legend" title="Legend" icon="mdi:palette-swatch-outline" bind:open={left.legend}>
				<Legend />
			</SidebarSection>
		</Sidebar>

		<main class="min-h-0 min-w-0 overflow-hidden rounded-xl ring-1 ring-seam">
			<UploadPanel bind:this={upload}>
				<DependencyGraph bind:this={graphCanvas} />
				{#if !app.hasGraph}
					<EmptyState onimport={handleImport} onrepository={handleRepositoryImport} ondemo={handleDemo} />
				{/if}
			</UploadPanel>
		</main>

		<Sidebar
			side="right"
			label="Package"
			bind:open={rightOpen}
			items={rightRail}
			onpick={(id) => pick(right, id, () => (rightOpen = true))}
		>
			<SidebarSection id="package" title="Details" icon="mdi:package-variant-closed" bind:open={right.package}>
				<PackageDetails />
			</SidebarSection>
			{#if app.selectedNode}
				<SidebarSection
					id="pkg-advisories"
					title="Known advisories"
					icon="mdi:shield-search"
					bind:open={right['pkg-advisories']}
				>
					<KnownAdvisories />
				</SidebarSection>
			{/if}
			<SidebarSection
				id="impact"
				title="Simulation"
				icon="mdi:alert-octagon-outline"
				meta={impactMeta}
				bind:open={right.impact}
			>
				<ImpactSummary />
			</SidebarSection>
		</Sidebar>
	{/key}

	<StatusBar />
</div>

<style>
	.shell {
		grid-template-columns: var(--left) minmax(0, 1fr) var(--right);
		transition: grid-template-columns 250ms var(--ease-drawer);
	}

	@media (prefers-reduced-motion: reduce) {
		.shell {
			transition: none;
		}
	}
</style>

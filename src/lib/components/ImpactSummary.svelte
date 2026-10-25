<script lang="ts">
	import Icon from '#lib/icons.js';
	import { app } from '#lib/state.svelte.ts';
	import { impactMetrics } from '#lib/graph/metrics.js';
	import { buildSimulationReport, reportToJson } from '#lib/report/report.js';
	import { downloadReport } from '#lib/report/download.js';
	import type { ReportFormat } from '#lib/report/download.js';
	import { reportToMarkdown } from '#lib/report/markdown.js';
	import { simulateCompromise } from '#lib/graph/impact.js';
	import AffectedPackages from '#lib/components/AffectedPackages.svelte';

	let exportError = $state<string | null>(null);
	$effect(() => {
		if (app.impact) exportError = null;
	});
	function exportReport(format: ReportFormat) {
		exportError = null;
		if (!app.graph || !app.impact) return;
		try {
			const report = buildSimulationReport(app.graph, app.impact, {
				generatedAt: new Date().toISOString(),
				sourceLabel: app.sourceLabel,
				advisoryLookupStatus: app.osvStatus,
				warnings: app.warnings
			});
			downloadReport(format === 'json' ? reportToJson(report) : reportToMarkdown(report), format);
		} catch {
			exportError = 'Could not export this report. Run the simulation and try again.';
		}
	}

	const impact = $derived(app.impact);
	const metrics = $derived(app.graph && impact ? impactMetrics(app.graph, impact) : null);
	const isRootOrigin = $derived(impact ? (impact.originIds ?? [impact.originId]).every((id) => id === '') : false);
	const path = $derived(impact?.samplePaths[0] ?? []);
	const originNames = $derived(
		(impact?.originIds ?? (impact ? [impact.originId] : [])).map((id) => node(id)?.name ?? 'this package')
	);

	// Long chains keep both ends visible and fold the middle hops until asked.
	const CHAIN_EDGE = 3;
	let chainExpanded = $state(false);
	$effect(() => {
		void impact;
		chainExpanded = false;
	});
	const folded = $derived(!chainExpanded && path.length > CHAIN_EDGE * 2 + 2);
	const steps = $derived(
		folded ? [...path.slice(0, CHAIN_EDGE), null, ...path.slice(-CHAIN_EDGE)] : (path as (string | null)[])
	);

	function node(id: string) {
		return app.nodesById.get(id);
	}

	function switchSimulation(originIds: string[]) {
		if (!app.graph) return;
		app.setImpact(simulateCompromise(app.graph, originIds));
	}

	function recentLabel(originIds: string[]) {
		const names = originIds.map((id) => (node(id)?.name ?? id) || 'unknown package');
		return names.length > 1 ? `${names[0]} + ${names.length - 1} more` : names[0];
	}

	const exportBtn =
		'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-layer-2 px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-layer-3 hover:text-ink';
</script>

{#if impact && metrics}
	<div class="space-y-4 text-sm">
		<button
			type="button"
			aria-pressed={app.viewMode === 'impact'}
			onclick={() => (app.viewMode === 'impact' ? (app.viewMode = 'all') : app.showImpactOnly())}
			class="w-full rounded-lg bg-layer-2 px-3 py-2 text-sm font-medium text-cascade hover:bg-layer-3"
		>
			Show only simulated impact
		</button>
		{#if app.recentSimulations.length > 0}
			<div>
				<h3 class="mb-2 text-[13px] font-medium text-ink-muted">Recent simulations</h3>
				<div class="flex flex-wrap gap-1.5" aria-label="Recent simulations">
					{#each app.recentSimulations as recent, index (JSON.stringify(recent.originIds))}
						<button
							type="button"
							class="max-w-full truncate rounded-md bg-layer-2 px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-layer-3 hover:text-ink aria-[current=true]:bg-layer-3"
							aria-current={index === 0}
							title={recent.originIds.map((id) => node(id)?.name ?? id).join(', ')}
							onclick={() => switchSimulation(recent.originIds)}
						>
							{recentLabel(recent.originIds)}
						</button>
					{/each}
				</div>
			</div>
		{/if}
		<p class="text-ink">
			{#if metrics.affectedInstances === 0}
				No installed package instances depend on
				<span class="font-semibold text-origin">{originNames.join(', ')}</span>.
			{:else}
				<span class="font-semibold text-cascade tabular-nums">{metrics.affectedInstances.toLocaleString()}</span>
				installed package {metrics.affectedInstances === 1 ? 'instance depends' : 'instances depend'} on
				<span class="font-semibold wrap-break-word text-origin">{originNames.join(', ')}</span>, directly or through
				other packages.
			{/if}
		</p>

		<dl class="space-y-0.5">
			<div class="flex justify-between gap-3 px-1">
				<dt class="text-ink-muted">Not marked dev-only</dt>
				<dd class="font-medium text-ink tabular-nums">{metrics.otherInstances.toLocaleString()}</dd>
			</div>
			<div class="flex justify-between gap-3 px-1">
				<dt class="text-ink-muted">Development only</dt>
				<dd class="font-medium text-ink tabular-nums">{metrics.developmentOnlyInstances.toLocaleString()}</dd>
			</div>
			<div class="flex justify-between gap-3 px-1">
				<dt class="text-ink-muted">Hops to the project root</dt>
				<dd class="font-medium text-ink tabular-nums">{metrics.shortestDistanceToRoot ?? 'Not reached'}</dd>
			</div>
		</dl>
		<AffectedPackages />

		{#if app.hiddenAffectedCount > 0}
			<p class="flex items-start gap-2 rounded-lg bg-layer-1 p-2.5 text-xs text-ink-muted">
				<Icon icon="mdi:eye-off-outline" width="16" height="16" class="mt-px shrink-0" />
				{app.hiddenAffectedCount.toLocaleString()} affected
				{app.hiddenAffectedCount === 1 ? 'instance is' : 'instances are'} hidden by the current filters.
			</p>
		{/if}

		<div>
			<h3 class="mb-2 text-[13px] font-medium text-ink-muted">
				{#if path.length > 1}
					Sample path from the project root, {path.length - 1}
					{path.length === 2 ? 'hop' : 'hops'}
				{:else}
					Sample path from the project root
				{/if}
			</h3>
			{#if isRootOrigin}
				<p class="text-ink-muted">This is the project root itself.</p>
			{:else if path.length === 0}
				<p class="text-ink-muted">The project root does not reach this package through resolved dependencies.</p>
			{:else}
				<ol class="chain" aria-label="Dependency path from the project root">
					{#each steps as id, i (id ?? 'fold')}
						{#if id === null}
							<li class="relative">
								<button
									type="button"
									onclick={() => (chainExpanded = true)}
									class="flex w-full items-center gap-2.5 rounded-md py-1 pr-2 pl-1 text-left text-xs text-ink-muted transition-colors hover:bg-layer-2 hover:text-ink"
								>
									<span class="relative z-10 flex size-3 shrink-0 items-center justify-center" aria-hidden="true">
										<Icon icon="mdi:dots-vertical" width="14" height="14" class="text-cascade" />
									</span>
									Show {path.length - CHAIN_EDGE * 2} more hops
								</button>
							</li>
						{:else}
							{@const n = node(id)}
							{@const role = i === 0 ? 'root' : i === steps.length - 1 ? 'origin' : 'link'}
							<li class="relative">
								<button
									type="button"
									onclick={() => app.focus(id)}
									aria-current={app.selectedId === id}
									class="group flex w-full items-center gap-2.5 rounded-md py-1 pr-2 pl-1 text-left transition-colors hover:bg-layer-2 aria-[current=true]:bg-layer-2"
								>
									<span
										class="pip relative z-10 block size-3 shrink-0 rounded-full ring-4 ring-chassis {role === 'root'
											? 'bg-downstream'
											: role === 'origin'
												? 'bg-origin'
												: 'bg-cascade'}"
									></span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-[13px] text-ink {role === 'origin' ? 'font-semibold' : ''}">
											{id === '' ? `${n?.name ?? 'project'} (project)` : (n?.name ?? id)}
										</span>
										{#if id !== '' && n?.version}
											<span class="block font-mono text-[11px] text-ink-faint">{n.version}</span>
										{/if}
									</span>
									<Icon
										icon="mdi:crosshairs-gps"
										width="14"
										height="14"
										class="shrink-0 text-ink-faint opacity-0 group-hover:opacity-100"
									/>
								</button>
							</li>
						{/if}
					{/each}
				</ol>
			{/if}
		</div>

		<p class="text-xs text-ink-faint">
			A compromise could expose these dependency paths, depending on how the package is used and which build or runtime
			environments load it. This is a hypothetical exposure model, not a vulnerability finding.
		</p>

		<div class="flex gap-2">
			<button type="button" onclick={() => exportReport('json')} class={exportBtn}>
				<Icon icon="mdi:code-json" width="16" height="16" /> Export JSON
			</button>
			<button type="button" onclick={() => exportReport('markdown')} class={exportBtn}>
				<Icon icon="mdi:language-markdown-outline" width="16" height="16" /> Export Markdown
			</button>
		</div>
		{#if exportError}<p role="alert" class="text-xs text-rose-300">{exportError}</p>{/if}
	</div>
{:else}
	<div class="space-y-3">
		<p class="text-sm text-ink-faint">Run a simulation on a selected package to trace what depends on it.</p>
		{#if app.recentSimulations.length > 0}
			<div>
				<h3 class="mb-2 text-[13px] font-medium text-ink-muted">Recent simulations</h3>
				<div class="flex flex-wrap gap-1.5" aria-label="Recent simulations">
					{#each app.recentSimulations as recent (JSON.stringify(recent.originIds))}
						<button
							type="button"
							class="max-w-full truncate rounded-md bg-layer-2 px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-layer-3 hover:text-ink"
							title={recent.originIds.map((id) => node(id)?.name ?? id).join(', ')}
							onclick={() => switchSimulation(recent.originIds)}
						>
							{recentLabel(recent.originIds)}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* The rail connecting each pip in the chain, like the seam running through a row of dominoes. */
	.chain li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: calc(0.25rem + 0.375rem - 1px);
		top: 1.25rem;
		bottom: -0.5rem;
		width: 2px;
		background: var(--color-stroke);
	}
</style>

<script lang="ts">
	import Icon from '@iconify/svelte';
	import { app } from '#lib/state.svelte.ts';
	const result = $derived(app.selectedAdvisories);

	$effect(() => {
		const ids = result?.status === 'found' ? result.advisoryIds : [];
		if (ids.length > 0) void app.loadAdvisoryDetails(ids);
	});

	function formatPublished(value: string): string {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
	}
</script>

<div class="text-sm text-ink-muted" aria-live="polite">
	{#if result?.status === 'not_checked'}
		<p>Not checked. OSV lookup requires a registry package with an exact name and version.</p>
	{:else if result?.status === 'loading'}
		<p class="flex items-center gap-2">
			<Icon icon="mdi:loading" width="16" height="16" class="animate-spin motion-reduce:animate-none" />
			Checking known advisories
		</p>
	{:else if result?.status === 'failed'}
		<p>Lookup failed for this package. Known advisories could not be determined.</p>
	{:else if result?.status === 'none'}
		<p>No known advisories returned for this version. This does not establish that it is safe.</p>
	{:else if result?.status === 'found'}
		<ul class="space-y-0.5">
			{#each result.advisoryIds as id (id)}
				{@const detail = app.advisoryDetail(id)}
				<li>
					<div class="rounded-md px-2 py-1.5">
						<div class="flex items-start gap-2">
							<Icon icon="mdi:shield-alert-outline" width="16" height="16" class="mt-0.5 shrink-0 text-advisory" />
							<a
								class="flex-1 font-mono text-xs break-all text-advisory transition-colors hover:text-ink"
								href={`https://osv.dev/vulnerability/${encodeURIComponent(id)}`}
								target="_blank"
								rel="noopener noreferrer"
							>
								{id}
							</a>
							<Icon icon="mdi:open-in-new" width="14" height="14" class="mt-0.5 shrink-0 text-ink-faint" />
						</div>
						{#if detail?.status === 'loading'}
							<p class="mt-1 pl-6 text-xs text-ink-faint">Loading details...</p>
						{:else if detail?.status === 'failed'}
							<p class="mt-1 pl-6 text-xs text-ink-faint">Details unavailable.</p>
						{:else if detail?.status === 'loaded'}
							<div class="mt-1 space-y-1 pl-6 text-xs text-ink-muted">
								{#if detail.details.summary}
									<p>{detail.details.summary}</p>
								{/if}
								<div class="flex flex-wrap gap-x-2 gap-y-1 text-ink-faint">
									{#if detail.details.published}
										<span>Published {formatPublished(detail.details.published)}</span>
									{/if}
									{#if detail.details.severity}
										<span>Severity {detail.details.severity}</span>
									{/if}
								</div>
								{#if detail.details.aliases.length > 0}
									<p>Aliases: {detail.details.aliases.join(', ')}</p>
								{/if}
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
		<p class="mt-2 text-xs text-ink-faint">Known advisories are separate from hypothetical simulations.</p>
	{/if}
</div>

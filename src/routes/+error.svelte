<script lang="ts">
	import { page } from '$app/state';
	import BrandLogo from '#lib/components/BrandLogo.svelte';
</script>

<main class="flex min-h-dvh items-center justify-center bg-well p-6 text-ink">
	<div class="w-full max-w-md space-y-5 rounded-2xl bg-chassis p-8 ring-1 ring-seam">
		<BrandLogo variant="full" class="h-10 w-auto" />
		<p class="font-mono text-sm text-downstream">{page.status}</p>
		<h1 class="text-2xl font-semibold">{page.status === 404 ? 'Page not found' : 'Something interrupted the app'}</h1>
		<p class="text-sm text-ink-muted">
			{page.status === 404
				? 'This address does not point to a page in Dependency Domino.'
				: 'Return to the app to import a lockfile or load the bundled example.'}
		</p>
		<a href="/" class="inline-flex rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-chassis"
			>Return to Dependency Domino</a
		>
	</div>
</main>

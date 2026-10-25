<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import { app } from '#lib/state.svelte.ts';
	import { PREVIEW_IMAGE, SITE_DESCRIPTION, SITE_NAME, THEME_COLOR, pageTitle } from '#lib/meta.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const title = $derived(pageTitle(app.sourceLabel));
	// Open Graph needs absolute URLs. The origin comes from the request, so no production URL is hardcoded.
	const previewUrl = $derived(`${page.url.origin}${PREVIEW_IMAGE.path}`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={SITE_DESCRIPTION} />
	<meta name="theme-color" content={THEME_COLOR} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={SITE_NAME} />
	<meta property="og:description" content={SITE_DESCRIPTION} />
	<meta property="og:url" content={page.url.origin} />
	<meta property="og:image" content={previewUrl} />
	<meta property="og:image:width" content={String(PREVIEW_IMAGE.width)} />
	<meta property="og:image:height" content={String(PREVIEW_IMAGE.height)} />
	<meta property="og:image:alt" content={PREVIEW_IMAGE.alt} />
	<meta name="twitter:card" content="summary_large_image" />

	<link rel="icon" type="image/svg+xml" href={favicon} />
	<link rel="alternate icon" type="image/png" href="/favicon-32x32.png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

{@render children()}

export const SITE_NAME = 'Dependency Domino';

export const SITE_DESCRIPTION =
	'Turn a lockfile into a dependency graph and simulate how a compromised package would spread through the packages installed in your project. Known advisories come from OSV.';

// TODO: set to the app's background color (the --color-chassis value in layout.css).
export const THEME_COLOR = '#0b0f14';

/** Existing logo in static/. Open Graph needs an absolute URL, so the layout prefixes the origin. */
export const PREVIEW_IMAGE = { path: '/logo.png', width: 1024, height: 258, alt: 'Dependency Domino logo' };

const MAX_LABEL = 60;

/** Browser tab title. Includes the loaded lockfile name, which comes from an uploaded file name. */
export function pageTitle(sourceLabel: string | null): string {
	const label = sourceLabel?.trim();
	if (!label) return SITE_NAME;
	const short = label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;
	return `${short} · ${SITE_NAME}`;
}
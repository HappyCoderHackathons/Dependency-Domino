# Brand Assets & Design Guide

This document describes the brand identity assets, color palette, and asset usage guidelines for Dependency Domino.

## Brand Concept

The Dependency Domino identity combines two core metaphors:

1. **The Domino Cascade**: A dynamic pair of domino tiles in motion, illustrating how a single package failure propagates downstream.
2. **The Dependency Graph**: The pips on each domino double as software dependency nodes connected by directional graph edges. The top node of the lead domino marks the compromised package origin with an alert indicator, propagating across the central seam and into downstream dependent nodes.

## Color Palette

| Token              | Hex                   | Role                                           |
| ------------------ | --------------------- | ---------------------------------------------- |
| Slate Chassis      | `#0f172a` / `#1e293b` | Tile background and primary structure          |
| Tile Seam & Stroke | `#475569` / `#64748b` | Domino divider and structural borders          |
| Compromise Origin  | `#f43f5e` / `#e11d48` | Vulnerable package indicator and cascade alert |
| Cascade Warning    | `#f59e0b`             | Propagating impact node                        |
| Downstream Nodes   | `#38bdf8` / `#0284c7` | Dependent packages in the dependency tree      |

## Interface Tokens

The app UI uses the palette above on a dark chassis. Tokens live in `src/routes/layout.css` (`@theme`) and graph
colors in `src/lib/graph/theme.ts`.

| Token                             | Value                             | Use                                                  |
| --------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `chassis`                         | `#0f172a`                         | App background and sidebars                          |
| `well`                            | `#0b1222`                         | Graph canvas, with a `seam` pip grid                 |
| `layer-1` / `layer-2` / `layer-3` | slate-400 at 7%, 12%, 20%         | Hover, active, and inset surfaces instead of borders |
| `ink` / `ink-muted` / `ink-faint` | `#e2e8f0` / `#94a3b8` / `#64748b` | Primary, secondary, and tertiary text                |
| `origin`                          | `#f43f5e`                         | Hypothetical origin and the Simulate button          |
| `cascade`                         | `#f59e0b`                         | Packages that depend on the origin                   |
| `downstream`                      | `#38bdf8`                         | Project root, focus rings, active toggles            |
| `advisory`                        | `#c084fc`                         | Known OSV advisories, kept apart from simulation     |

Type is Geist (UI) and Geist Mono (versions and lockfile paths only). Sidebars collapse to a 52px icon rail.

## Asset Files

All assets are located in `static/` for public routing and `src/lib/assets/` for component bundling.

### Vector Assets (SVG)

- `static/favicon.svg`: High contrast 32x32 SVG favicon optimized for browser tabs in both dark and light modes.
- `src/lib/assets/favicon.svg`: SvelteKit source favicon imported in `src/routes/+layout.svelte`.
- `static/logo-mark.svg` & `src/lib/assets/logo-mark.svg`: Standalone 128x128 brand mark featuring the cascading domino pair.
- `static/logo.svg` & `src/lib/assets/logo.svg`: Primary horizontal lockup with brand mark and logotype for dark/neutral backgrounds.
- `static/logo-light.svg`: Horizontal lockup variant with high contrast for light backgrounds.

### Raster Assets (PNG)

- `static/logo-mark.png`: 512x512 transparent brand mark.
- `static/logo-mark-192.png`: 192x192 transparent icon for progressive web app manifests.
- `static/logo.png`: 1024x258 high resolution horizontal lockup.
- `static/logo-light.png`: 1024x258 light background horizontal lockup.
- `static/apple-touch-icon.png`: 180x180 icon for iOS home screen shortcuts.
- `static/favicon-32x32.png`: 32x32 standard browser favicon.
- `static/favicon-16x16.png`: 16x16 standard browser favicon.
- `static/favicon.png`: 32x32 fallback favicon.

## Usage in SvelteKit

### Favicon Configuration

The favicon is mounted in `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={favicon} />
	<link rel="alternate icon" type="image/png" href="/favicon-32x32.png" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>
```

### BrandLogo Component

Import the reusable component directly from `#lib/components/BrandLogo.svelte` or `#lib`:

```svelte
<script lang="ts">
	import BrandLogo from '#lib/components/BrandLogo.svelte';
</script>

<!-- Standalone Icon Mark -->
<BrandLogo variant="mark" class="size-16" />

<!-- Full Horizontal Lockup -->
<BrandLogo variant="full" class="h-12 w-auto" />
```

### Regenerating Raster Assets

PNG exports can be regenerated from SVGs using the build script:

```bash
python scripts/generate_pngs.py
```

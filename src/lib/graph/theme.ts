// src/lib/graph/theme.ts
// One source of truth for graph colors. DependencyGraph.svelte (Cytoscape styles)
// and Legend.svelte both read from here, so the swatches always match the canvas.

export const COLORS = {
	// Packages
	node: '#8892a6',
	advisory: '#7e22ce',
	root: '#334155',

	// Simulation
	origin: '#2563eb',
	originBorder: '#1d4ed8',
	affected: '#f97316',
	affectedBorder: '#c2410c',

	// Selection outline (separate from simulation colors)
	picked: '#0f172a',

	// Edges (darker than before so they stay visible on a projector)
	edge: '#7c8aa0',
	devEdge: '#94a3b8',
	pathEdge: '#c2410c',

	// Caveats: unsupported sources (link or other) and unresolved items
	unresolved: '#94a3b8',
	unsupportedFill: '#e2e8f0'
} as const;

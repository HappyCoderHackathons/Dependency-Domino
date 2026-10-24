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

	// Edges
	edge: '#b8bfcc',
	devEdge: '#d5dae3',
	pathEdge: '#c2410c',
	unresolved: '#94a3b8'
} as const;

// src/lib/graph/theme.ts
// One source of truth for graph colors. DependencyGraph.svelte (Cytoscape styles)
// and Legend.svelte both read from here, so the swatches always match the canvas.
// Values follow the brand palette in docs/BRANDING.md, tuned for the dark canvas.

export const COLORS = {
	canvas: '#0b1222',
	label: '#cbd5e1',

	// Packages
	node: '#64748b',
	nodeBorder: '#94a3b8',
	advisory: '#c084fc',
	root: '#38bdf8',
	rootBorder: '#0284c7',

	// Simulation
	origin: '#f43f5e',
	originBorder: '#fecdd3',
	affected: '#f59e0b',
	affectedBorder: '#b45309',

	// Selection outline (separate from simulation colors)
	picked: '#f8fafc',

	// Edges
	edge: '#475569',
	devEdge: '#475569',
	cascadeEdge: '#b45309',
	pathEdge: '#fb7185',

	// Caveats: unsupported sources (link or other) and unresolved items
	unresolved: '#64748b',
	unsupportedFill: '#1e293b'
} as const;

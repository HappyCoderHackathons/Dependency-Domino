export const COLORS = {
	canvas: '#0b1222',
	label: '#cbd5e1',

	// Packages
	node: '#64748b',
	nodeBorder: '#94a3b8',
	advisory: '#c084fc',
	installScript: '#fbbf24',
	installScriptBorder: '#f59e0b',
	root: '#38bdf8',
	rootBorder: '#0284c7',

	// Simulation
	origin: '#f43f5e',
	originBorder: '#fecdd3',
	affected: '#f59e0b',
	affectedBorder: '#b45309',

	// Selection outline
	picked: '#f8fafc',

	// Edges
	edge: '#475569',
	devEdge: '#475569',
	peerEdge: '#94a3b8',
	optionalEdge: '#475569',
	cascadeEdge: '#b45309',
	pathEdge: '#fb7185',

	// Caveats
	unresolved: '#64748b',
	unsupportedFill: '#1e293b'
} as const;

// Dash patterns: dash length, gap length, repeated as needed
export const EDGE_DASH = {
	peer: [4, 3],
	optional: [10, 5],
	unresolved: [6, 3, 1, 3]
} as const;

import { describe, expect, it } from 'vitest';
import { AppState } from '#lib/state.svelte.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import { simulateCompromise } from '#lib/graph/impact.js';
import demo from '#lib/fixtures/demo-lockfile.json';

function state() {
	const result = parseLockfile(JSON.stringify(demo));
	if (!result.ok) throw new Error(result.message);
	const app = new AppState();
	app.graph = result.graph;
	return app;
}

describe('focused graph views', () => {
	it('keeps dependency counts and copy lists independent of canvas filters', () => {
		const app = state();
		app.focus('node_modules/@domino-demo/report-gen');
		const total = app.selectedDependencyCount;
		expect(total).toBeGreaterThan(3);
		app.filters.directOnly = true;
		expect(app.selectedDependencyCount).toBe(total);
		app.focus('node_modules/@domino-demo/date-helpers');
		expect(app.selectedCopies.map((node) => node.version)).toEqual(['1.3.0', '2.0.1']);
		expect(app.visibleIds.has(app.selectedCopies[0].id)).toBe(false);
		app.select('');
		expect(app.selectedCopies).toEqual([]);
	});
	it('shows the selected neighborhood and retargets it on navigation', () => {
		const app = state();
		app.focus('node_modules/@domino-demo/tiny-pad');
		app.showNeighborhood();
		expect(app.visibleIds.size).toBe(4);
		expect(app.visibleIds.has('')).toBe(false);
		app.neighborhoodDirection = 'dependencies';
		expect([...app.visibleIds]).toEqual(['node_modules/@domino-demo/tiny-pad']);
		app.focus('node_modules/@domino-demo/format-core');
		expect(app.visibleIds.size).toBe(3);
		app.select(null);
		expect(app.viewMode).toBe('all');
	});

	it('keeps simulation counts independent of the canvas and restores overview on clear', () => {
		const app = state();
		const impact = simulateCompromise(app.graph!, 'node_modules/@domino-demo/tiny-pad');
		app.setImpact(impact);
		app.showImpactOnly();
		expect(app.visibleIds.size).toBe(8);
		app.filters.directOnly = true;
		expect(app.visibleIds.size).toBe(3);
		expect(app.impact).toBe(impact);
		app.clearSimulation();
		expect(app.viewMode).toBe('all');
		expect(app.impact).toBeNull();
	});

	it('leaves impact-only view when navigating to a package outside it', () => {
		const app = state();
		app.setImpact(simulateCompromise(app.graph!, 'node_modules/@domino-demo/tiny-pad'));
		app.showImpactOnly();
		app.focus('node_modules/@domino-demo/test-runner');
		expect(app.viewMode).toBe('all');
		expect(app.visibleIds.has(app.selectedId!)).toBe(true);
		app.showNeighborhood();
		app.reset();
		expect(app.viewMode).toBe('all');
	});

	it('bypasses progressive reveal for a neighborhood without changing the overview reveal state', () => {
		const app = state();
		const graph = app.graph!;
		app.graph = {
			...graph,
			nodes: [...graph.nodes, ...Array.from({ length: 301 }, (_, i) => ({ ...graph.nodes[1], id: `extra-${i}` }))]
		};
		const overview = app.revealedIds;
		const pins = app.pinnedIds;
		app.select('node_modules/@domino-demo/tiny-pad');
		app.showNeighborhood();
		expect(app.canvasIds?.has('node_modules/@domino-demo/tiny-pad')).toBe(true);
		expect(app.visibleIds.size).toBe(4);
		expect(app.pinnedIds).toBe(pins);
		app.viewMode = 'all';
		expect(app.revealedIds).toEqual(overview);
	});
});

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
	it('turns an unexpected simulation failure into a recoverable state without discarding the graph', () => {
		const app = state();
		const graph = app.graph;
		app.simulate([]);
		expect(app.runtimeError).toContain('simulation could not finish');
		expect(app.graph).toBe(graph);
		expect(app.impact).toBeNull();
		app.closeGraph();
		expect(app.runtimeError).toBeNull();
	});
	it('closes the entire analysis and resets filters while keeping a session hint dismissed', () => {
		const app = state();
		app.focus('node_modules/@domino-demo/tiny-pad');
		app.setImpact(simulateCompromise(app.graph!, app.selectedId!));
		app.filters.hideDev = true;
		app.layoutDirection = 'LR';
		app.warnings = ['test'];
		app.sourceLabel = 'test.json';
		app.advisoryDetails = { TEST: { status: 'failed' } };
		app.closeGraph();
		expect(app.hasGraph).toBe(false);
		expect(app.selectedId).toBeNull();
		expect(app.impact).toBeNull();
		expect(app.sourceLabel).toBeNull();
		expect(app.warnings).toEqual([]);
		expect(app.advisoryDetails).toEqual({});
		expect(app.osvStatus).toBe('idle');
		expect(app.recentSimulations).toEqual([]);
		expect(app.filters.hideDev).toBe(false);
		expect(app.layoutDirection).toBe('auto');
		expect(app.hintDismissed).toBe(true);
	});

	it('ignores advisory and detail responses that finish after closing', async () => {
		const app = state();
		let finish!: (response: Response) => void;
		const response = new Promise<Response>((resolve) => {
			finish = resolve;
		});
		const fetchFn = (() => response) as typeof fetch;
		const pending = app.checkAdvisories(fetchFn);
		const details = app.loadAdvisoryDetails(['TEST'], fetchFn);
		app.closeGraph();
		finish(new Response(JSON.stringify({ status: 'complete', results: [], warnings: [] })));
		await Promise.all([pending, details]);
		expect(app.graph).toBeNull();
		expect(app.osvResponse).toBeNull();
		expect(app.osvStatus).toBe('idle');
		expect(app.advisoryDetails).toEqual({});
	});
	it('reveals a chosen sample path beyond progressive depth without clearing filters', () => {
		const app = state();
		const original = app.graph!;
		app.graph = {
			...original,
			nodes: [...original.nodes, ...Array.from({ length: 301 }, (_, i) => ({ ...original.nodes[1], id: `extra-${i}` }))]
		};
		app.setImpact(simulateCompromise(app.graph, 'node_modules/@domino-demo/tiny-pad'));
		expect(app.revealedIds?.has('node_modules/@domino-demo/tiny-pad')).toBe(false);
		app.filters.hideDev = true;
		app.selectSamplePath(1);
		expect(app.activeSamplePath.every((id) => app.revealedIds?.has(id))).toBe(true);
		expect(app.filters.hideDev).toBe(true);
		expect(app.pinnedIds.has('')).toBe(false);
	});
	it('switches the explanatory path independently of the simulation and resets it for another origin', () => {
		const app = state();
		const impact = simulateCompromise(app.graph!, 'node_modules/@domino-demo/tiny-pad');
		app.setImpact(impact);
		app.selectSamplePath(1);
		expect(app.activeSamplePath[1]).toBe('node_modules/@domino-demo/report-gen');
		expect(app.impact).toBe(impact);
		app.selectSamplePath(99);
		expect(app.samplePathIndex).toBe(1);
		app.setImpact(simulateCompromise(app.graph!, 'node_modules/@domino-demo/string-utils'));
		expect(app.samplePathIndex).toBe(0);
		app.clearSimulation();
		expect(app.activeSamplePath).toEqual([]);
	});
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

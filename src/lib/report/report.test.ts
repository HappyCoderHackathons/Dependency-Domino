import { describe, expect, it } from 'vitest';
import { buildSimulationReport, REPORT_DISCLAIMER, reportToJson } from '#lib/report/report.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import { simulateCompromise } from '#lib/graph/impact.js';

const generatedAt = '2026-10-25T00:00:00.000Z';
function graph() {
	const result = parseLockfile(
		JSON.stringify({
			lockfileVersion: 3,
			packages: {
				'': { name: 'project', dependencies: { a: '1', x: '1' }, devDependencies: { tool: '1' } },
				'node_modules/a': { version: '1.0.0', dependencies: { x: '2' } },
				'node_modules/a/node_modules/x': { version: '2.0.0' },
				'node_modules/x': { version: '1.0.0', hasInstallScript: true, dependencies: { missing: '1' } },
				'node_modules/tool': { version: '1.0.0', dev: true, dependencies: { x: '1' } }
			}
		})
	);
	if (!result.ok) throw new Error(result.message);
	return result.graph;
}

describe('simulation reports', () => {
	it('snapshots requested ranges and root-branch coverage alongside each path', () => {
		const input = graph();
		const report = buildSimulationReport(input, simulateCompromise(input, 'node_modules/x'), { generatedAt });
		expect(report.samplePathEdges?.[0]).toEqual([
			{ source: '', target: 'node_modules/x', kind: 'runtime', requestedRange: '1' }
		]);
		expect(report.rootBranchCount).toBe(2);
		input.edges.find((edge) => edge.target === 'node_modules/x')!.requestedRange = 'changed';
		expect(report.samplePathEdges?.[0][0].requestedRange).toBe('1');
	});
	it('exports a self-contained snapshot with paths, parser/lookup warnings, and existing metric definitions', () => {
		const input = graph();
		input.nodes.find((node) => node.id === 'node_modules/x')!.advisoryIds = ['GHSA-example'];
		const impact = simulateCompromise(input, 'node_modules/x');
		const before = structuredClone({ input, impact });
		const report = buildSimulationReport(input, impact, {
			generatedAt,
			sourceLabel: 'pnpm-lock.yaml (pnpm)',
			advisoryLookupStatus: 'partial',
			warnings: [...input.warnings, 'Lookup was partial.']
		});
		expect(JSON.parse(reportToJson(report))).toEqual(report);
		expect(report.origin).toMatchObject({ id: 'node_modules/x', version: '1.0.0', advisoryIds: ['GHSA-example'] });
		expect(report.origin.hasInstallScript).toBe(true);
		expect(report.ancestors.map((node) => node.id)).toEqual(['', 'node_modules/tool']);
		expect(report.metrics.impact).toMatchObject({
			affectedInstances: 1,
			developmentOnlyInstances: 1,
			shortestDistanceToRoot: 1
		});
		expect(report.metrics.graph.warningCount).toBe(1);
		expect(report.warnings).toHaveLength(2);
		expect(report.samplePaths[0].map((node) => node.id)).toEqual(['', 'node_modules/x']);
		expect(report.disclaimer).toBe(REPORT_DISCLAIMER);
		expect(report.advisoryLookupStatus).toBe('partial');
		expect({ input, impact }).toEqual(before);
		input.nodes.find((node) => node.id === 'node_modules/x')!.advisoryIds.push('GHSA-later');
		expect(report.origin.advisoryIds).toEqual(['GHSA-example']);
	});

	it('keeps distinct versions and instance IDs when selecting a nested package', () => {
		const input = graph();
		const report = buildSimulationReport(input, simulateCompromise(input, 'node_modules/a/node_modules/x'), {
			generatedAt
		});
		expect(report.origin).toMatchObject({ id: 'node_modules/a/node_modules/x', version: '2.0.0' });
		expect(report.ancestors.map((node) => node.id)).toEqual(['node_modules/a', '']);
	});

	it('reports an unreachable root and handles a root origin', () => {
		const input = graph();
		input.edges = [];
		const disconnected = buildSimulationReport(input, simulateCompromise(input, 'node_modules/x'), { generatedAt });
		expect(disconnected.samplePaths).toEqual([]);
		expect(disconnected.metrics.impact.shortestDistanceToRoot).toBeNull();
		const root = buildSimulationReport(input, simulateCompromise(input, ''), { generatedAt });
		expect(root.ancestors).toEqual([]);
		expect(root.samplePaths[0][0].id).toBe('');
		expect(root.metrics.impact.shortestDistanceToRoot).toBe(0);
	});

	it('rejects stale simulation references and invalid timestamps', () => {
		const input = graph();
		expect(() =>
			buildSimulationReport(
				input,
				{ originIds: ['missing'], originId: 'missing', ancestorIds: [], layers: [], samplePaths: [] },
				{ generatedAt }
			)
		).toThrow('absent from this graph');
		expect(() => buildSimulationReport(input, simulateCompromise(input, ''), { generatedAt: 'invalid' })).toThrow();
	});
});

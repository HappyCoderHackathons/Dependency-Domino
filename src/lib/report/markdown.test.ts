import { describe, expect, it } from 'vitest';
import { reportToMarkdown } from '#lib/report/markdown.js';
import { buildSimulationReport } from '#lib/report/report.js';
import { parseLockfile } from '#lib/parser/lockfile.js';
import { simulateCompromise } from '#lib/graph/impact.js';

function report() {
	const parsed = parseLockfile(
		JSON.stringify({
			lockfileVersion: 3,
			packages: {
				'': { name: 'project', dependencies: { x: '1' } },
				'node_modules/x': { version: '1.0.0' }
			}
		})
	);
	if (!parsed.ok) throw new Error(parsed.message);
	return buildSimulationReport(parsed.graph, simulateCompromise(parsed.graph, 'node_modules/x'), {
		generatedAt: '2026-10-25T00:00:00.000Z',
		sourceLabel: 'bun.lock',
		advisoryLookupStatus: 'loading'
	});
}

describe('Markdown reports', () => {
	it('includes the same report sections, metadata, paths, and root-aware metric definitions', () => {
		const input = report();
		const before = structuredClone(input);
		const markdown = reportToMarkdown(input);
		expect(markdown).toContain('# Dependency Domino simulation report');
		expect(markdown).toContain('hypothetical dependency exposure model');
		expect(markdown).toContain('## Hypothetical origin');
		expect(markdown).toContain('## Root-to-origin sample paths');
		expect(markdown).toContain(' → ');
		expect(markdown).toContain('## Dependent ancestors');
		expect(markdown).toContain('Advisory lookup status: loading');
		expect(markdown).toContain('excluding origin and project root | 0');
		expect(markdown).toContain('No warnings were recorded.');
		expect(input).toEqual(before);
	});

	it('escapes imported names, identities, advisory IDs, warnings, and source labels as text', () => {
		const input = report();
		const unsafe = '<script>alert(1)</script>|[click](javascript:bad)\n# injected ![image](https://example.com)';
		input.sourceLabel = unsafe;
		input.origin.name = unsafe;
		input.origin.id = unsafe;
		input.origin.advisoryIds = [unsafe];
		input.ancestors[0].name = unsafe;
		input.warnings = [unsafe];
		const markdown = reportToMarkdown(input);
		expect(markdown).not.toContain('<script>');
		expect(markdown).not.toContain('[click](');
		expect(markdown).not.toContain('![image]');
		expect(markdown).not.toContain('\n# injected');
		expect(markdown).toContain('&#60;script&#62;');
		expect(markdown).toContain('&#124;');
	});

	it('explains missing root paths and empty ancestor sets', () => {
		const input = report();
		input.ancestors = [];
		input.samplePaths = [];
		input.metrics.impact.shortestDistanceToRoot = null;
		const markdown = reportToMarkdown(input);
		expect(markdown).toContain('No root path was available');
		expect(markdown).toContain('No dependent ancestors were reached.');
		expect(markdown).toContain('project root | unreachable');
	});
});

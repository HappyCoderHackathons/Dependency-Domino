import type { DependencyEdge, PackageNode } from '#lib/types.js';
import type { SimulationReport } from '#lib/report/report.js';

/** Imported strings stay text, including inside table cells and Markdown-capable issue renderers. */
function text(value: string): string {
	return value
		.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ')
		.replace(/[&<>"'\\`*_{}\[\]()#+.!|~:\/@-]/g, (char) => `&#${char.codePointAt(0)};`);
}

function label(node: PackageNode): string {
	return `${text(node.name)}@${text(node.version ?? 'unknown')} (${text(node.id || 'project root')})`;
}

function details(node: PackageNode): string[] {
	return [
		`- Name: ${text(node.name)}`,
		`- Version: ${text(node.version ?? 'unknown')}`,
		`- Lockfile identity: ${text(node.id || '(project root)')}`,
		`- Direct dependency: ${node.direct ? 'yes' : 'no'}`,
		`- Marked development-only: ${node.devOnly ? 'yes' : 'no'}`,
		`- Marked optional: ${node.optional ? 'yes' : 'no'}`,
		`- Runs a script at install time: ${node.hasInstallScript === true ? 'yes' : 'not recorded'}`,
		`- Source: ${text(node.source)}`,
		`- Known advisory IDs: ${node.advisoryIds.length ? node.advisoryIds.map(text).join(', ') : 'none recorded'}`
	];
}

export function reportToMarkdown(report: SimulationReport): string {
	const graph = report.metrics.graph;
	const impact = report.metrics.impact;
	const lines = [
		'# Dependency Domino simulation report',
		'',
		`> ${text(report.disclaimer)}`,
		'',
		`- Report schema: ${report.schemaVersion}`,
		`- Generated at: ${text(report.generatedAt)}`,
		`- Input: ${text(report.sourceLabel ?? 'not recorded')}`,
		`- Advisory lookup status: ${text(report.advisoryLookupStatus)}`,
		'',
		'## Hypothetical origins',
		'',
		report.origins.length > 1
			? 'This report combines multiple installed instances that matched known advisories as origins. The advisory matches are real external records; the dependency exposure trace is hypothetical.'
			: 'The advisory matches are real external records when present; the dependency exposure trace is hypothetical.',
		'',
		...report.origins.flatMap((origin, index) => [`### Origin ${index + 1}`, '', ...details(origin), '']),
		'## Metrics',
		'',
		'| Metric | Count |',
		'| --- | --- |',
		`| Package nodes, excluding project root | ${graph.installedInstances} |`,
		`| Distinct name/version pairs | ${graph.distinctPackageVersions} |`,
		`| Direct dependencies | ${graph.directDependencies} |`,
		`| Parser warnings | ${graph.warningCount} |`,
		`| Unresolved dependency warnings | ${graph.unresolvedDependencies} |`,
		`| Other parser warnings | ${graph.otherWarnings} |`,
		`| Affected package nodes, excluding origin and project root | ${impact.affectedInstances} |`,
		`| Affected nodes marked development-only | ${impact.developmentOnlyInstances} |`,
		`| Other affected package nodes | ${impact.otherInstances} |`,
		`| Shortest dependency distance to project root | ${impact.shortestDistanceToRoot ?? 'unreachable'} |`,
		'',
		'Nodes are installed instances or lockfile resolutions, depending on the input format. Flags reflect lockfile metadata, not runtime execution.',
		'',
		'## Root-to-origin sample paths',
		''
	];
	if (report.samplePaths.length === 0) lines.push('No root path was available through resolved dependencies.');
	else {
		if (report.rootBranchCount !== undefined)
			lines.push(`Reached through ${report.rootBranchCount} of the project's direct dependencies.`, '');
		lines.push(
			'Up to five short sample paths are included across the selected origins. Additional routes may exist.',
			''
		);
		report.samplePaths.forEach((path, index) => {
			const edges = report.samplePathEdges?.[index] ?? [];
			const bySource = new Map<string, DependencyEdge[]>();
			for (const edge of edges) {
				if (!bySource.has(edge.source)) bySource.set(edge.source, []);
				bySource.get(edge.source)!.push(edge);
			}
			const steps = path.map((node, i) => {
				const requests = (bySource.get(node.id) ?? [])
					.filter((edge) => edge.source === node.id && edge.target === path[i + 1]?.id && edge.requestedRange)
					.map((edge) => `${text(edge.requestedRange!)} (${text(edge.kind)})`);
				return `${label(node)}${requests.length ? ` (requires ${requests.join(', ')})` : ''}`;
			});
			lines.push(`${index + 1}. ${steps.join(' → ')}`);
		});
	}
	lines.push(
		'',
		'## Dependent ancestors',
		'',
		'The project root is included here when reached, but excluded from the affected package-node metric.',
		''
	);
	if (report.ancestors.length === 0) lines.push('No dependent ancestors were reached.');
	else {
		lines.push(
			'| Name | Version | Lockfile identity | Direct | Development-only | Optional | Install script | Source | Known advisory IDs |',
			'| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
		);
		for (const node of report.ancestors)
			lines.push(
				`| ${[
					node.name,
					node.version ?? 'unknown',
					node.id || '(project root)',
					node.direct ? 'yes' : 'no',
					node.devOnly ? 'yes' : 'no',
					node.optional ? 'yes' : 'no',
					node.hasInstallScript === true ? 'yes' : 'not recorded',
					node.source,
					node.advisoryIds.length ? node.advisoryIds.join(', ') : 'none recorded'
				]
					.map(text)
					.join(' | ')} |`
			);
	}
	lines.push('', '## Warnings', '');
	if (report.warnings.length === 0) lines.push('No warnings were recorded.');
	else lines.push(...report.warnings.map((warning) => `- ${text(warning)}`));
	return lines.join('\n') + '\n';
}

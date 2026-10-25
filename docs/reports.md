# Simulation report exports

Run a simulation and use Export JSON or Export Markdown in the results panel. Downloads use fixed filenames
`dependency-domino-report.json` and `dependency-domino-report.md`. No report content is sent to a server or persisted by
the app. Imported package names are not used as download filenames.
Each click captures the current state, so a later export may include newer advisory results or a different lookup status.

## Shared snapshot

`buildSimulationReport(graph, impact, options)` is a pure snapshot builder in `src/lib/report/report.ts`. Callers supply
the generation timestamp so the function stays deterministic. It copies node metadata and advisory ID arrays, preserving
lockfile identities and separating duplicate package instances. Supply the graph used for the simulation; references to
absent nodes fail rather than silently dropping data.

JSON schema version 1 contains:

- `generatedAt`: ISO timestamp normalized to UTC.
- `sourceLabel`: source label from the import, or null if not supplied.
- `disclaimer`: hypothetical-exposure explanation and the limits of advisory matches.
- `advisoryLookupStatus`: current lookup state, or `not_provided` for callers without that context.
- `origin`: a package-node snapshot for the hypothetical origin.
- `ancestors`: dependent package-node snapshots, including the project root when reached and excluding the origin.
- `samplePaths`: ordered root-to-origin paths containing package-node snapshots, or an empty array when unavailable.
- `metrics`: the existing graph and impact metrics. Package counts exclude the project root; affected counts also exclude
  the origin. A null root distance means unreachable, and zero means the root itself was selected.
- `warnings`: unique parser and caller-supplied warnings. Graph warning metrics remain limited to parser warnings.

Flags reflect lockfile metadata. A node without the development-only flag is not assumed to execute at runtime. Nodes may
represent installed instances or recorded resolutions depending on the lockfile format. Advisory IDs remain external
version matches, not proof of exploitability; empty IDs are not a clean bill of health, especially during a partial,
pending, or failed lookup.

## Serializers and downloads

`reportToJson(report)` serializes that snapshot with indentation. `reportToMarkdown(report)` formats the same data with
headings, metrics, paths, and an ancestor table. Imported strings are escaped as text to prevent names, paths, advisory
IDs, or warnings from creating Markdown links, images, table columns, or raw HTML.

The download helper creates a temporary Blob URL, starts a browser download, removes its anchor, and releases the URL.
Exports require a simulation result. A failed download shows an error in the results panel and leaves the graph intact.

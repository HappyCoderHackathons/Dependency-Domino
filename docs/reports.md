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
- `origins`: snapshots of all selected hypothetical origin instances. `origin` retains the first for compatibility.
- `ancestors`: dependent package-node snapshots, including the project root when reached and excluding the origin.
- `samplePaths`: ordered root-to-origin paths containing package-node snapshots, or an empty array when unavailable.
- `samplePathEdges`: optional recorded edge snapshots grouped by sample path, including source, target, kind, and
  requested range when available. This matches `samplePaths` by index; multiple edge kinds can connect the same steps.
- `rootBranchCount`: optional count of distinct recorded direct dependencies of the root that reach any selected origin.
- `metrics`: the existing graph and impact metrics. Package counts exclude the project root; affected counts also exclude
  the origin. A null root distance means unreachable, and zero means the root itself was selected.
- `warnings`: unique parser and caller-supplied warnings. Graph warning metrics remain limited to parser warnings.

Sampling is capped at five paths globally across the selected origins. It favors different direct branches and uses
shortest routes within each branch. This is a set of examples, not an exhaustive path inventory. The branch count is
computed separately and includes branches beyond the sample limit. Exports include all sampled paths even when the UI
highlights only one. Older schema-1 snapshots without the optional edge metadata still render in Markdown.

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

## PNG images

The canvas **Export PNG** control offers a viewport capture and a padded capture of the full displayed graph. It uses
Cytoscape's asynchronous Blob export with the app canvas background and a 4096-pixel bound on either side. The full
capture preserves the user's zoom and pan, including on failure. Current filters, focused views, reveal depth, labels,
and playback styling apply. Hidden or unmounted packages are not reconstructed, and UI controls are not included.

**Download summary PNG** in the simulation panel creates a 1600×900 card using the app logo, palette, and local fonts.
The pure `buildSummaryCard` helper snapshots origin names/versions, full-graph impact metrics, and the selected sampled
route before asynchronous rendering. Paths longer than five nodes retain the first two and last two nodes with an
omitted-package count. The shortest-root metric is distinct from the selected route's hop count. Disconnected origins
show no recorded root path, and multiple origins have an explicit instance count. The image contains the same
hypothetical disclaimer as reports. A removal preview does not produce a compromise summary card.

PNG filenames include bounded, sanitized source and origin labels plus an export-kind suffix. Imported strings are
rendered through canvas text APIs rather than HTML or remote images. Temporary Blob URLs are released after download;
no PNG or lockfile is uploaded. Failed encoding leaves the analysis intact and displays a retry message.

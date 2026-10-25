# Dependency Domino

> One compromised package. How far does it fall?

**Live demo:** [dependency.toolsmith.online](https://dependency.toolsmith.online/) (choose **Try Demo** to load a sample project)

Dependency Domino is a software supply-chain visualization tool. Import a project's dependency lockfile, explore its
dependency graph, and select any package to run a hypothetical compromise simulation. The graph highlights every package
that depends on the selection, directly or indirectly, so you can see how far trust in one upstream package reaches.

The app can also query [OSV.dev](https://osv.dev/) for known advisories against exact package versions. Known advisories
and hypothetical simulation results are shown as separate kinds of information.

Dependency Domino is an exposure visualization and educational tool. It does not detect exploits, analyze malware, or
prove that a dependent package is vulnerable.

## Status

In active development. File import, the interactive dependency graph, package search, hypothetical compromise simulation,
root paths, a graph legend, and a warnings panel are available. OSV lookup runs in the background, with a separate advisory
panel, advisory markers, live lookup status, and a retry action. Visual presentation is still being refined.
See [the project plan](Dependency_Domino_24_Hour_Project_Plan.md) for scope and milestones.

## Usage

1. Open the live demo or start the app locally. Choose **Try Demo** for a bundled example, **GitHub URL** to fetch
   a supported lockfile from a public repository's default branch, or **Import Lockfile** to select
   `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, or `bun.lock`. You can also drop the file onto the graph area.
2. Pan and zoom the graph. Click a package or search by name or version to select an installed instance. The details
   panel shows its version, lockfile identity, source, and dependency information.
3. Choose **Simulate Compromise**. The animation highlights packages that depend on the selected instance, directly or
   indirectly. Results include a dependent count and a sample path from the project root when one exists.
4. Choose **Reset** to clear the simulation and selection while keeping the loaded graph, or select another package
   and simulate again.
5. Review **Warnings** in the footer for unresolved dependencies and unsupported relationships. A rejected file shows
   an error while keeping any previously loaded graph.
6. After running a simulation, choose **Export JSON** or **Export Markdown** in the results panel to save a local report.
   Both include the origin, dependent ancestors, sample paths, metrics, warnings, generation time, advisory lookup status,
   and hypothetical-exposure disclaimer. Advisory IDs are recorded separately from the simulated exposure.

Package details includes expandable lists of direct dependencies and dependents, with edge kinds and requested ranges
where recorded. Click an installed instance to select and focus it. Lists initially show ten relationships.
The **Direct and indirect dependencies** count includes each reachable installed instance once, even when several paths
lead to it. It excludes the selected instance and project root and is based on recorded edges, so unresolved relationships
can make it incomplete. Canvas filters do not change this count.

Under **View**, set **Package labels** to **Name only** for shorter canvas labels. Names installed at different versions
keep their versions, including when another copy is outside the current view. OSV markers remain visible on advisory labels.
Hovering or selecting a package outlines its other visible installed copies in blue. **Other installed copies** in package
details lists their versions and lockfile identities, ten per page, and lets you select and focus each copy.

Choose **Explore neighborhood** to lay out the packages within 1 to 4 hops of the selection. The **View** section lets
you follow dependencies, dependents, or both; selecting another package moves the neighborhood to that instance.
During a simulation, **Show only simulated impact** lays out just the origins and their dependent instances.
Both views respect the development and direct-only filters and include relevant packages beyond the overview's reveal
depth. **Back to overview** restores the previous layout and viewport when its layout direction, label mode, and reveal set are
unchanged. Clearing a simulation exits impact-only view; importing another lockfile or resetting exits either view.
Searching outside an impact-only view returns to the overview so that package can be focused.

The Simulation section also lists **Affected packages by distance**, grouped by shortest hop count from any simulation
origin. It shows 50 installed instances per page, marks development-only packages, and lets you focus each instance.
The project root is reported separately. These canvas views never change simulation counts or exported reports, which
continue to use the full dependency graph.

Report downloads stay local and do not upload the lockfile or report. JSON uses report schema version 1; Markdown formats
the same snapshot for sharing in issues or PRs. Reports preserve lockfile identities, including duplicate instances and
non-npm resolution IDs. The project root appears among ancestors when reached, but package counts exclude the root and
the affected-package count also excludes the simulated origin. A missing root path is reported as unavailable. Parser
warning metrics count only parser warnings; the report's warning list can also include advisory lookup warnings.

GitHub imports require a public repository URL and network access. The repository metadata determines the default branch,
then the app checks the repository root on `raw.githubusercontent.com` in this order: `package-lock.json`,
`npm-shrinkwrap.json`, `pnpm-lock.yaml`, `pnpm-lock.yml`, `yarn.lock`, and `bun.lock`. The first file found is parsed;
an invalid or unsupported file reports its error rather than falling back to another lockfile. If only `bun.lockb`
is found, the app explains how to generate a supported text lockfile. The lockfile is parsed in browser memory
with the same 10 MiB limit and parser path as a local upload. No repository URL is fetched until you submit the GitHub
URL form.

The bundled graph and simulation work without OSV access. Advisory lookup requires network access; a failed lookup does
not prevent simulation. The footer reports lookup progress and partial or failed lookups. Select a package to distinguish
an unchecked package from a successful empty result or a failed lookup, and use **Check advisories again** to retry.
The right sidebar lists installed instances with known advisories even before you select a node. Select a list entry to
locate that package on the graph and view its OSV links. Advisory nodes have a purple halo and an `OSV:` label with their
advisory count, separate from the simulation's colors.

## Supported inputs and limitations

All formats have a **10 MiB** input limit and are parsed in browser memory.

| Input                                       | Supported format                     | Graph identity and caveats                                                                  |
| ------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `package-lock.json` / `npm-shrinkwrap.json` | npm v2/v3                            | Installed paths from `packages`; legacy `dependencies` is ignored                           |
| `pnpm-lock.yaml`                            | Lockfile v6/v9                       | Snapshot keys retain peer contexts; explicit workspace links connect importers              |
| `yarn.lock`                                 | Classic v1 and Berry metadata v2–v10 | Locked descriptors/resolutions; installed copies and resolved peer contexts are unavailable |
| `bun.lock`                                  | Text lockfile v0/v1                  | Recorded package keys retain nested copies; JSONC comments and trailing commas are accepted |

- For Yarn Classic, root declarations are not present in `yarn.lock`. Direct dependency flags and root paths are left
  unavailable rather than inferred. Berry workspace roots are used when explicitly recorded; development-only flags and
  resolved peer contexts are not reconstructed. Transitive simulation and advisory matching remain available.
- pnpm configuration documents preceding the project document are excluded with a warning. Bun's isolated linker and
  platform-specific installed layouts are not reconstructed. Unsupported sources and unresolved references produce
  caveats rather than guessed edges. See [parser details and references](docs/lockfile-formats.md).
- Binary `bun.lockb` is unsupported. Generate text with `bun install --save-text-lockfile --frozen-lockfile --lockfile-only`.
  npm v1 and pnpm formats other than v6/v9 are also unsupported.
- npm nodes represent installed paths, so duplicate copies of the same name and version remain separate. Other formats
  use their recorded resolution identities, which may group installed copies. Edges point from
  consumer to dependency; simulations follow them in reverse to find dependents.
- Runtime, optional, and peer dependencies are traced, along with development dependencies declared by the root project.
  Missing required peers produce warnings; missing peers explicitly marked optional are skipped silently.
- npm dependency resolution follows nested and hoisted installed paths. Workspace links and other linked packages are not
  fully traced. Local folder entries outside `node_modules` are skipped with warnings.
- Aliases (`npm:`), workspace, Git, file, link, and other unusual dependency ranges produce caveats. An installed target
  may still be connected by path, but the graph does not establish complete resolution for these cases or validate
  whether installed versions satisfy requested ranges.
- Development and optional indicators reflect lockfile metadata. They do not establish which packages execute in
  production. Large graphs can still be slow or crowded; progressive reveal, focused views, and layout caching reduce
  how much needs to be displayed or laid out at once.
- npm v2/v3 `hasInstallScript` metadata is shown as a package flag because the package runs a script at install time;
  this does not imply the package is malicious. Other supported lockfile formats do not provide this npm-specific flag,
  so it remains unset for those nodes.
- Simulations show hypothetical dependency exposure, not confirmed vulnerabilities, exploitability, or code execution.
  OSV advisory matches are separate external records; no returned advisories does not establish that a package is safe.

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) + TypeScript
- [Vite](https://vite.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Cytoscape.js](https://js.cytoscape.org/)
- [Iconify](https://iconify.design/)
- [Vitest](https://vitest.dev/)
- [Prettier](https://prettier.io/)

## Getting started

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

Then open http://localhost:5173.

## Scripts

| Command            | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| `npm run dev`      | Start the dev server                                         |
| `npm run build`    | Build for production                                         |
| `npm run preview`  | Preview the production build                                 |
| `npm run check`    | Type-check with `svelte-check`                               |
| `npm run lint`     | Check formatting with Prettier                               |
| `npm run format`   | Format the codebase                                          |
| `npm test`         | Run unit tests once                                          |
| `npm run test:e2e` | Run Chromium smoke tests for the demo and file import        |
| `npm run fixtures` | Download real-world lockfile fixtures used by optional tests |

## Browser smoke tests

Install the browser and download the pinned fixtures once while online:

```sh
npx playwright install chromium
npm run fixtures
npm run test:e2e
```

The tests start their own dev server on `127.0.0.1:4173`; keep that port free. After setup, they run without external
network access: OSV responses are stubbed and other external requests fail the tests. The yargs import test requires
its fixture and reports a setup error if it is missing. Tests cover demo search, simulation counts, JSON export,
and the real yargs file-picker import. Failure screenshots and traces are saved under `test-results/`.
Use `npx playwright show-trace <trace.zip>` to inspect a failed run.

## Deployment

The app is deployed on [Vercel](https://vercel.com/) with `@sveltejs/adapter-vercel` on the Node 24 runtime. Every push to
`main` deploys automatically. No environment variables or API keys are needed.

On Windows, `npm run build` stops at the final adapter step unless Developer Mode is enabled, because the adapter creates
a symlink. Vercel builds on Linux, so deploys are not affected.

## Privacy

Uploaded lockfiles are parsed in the browser and are not stored. Only package names and versions are sent to the server
for advisory lookups.

## License

See [LICENSE](LICENSE).

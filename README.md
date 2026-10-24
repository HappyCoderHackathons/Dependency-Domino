# Dependency Domino

> One compromised package. How far does it fall?

**Live demo:** [dependency.toolsmith.online](https://dependency.toolsmith.online/) (choose **Try Demo** to load a sample project)

Dependency Domino is a software supply-chain visualization tool. Import a project's `package-lock.json`, explore its
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

1. Open the live demo or start the app locally. Choose **Try Demo** for a bundled example, or **Import Lockfile** to
   select your project's `package-lock.json`. You can also drop the file onto the graph area.
2. Pan and zoom the graph. Click a package or search by name or version to select an installed instance. The details
   panel shows its version, installed path, source, and dependency information.
3. Choose **Simulate Compromise**. The animation highlights packages that depend on the selected instance, directly or
   indirectly. Results include a dependent count and a sample path from the project root when one exists.
4. Choose **Reset** to clear the simulation and selection while keeping the loaded graph, or select another package
   and simulate again.
5. Review **Warnings** in the footer for unresolved dependencies and unsupported relationships. A rejected file shows
   an error while keeping any previously loaded graph.

The bundled graph and simulation work without OSV access. Advisory lookup requires network access; a failed lookup does
not prevent simulation. The footer reports lookup progress and partial or failed lookups. Select a package to distinguish
an unchecked package from a successful empty result or a failed lookup, and use **Check advisories again** to retry.
The right sidebar lists installed instances with known advisories even before you select a node. Select a list entry to
locate that package on the graph and view its OSV links. Advisory nodes have a purple halo and an `OSV:` label with their
advisory count, separate from the simulation's colors.

## Supported inputs and limitations

- Only npm `package-lock.json` versions **2 and 3**, up to **10 MiB**, are supported. The parser uses the `packages` map
  and ignores the legacy top-level `dependencies` map. Yarn, pnpm, Bun, and npm v1 lockfiles are not supported.
- Nodes represent installed paths, so duplicate copies of the same name and version remain separate. Edges point from
  consumer to dependency; simulations follow them in reverse to find dependents.
- Runtime, optional, and peer dependencies are traced, along with development dependencies declared by the root project.
  Missing required peers produce warnings; missing peers explicitly marked optional are skipped silently.
- Dependency resolution follows nested and hoisted installed paths. Workspace links and other linked packages are not
  fully traced. Local folder entries outside `node_modules` are skipped with warnings.
- Aliases (`npm:`), workspace, Git, file, link, and other unusual dependency ranges produce caveats. An installed target
  may still be connected by path, but the graph does not establish complete resolution for these cases or validate
  whether installed versions satisfy requested ranges.
- Development and optional indicators reflect lockfile metadata. They do not establish which packages execute in
  production. Large graphs may be slow or crowded; progressive display and layout caching are still planned.
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
| `npm run fixtures` | Download real-world lockfile fixtures used by optional tests |

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

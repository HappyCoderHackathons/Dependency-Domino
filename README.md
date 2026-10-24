# Dependency Domino

> One compromised package. How far does it fall?

**Live demo:** https://dependency-domino-zeta.vercel.app/ (choose **Try Demo** to load a sample project)

Dependency Domino is a software supply-chain visualization tool. Import a project's `package-lock.json`, explore its
dependency graph, and select any package to run a hypothetical compromise simulation. The graph highlights every package
that depends on the selection, directly or indirectly, so you can see how far trust in one upstream package reaches.

The app can also query [OSV.dev](https://osv.dev/) for known advisories against exact package versions. Known advisories
and hypothetical simulation results are shown as separate kinds of information.

Dependency Domino is an exposure visualization and educational tool. It does not detect exploits, analyze malware, or
prove that a dependent package is vulnerable.

## Status

In active development. The lockfile parser, dependency graph, compromise simulation, and OSV advisory lookup work, and
the bundled demo runs end to end on the live site. Importing your own lockfile from the UI and showing advisories on the
graph are still being connected. See [the project plan](Dependency_Domino_24_Hour_Project_Plan.md) for scope and
milestones.

## Planned features

- Import npm `package-lock.json` (v2 and v3), processed locally in the browser
- Interactive dependency graph
- Reverse dependency simulation with layered, animated spread
- Impact summary with example paths back to the project root
- Known advisory lookup through OSV.dev
- Bundled demo lockfile for trying the app without your own project

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

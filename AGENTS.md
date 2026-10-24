# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Dependency Domino visualizes an npm project's dependency graph from a `package-lock.json` and simulates a hypothetical
compromise of any package, highlighting every package that depends on it directly or indirectly. It can also look up
known advisories from OSV.dev. The full product and implementation plan lives in
`Dependency_Domino_24_Hour_Project_Plan.md`. Read it before making design decisions.

## Stack

- SvelteKit (Svelte 5 runes) + TypeScript
- Vite
- Tailwind CSS v4 (`@tailwindcss/forms`)
- Cytoscape.js for the graph
- Iconify (`@iconify/svelte`) for icons
- Vitest for unit tests
- Prettier (tabs, single quotes, 120 char width)

No database, no auth, no persistence.

## Commands

| Task             | Command          |
| ---------------- | ---------------- |
| Dev server       | `npm run dev`    |
| Type check       | `npm run check`  |
| Lint (Prettier)  | `npm run lint`   |
| Format           | `npm run format` |
| Unit tests       | `npm test`       |
| Production build | `npm run build`  |

Run `lint` and `check` before committing. Keep testing lightweight and proportional to the change: use a few
representative tests for parser and graph behavior, and run focused tests when that behavior changes. Do not add
exhaustive tests or run the full suite before every commit. Run `test` and `build` once before opening a PR.

## Layout

```text
src/
  lib/
    types.ts        Shared graph and API contracts
    parser/         Lockfile parsing and dependency resolution
    graph/          Graph normalization and impact traversal
    components/     Svelte UI components
    fixtures/       Demo and test lockfiles
  routes/
    +page.svelte    Main app
    api/            Server endpoints (OSV proxy)
```

Import from `src/lib` with the `#lib` alias (e.g. `import type { DependencyGraph } from '#lib/types'`).

## Domain rules

- A graph node is an installed package instance keyed by its lockfile `packages` path (`""` is the root), not by
  package name or `name@version`.
- Support npm lockfile v2/v3 through the `packages` map only. Ignore the legacy top-level `dependencies` map.
- Edges point consumer -> dependency. Impact is a reverse BFS from the selected package.
- Keep real OSV advisories and hypothetical compromise results visually and textually distinct. Never imply the
  simulation proves exploitability.
- Uploaded lockfiles stay in browser memory. Only validated name/version pairs go to the server endpoint. Never store
  uploads.
- Keep parser and graph logic pure. Prefer a small set of useful Vitest tests with small fixtures over exhaustive coverage.

## Conventions

- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `ci:`).
- Do not add `Co-Authored-By` trailers or "Generated with" lines to commits or PRs.
- Use Iconify icons, not emojis.
- Do not over-comment code.
- In docs and UI copy: no em dashes, no overclaiming language.

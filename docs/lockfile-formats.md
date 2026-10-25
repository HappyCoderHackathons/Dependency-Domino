# Lockfile parsers

`parseDependencyLockfile(text, filename)` returns the existing `ParseResult` graph contract with a format label and npm
lockfile version on success. `parseDependencyFile(file)` checks size before reading and returns read errors as failures.
The upload component uses this one entry point; graph rendering, reverse BFS, and OSV queries consume the existing graph.
`parseLockfile(text)` remains the npm-specific API for existing callers and the bundled demo.

## Identities and scope

The root remains `""`. npm uses installed paths. pnpm uses `pnpm:<snapshot-key>`, Yarn uses `yarn:<descriptor-or-resolution>`,
and Bun uses `bun:<package-key>`. These preserve distinctions recorded by the respective lockfile, including pnpm peer
contexts and Bun nested copies. They do not claim to reconstruct an installation when the format lacks that information.

- **pnpm v6/v9:** use resolved references, never semver matching, to connect snapshots. Include importer nodes for explicit
  workspace links. v9 separates package metadata from dependency snapshots. In multi-document files, analyze the final
  project document and warn that preceding configuration graphs are excluded. Unlinked workspace importers may have no
  path from the root importer. Packages with unsupported non-registry resolution keys are skipped with warnings.
- **Yarn Classic/Berry:** use Yarn's parser for Classic syntax and bounded YAML parsing for Berry. Grouped selectors map
  to one lockfile entry, while separate records remain distinct. Berry `workspace:.` provides the project root when
  present. Classic has no root declarations, so it has a placeholder root with no invented edges. A companion
  `package.json` import is not implemented. Peers cannot be resolved from ranges alone and are not fabricated. Berry
  dependency metadata is used for optional edges, but development-only flags are unavailable.
- **Bun text v0/v1:** use JSONC parsing and nearest recorded package-path lookup, respecting scoped path components.
  Workspace package records use declarations from the matching workspace. Binary lockfiles are rejected before reading
  with a text-conversion command. Isolated linker layouts are outside this implementation.

Non-npm development-only flags are derived only for resolutions reachable through development edges and not through a
non-development path from the root. Unreachable resolutions remain unclassified. Optional flags use recorded metadata;
they do not establish platform installation. Only registry nodes with name/version pairs enter the existing OSV query.
Resolved graphs do not establish version-range satisfaction, exploitability, or runtime execution.

## Validation

Focused tests cover each format and the shared importer. `npm run fixtures` downloads SHA-256-verified lockfiles pinned
to commits in the pnpm, Yarn Classic, Yarn Berry, Bun, and yargs repositories. Optional real-file tests skip when downloads are absent and
check unique IDs, valid edge endpoints, graph conversion, and advisory-query compatibility. Fixtures are not executed or
installed, and their downloaded lockfiles are ignored by Git.

## Primary references

- [pnpm v9 specification](https://github.com/pnpm/spec/blob/master/lockfile/9.0.md)
- [pnpm v6 specification](https://github.com/pnpm/spec/blob/master/lockfile/6.0.md)
- [Yarn Classic lockfile documentation](https://classic.yarnpkg.com/en/docs/yarn-lock)
- [Yarn parser API](https://yarnpkg.com/api/yarnpkg-parsers)
- [Yarn Berry lockfile fixture](https://github.com/yarnpkg/berry/blob/ef16bb2e5826f2b4c342f387e4ac50fea86d4a51/yarn.lock)
- [Bun lockfile documentation](https://bun.sh/docs/pm/lockfile)
- [Bun text lockfile fixture](https://github.com/oven-sh/bun/blob/179664ea89f402c02af3fcd13b9bafeff1b7bcfd/bun.lock)

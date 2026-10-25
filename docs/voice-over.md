## Austin Sternberg

This is Dependency Domino.

I'm Austin Sternberg, and I worked on the backend.

That scales to real projects. This is the actual lockfile from the yargs repository: 28 direct dependencies and 562
installed packages.

Here is is-number. It does one small job, and nobody on this project chose it directly. Simulate a compromise, and the
trace climbs ten layers to the root.

Twelve packages depend on it, all through the gts lint tooling and all development-only, so the exposure sits in the
build toolchain.

You can also paste a public GitHub URL, and its lockfile is fetched live from the default branch. This project uses
Bun, and that works too.

## Conner Brunner

I'm Conner Brunner, on frontend and research.

How is this different from a dependency scanner? Tools like npm audit start from known advisories and list which
installed versions are flagged. Dependency Domino starts from any package and asks what depends on it, and through which
paths. It works before an advisory exists, and complements a scanner.

Known advisories still have a place, as separate context. These are real OSV records for exact versions in this
lockfile. A match does not mean the vulnerable code runs.

npm, pnpm, Yarn, and Bun lockfiles all work, parsed entirely in your browser.

Only package names and versions leave the browser. That's Dependency Domino. Thanks for watching.

## Savar Shrestha

And I'm Savar Shrestha, on frontend.

Developers choose a few dependencies and inherit many more. How far does one bad package reach?

Let's start with the small example. Each node is an installed package, and each edge points from a package to something
it depends on.

Pick a package, say tiny-pad, and assume it is compromised. The simulation walks the edges in reverse and lights up
everything that depends on it.

Six packages depend on it, and the panel shows the path from the project root, so you can see why.

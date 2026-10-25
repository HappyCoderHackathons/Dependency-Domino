# Voice-over script

Narration for the [demo video](demo/dependency-domino-demo.mp4), split by speaker. Each line starts at the time shown
and must finish before the next line's time. Read at a relaxed pace, about 2.5 words per second. Leave a short breath at
the start of each line so cuts between speakers stay clean.

Speaking order: Austin, Conner, Savar, Savar, Austin, Conner.

## Austin Sternberg

**0:00, title card.** About 3 seconds.

This is Dependency Domino.

**0:04, team card.** Speak first, then hand off to Conner.

I'm Austin Sternberg, and I worked on the backend.

**1:02, Real project loads.** About 11 seconds.

That scales to real projects. This is the actual lockfile from the yargs repository: 28 direct dependencies and 562
installed packages.

**1:14, searching is-number and simulating.** About 15 seconds.

Here is is-number. It does one small job, and nobody on this project chose it directly. Simulate a compromise, and the
trace climbs ten layers to the root.

**1:30, simulation summary.** About 10 seconds.

Twelve packages depend on it, all through the gts lint tooling and all development-only, so the exposure sits in the
build toolchain.

**2:19, GitHub URL import.** About 16 seconds.

You can also paste a public GitHub URL, and its lockfile is fetched live from the default branch. This project uses
Bun, and that works too.

## Conner Brunner

**0:08, team card, after Austin.**

I'm Conner Brunner, on frontend and research.

**1:41, comparison card.** About 21 seconds.

How is this different from a dependency scanner? Tools like npm audit start from known advisories and list which
installed versions are flagged. Dependency Domino starts from any package and asks what depends on it, and through which
paths. It works before an advisory exists, and complements a scanner.

**2:03, known advisories.** About 15 seconds.

Known advisories still have a place, as separate context. These are real OSV records for exact versions in this
lockfile. A match does not mean the vulnerable code runs.

**2:36, lockfile formats card.** About 7 seconds.

npm, pnpm, Yarn, and Bun lockfiles all work, parsed entirely in your browser.

**2:44, end card.** About 7 seconds.

Only package names and versions leave the browser. That's Dependency Domino. Thanks for watching.

## Savar Shrestha

**0:12, team card, after Conner.**

And I'm Savar Shrestha, on frontend.

**0:16, start screen.** About 7 seconds.

Developers choose a few dependencies and inherit many more. How far does one bad package reach?

**0:24, Small example loads.** About 12 seconds.

Let's start with the small example. Each node is an installed package, and each edge points from a package to something
it depends on.

**0:37, searching tiny-pad and simulating.** About 14 seconds.

Pick a package, say tiny-pad, and assume it is compromised. The simulation walks the edges in reverse and lights up
everything that depends on it.

**0:52, simulation summary.** About 9 seconds.

Six packages depend on it, and the panel shows the path from the project root, so you can see why.

## Pronunciation

- yargs: "yargs," one syllable, rhymes with "cargs"
- pnpm: "P-N-P-M," letters spelled out
- npm: "N-P-M"
- OSV: "O-S-V"
- gts: "G-T-S"
- is-number: "is number"
- tiny-pad: "tiny pad"

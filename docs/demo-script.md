# Demo script

A walkthrough of 2 minutes 52 seconds, under the 3-minute limit. The live demo and the
[backup video](demo/dependency-domino-demo.mp4) follow the same beats, so both tell the same story.

The video is 1080p with a music bed and no voice-over or captions. Times in the playbook match the video, so the VO
column doubles as the cue sheet for recording narration. [voice-over.md](voice-over.md) splits the same lines by speaker. Each line fits its window at about 2.5 words per second.

## Setup

- Desktop Chrome at 1600x900 or larger, dark mode, zoom 100%, bookmarks bar hidden, no other tabs visible.
- Open [dependency.toolsmith.online](https://dependency.toolsmith.online/) on a fresh load. No lockfile is loaded.
- Notifications off. Close the "Select a package" hint only if it covers the graph.
- Network on, so OSV lookup and GitHub import work. If the venue network fails, skip the advisory and GitHub beats and
  say both need network access.
- Fallback order: live demo, then the backup video, then `docs/screenshots/`.

## Playbook

| Time | Picture                                                                                      | VO                                                                                                                                                                                                                                                                                              |
| ---- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Title card: logo and tagline.                                                                | "Hi, this is Dependency Domino."                                                                                                                                                                                                                                                                |
| 0:04 | Team card: photos, names, and roles.                                                         | Austin: "I'm Austin Sternberg. I built the backend." Conner: "I'm Conner Brunner. I handled frontend and research." Savar: "And I'm Savar Shrestha. I worked on the frontend."                                                                                                                  |
| 0:16 | Start screen. Hover the headline.                                                            | "You pick a few dependencies, but you inherit many more. How far can one bad package reach?"                                                                                                                                                                                                    |
| 0:24 | **Try demo**, then **Small example**. Hover across the graph.                                | "Let's start with a small example. Each dot is an installed package, and each line points from a package to something it depends on."                                                                                                                                                           |
| 0:37 | Search `tiny-pad`, press Enter, then **Simulate compromise**. The trace animates.            | "Let's pick tiny-pad and pretend it's been compromised. The simulation follows those lines backward and lights up everything that depends on it."                                                                                                                                               |
| 0:52 | Collapse Details. Hover the dependent count, then the root path.                             | "Six packages depend on it, and the panel shows the path back to the project, so you can see exactly why."                                                                                                                                                                                      |
| 1:02 | **Try demo**, then **Real project**. Hover Direct dependencies and Installed instances.      | "Now let's look at a real project. This is the lockfile from the yargs repository, with 28 direct dependencies and 562 installed packages."                                                                                                                                                     |
| 1:14 | Search `is-number`, press Enter, then **Simulate compromise**. The trace runs to layer 11.   | "Let's search for is-number. It's a tiny utility that nobody on this project added directly. When we simulate a compromise, the trace climbs ten layers up to the project."                                                                                                                     |
| 1:30 | Collapse Details, press I to frame. Hover **Every path passes through**, then the count.     | "Twelve packages depend on it. Every path runs through the gts lint tool, and all twelve are dev dependencies."                                                                                                                                                                                 |
| 1:41 | Comparison card: dependency scanner versus Dependency Domino.                                | "How is this different from a scanner? npm audit starts from known advisories and lists the flagged versions. Dependency Domino starts from any package you pick and shows what depends on it, and how. It works before an advisory exists, and complements a scanner instead of replacing it." |
| 2:03 | **Reset**. Select a brace-expansion entry under **Known advisories**. Hover its OSV records. | "We still show known advisories, but separately. These are real OSV records for the exact versions in this lockfile. A match doesn't mean the vulnerable code actually runs."                                                                                                                   |
| 2:19 | **GitHub URL**, paste a public repository URL that uses `bun.lock`, submit. The graph loads. | "You can also paste a public GitHub URL, and we'll fetch the lockfile straight from the repository. This one uses Bun, which we support too."                                                                                                                                                   |
| 2:36 | Formats card: npm, pnpm, Yarn, and Bun.                                                      | "It supports npm, pnpm, Yarn, and Bun lockfiles, all parsed in your browser."                                                                                                                                                                                                                   |
| 2:44 | End card: logo, URL, team, music credit.                                                     | "That's Dependency Domino. Your lockfile never leaves your browser. Thanks for watching."                                                                                                                                                                                                       |

If a live beat runs long, shorten the small example first, then the GitHub import.

## Claims check

Every spoken or on-screen claim, with how it was verified against the app or source.

| Claim                                                              | Verified by                                                                                           |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| tiny-pad has 6 dependents and a path from the root                 | Small example simulation summary; browser smoke test asserts the count                                |
| The Real project demo is the yargs repository's lockfile           | `src/lib/fixtures/demos/README.md`, pinned commit and SHA-256                                         |
| 28 direct dependencies, 562 installed instances                    | Graph summary on the loaded demo (`docs/screenshots/02-graph-overview.png`)                           |
| is-number's trace reaches ten hops to the root                     | Simulation summary, "Hops to the project root: 10", playback "Layer 11 of 11" (origin layer included) |
| 12 dependents, all development-only, through gts                   | Simulation summary and **Every path passes through** (`docs/screenshots/04-simulation-result.png`)    |
| Scanners start from known advisories                               | `npm audit` reports installed versions that match published advisories                                |
| Domino starts from any package and works before an advisory exists | Simulation runs on any selected instance and does not use advisory data                               |
| Advisories are real OSV records for exact versions                 | OSV proxy in `src/routes/api/`, advisory panel links to OSV entries                                   |
| A match does not mean the vulnerable code runs                     | Matches the app's own copy in the Known advisories panel                                              |
| GitHub import fetches live from the default branch                 | README GitHub import section                                                                          |
| npm, pnpm, Yarn, and Bun lockfiles are supported                   | README supported inputs table                                                                         |
| Only names and versions leave the browser                          | README Privacy section and `AGENTS.md` domain rules                                                   |

Words to avoid: "proves", "detects", "vulnerable" (for simulated packages), "safe" (for packages with no advisories).
The simulation is hypothetical. Advisory counts come from a live service and can change between runs, so the script
names no advisory count.

## Credits

Music: "Gravity Turn (calm)" by vitalezzz, [CC0](https://creativecommons.org/publicdomain/zero/1.0/), from
[OpenGameArt](https://opengameart.org/node/155271).

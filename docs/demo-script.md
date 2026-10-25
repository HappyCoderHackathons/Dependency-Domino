# Demo script

A live walkthrough of about 2 minutes 30 seconds, with a hard limit of 3 minutes. The backup video follows the same
beats, so the live demo and the recording tell the same story.

## Setup

- Desktop Chrome at 1600x900 or larger, dark mode, zoom 100%, bookmarks bar hidden, no other tabs visible.
- Open [dependency.toolsmith.online](https://dependency.toolsmith.online/) on a fresh load. No lockfile is loaded.
- Notifications off. Close the "Select a package" hint only if it covers the graph.
- Network on, so OSV lookup completes. If the venue network fails, skip beat 7 and say advisories need network access.
- Fallback order: live demo, then the backup video, then `docs/screenshots/`.

## Playbook

Times are cumulative. VO is what the presenter says; on-screen text is the caption burned into the backup video.

| Time      | Picture                                                                                                | Source           | VO                                                                                                                                                                                   | On-screen text                                       |
| --------- | ------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 0:00-0:15 | Start screen. Hold on the headline, then hover **Real project**.                                       | Chrome, live app | "Most developers choose a few dependencies. They inherit many more. Dependency Domino shows how far trust in one package reaches."                                                   | Choose a few dependencies.\nInherit many more.       |
| 0:15-0:35 | Click **Real project**. The yargs graph loads. Point at the instance count and Graph summary.          | Chrome, live app | "This is the real lockfile from the yargs repository. It records 28 direct dependencies, and 562 installed package instances in total. It is parsed in the browser."                 | Real lockfile: yargs\n28 direct, 562 installed       |
| 0:35-0:50 | Pan and zoom once. Point at **Show more** and the minimap.                                             | Chrome, live app | "Large graphs reveal progressively, so the canvas stays readable. Search reaches every package, even ones not drawn yet."                                                            | Large graphs reveal progressively                    |
| 0:50-1:10 | Type `is-number` in Search and press Enter. The details panel opens.                                   | Chrome, live app | "Here is is-number. It does one small job, and nobody on this project chose it directly. It is ten hops from the root."                                                              | is-number: 10 hops from the root                     |
| 1:10-1:35 | Click **Simulate compromise**. Let the trace animate layer by layer up to yargs.                       | Chrome, live app | "Let's assume this one package is compromised. The simulation walks the graph in reverse and lights up everything that depends on it, layer by layer."                               | Hypothetical compromise:\nwhat depends on it?        |
| 1:35-2:00 | Collapse Details. Show the Simulation summary: 12 dependents, the path, **Every path passes through**. | Chrome, live app | "Twelve installed packages depend on it, through a chain that runs from the gts lint tooling down to is-number. All twelve are development-only, so this is build tooling exposure." | 12 dependents, all development-only                  |
| 2:00-2:20 | Choose **Reset**. Open **Known advisories** in the left sidebar and select a brace-expansion entry.    | Chrome, live app | "Known advisories are separate. These are real records from OSV.dev for exact versions in this lockfile. A match does not mean the vulnerable code runs here."                       | Known advisories: real OSV records\nshown separately |
| 2:20-2:35 | Choose **Simulate exposure** on that advisory entry, then **Download summary PNG**.                    | Chrome, live app | "You can trace exposure from an advisory too, and export the result as a report or an image to share."                                                                               | Export JSON, Markdown, or PNG                        |
| 2:35-2:50 | Return to the start screen via **Close lockfile**. Hold on the privacy line.                           | Chrome, live app | "Lockfiles stay in your browser. Only package names and versions go to the advisory lookup. Dependency Domino is an exposure map, not a vulnerability scanner."                      | Lockfiles stay in your browser                       |

Total: 2:50. If a beat runs long, cut beat 3 first, then beat 8.

## Claims check

Every spoken or on-screen claim, with how it was verified against the app or source.

| Claim                                                    | Verified by                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| The Real project demo is the yargs repository's lockfile | `src/lib/fixtures/demos/README.md`, pinned commit and SHA-256                                               |
| 28 direct dependencies, 562 installed instances          | Graph summary on the loaded demo (`docs/screenshots/02-graph-overview.png`)                                 |
| is-number is ten hops from the root                      | Simulation summary, "Hops to the project root: 10" (`docs/screenshots/04-simulation-result.png`)            |
| 12 installed packages depend on is-number                | Simulation summary, "12 installed package instances depend on is-number"                                    |
| All 12 are development-only                              | Simulation summary, "Development only: 12", "Not marked dev-only: 0"                                        |
| The chain passes through gts lint tooling                | **Every path passes through** list in the same screenshot                                                   |
| Advisories are real OSV records for exact versions       | `src/routes/api/` OSV proxy, advisory panel links to OSV entries (`docs/screenshots/05-advisory-panel.png`) |
| A match does not mean the vulnerable code runs           | Matches the app's own copy in the Known advisories panel                                                    |
| Only names and versions go to the server                 | README Privacy section and `AGENTS.md` domain rules                                                         |
| Not a vulnerability scanner                              | README positioning statement                                                                                |

Words to avoid: "proves", "detects", "vulnerable" (for simulated packages), "safe" (for packages with no advisories).
The simulation is hypothetical; advisory counts come from a live service and can change between runs, so the script
names no advisory count.

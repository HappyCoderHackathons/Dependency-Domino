## Austin Sternberg

Hi, this is Dependency Domino.

I'm Austin Sternberg. I built the backend.

Now let's look at a real project. This is the lockfile from the yargs repository, with 28 direct dependencies and 562
installed packages.

Let's search for is-number. It's a tiny utility that nobody on this project added directly. When we simulate a
compromise, the trace climbs ten layers up to the project.

Twelve packages depend on it. Every path runs through the gts lint tool, and all twelve are dev dependencies.

You can also paste a public GitHub URL, and we'll fetch the lockfile straight from the repository. This one uses Bun,
which we support too.

## Conner Brunner

I'm Conner Brunner. I handled frontend and research.

How is this different from a scanner? npm audit starts from known advisories and lists the flagged versions. Dependency
Domino starts from any package you pick and shows what depends on it, and how. It works before an advisory exists, and
complements a scanner instead of replacing it.

We still show known advisories, but separately. These are real OSV records for the exact versions in this lockfile. A
match doesn't mean the vulnerable code actually runs.

It supports npm, pnpm, Yarn, and Bun lockfiles, all parsed in your browser.

That's Dependency Domino. Your lockfile never leaves your browser. Thanks for watching.

## Savar Shrestha

And I'm Savar Shrestha. I worked on the frontend.

You pick a few dependencies, but you inherit many more. How far can one bad package reach?

Let's start with a small example. Each dot is an installed package, and each line points from a package to something
it depends on.

Let's pick tiny-pad and pretend it's been compromised. The simulation follows those lines backward and lights up
everything that depends on it.

Six packages depend on it, and the panel shows the path back to the project, so you can see exactly why.

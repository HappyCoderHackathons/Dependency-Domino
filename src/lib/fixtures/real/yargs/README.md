# yargs package-lock.json

Real-world lockfile used to check that the parser handles a project with a few hundred packages.

- Source: [yargs/yargs](https://github.com/yargs/yargs) at commit `8021675da05763e13d9744aef953be65c0fd878f` (2026-10-13)
- License: MIT, Copyright 2010 James Halliday; Modified work Copyright 2014 Contributors
- Not committed because of its size. Run `npm run fixtures` to download it; the script checks it against a pinned SHA-256 hash, so the file is byte-for-byte as published.
- Without it, the real-world lockfile tests are skipped.

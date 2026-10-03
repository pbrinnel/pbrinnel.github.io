# Agent Sim Test

A predator–prey–resource simulation: bunnies, wolves and blades of grass on a tile grid.
Paul's project; he answers design questions, Claude builds.

## Start here

- `DESIGN.md` is the spec. Everything in it is decided by Paul. Don't change a decision
  without asking him.
- `tables/*.csv` hold every number and are the source of truth. The sim reads them at
  startup; never hard-code a value that has a column there. Every number is a placeholder
  for tuning, so the code must not depend on any particular value.
- `_original-notes.txt` is Paul's first sketch, kept for history. `DESIGN.md` supersedes it.

## Rules

- **Don't guess.** When the spec doesn't cover something that changes behavior, ask Paul
  before building it. Implementation details that don't change what he sees are yours.
- **This folder is public.** GitHub Pages publishes it at paulbrinnel.com/Test/agent-sim/
  as soon as it reaches master. Scratch and test files go in the repo's `.claude/`
  (git-ignored), not here.
- Stay inside `Test/agent-sim/`. The rest of the repo is Paul's site and games; other
  sessions work there at the same time. Don't touch it.
- Paul pushes. Commit when he asks, only your own files (`git status` and `git diff` first),
  then tell him it's ready to push.
- Every `<script src>` and CSV `fetch` carries `?v=N`; bump them all together on every
  commit. Pages caches for ten minutes, and a half-updated set of files breaks the page.
- Serve it to test: the `site` preview config in `.claude/launch.json` serves the repo root
  on port 8912, so the sim is at `http://localhost:8912/Test/agent-sim/`. Port 8912 is often
  taken; `site-auto` picks a free one.
- Verify on a phone-sized viewport as well as desktop; phone is a target.
- Event marks (bites, births, deaths) fade and are capped per second. Never strobe or flash.
- American spelling in text and comments.

## Comments

- A comment says why the code is the way it is now.
- Old behavior and old tuning values go in the commit message, not the code.
- Name a constant (or CSV column) rather than repeating its value in prose.

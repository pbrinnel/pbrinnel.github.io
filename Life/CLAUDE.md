# Life

A predator–prey–resource simulation: bunnies, wolves and blades of grass on a tile grid,
at paulbrinnel.com/life.html. Paul's project; he answers design questions, Claude builds.
The goal is a self-sustaining ecosystem (DESIGN.md, top).

## Start here

1. `DESIGN.md`: the spec, the milestones (all done) and the tuning notes. Everything in it is decided
   by Paul. Don't change a decision without asking him.
2. `MAP.md`: the code map: files, load order, data layout, who writes what, the tick,
   the tools. Read it before opening code; keep it true when you change structure.
3. `tables/*.csv`: every number, and the source of truth. The sim reads them at startup;
   never hard-code a value that has a column there. Every number is a placeholder for
   tuning, so neither the code nor the checks may depend on any particular value.
4. Before and after any change: `node Life/_tools/check-all.js` (about 3 minutes, no
   browser). It must end "All checks passed".

`_original-notes.txt` is Paul's first sketch, kept for history; DESIGN.md supersedes it.

## Rules

- **Don't guess.** When the spec doesn't cover something that changes what Paul sees or how
  the sim behaves, ask him before building it, and record his answer in DESIGN.md.
  Implementation details that don't change either are yours.
- **What's public.** GitHub Pages publishes `life.html` and everything in `Life/` whose
  name doesn't start with `_` or `.`, Markdown included, as soon as it reaches master. The
  repo itself is public on GitHub.
  - `Life/_tools/` and `Life/_lab/` are tracked but never published, like the repo's
    `_ref/` and `_worker/`.
  - Screenshots and scratch go in the repo's `.claude/` (git-ignored), e.g.
    `.claude/life-shots/`.
- **Unlisted, always.** `life.html` keeps `<meta name="robots" content="noindex, nofollow">`,
  has no `og:`/`twitter:` tags and no analytics unless Paul asks, and nothing on the site
  links to it. People find it by direct URL only.
- Stay inside `life.html` and `Life/`. The rest of the repo is Paul's site and games;
  other sessions work there at the same time. Don't touch it.
- Paul pushes. Commit when he asks, only your own files (`git status` and `git diff`
  first), then tell him it's ready to push.
- **Versions.** Every `<script src>` and the stylesheet in `life.html`, and the CSV
  `fetch`, carry `?v=N` (the CSV one through `AS.V`). Bump `AS.V` and every `?v=` together
  on every commit that changes `life.html` or anything in `Life/` the page loads. Pages
  caches for ten minutes, and a half-updated set of files breaks the page.
- **Serve it to test.** The `site` preview config in `.claude/launch.json` serves the repo
  root on port 8912 (often taken; `site-auto` picks a free one), so the sim is at
  `http://localhost:<port>/life.html`. The browser tools in `_tools/` default to
  `http://localhost:8914/life.html`; set `LIFE_URL` to point them elsewhere.
- **The browser pane throttles when hidden.** If the Claude app's browser pane isn't on
  screen, the page sees itself as a background tab and animation frames nearly stop. For
  anything timed (speed, benchmarks, screenshots of motion) use `_tools/shoot.js` or
  `_tools/run-bench.js`, which drive a real windowed Chrome.
- Verify on a phone-sized viewport as well as desktop; phone is a target. Paul's phone is an
  iPhone; Safari is the browser to judge it by (Firefox on iOS caps pages at 30 fps).
- Never strobe or flash. Event poses (a bite, a mouthful, a death) hold for a minimum of
  real time, and legs stop cycling when the sim runs too fast to show steps (DESIGN.md,
  "Photosensitivity").
- Colors in charts are validated for color-blind readers (MAP.md, "Colors"); don't swap
  them by eye.
- American spelling in text and comments.

## Working with agents

The project was built by a lead session handing bounded tasks to subagents. That works
well here because files are small and single-purpose:

- Give an agent one or two files, the interface they must meet (MAP.md), the parts of
  DESIGN.md and the CSVs that apply, and a check script that proves it's done.
- Never let two agents edit the same file at the same time.
- Review every diff and run the result before calling it done.

## Comments

- A comment says why the code is the way it is now.
- Old behavior and old tuning values go in the commit message, not the code.
- Name a constant (or CSV column) rather than repeating its value in prose.

# pbrinnel.github.io

Paul's site, paulbrinnel.com. GitHub Pages serves `master` directly, so whatever reaches master is live.

## Publishing

- Pages builds with Jekyll. Folders starting with `_` and dotfiles are not published. Everything else is, Markdown included.
- The repo is public, so anything committed can be read on GitHub even where the site doesn't serve it.
- Dev-only files (notes, test pages, tools) go in `.claude/`, which git ignores apart from this file.
- Reference docs that should reach every session on any machine go in `_ref/`, tracked. Like `_worker/`, the leading underscore keeps Jekyll from publishing it, so it is on GitHub but never on the site.
- Paul pushes. Commit when he asks, then tell him it's ready to push.
- Other Claude sessions may be working in this folder at the same time. Before committing, check `git status` and `git diff`, and commit only your own changes.

## brandon.html

A game with a shared online leaderboard.

- **Read `_ref/BRANDON.md` before you open the game.** It is the map: the phase machine, the shape of a frame, and how to find a section. It is short on purpose. Keep it true — it tells you when it needs updating.
- Navigate by section, not by reading the file. `grep -n "// ---- " brandon.html` lists all 41 in order. Line numbers shift under edits from other sessions; section names don't.
- **The leaderboard is live and public.** `BOARD_URL` points at a Cloudflare Worker (source in `_worker/`). Any test that reaches the initials screen and presses OK posts a real row.
  - Before testing anything near the end of a run, override `window.fetch` for `workers.dev` URLs. The game looks `fetch` up at call time, so overriding it after the page loads works.
- Throwaway copies of the game go in `.claude/`. In each copy, empty `BOARD_URL`, rename `BEST_KEY` and remove the analytics tag, then delete the copy when done.
- Test through a local static server, for example `npx http-server . -p 8912 -c-1`.
- Only Paul can remove a leaderboard row, by hand in the Cloudflare dashboard (Workers KV → `brandon-board` → key `top`). While the table has fewer than ten rows, any finished run gets on.
- The worker's limits (ten rows, scores up to 10,000,000) must stay in step with `TOP_N` and `SCORE_CAP` in the page.
- What players load stays one self-contained file. Pages are cached for ten minutes, so a page split across several files can reach a returning player half-updated.
- Keep the game a surprise. Nothing shareable (link previews, the homepage, screenshots, posts) shows gameplay. The share image is the splash, and the missing `og:description` is deliberate.
- Feel numbers (spin, speeds, angles, timings) stay flat named `const`s. When a change is about how something feels, offer Paul a slider page to tune it himself instead of guessing values.
- Don't rebuild the spin lab. If `.claude/spinlab/` exists, write what the next build will need into `.claude/spinlab/TODO.md` instead — new sliders, hooks, panel rows — and say so when you finish. Paul rebuilds it when he next wants it: `node .claude/spinlab/spinlab-build.js`.

## Comments

- A comment says why the code is the way it is now.
- What the code used to do, and old tuning values, go in the commit message.
- When you change code, fix or delete the comments that describe it in the same edit.
- Name a constant rather than repeating its value in prose, so retuning can't make the comment wrong.

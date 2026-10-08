# pbrinnel.github.io

Paul's site, paulbrinnel.com. GitHub Pages serves `master` directly, so whatever reaches master is live.

## Publishing

- Pages builds with Jekyll. Folders starting with `_` and dotfiles are not published. Everything else is, Markdown included.
- The repo is public, so anything committed can be read on GitHub even where the site doesn't serve it.
- Dev-only files (notes, test pages, tools) go in `.claude/`, which git ignores apart from this file.
- Reference docs that should reach every session on any machine go in `_ref/`, tracked. Like `_worker/`, the leading underscore keeps Jekyll from publishing it, so it is on GitHub but never on the site.
- Paul pushes. Commit when he asks, then tell him it's ready to push.
- Other Claude sessions may be working in this folder at the same time. Before committing, check `git status` and `git diff`, and commit only your own changes.

## The games are offline (since 8 Oct 2026)

`brandon.html` and `fourkeys.html` are parked in `_offline/`, which Jekyll doesn't publish,
so both URLs 404. Everything they load (`js/fourkeys/`, `fonts/fourkeys/`, `images/brandon/`)
stayed where it was, so they need no edits to come back. Both leaderboard workers were left
running. To restore, Paul runs:

    git mv _offline/brandon.html _offline/fourkeys.html . && git commit -m "Restore the games"

and pushes. Then delete this section. Until then, the paths in the two sections below mean
`_offline/`, and nothing players can reach is affected by edits there.

## brandon.html

A game with a shared online leaderboard.

- **Read `_ref/BRANDON.md` before you open the game.** It is the map: the phase machine, the shape of a frame, and how to find a section. It is short on purpose. Keep it true — it tells you when it needs updating.
- Navigate by section, not by reading the file. `grep -n "// ---- " brandon.html` lists all 44 in order. Line numbers shift under edits from other sessions; section names don't.
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

## fourkeys.html

The sequel, under a codename. `brandon.html` is the released game and sequel work never
touches it.

- **Unlisted, like brandon.html**: `noindex, nofollow`, not linked from anywhere, and no
  `og:`/`twitter:` tags at all, so a pasted link shows nothing. It carries the site's Google
  tag, which loads only on paulbrinnel.com so local tests don't count; copies and labs
  remove it all the same, like brandon.html's. Its bests are its own,
  one per level, kept with the town's progress (`menuBestIs` in `menu.js`).
- **Its leaderboards are live and public, and separate from brandon's.** `BOARD_URL` in
  `engine.js` points at the `brandon2-board` worker (source in
  `_worker/brandon2-leaderboard-worker.js`, its own KV namespace `brandon2-board`): a table
  per stage plus TOTAL. Anything long-lived is named `brandon2`, the name it launches
  under. Any test that gets past the initials screen posts a real row, and one also
  counts toward TOTAL, so stub `window.fetch` for `workers.dev` first, exactly as for
  brandon.html. Only Paul can remove rows, in the Cloudflare dashboard (KV →
  `brandon2-board` → keys `view` and `bests`; a row gone from `view` still counts in TOTAL
  until it is gone from `bests` too).
- The worker's stage list (`STAGES`, `IN_TOTAL`) must stay in step with `BOARD_IDS` in
  `engine.js`, and its caps with `TOP_N` and `SCORE_CAP`. A new stage means editing
  the worker and redeploying it in the dashboard.
- Its code is in `js/fourkeys/`: `engine.js` (brandon.html's game, forked 22 Sep 2026 and
  edited here from now on), `runtime.js` (the seam the bosses plug into), a file per boss,
  mini-boss and paddle, `powers.js` (the sequel's eight capsules, KATAMARI to WILD),
  `levels.js` (each level's three screens: a wall, a second
  wall a mini-boss makes an entrance on, then the boss), `dark.js` (the VOLCANO fight's
  dark room: lit only by what burns, the rest flat silhouettes), `storm.js` (the VOID
  fight's storm: silhouette and lightning, his cracked red sky in the last part; it only
  draws, and every flash in it is rationed for photosensitive players), `menu.js` (the town), `debug.js` (what the konami code and
  `?debug` open: the keys, the paddles, and a hold to forget it all), `intro.js` (the
  BRANDON WINS and 2000 YEARS LATER cards before the town), `memory.js` (the cutscene a
  level's first win plays and MEMORIES replays), `lore.js` (the lines PAUSED, and READY after a
  lost head, pick from at random; Paul writes them), and `start.js`, which is where the game
  begins.
- The boss lab builds from these files but not from `intro.js`, `debug.js`, `levels.js` or `powers.js`, and it runs
  brandon.html's engine. It does build `memory.js`, for the VOID's end (Odin, and his
  voice). So a module that calls something only fourkeys has must check it with `typeof`
  first, and a new top-level name must not already be used in
  brandon.html (the lab refuses a name declared twice). Where the lab needs an engine
  change of fourkeys', the build lifts it out of `engine.js` rather than copying it (the
  paddle split, `spread()`..`halfSpan()`, is the first).
- **Load order is the whole design and `fourkeys.html` sets it.** They are plain scripts
  sharing one scope: runtime and modules first, `engine.js` after them, `start.js` last.
  Nothing in a module may READ an engine const at load time — inside a function is fine.
- **Every font ships with the game**, in `fonts/fourkeys/` (woff2, with each font's OFL
  licence), declared by `@font-face` in `fourkeys.html`. Never a system font or a font
  service: text must look the same on every machine. Fira Sans is the player's and the
  UI's; each other Brandon speaks in his own font and colour (see `MEM_VOICE` in
  `memory.js`).
- Brick screens use brandon.html's brick size: seven across, every screen. An exception needs
  a specific reason (Paul, 27 Sep 2026). The layout rules are in `levels.js`'s header.
- The capsules are tuned in the powerup lab, `.claude/powerlab/` (git-ignored, on Paul's Mac):
  `node .claude/powerlab/powerlab-build.js` builds `.claude/fourkeys-powerlab.html` from these same
  files, with a slider tab per capsule. Rebuild it after changing `powers.js` or its hooks in `engine.js`.
- **Save files (`.brandon`) are specified in `_ref/BRANDON-SAVE.md`.** Read it before you
  touch saved progress in any way: a new unlock, paddle, memory, stage or anything kept in
  `menu`. Every new thing needs a pinned save token, and the doc changes in the same
  commit. Old saves must always keep loading.
- Every `<script src>` carries `?v=N`. Pages are cached for ten minutes, so **bump all of
  them together on every deploy** or someone gets one new file and one old one.
- The boss lab builds from these same files; only the panel is the lab's own. Tuning a boss
  in the lab is tuning what the game ships. The lab still wraps `brandon.html`'s engine
  rather than `engine.js`, so the two engines will drift — repoint it when that starts to
  matter.

## life.html and Life/

A separate project, the Life simulation (bunnies, wolves, grass), at
paulbrinnel.com/life.html; its code lives in `Life/`. Unlisted like brandon.html: found by
direct URL only, never indexed or linked. Its own rules are in `Life/CLAUDE.md` and its
code map in `Life/MAP.md`; read both before working there. It shares nothing with the
games.

## Comments

- A comment says why the code is the way it is now.
- What the code used to do, and old tuning values, go in the commit message.
- When you change code, fix or delete the comments that describe it in the same edit.
- Name a constant rather than repeating its value in prose, so retuning can't make the comment wrong.

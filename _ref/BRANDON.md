# brandon.html: the map

How to get oriented in a 5,247-line single file without reading it end to end.

**Current as of `2857fea`, 19 Sep 2026.** Before trusting anything below, run:

```bash
git log --oneline 2857fea..HEAD -- brandon.html
```

Nothing listed means this file is still true. A short list means read those commit
messages; they say what moved. A long list means this file was not kept up and you
should treat it as a starting point, not an authority — then fix it before you finish.

## What the file is

One `<head>` with the analytics tag and the CSS, a few `<div>`s, one `<canvas>`, and
one `<script>` holding a single IIFE closure of about 5,000 lines. No modules, no
build step, no imports. Every function and every piece of state is in that one scope,
so anything can reach anything.

The field is a fixed **800 x 600** coordinate space (`LW`, `LH`). `resize()` scales the
canvas to fit whatever the device actually shows and sets `uiScale` so the HUD stays
readable when the field shrinks. You draw in field coordinates and never think about
device pixels.

Why one file: a player loads exactly one thing. Pages caches for ten minutes, so a page
split across several files can reach a returning player half-updated. See CLAUDE.md.

## Where things are

The map is in the file, not in this document. 42 sections, in reading order:

```bash
grep -n "// ---- " brandon.html
```

That gives you the whole table of contents in one call — `the shape`, `the boss`,
`the endless gauntlet`, `physics`, `drawing`, `loop`, and so on. Find your section,
read that span, stop. **Do not read the file top to bottom**; it is 248 KB and you
will spend most of a context window learning things you did not need.

Line numbers are not stable — Paul edits from other sessions and everything below a
change shifts. Names are stable. Navigate by section name and by `grep`.

Rough shape of the order: constants and tuning first (lines ~279–970), then canvas
and mutable state, then the small helpers, then input, then collision and physics,
then all the drawing, then the loop at the very bottom.

## The phase machine

This is the one thing you cannot reconstruct with a single grep, and the thing most
worth knowing before you touch anything.

A single `let phase` string drives the whole game. **Twelve** values:

| phase | what it is |
|---|---|
| `entrance` | he is not on the field yet |
| `ready` | waiting for the serve |
| `play` | a normal rally |
| `siphon` | the second-wind scene, world held |
| `ascend` | he is going for the throne |
| `cleared` | the stage is done |
| `absorb` | the takeover, before you have the throne |
| `gauntlet` | the endless mode, its own game entirely |
| `fall` | the gauntlet ending |
| `over` | game over, continue or let it stand |
| `initials` | entering initials — **posts a real leaderboard row** |
| `scores` | the table |

Watch for two traps:

- `grep "phase = '"` finds only eleven. `absorb` is set by a ternary at
  `phase = gAbsorbLeft > 0 ? 'absorb' : 'gauntlet'`, in the `endless gauntlet`
  section. Grep `phase =` if you want them all.
- `PLAYING` (a `Set` in `the mouse, captured`) is the subset where the field owns the
  pointer lock. It lists nine of the twelve; `over`, `initials` and `scores` are the
  screens with buttons, and a lock that survives into them is released by the loop.

About 65 places branch on `phase`. If you add one, grep `phase ===` and decide about
each site — several are `king && (phase === 'gauntlet' || 'absorb' || 'fall')`
repeated verbatim, which is the "are we in the gauntlet" test.

## A frame

The loop at the bottom of the file:

```
dt clamped to 0.05   →  release a stray pointer lock  →  update(dt)  →  draw()
```

`dt` is clamped so a tab-out does not teleport the ball. `paused` freezes `update`
but not `draw` — the picture keeps painting while the world stands still.

`update()` forks immediately: if the throne is yours it calls `updateGauntlet()` and
returns. **The gauntlet is a separate game** — no ball, no paddle, no wall, no
capsule. Nothing in the main update applies. Same fork in `draw()`. When a change
should affect both, you have to make it twice, and it is easy to forget the second.

Ordering inside `update()` is load-bearing and commented where it matters: his
reactions before his box is placed, his box before the physics, whatever he has
caught after he has moved, his span before the clamp.

## Invariants

Breaking one of these breaks the live site or spoils the game.

- **Anything that reaches `master` is live.** Pages serves it directly.
- **The leaderboard is real.** Reaching the initials screen and pressing OK posts a
  public row that only Paul can remove, by hand in Cloudflare. Stub `window.fetch`
  for `workers.dev` before testing anything near the end of a run. The game looks
  `fetch` up at call time, so overriding it after load works.
- **`TOP_N` (10) and `SCORE_CAP` (9999999) must stay in step with the worker**
  in `_worker/`. The worker enforces its own copy of both and rejects what
  disagrees.
- **One self-contained file** for what players load.
- **Nothing shareable shows gameplay.** The share image is the splash. The missing
  `og:description` is deliberate.
- **Feel numbers stay flat named `const`s** near the top. When a change is about how
  something feels, build Paul a slider page instead of guessing values.

## Already tried and rejected

Do not re-propose these without new information. The reasoning is in Claude's memory
on this Mac and in the commit history:

- **Splitting the source into files with a join step.** Prototyped byte-identical,
  15 Sep 2026; Paul skipped it. The full write-up is at
  `.claude/brandon-refactor-proposal.md`, which is git-ignored — it exists on Paul's
  Mac and nowhere else, so do not go looking for it on a fresh clone.
- **Magnus / grip / eccentric spin physics.** Made the game less fun. Gyroscopic
  stabilization is not a thing in 2D.
- **A GBA port.** The photo art and the swipe-driven spin are what do not survive
  240x160 and a D-pad.
- **A letter wheel for initials.** Was in for a while and was worse.

## Keeping this true

The only reason this file is worth having is that it is short enough to keep true and
narrow enough to rarely need it. Both properties are easy to lose.

**It holds:** the phase machine, the frame, the coordinate space, the invariants, the
rejected list, and how to navigate. Things that change rarely.

**It must never hold:** tuning values, mechanic descriptions, line numbers, or
anything a comment in the file already says. Those change constantly, and a second
copy is a second thing to drift. The inline comments already drift within days at the
rate this file moves; a detached copy would drift faster and more quietly.

**Update it when** you add or remove a phase, change the shape of a frame, change an
invariant, or get an approach rejected. Bump the commit hash and date at the top in
the same edit. Otherwise leave it alone — a change to how the boss behaves does not
belong here.

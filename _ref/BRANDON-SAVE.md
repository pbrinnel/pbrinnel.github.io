# The .brandon save file

`.brandon` is the save-file extension for Paul's games. Each file names the game it
belongs to on its first line. This doc covers **brandon2** (codename fourkeys), game id
`BRANDON2`. If another game gets `.brandon` saves, give it its own id and its own section
or doc, and never let one game load another's saves.

This is the spec for fourkeys' save file: what **EXPORT SAVE** writes and **IMPORT SAVE**
reads, from the SETTINGS building in the town. Every save a player has ever downloaded
must keep loading, so this doc is the contract.

The code is in `js/fourkeys/menu.js`, section `// ---- the save file`. **If you change
what that section writes or reads, update this doc in the same commit.** The changelog at
the bottom is where each format change is recorded.

## Example

```
BRANDON2 SAVE 1
KEY FARM
KEY CITY
PADDLE GILT
MEMORY EXHORTATION
GAVE FARM
VISITED FARM
BEST FARM 4321
BEST BOSS RUSH 77
BOSSES 9
SEAL ff3cacb0
```

## Layout

- The file is UTF-8 plain text with one entry per line. The name the game gives it is
  `save.brandon`, but the reader never looks at the name or the extension.
- The reader ignores `\r` characters, blank lines, and spaces at either end of a line.
  The writer uses `\n` line endings and ends the file with one.
- **The first line** is `<GAME> SAVE <version>`: for this game, `BRANDON2 SAVE 1`. The
  game id is `M_SAVE_GAME` in `menu.js`, and the version is `M_SAVE_VER`. A file whose
  first line has that shape but names another game is rejected with "THAT SAVE IS FOR
  ANOTHER GAME". A file whose first line doesn't have that shape at all is rejected with
  "THAT IS NOT A BRANDON SAVE".
- **The last line** is `SEAL <8 lowercase hex>` (see *The seal* below).
- **Every line in between** is `<WORD> <TOKEN>`, `BEST <TOKEN> <score>`, or `BOSSES <n>`. A word is
  everything before the first space, and the token is the rest of the line. A stage
  token can contain a space (`BOSS RUSH`), so a `BEST` line's score is whatever follows
  the *last* space.
- The order of the lines doesn't matter. The writer groups them by word, in the order of
  the table below.

## Lines

| Word | Means | Filled from | Tokens |
|---|---|---|---|
| `KEY` | the player has this stage's key | `menu.keys` | stage |
| `PADDLE` | the player owns this paddle | `menu.pads` | paddle |
| `MEMORY` | the player has earned this memory | `menu.mems` | memory |
| `GAVE` | this stage has already handed out its memory | `menu.memFrom` | stage |
| `VISITED` | this building's dust has been wiped off | `menu.seen` | stage |
| `BEST <stage> <n>` | the player's best score on this stage, a whole number above 0 | `menu.best` | stage |
| `BOSSES <n>` | how many bosses the player has beaten, over every run, a whole number above 0 | `menu.slain` | none |

A save lists only what the player has. The writer never writes a "no" line, and the
reader has no way to read one.

- The starting paddle (`standard`) is never written, and every load gives it back.
- The year-0 memory (`now`, marked `always`) is never written either, because everyone
  has it.
- `BOSSES` is written once, and only when the count is above 0. The count is what buys
  the paddles no level guards (`MENU_SLAIN_PADS`), but a save lists those paddles on
  `PADDLE` lines like any other, so a paddle never depends on the count to load. Progress
  from before the count existed starts it at the number of keys held, the next time a
  boss is beaten.

## Tokens

These tokens are **pinned**. Once a token has shipped, it never changes. They are
defined in `menu.js` as `M_SAVE_STAGES`, `M_SAVE_PADS` and `M_SAVE_MEMS`, which keeps
them separate from display names and internal ids. That way, renaming a building or a
paddle can't break old saves.

| Kind | Token | Internal key |
|---|---|---|
| stage | `FARM` `RUINS` `CITY` `VOLCANO` `CASTLE` `VOID` | 1 2 3 4 5 6 |
| stage | `BOSS RUSH` | `rush` |
| paddle | `GILT` `STATUE` `FROST` `EMBER` `PAIR` `CLASSIC` `MULTI` `PRINCE` `CHELL` | same id, lowercase |
| memory | `EXHORTATION` `SALVATION` `CYCLE` `COUNSEL` `FALL` `CONSOLIDATION` | same id, lowercase |

## The seal

`SEAL` is 32-bit FNV-1a, written as 8 lowercase hex digits and zero-padded. It is
computed over this string:

```
"2000 YEARS LATER" + "\n" + <every line before SEAL, trimmed, joined with "\n">
```

The hashing starts from the offset `0x811c9dc5` and multiplies by the prime `0x01000193`.
It runs over UTF-16 code units, which is what JavaScript's `charCodeAt` returns. If the
seal doesn't match, the file is rejected.

The seal only stops casual hand-editing. Its algorithm and salt are public in the repo,
so it isn't security. It exists so that editing a save by hand is more trouble than
playing, and it covers every line, scores included. Local high scores don't need
protecting; the global leaderboards will check their own scores.

The seal covers the first line too, so the game id can't be edited either.

**The salt and the algorithm can never change.** If either one did, every existing save
would stop loading.

## Compatibility rules

These rules are why a save written in any version of the game loads in any other.

1. **Anything a save doesn't mention, the player doesn't have.** When an older file lacks
   something added later, that thing starts locked, unvisited or unscored. A file with
   only the first and last lines loads as a fresh game.
2. **The reader skips lines it doesn't recognise.** This covers an unknown word, an
   unknown token, and a `BEST` line whose score isn't a whole number above 0. A file
   from a newer game still loads everything this game understands. A file is never
   rejected for its contents, only for a bad first line, another game's id, a bad seal,
   or a newer version.
3. **When the same thing is listed twice, the reader treats it as once.** For `BEST`
   and `BOSSES`, the higher number wins.
4. **Adding something new never bumps the version.** A new paddle, stage or memory needs
   a new token in the right table. A new kind of thing to save needs a new word, added to
   `M_SAVE_SETS`, or its own branch if it carries a value like `BEST` does. In both cases,
   add a row above and a changelog entry below.
   - If something the player has doesn't have a token, the writer leaves it out and logs
     `no save token for ...` to the console. When you add an unlock, export a save and
     check the console.
5. **Bump `M_SAVE_VER` only when an older reader would get a file *wrong*.** Rule 2
   already covers anything an older reader would merely *miss*. An example of "wrong"
   would be changing what an existing word means. A reader rejects a version newer than
   its own with "THAT SAVE IS FROM A NEWER GAME". Readers must keep accepting every older
   version.
6. **Never change the game id.** Every save ever made starts with it.
7. **Never rename or reuse a token or a word.** If an internal id changes, point the old
   token at the new id in the table. Don't change the token.

## What loading does

`menuLoadSave` replaces every one of `menu`'s saved tables with the file's contents. If
the paddle in hand isn't owned any more, it goes back to `standard`. Loading then saves
to localStorage (`MENU_KEY`) and returns to the town with SAVE LOADED. Before any of that,
the IMPORT screen shows a summary and needs its own press to go ahead.

## Changelog

- **v1** (27 Sep 2026): the first format, game id `BRANDON2`. Words: `KEY`, `PADDLE`, `MEMORY`, `GAVE`,
  `VISITED`, `BEST`.
- **v1** (29 Sep 2026): the word `BOSSES`, and the paddle tokens `MULTI`, `PRINCE` and
  `CHELL`. No version bump: an older reader skips them (rule 2).

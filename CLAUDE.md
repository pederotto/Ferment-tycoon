# Working on Fermenta Tycoon

Rules that are easy to break because the reason for them is not local to the code
you would be editing. Most were learned by breaking them.

## Adding state

**A new `GameState` field must be added in three places** or something silently
breaks:

1. `types.ts` — the interface
2. `App.tsx` — the initial state literal (miss this and a new game crashes)
3. `services/persistence.ts` — `migrate()` (miss this and every existing save
   loads with `undefined` in that field)

## The recipe matrix

`RECIPE_MATRIX` in `constants.ts` is the single source of truth for what
combination produces what. `Recipe.requiredIngredients` is too vague to read
from — it says `{substrate: true, additive: 'salt'}` for Colatura and never names
anchovies. The resolver iterates the matrix and the recipe books print from it,
so they cannot drift.

- **Order is load-bearing.** First match wins. A specific entry must precede any
  broader entry that would also match. Black garlic was swallowed by
  `black_apple`, and blue cheese by `ricotta_forte`, exactly this way.
- **A named recipe with no matrix entry is unreachable.** Sweep for orphans after
  adding content.
- Two recipes (Shio Koji, Amazake) were unreachable from the game's first commit
  because their condition required "no substrate" while both koji ingredients are
  typed `SUBSTRATE`. Hence the `kojiBase` matcher.

## The simulation

**The substrate sets a ceiling, not a target.** Procedural recipes once derived
their `idealFlavorProfile` from the same stats that produced the batch's actual
profile, so the goalposts moved with the ball and every substrate scored the
same — it even inverted, with cheap barley beating dried scallops. Procedural
targets are fixed properties of the process now. Do not re-derive them from the
substrate.

**Enzymes gate what the substrate can become.** Protein is not umami until a
protease cuts it up; starch is not sweet until an amylase does; fat is not
pungent until a lipase does. `getFlavorPotential` applies all three.

**Salt and heat are alternative preservatives, not a single axis.** Above ~20%
salt nothing establishes at room temperature (the Roman route); above ~55 °C
nothing establishes at any salinity (the modern route). Lowering *both* is the
mistake. Do not "simplify" this back to salt alone.

**Titrated quantities can legitimately be zero.** `getMass` tests
`!== undefined`, not truthiness. The truthy version fell back to the full 1 kg
unit mass whenever a dial hit zero, silently dumping a kilo of salt into a batch.

**Ferments that mature must not spoil past the window.** `AGEING_BY_TYPE`
decides: `matures` keeps developing (miso, shoyu, garum, vinegar, blackening),
`peaks` and `fragile` decline and spoil. A three-year miso is not a miso that
missed its window.

## Progression and information

**Mastery grants information only, never score.** A score bonus would land before
the terroir cap in `calculateCriticScore`, making it worth nothing with good
ingredients and everything with cheap ones — letting mastery substitute for
buying quality. And a score-weighted XP system feeding a score bonus is a
feedback loop.

**The `??` readouts are deliberate.** The Codex and the spectrometer show `??`
for target temperature and humidity until the mastery track is high enough. That
is the thing mastery sells. Do not "fix" it.

**Two advice sources, kept separate.** `BOOK_ADVICE` is authored, bought, and
identical for everyone — it is about the craft. `benchAdvice()` is generated from
the player's own run history — it is about them. Do not merge them.

## Layout

Stacking order, which three separate bugs came from getting wrong:

```
scrim (20) < HUD (30) < supply drawer (50) < modals (100)
```

The Inoculation Bench is a grid with weighted, min-constrained columns, and
switches to 2×2 between 768 px and 1150 px. That mid range was a dead zone —
four columns at ~230 px each, while the phone step-through did not start until
767 px.

**Re-measure the bench after adding anything to station 04.** Every guidance
system added there pushed the Seal button — the point of the screen — closer to
falling off the bottom. It eventually did, at 1366×768. Guidance belongs on the
Recipe Card.

## Verifying

The browser pane's viewport emulation is unreliable and screenshots fail when the
Claude window is minimised. **Prefer DOM measurement over screenshots**: read
`getBoundingClientRect`, `scrollHeight` vs `clientHeight`, and hit-test with
`document.elementFromPoint`. Several layout bugs were invisible at the wide
viewport and only appeared when measured at 1366×768.

For simulation changes, write a throwaway harness under `sim/`, bundle it with
`npx esbuild sim/x.ts --bundle --platform=node --outfile=sim/x.cjs`, run it, and
delete the directory. Balance claims in this project are measured, not asserted.

Console errors persist across navigations in that tool. Push a
`console.error('=== MARKER ===')` and check whether anything appears *after* it
before believing an error is current.

## Dev tools

Backtick `` ` ``, the DEV chip in the header, or `?dev` / `?god` in the URL.
`components/DevPanel.tsx` is self-contained and can be deleted outright.

Cmd/Ctrl+Shift+D does not work — Chrome claims it for "Bookmark all tabs".

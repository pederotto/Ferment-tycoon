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

**Chamber controls are held settings; interventions are pokes.** `controls`
(vent / mist / heat) is read every tick and persists; `applyBatchIntervention`
is a one-off with a disturbance cost. Do not move one into the other — the vent
was a one-shot lid toggle originally and that is why it never interacted with
anything.

**Vent and mist are one system, not two knobs.** Airflow sheds heat *and*
moisture; misting cools only as fast as the vent carries the vapour off. So
mist+vent holds humidity while dropping temperature (a swamp cooler) and is the
only route to a cool, damp bed. Measured: open+mist yields protease 67 / amylase
50, sealed yields protease 33 / amylase 52. Changing either coefficient without
re-measuring that spread will quietly collapse the interaction.

**Chamber humidity and substrate wetness are different quantities.**
`surfaceWater` is free water on the bed; `params.humidity` is vapour in the air.
Misting into a sealed chamber raises the second barely and the first a lot, and
a waterlogged bed grows bacteria while the hygrometer reads fine.

**Lineage lives on the culture, not on a counter.** `getLineage()` reads
`batch.lineage` and only falls back to deriving from `generation` for founder
stock and old saves. `bias` drifts toward the conditions the parent bed was held
at, in the same direction as `kojiDevelopment` — warm and wet selects amylase.
If you change one, change both, or the game teaches two contradictory rules.

**Volume is limited by control, not by cost.** `unevennessRate` is what stops
bulk being free money: a big vessel ferments unevenly, and `evennessCeiling`
caps the score accordingly. Two things about it are load-bearing —

- **Below ~3 L the rate is exactly zero.** Not small, zero. A mason jar and a
  koji tray must never stratify, or the mechanic becomes early-game busywork.
  The `Math.cbrt(3)` subtraction is what guarantees that; do not smooth it out.
- **Anything that stratifies needs a turning tool on screen.** Pastes are the
  stiffest and separate fastest, and originally had only "Clean" — a mash could
  go badly stratified with nothing in the UI to fix it. `BatchInspector` adds a
  Turn button to any batch whose rate is non-zero.

The workload it creates is the point: a 60 L cask needs six turns by hand, two
with a technician, none with a geared agitator. That ladder is why staff and
machinery exist. If you re-tune the rate, re-check that ladder.

**Upkeep is charged per litre of bench, not per vessel.** Counting pots was
written when every batch was a 1 kg jar. Once reagents could be dialled by the
gram and scaled to capacity, a bench of two 60 L oak casks fell inside the
two-vessel free allowance and paid nothing, while eight 2 L jars paid six lots.
If you touch this, check the opening bench (jar + tray = 5 L) still bills exactly
the $120 floor and nothing more.

**A heated chamber must be able to reach its setpoint before the batch spoils.**
The incubator's heating is proportional to the gap for this reason; a flat rate
meant a low-salt batch died in the twenties on its way to 60 °C, which made the
heat-instead-of-salt route unreachable even though the safety model supports it.

**Two advice sources, kept separate.** `BOOK_ADVICE` is authored, bought, and
identical for everyone — it is about the craft. `benchAdvice()` is generated from
the player's own run history — it is about them. Do not merge them.

## Vendors

**Standing is money, not flavour text.** `standingTier` feeds a price bonus
straight into `calculateOffer`, so a relationship is worth up to 35%. Fences are
excluded on purpose — the underground does not do loyalty.

**Contracted goods must never glut the market.** `processHarvest` takes an
`isContracted` flag that zeroes the demand hit. This is the whole mechanical
point of contracts: spot selling saturates and contracts do not, which is what
makes them a real alternative rather than a slightly better price.

**An unlock route must gate the sell list, not just the order book.**
`getInterestedBuyers` takes the GameState so `isVendorUnlocked` can run. Without
it a vendor shows as locked in the order book while still appearing in the buyer
list, which is worse than having no routes at all. `unlockedVendorIds` is a
latch — once met, a condition stays met.

## The crew

**Skill must cut both ways round the right way.** In `crewEffect`, a trait that
helps (raw below 1) is delivered *more* fully with skill; one that hurts is
delivered *less*. Scaling both by the same factor made a green technician get
steadily worse the longer they worked for you.

**`gameState.staff` is now derived, not authoritative.** `crewToStaffFlags`
recomputes it from the crew every week, and everything that already read the
booleans keeps working. The one exception is a save that predates the crew: it
keeps its old flags until the player hires someone real, because there is no
fair way to invent names and wages for staff they already paid for.

**The hiring pool must never be empty on load.** It only rolls every fourth
week, so `migrate()` seeds one — otherwise a loaded save shows an empty hiring
screen for up to a month, which reads as broken rather than as quiet.

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

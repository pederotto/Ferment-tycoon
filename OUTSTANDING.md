# Outstanding

Where the work stopped, so it can be picked up without this conversation.

## Needs doing before anything else

**A balance sweep after per-reagent gram dialling.** Batch value derives from
mass (`yieldVolume`), and reagents can now be dialled down, so smaller batches
mean smaller sales. That is correct behaviour but the economy was last measured
against fixed 1 kg units. If early-game income feels wrong, this is the cause.
Method: harness under `sim/`, compare profit-per-week across the opening vessels
against the weekly bill floor of $120.

**A visual review.** Almost everything built in the last stretch was verified by
DOM measurement rather than by eye, because the browser pane could not render
screenshots for most of it. The geometry is right and the interactions work; how
it *looks* — density, spacing, whether the composition bars read at a glance, the
2×2 bench, the new Supply catalogue — has not been seen properly.

## Asked for, not built

**History mode.** Requested but never specified, and the readings diverge too far
to guess: historical *eras* as a campaign (partly built — see `ERAS`), a
reviewable log of past runs, or a scenario mode starting in a given period. Worth
settling before building.

**Deeper interventions.** Stir / Flip / Skim / Ventilate are state-dependent now,
but propping the lid on a koji bed is still the only one that genuinely steers an
outcome. The others could carry similar weight.

**Staff.** Still fire-and-forget passive multipliers. Low ceiling as designed.

## Known dead scaffolding

- `Ingredient.lineageBuffs` — set on master spores, never read; the buff is
  recomputed from `generation` instead. Either wire it up or delete it.

## Deliberately not done

- **More content.** 46 recipes is enough that the teaching, not the catalogue, is
  the limiting factor. Adding more widens the gap.
- **A score bonus for mastery.** See `CLAUDE.md` — it inverts the ingredient
  economy.

## Provenance

Parameters were cross-checked against a reference the project owner supplied
(temperatures, salt percentages, timings — facts, not text). That check confirmed
the procedural garum's 60 °C / 15 % and caught `garum_sociorum` sitting at 40 °C
while its own description said 60 °C. Where the two disagreed, the reference won.

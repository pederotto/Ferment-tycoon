# Outstanding

Where the work stopped, so it can be picked up without this conversation.

## Measured — the economy after gram dialling

The balance sweep this file used to ask for has been run. The economy still
clears its floor, but the dial has a one-way bias worth knowing about.

Method: `esbuild --bundle` on `constants.ts` and `services/gameLogic.ts` into
plain ESM, then arithmetic on the real numbers. No new harness — it takes about
a minute to redo.

The floor is $120 rent a week, plus $18 upkeep per vessel past the first two.
A week is 7 days x `DAY_DURATION_MS` (8 s) = 56 s of wall clock, and recipes run
60-400 s, so most ferments take *more than one week* to finish. That, not the
batch price, is what sets income.

Revenue is `50 x difficulty x (score/50) x mass_kg^0.62 x buyerMult x demand`.
At score 70 against a plain 1.0 buyer, one difficulty-2 recipe on a 150 s clock
(2.7 weeks) pays:

| fill | per batch | per vessel-week | two vessels |
|------|-----------|-----------------|-------------|
| 0.5 kg | $91 | $34 | $68 — underwater |
| 1.0 kg | $140 | $52 | $104 — underwater |
| 2.0 kg (full mason jar) | $215 | $80 | $160 — clears |

With a x1.5 buyer a single filled jar clears the floor on its own. So: the
opening is solvent if the player fills the vessel, and insolvent if they do not.

**The bias worth knowing about.** Because yield pays `mass^0.62` while
ingredients cost linearly, a *smaller* batch is more efficient per gram spent —
but vessel-weeks are the real bottleneck, so a smaller batch is always worse per
week. Filling the vessel is therefore never wrong, and the mass half of the
reagent dial has no upside; only the *ratios* between reagents are a real
decision. If that ever wants fixing, the lever is a per-batch cost that scales
with time rather than mass (the upkeep already does this per vessel), or an
ingredient market that makes bulk genuinely dearer.

## Needs doing before anything else

**The Inoculation Bench needs the popup redesign.** Reported as unusable, and the
diagnosis is that it fails in opposite ways at each end of the range rather than
one way throughout:

- *Short window* (~720px tall): four stations get 299px each against station
  04's 373px of content. Cramped. Partly relieved by making the scan dock yield.
- *Full screen* (1920x1080): the modal is 1440x940 and the four columns are
  330-409px wide by **711px tall**, holding roughly 300px of content each.
  Nothing overflows; it is strung out into thin, mostly-empty vertical strips,
  which is why it reads worse the more room it has.

One layout cannot serve both. The direction the owner asked for is popups: keep
the chamber and the seal controls as a two-column work area that can use the
width, and move reagents (01) and vessel (03) into overlays opened on demand.
The stations are already cleanly delimited `<section className="station">`
blocks and an `activeTab` mechanism with `.is-hidden` already exists for the
phone step-through, so the pieces are in place — this is a layout change, not a
rewrite.

**~~A design decision on bulk.~~ Settled.** Volume is now limited by how hard it
is to control rather than by cost — see `unevennessRate` and the CLAUDE.md note.
Alongside it, market absorption was re-tuned: the drop per batch doubled and
recovery slowed, because with four ferment types the market previously recovered
faster than a full bench could flood it and demand never fell below 0.95.

Measured over 30 weeks, full bench, four types, cheap substrate: the spread
between best and worst vessel fell from 2.8x to about 1.3x, the onggi play fell
from $1,630/wk to roughly $550, and the opening bench was unchanged at +$40/wk
because a 2 kg batch barely dents the market. Scaling up is still clearly worth
doing; it is no longer the only thing worth doing.

**Correction to an earlier note here.** This file previously said expensive
substrates never pay. That was measured at difficulty 3 with a x1.5 buyer, which
is the wrong case for them. At small scale with a high-difficulty recipe and a
premium buyer — 1 kg, difficulty 5, score 96, x3.2 — a luxury substrate returns
about $1,536 against $400 of ingredients, and beats bulk *per bench slot*. The
real shape is: cheap substrate wins on absolute income and needs machinery,
luxury wins per slot and needs recipe knowledge and buyer access. Whether that
reads clearly enough in play is a separate question, and untested.

## The vendor and crew layer — built

Standing, contracts and unlock routes are in (`services/vendors.ts`, the order
book), and staff are named hires with traits and growing skill rather than four
booleans (`services/crew.ts`, the crew room).

What is *not* built from the original ask:

- **Sub-quests and dialogue trees.** Vendors have warmth lines keyed to standing
  and a contract pitch, which is dialogue in the loosest sense. There is no
  branching conversation and no quest chain.
- **Random events as an unlock route.** The other four routes are live
  (ingredient purchase, recipe mastery, N recipes above a score, introduction by
  another vendor, plus the stat gates). There is no event system to hang the
  fifth on.
- **More vendors.** Still fifteen. Eight now carry warmth lines, appetite and
  unlock routes; the other seven are as they were.
- **Crew beyond the bench.** Traits touch stratification, hygiene and sale
  value. Nobody can be assigned to a specific vessel, and morale does not exist.

## Also outstanding

**A visual review.** Still owed, and still the biggest gap. Everything is
verified by DOM measurement and live interaction — geometry is right, controls
respond, nothing overflows at 1366x768 — but the browser pane renders at a fixed
size regardless of viewport emulation, so how it *looks* has not been judged by
eye. The one alignment bug found this way (the progress ring sitting 15px off its
vessel) was found by measuring, not by looking, which is exactly the point: a
measurement pass cannot catch what only reads wrong.

## Asked for, not built

**~~History mode.~~ Settled and built** as the reviewable-log reading: every
harvest writes a full run record (`LogEntry.record`) and the Vintage Archives
fold open into it. The *era campaign* reading remains only half-built — `ERAS`
exists and tags recipes, but nothing sequences them into a progression.

**Deeper interventions.** Vent, mist and the heat setpoint are held settings
that genuinely steer an outcome. Stir / Flip / Skim remain one-off pokes that are
state-dependent but not strategic. They could carry similar weight.

**Staff.** Still fire-and-forget passive multipliers. Low ceiling as designed.

## Known dead scaffolding

- `FermentType.SHOYU` is declared, referenced by `AGEING_BY_TYPE` and by
  `isAgitatedFerment`, and used by **zero recipes** — so there is no soy sauce in
  a game about fermentation. Adding a moromi would be content work, and it is
  the one ferment family whose defining technique (kai-ire, regular stirring)
  the agitation mechanic was built to express.

~~`Ingredient.lineageBuffs`~~ — replaced by `Ingredient.lineage`, which is read
by the simulation and drifts with cultivation conditions. Nothing known is dead
here now.

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

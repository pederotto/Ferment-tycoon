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

**A design decision on bulk.** Scaling a batch to fill the vessel is now one
click, which is right — but the value curve behind it was tuned for 1 kg jars.
Measured over 30 weeks with market saturation and ingredient cost included, a
full bench across four ferment types nets:

| substrate | mason jars | onggi | oak casks |
|---|---|---|---|
| barley, $5/kg | $495/wk | $1,472/wk | $1,352/wk |
| median, $35/kg | $207/wk | $236/wk | **-$448/wk** |
| scallops, $400/kg | loss | loss | loss |

Against a $120 floor. Two readings, and which is right is a design call, not a
measurement:

- *Working as intended.* Cheap commodity in bulk is how real fermentation
  businesses make money, and expensive substrate in a 60 L cask should be
  ruinous. The curve already punishes the wrong combinations.
- *Broken.* 12x the floor by week 30 means the mid-game has no pressure left,
  and the only lever is "buy barley, buy casks".

Volume-based upkeep (below) closes the worst loophole but only moves the spread
from 3.0x to 2.6x. The remaining levers are the demand floor (0.35 — a glutted
market still pays a third), how far spreading across ferment types should dodge
saturation, and whether recipe difficulty should scale with substrate cost.

**Expensive substrates do not pay, and that is structural.** Revenue depends on
difficulty, score, buyer and mass — never on what the substrate cost. Better
ingredients lift the score ceiling (terroir cap, roughly 59 to 88 across the
range) which is about 1.5x revenue, against up to 80x the price. At difficulty 3
with a x1.5 buyer, scallops lose money at any mass. Either high-cost substrates
need to gate high-difficulty recipes, or quality needs to pay more directly.
Pre-existing, not caused by the fill button.

## Asked for, not built — the vendor and quest layer

Requested as groundwork before any story mode, and not started:

- **More vendors, and more variety among them.** Currently 15, separated mainly
  by a price multiplier and what they will accept.
- **Depth per vendor** — more variables than multiplier and acceptance.
- **Sub-quests and dialogue.**
- **Unlock routes**: buying particular ingredients, random events, mastery of a
  named recipe, completing N recipes above a given score, or story progression.

Worth knowing before starting: `BUYERS` already carries `renownRequired`, and
every entry currently sets it to 0 — so the gating field exists and does nothing.
`getInterestedBuyers` takes renown, xp and reputation already. A quest system
would want somewhere to live in `GameState`, which means the three-place rule.

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

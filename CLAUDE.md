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

**`ingredientQuantities` is PER UNIT, not per ingredient.** The map is keyed by
ingredient id, but `selectedIngredients` holds one entry for every *unit* drawn
and `calculateBatchDynamics` sums `getMass` across all of them — so anything
stored there is applied once per copy. Storing a total is the bug that made ten
salt units titrated to 5% come out at 25%, and a reagent slider dialled to
46.85 kg build a 1,311 kg batch. Both were invisible until touched, because the
untouched fallback — the ingredient's own unit mass — is the one correct
per-unit value in the function. Divide by the unit count when writing; the
slider and `scaleToVessel` both work in aggregates.

**The same per-copy trap exists on the producer side.** `solidsMass` fed the
salinity dial and reduced over `selectedIngredients` — one entry per unit —
adding the whole aggregate each time. Fifty mackerel dialled to 44.6kg reported
2,230kg of solids and the dial asked for 412kg of salt. Anything that sums
`reagentGrams` must do it once per *unique* id.

**And a third layer: the pantry deduction.** `handleStartBatch` iterated
`usedIngredients` — one entry per unit — while `deductionMap` already held the
aggregate to remove, so it charged the total once per copy. Ten anchovies
deducted a hundred, `Math.max(0, ...)` swallowed the overshoot, and the stock
vanished the moment you used any of it. It charges once per unique id now.

The rule this keeps teaching: **anything that reduces over `selectedIngredients`
must first decide whether it wants units or ingredients.** Three separate bugs
have come from getting that wrong — the consumer (`customQuantities`), the
producer (`solidsMass`), and now the deduction.

**Titrated quantities can legitimately be zero.** `getMass` tests
`!== undefined`, not truthiness. The truthy version fell back to the full 1 kg
unit mass whenever a dial hit zero, silently dumping a kilo of salt into a batch.

**Koji must keep ticking past `ready` too, and for a different reason.** A bed
left past its peak goes to spore — that is the only way to take a strain off it,
and it is the entrance to the whole lineage system. Freezing at 100 made
`SPORULATION_START` unreachable, so the mechanic existed on paper and had no
door. Koji also has its own end (`SPORULATION_SPOIL`), because the generic
"+40 past peak is spoiled" rule killed the bed at 140 — inside the window where
it is still giving spores.

**Selection cuts both ways, or it is not selection.** `propagateLineage` added
a fixed +0.05 vigour and +5 resilience *every generation whatever the bed had
been through*, and the blend-on-repropagate kept `Math.max` of old and new — so a
ruined generation could never cost anything. Ten careless runs bought +45% speed
and +45 effective hygiene at no risk. `sporePotency` (safety, stress, enzyme
development) now drives the step: above 1 improves, below 1 degrades, and
blending averages instead of taking the best. Measured over 8 generations — run
well: vigour 1.20, potency 1.25. Run carelessly: vigour **0.80**, below founder
stock. Recovering a ruined strain costs as many good generations as the bad ones
that ruined it.

- **Weight the potency terms, do not multiply them.** Three sub-1 factors
  compound viciously: a genuinely good bed came out at 0.75 and everything at or
  below 80 safety hit the floor together, so the middle of the range — where most
  play happens — carried no information. Weighted 0.45/0.25/0.30 with each term
  centred on 1.0 at "run properly", plus a hard ceiling when safety is low,
  because a sick bed cannot throw good spore however well the rest went.

**Spore economics: yield, worth and sale price are three different numbers.**
Getting them confused broke the balance twice in one sitting.

- **Yield** is 3 at full strength, scaled by potency. At 6 (and at the original
  14) an exemplary bed sold for $539 against a $120 weekly rent.
- **Worth** (`sporeValue`) is replacement cost, priced on strength cubed — a
  strong gen-3 beats a weak gen-8, which is the entire point of tracking potency.
  It was `150 + generation * 50`, so farming generations inflated the price of a
  strain that might be getting weaker.
- **Sale price** (`cultureSalePrice`) is wholesale at 0.45 of worth, saturating
  per packet through the same `marketDemand` map every other product uses — so
  it recovers on the existing weekly drift and needed no new state.

Measured, against a koji bed worth $70: exemplary +$25, good -$5, ordinary -$43,
neglected -$63. Sporulating pays only if you ran the bed well. And farming it is
strictly worse than making koji — ten sporulations dumped into the market total
$382 against $700 for simply selling the same beds as food, converging to $26 a
run at the demand floor. The reward for a good lineage is what it does in the
simulation, not cash.

**Sporulation is a phase, not a reward.** The Sporulate button used to be gated
on `score >= 85 && safety >= 90`, which got it backwards twice: a bed you ran
well handed you a strain the instant it was ready, at no cost and no wait, and a
bed you ran adequately could never give you one at all. Progress is the gate now
and score decides the *quantity*.

**Decay in that window scales with progress, not with ticks.** Per-tick decay
made the cost depend on `baseDurationSeconds`: koji runs 48 s, so 110 to 145 is
17 ticks and the bed lost about six points of enzyme for thirteen packets of
spore — free. Against progress the trade is real. Measured, from a bed at
umami 62 / amylase 68: at 110 it gives 1 packet and is nearly intact; at 121,
4 packets and amylase 43; at 142, 12 packets and amylase 1. You cannot both eat
the bed and keep its children.

**Koji's inoculation temperature is not a setting.** The substrate goes in off
the steamer, so it is fixed at `KOJI_INOCULATION_TEMP`; where it goes afterwards
belongs to the vessel (tray follows the room, muro holds to 35 °C, chamber to
70). Derive "is this koji" from the SELECTION, not from `resolvedRecipe` — that
only resolves once a vessel is chosen, so keying on it leaves the slider live
through the whole reagent step and then swaps it out underneath the player.

**A maturing batch must keep ticking past `ready`.** The tick loop gated on
`status === 'active'`, so a batch froze the instant it reached 100 — which made
`getMaturity` (progress minus `peakWindowEnd`) permanently zero and the entire
ageing system dead code that had never once executed. `AGEING_MAX_PROGRESS`, the
logarithmic maturity curve, `describeMaturity`, the flavour gains past the window
and the value bonus were all unreachable, and the five families *defined* by age
were exactly the ones that could not age. A colatura sat at 100% saying "young,
just past ready" forever. Measured after: progress 110 reads 9% mature, 240 reads
62%, 500 reads 100%, about 3.3 real minutes of tail at 8x on the bench and six
times that in the cellar.

Fermentation and ageing are two clocks and the UI needs two scales. The second
one is `.mature-track`, and it only appears for `matures` types past the window.

**Ferments that mature must not spoil past the window.** `AGEING_BY_TYPE`
decides: `matures` keeps developing (miso, shoyu, garum, vinegar, blackening),
`peaks` and `fragile` decline and spoil. A three-year miso is not a miso that
missed its window.

**Never count the pantry with a hardcoded list of ids.** The HUD strip asked
for `rice` (the substrate is `glutinous_rice`) and `koji_spores_gen2` (harvested
spores are custom ingredients with generated ids), so rice and every strain the
player ever cultured were invisible. It also printed the salt *unit* count with a
`g` suffix while a unit of salt is 1000 g, so a 10 kg reserve read as "10g", and
it never counted Trapani salt at all. It reads `IngredientType` off the
ingredient now, over `INGREDIENTS` plus `customIngredients`, and multiplies by
`mass`. A list of ids drifts from the data the moment content is added.

**A heated vessel is one that declares `heatedTo`.** `isIncubated` was
`vesselId === 'incubator'`, so a second heated vessel could not exist without
editing the physics. The ceiling is also load-bearing balance, not flavour: the
Cedar Muro stops at 34 °C, which holds a koji bed and cannot reach the 55 °C the
low-salt garum route needs — so a $420 cupboard never becomes a cut-price
$1500 chamber. Koji had a tray that cannot hold heat and a chamber that traps the
bed's own (the critic has always said so); the muro is the missing middle at
insulation 0.45.

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
- **Only koji and shoyu are agitated.** `isAgitatedFerment` gates the whole
evenness mechanic, because "turn it" is only the right answer where turning is
real practice — te-ire on a koji bed, kai-ire on a shoyu moromi. A colatura is
layered and left alone; this file said "and garum" for a while after the code
stopped agreeing, and the owner corrected it.
A miso is packed, weighted and shut for months and you mix it when it comes out;
a lacto pickle is anaerobic and opening it is the fault. Applying stratification
to everything made the game a chore and taught something false about how these
ferments are actually made.

**The surface is its own quantity.** `surfaceFilm` grows on anything wet and
open — a kahm skin on a brine, a pellicle on a vinegar. It exists because Stir
and Skim had nothing to act on: once stratification was correctly narrowed to
koji and shoyu, `evenness` was pinned at 100 for every other ferment, so both
buttons fell through to nudging `quality.safety` and were the same weaker
`Clean` twice over.

- **Three defences, and the player picks one.** Salt, a closed lid, or the
  skimmer. Measured over 400 ticks: 18% salt reaches 11 points of cover, a
  sealed vessel 26, an open 12% one 71. Re-tune `filmGrowthRate` and re-check
  that spread or the choice collapses to one answer.
- **Warmth is a hump, not a ramp.** Peak at 29 °C, zero by 50 °C. A ramp made
  the 60 °C low-salt route the fastest-filming vessel in the game, which is
  backwards — that route runs hot precisely so nothing establishes.
- **On a vinegar or a kombucha the film IS the culture.** `filmIsTheCulture`
  flips the meaning: the mother drives acidification, and skimming or rousing it
  sets the ferment back. Same quantity, opposite sign — do not split it into
  two, the point is that the player has to know which vessel they are over.

**Fat is what closes the loop on the surface.** Fat floats, so an oily
substrate skins over about twice as fast (`filmGrowthRate` takes `fatContent`:
measured, film after 200 ticks goes 41 at fat 0 to 93 at fat 20). And fat held at
the surface by that skin oxidises there — which is where `rancidity` comes from.
Rancidity used to be a 1% dice roll above 35 °C that bumped a risk factor and was
never seen again; it is now the characteristic way a fatty ferment fails, it is
irreversible, and skimming lifts the turned layer off with the film, which is the
whole reason to skim rather than simply shut the vessel.

Measured over 400 ticks, oily substrate at 12% salt, 24 °C, open — never skimmed:
41 rancidity, safety 75. Skimmed five times: 4 and 95. Sealed instead: 6 and 97.
At 18% salt: 0. Lean substrate: 0 whatever you do. Three strategies, one
requirement (fat), and the salt divisor is 20 rather than 12 — at /12 the floor
landed exactly on the 12% the critic quotes, so every salinity at or above it
behaved identically and the whole mechanic read as noise.

**An owned tool must be offered wherever it can act.** `interventionReach` reads
the agitator as well as the paddle — the agitator was consulted only by the tick,
so the most expensive tool in the game did nothing for the action it is named
after. The ladder, measured to 90% even on a 60 L cask: 14 passes by hand, 7 with
a paddle, 3 with an agitator, which is the same as a jar. That is what you are
buying. The same rule fixed the centrifuge, which the inspector gated to garum
and vinegar while the centrifuge's own screen accepted anything unfiltered.

**Unevenness is asymptotic, not a slide to zero.** `evennessEquilibrium` is
where a vessel settles — diffusion balances settling, so a barrel is uneven
rather than infinitely uneven. Unbounded decay ran a 400-tick Colatura to zero
around tick 300 and capped it at 55 whatever the player did, which removes the
decision the mechanic exists to create.

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

**Tasting notes describe the thing; diagnostics describe the process.** They
were the same list under one heading called "Organoleptic Tasting Notes", which
is why it read as a lint report — all caps, one fixed string per broken rule, and
two rules firing on the same fault so a low-umami garum reported it twice.
`generateTastingNotes` reads the whole state (target-relative, not absolute) and
writes colour, aroma, palate, texture and finish; `generateCriticFeedback` keeps
the faults, under a heading that admits what they are. Three rules keep the prose
from degenerating: only speak to an axis whose target is at least 20 (otherwise
every garum trips "sweeter than intended"), at most two palate clauses, at most
one em-dash aside per sentence. Variation is seeded off the batch id and never
`Math.random` — this runs during render, and StrictMode would give two answers.

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

## The inspector

**Confiscation must use `isContrabandBatch`, like everything else.** "Let them
take the illegal stock" filtered on `substrate.currency !== 'renown'` — the
ORIGINAL contraband test, which stopped meaning anything the moment the
underground started charging money. The heat tick was moved onto
`batch.contraband` for exactly that reason and the confiscation was missed, so
conceding a raid took **nothing**, paid a fine, and put you on a list. It also
searched only `INGREDIENTS`, so a batch built on a cultured spore was invisible
to it regardless. Measured on a mixed bench of five: the old rule kept all five;
it now seizes the contraband and the spoiled and keeps the rest.

**A save can carry damage a fixed tick will not heal.** Heat pinned near 100 by
the idle-bench bug drains at the post-bust rate, which is slow enough to take
in-game years — so the fix alone left existing runs broken. `migrate()` pulls
heat down when nothing on the bench is still earning it. Contraband you are
holding keeps its heat.

**Roll the raid once per game day, never per tick.** A per-tick roll scaled the
odds with the speed control — at 8x and full heat the inspector called every
four real seconds — and no per-tick probability is something a player can reason
about. `RAID_CHANCE_PER_DAY` is squared against how far over the threshold you
sit, giving roughly a visit a fortnight at 100 heat and effectively never below
60.

**Heat must always be able to fall.** Post-bust decay used to be exactly zero
forever, so a single bust meant heat only ratcheted up and the inspector kept
calling however clean the bench then was. It is a reduced rate now, and a
spotless bench actively cools their interest rather than merely not attracting
it.

## React correctness

**An empty bench must not get dirty — it must air out.** Three inspector fixes
in and this was still the bug. Hygiene decay was `1 + count * 0.18`, so a bench
with NOTHING on it lost hygiene at the full base rate down to
`HYGIENE_NEGLECT_FLOOR`. That floor is 25, and filth starts at 40 — so the floor
did not prevent filth heat, it **guaranteed** it: 0.0375 a tick forever on an
empty room, against a post-bust decay of 0.0175. One bust and heat ratcheted to
100 and the inspector called on a bench with no batches at all.

Decay is driven from zero by load now, and an idle bench recovers at
`HYGIENE_IDLE_RECOVERY`. That bounds neglect: you can always stop, let the room
settle, and the heat drains. **The only thing that can hold heat up indefinitely
is contraband** — something you are actively doing — which is the shape this
mechanic always wanted.

Measured to equilibrium: empty bench with a past bust and starting at heat 80
recovers to hygiene 100 and heat 0. Eight clean batches sit at heat 0; the same
eight after a bust settle at 68, about a raid every 118 days, and a cleaner takes
that to 0. One contraband batch pins at 100, a raid every 10 days. If you retune
any of the heat constants, re-run that spread — the empty-bench row is the
regression test.

**Never put a side effect inside a state updater.** This app runs StrictMode, so
React double-invokes every `setGameState(prev => ...)` callback. The inspector
raid was rolled inside one, which meant `Math.random()` ran twice a game day and
the raid fired at roughly double the rate its own constant claims, from whichever
invocation won — the "randomly, and far too often" people reported. It rolls in
an effect now, keyed on the date so a re-render cannot repeat it.

The `setLabNotification` calls still inside that updater have the same defect in
milder form: they can post twice. Worth moving when convenient.

## Hardware

**Appliances in the room are decorative; the simulation reads the inventory.**
`IsoAppliance` draws what you own standing where it would stand, and animates
when a batch is actually calling on it — the fan turns while something is on
forced vent, the mister plumes while anything mists. Nothing in `gameLogic`
consults these; if you make them authoritative, the room and the sim will drift.

**A tool screen must take its batch as an argument.** `handleProcessBatch` reads
`activeBatchForTest` from state, so opening the press and pressing in the same
tick would act on the previously selected batch or none at all — React has not
committed the new id yet. It takes an optional batch for exactly this.

## The bench scene

**Big vessels stand on the floor, not on the table.** `isoPlacement` puts
anything needing four bench slots behind the bench at floor level, two-slot
vessels on the back of the table and one-slot vessels at the front. That is how
a workshop is arranged — nobody lifts a 60 L cask onto a workbench — and it is
also what stops four-slot vessels competing with everything else for table
space.

**The bench is a painted room too, and the window is a hole in it.** The plate's
window is black and its light is flat and ambient, which is what makes the room
work: the season view drops into the opening at its own size, and the weather
lights the room rather than arguing with it.

The first version of this plate had a summer sky painted in the window and a hard
sunbeam across the floor. Both had to be fought — the view was scaled to 1.9x and
clipped purely to hide the painted one behind a frame inside a frame, and a
multiply layer pulled the whole room down before anything could be added, so a
bright day was a dimmed room rather than a lit one. If a room plate is ever
regenerated, **ask for a black opening and no beam**; everything downstream gets
simpler.

**Light leaves through the whole opening, not off the sill.** The shaft polygon
started at the window's bottom edge, which drew a string of light hanging under
it rather than a room lit through a hole in a wall. It starts at the top edge and
covers the full height now, and the glow is centred on the opening rather than a
sixth of the way down it.

**Measure the opening; do not estimate it.** The window is black in the plate, so
it can be found by thresholding: x593–727, y218–388. The estimate was 15px out
horizontally and 33 too tall, which is why the view sat off to one side of its
own hole.

**Cover the opening, do not fit it.** The view is drawn 104x96 and the opening
is 134x170, so scaling to fit left black bands above and below — letterboxing, a
16:9 film in a 4:3 frame. Scale to the LARGER ratio and let the clip take the
overflow, which is what `background-size: cover` does and what the eye expects of
a view through a hole.

**Tools belong in a rack, not in the room.** They stood in it for a while and it
never worked: the sheet draws each tool from one angle while the room recedes to
a vanishing point, so half of them faced out of the room and none read as
standing on anything. Flat cards under the scene sidestep the whole problem — a
picture shown as a picture, at a size you can see — and answer the question the
room could not: what do I own, and is any of it working. An empty rack is a true
statement, so nothing is drawn for what you have not bought.

**Draw the view bare inside a painted wall.** `IsoWindow` carries a reveal, a
frame, glazing bars and a sill. The plate has all four, and a second set inside
them reads as a sticker over the hole — a frame printed across the tree. `bare`
draws sky, hill, tree and weather and nothing else.

**A sheet cell's origin is its centre; a tool's origin is its foot.** Cells are
centred on their subject with transparent margin all round, so placing one on a
shelf line puts half the tool through the board. `IsoAppliance` lifts by a third
of the cell height, which is the difference between hanging in the air near a
shelf and standing on it. Boards are measured too — left upper (0,95) to
(385,245), left lower (0,275) to (380,367), right mirrored — and a tool's y is
its board's height at its own x.

**Mirror the tools on the right-hand wall.** The room recedes to its centre, so
the left wall is seen from its right and the right wall from its left. The sheet
draws each tool from one angle; unmirrored, the right-hand pair face out of the
room, which is most of what made them look wrong.

**Light has no edge.** The glow and the shaft are gradient masks, not solid
shapes with a blend mode. A solid ellipse screened over the room drew a visible
disc on the wall — the same mistake as the hover ring, one scale up.

Small vessels go on the table, big ones on the flagstones either side, and the
hardware goes on the shelves: two boards a side, and a tool's y is the board's
height at its x, because the boards recede.

**A painted room must be EMPTY where the game puts things.** The first cellar
plate had painted jars on its shelves and painted barrels on its floor, and the
result was unreadable — you could not tell which vessels were yours. The plate in
use now has bare boards and clear flagstones, and everything on them is a real
batch. Any future room plate has the same requirement: furnish the back wall and
the corners, leave the surfaces empty.

**Placement is measured off the picture, not computed.** The room is one-point
perspective, so a shelf board climbs as it recedes and anything further back must
be drawn smaller or it punches through the wall. `FLOOR_SPOTS` and `SHELF_SPOTS`
are hand-placed points with a per-depth scale, in the plate's own 1344x800 grid —
which is also the viewBox, so there is no conversion to get wrong. Fifteen spots
against a capacity of six means the room is never crowded, and a spot that looks
wrong is one number.

**The plate has to be warmed into the palette.** The painting is lit cool
blue-grey stone; the game is warm brown throughout. A multiply pass at `#6b4a29`
plus a little `#e08a3c` overlay pulls it into the same room as the things
standing in it — without them a cream jar on a slate shelf reads as two pictures.

**Ship the plate as a data URI, never as a file in `public/`.** The game ships as
one self-contained page whose CSP blocks external images, so an `<img src="/art/…">`
works perfectly on the dev server and shows nothing at all once published. That is
the worst kind of bug: invisible exactly where you would test for it.

**The cellar is a room, not a flag.** `cellared` already meant something —
a sixth of the tick rate, out of reach of bench hygiene, slot freed — but a batch
sent down *vanished*, so the one place in the game where you deliberately do
nothing for a year could not be looked at. `CellarView` draws it in the same
isometric language and reuses the bench's classes (`.iso-slot`, `.iso-lift`,
`.iso-shadow`, `.iso-bar`) so a vessel behaves identically in both rooms — the
same object in a different place, which is the point.

It is the opposite room in every way that counts: no window, no weather, no
hardware, no hygiene. Do not add any of those to it; the absence is the design.

**The door is drawn before the floor row.** `IsoDoor` sits in the back wall
opposite the window, painted early so anything standing in front of it overlaps
it. Same rule as everything else in that scene — no z-index in SVG, paint order
is depth order.

**Rows must be drawn floor → back → front.** There is no z-index in SVG; paint
order is depth order. Drawing the floor row before the bench is what makes those
vessels read as standing behind it rather than on it.

**Vessel scale is softened, not true.** `isoScaleFor` spreads about 1.9x across
the range where the honest cube root of volume would give 3.1x, because at true
scale a 2 L jar is too small to read or click. The rest of the size difference
is carried by which row the vessel stands in.

**Nothing may move under the cursor.** The vessels lifted 8px on hover. In SVG
the hit area IS the painted shape, so lifting took the bottom edge out from under
the pointer, which dropped the hover, which dropped the vessel, which caught the
pointer again — a flicker loop. Every cycle set React state and re-rasterised the
ink filter, so the drawing strobed as well: "the jumping of the objects" and "the
flickering" were one bug. Hover cues must not change geometry. Brightness does.

**No ring on the floor, and no hover card.** The ring was a hard stroked ellipse
fading in under whatever the pointer crossed, which reads as an error state
rather than a highlight. The card repeated what the action bar under the scene
already says, was drawn inside the SVG so it covered the neighbours it described,
and was the loudest part of the flicker. The bar is where that information goes;
it does not obscure the room to show it.

**Nothing floats over the front row.** The action bar lives in its own band
under the scene. Positioned inside the room it covered the front row, which is
the row the player is most likely to be reaching for.

## The art direction

**The hand-drawn look is a filter, not sixty hand-drawn paths.** `InkDefs`
mounts `#inkRough` / `#inkRoughFine` once — feTurbulence into feDisplacementMap,
which pushes every edge a pixel or two along a noise field, exactly what a pen
does when a person holds it. Everything isometric inherits it: vessels on the
bench, the same vessels on the cellar shelves, the hardware in the room, the
window, the door, the press and centrifuge on their own screens, and the
ingredient art.

Consistency is the whole reason it is a filter. Redrawing every path by hand
would drift apart the first time content was added; one definition cannot.

- **Filter the drawn group, never the interactive one.** It goes on `.iso-lift`
  and `.iso-appliance`, not on `.iso-slot` — a displaced edge must not move a
  click target.
- **Two strengths, because scale matters.** A jar at 0.8 dissolves under the
  displacement a cask at 1.4 needs. Small objects get `inkRoughFine`.
- **Different `seed` per filter**, so two objects side by side do not wobble
  identically. Identical wobble is the tell that gives away a filter.
- Measured: 67 filtered ingredient glyphs plus the bench render with **zero long
  tasks**. Browsers cache filter output per element, so this is cheap — but
  re-measure if it is ever applied to something that animates.

**The ingredient sheet is sliced by index, and the order is load-bearing.**
`SHEET_ORDER` in `ingredientSheet.ts` is the source order of the ingredient
arrays as `constants.ts` concatenates them, and the sheet was drawn to match.
Adding an ingredient means appending to that list AND adding a cell, in the same
place — insert one in the middle and every icon after it becomes the wrong
picture, silently.

- **The grid was measured off the file, not assumed.** Columns every 137px from
  x=0, rows every 137px from **y=8** — the eight-pixel offset is the kind of thing
  that makes every icon a few pixels wrong in a way that reads as blur.
- **The supplied sheet had a printed label under each icon; they are trimmed off
  at build time**, not hidden with CSS. The game prints the real name beside the
  icon, and a second baked-in name at 30px is an unreadable smudge.
- **No ink filter on sheet cells.** They are already painted; roughening a
  painted icon only blurs it. The filter stays on the drawn fallbacks.

**A supplied sheet on a light ground has to be keyed at build time.** The tool
sheet arrived cream with a printed border round each cell, which would have
pasted six pale squares into a dark room. `art/tools.png` is produced by flooding
the ground from each cell's edges after painting over the border, plus an
explicit seed inside the press frame — the one region enclosed on all sides that
a flood cannot reach from outside. Keying works here only because these are drawn
with hard contour lines; it would destroy a soft-edged painting.

**A sheet cell is not the size of the thing in it.** The object fills roughly 60%
of its cell and the rest is transparent margin, so a tool drawn at 150 units
reads at about 90. The hardware scales look large for that reason; they are not.

**Painted tools cannot animate their own parts.** The sheet is one flat picture
per tool, so "running" is drawn over the top: a plume above the mister, a spun
streak across the fan and the centrifuge rotor, a warm cast on all of them. That
answers "is it doing anything", which is the only question the room needs to
answer — the numbers live in the inspector.

**Ingredient art is a lookup with a fallback.** `ART` in `IngredientArt.tsx`
maps id to a drawing and `artFor` returns null for anything missing, which falls
through to the old generic glyph. Filling in the remaining ingredients is
additive and nothing looks broken in the meantime. Draw at 32x32, flat fill, no
gradients — the ink filter supplies the character.

**The grain is generated, not an asset.** `--grain` and `--speckle` are SVG
turbulence data-URIs, so the printed-board texture costs nothing to download and
does not tile. Applied via `::after` with `pointer-events: none`, and the scene's
own SVG is lifted to `z-index: 2` above it.

## Layout

**The HUD lives in side rails, not along the top.** The room is limited by
HEIGHT, so on any wide window there was dead space either side of it while the
status bar fought for a thin strip — three gauge rings the size of thumbnails, an
almanac with no room to say what the weather meant, and a Supply drawer that slid
up over the very thing you were looking at. `.lab-grid` is three columns: the
world and what you own on the left, the room in the middle, money and navigation
and stock on the right.

**Supply is a modal in the nav, not a drawer.** It used to slide up from the
bottom edge over the room — the thing the player is looking at — and leave a 58px
bar permanently across the foot of the window whether or not anyone wanted to
shop. Every other screen in the game is a modal reached from the nav; this was
the one that was different, and the difference cost the room. Its catalogue is a
wide table, so it cannot live in a 258px rail: it belongs with Hardware, Staff,
Codex and Orders as one destination among five.

**Three breakpoints, because "it stacks" is not a mobile design.**

- `>= 1180px` — three columns, both rails open
- `760–1179` — two columns, the rails share one scrolling column beside the room
- `< 760px` — one column, **one rail at a time** behind a switch in the header.
  Stacking both would put the room on top of two thousand pixels of panels.

**On a phone the room must come first.** DOM order puts the left rail ahead of
the stage, which is correct for a grid and wrong for a column — it buried the
room under the almanac, three gauges and the whole tool rack. `.stage` takes
`order: -1` below the phone breakpoint.

**A component that moves loses the CSS attached to its old class.** The rack was
`.tool-rack` in the scene and became `.rack` in the rail, which silently dropped
`display: flex` — the cards stayed block-level at 50% width and stacked in a
half-wide column instead of pairing up. Check the whole rule, not just the ones
you are changing.



Stacking order, which three separate bugs came from getting wrong:

```
scrim (20) < HUD (30) < supply drawer (50) < modals (100)
```

**The Inoculation Bench is two stations wide above 768 px, not four.** Four
abreast failed at both ends of the range and for opposite reasons — cramped at
299 px each on a short window, and strung out into 330×711 px strips holding
300 px of content at 1920×1080, which is why it read worse the more room it was
given. The chamber (02) and the seal controls (04) are the work surface and stay
in flow; reagents (01) and vessel (03) are `position: absolute` overlays over
the bench, opened from the chamber and closed by scrim, Back button or Escape.

Two consequences that are not local to the rule that causes them:

- **The 768–1150 two-by-two block still sets `grid-template-rows: 1fr 1fr`.**
  With only two stations in flow that leaves the bench half empty, so the picker
  block has to reset the rows as well as the columns. Its borders describe the
  same vanished 2×2 and need resetting too.
- **The scrim renders on the phone as well.** Everything the overlay owns
  (`.pick-scrim`, `.pane-back`) is `display: none` at base and switched on
  inside the desktop block — an unstyled scrim is a stray button in the middle of
  the phone step-through.

**A picker that covers the bench needs an exposed scrim.** The panes were
`inset: 0` over a scrim that was also `inset: 0`, so every pixel of "click
outside to go back" sat underneath the pane and the only way out was a button.
Above 1150px the pane takes the right column and the scrim the left, which also
keeps the chamber's fill in view — the one thing four columns got right was that
you could watch the litres climb while you drew.

**Dynamics must not wait for a vessel.** The resolve effect was gated on
`selectedIngredientIds.length > 0 && vesselId`, so `dynamics.totalMass` stayed 0
until a vessel was chosen and the chamber printed `0.00 / 60 L` and `Vessel fill
0%` beside a row reading `Pearl Barley 2x 2.00kg`. Recipe resolution genuinely
needs a vessel; mass does not. Two behaviours written as design and never
actually working came back with the fix — reagents cap against the largest vessel
you own before you pick one, and the vessel list greys out anything too small for
what is already in the chamber.

**Pause is not a speed.** `gameSpeed` carried 0 to mean paused, so pausing
*erased the speed selection* — every one of the 1x/2x/4x/8x chips went
unselected and a paused game could not say what it would resume at. The pause
button and the speed chips were one control wearing two hats, which is why
changing speed read as the UI glitching. `gameSpeed` is now always 1, 2, 4 or 8
and `paused` is separate; the selected chip stays lit (dimmed) while the clock is
stopped, and picking a speed resumes as well as selects.

The control is `components/SpeedControl.tsx` and it renders in the inspector head
as well as the header. Speeding up to see what a change does and slowing down
when it gets interesting is the loop of that screen, and the control used to be
behind the modal.

**A header row must scroll, not shrink.** The HUD carries more than fits below
about 1300px and flexbox resolved that by crushing whichever child could shrink:
`.brand` measured **0px** at 1024 while the speed chips inside it printed across
the gauges — thirteen overlapping pairs at 1100, "FERMENTA" over "0W/100W". Text
that cannot shrink does not wrap, it overlaps. Every `.hud` child is
`flex-shrink: 0` now and the row scrolls, with the scroll contained in the header
rather than on the body. Measured 0 overlaps and 0 body overflow at 900, 1024,
1100, 1440 and 1600.

Also: the almanac appeared at Tailwind's `lg` (1024px) into a space that could
not hold it until ~1250. When you gate a header element on a breakpoint, check
the width it actually needs, not the one that looks about right.

**And a button that names a PROBLEM must offer the way out.** Same rule, second
instance: with the chamber over capacity the Seal button read "Too much for this
vessel" and sat disabled, while `scaleToVessel` — which fixes it in one click,
keeping every ratio and only charging the pantry for what actually goes in — was
a small link buried in station 02's fill readout. The primary action now performs
the scaling, and says what scaling does, because a player looking at "too much"
reasonably assumes the fix costs them the reagents they drew.

**A button that names a step must take you to it.** The Seal button read
"Draw your reagents" or "Choose a vessel" while `disabled` — the primary action
of the screen was an instruction you could not act on. It opens the picker it
names. Only a real error (overflow) disables it.

**Controls go above commentary in station 04.** The temperature and moisture
dials sat under the recipe-card strip and the koji steering readout, so on a koji
batch — the one that adds the extra block — they fell below the fold of a
scrolling column with a sticky button across the bottom, and people reported not
being able to set them at all. This is the third time an addition to station 04
has pushed something out of reach.

**The pickers must outrank the Seal button.** `.inoc-go` carries `z-index: 6`
and station 04 is `static`, so the sticky button competed directly with the panes
at 3 and won — opening the vessel picker printed "Seal & Inoculate" across its
Predicted physics readout. Scrim 7, pane 8.

**The spectrometer dock must yield before the stations do.** `.scan-dock` was a
fixed 148px that never shrank, so on a short window it took a fifth of the
modal while reading "Spectrometer idle" and left each station 227px against
station 04's 373px of content. It steps down with viewport height and
disappears in the 2x2 range. Stations went 225px to 299px from that alone.

**Put an override AFTER the rule it overrides.** The first attempt at the above
was written ~250 lines above `.scan-dock`'s own declaration, same specificity,
so source order silently won and nothing changed. Height overrides for it belong
at the end of the file.

**The Seal button needs `z-index`, not just `position: sticky`.** The sliders
above it create their own stacking contexts and painted straight over it, so the
primary action of the screen appeared to have a temperature row printed across
it.

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

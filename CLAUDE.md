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
- **Families are `oneOf` lists with a `label`, one entry per PROCESS.** Ten
  mushroom misos would be ten entries fighting over one shape; the substrate's
  stats carry the difference between a maitake and an enoki instead. The label is
  what the formula card prints — twelve names joined by "or" is a paragraph.
- **New entries go above the `barley_koji` catch-all, which stays last.** It
  matches any substrate sporulated on a tray, so a grain koji placed after it is
  unreachable and einkorn silently becomes barley koji.
- **Tokens are substring tests.** `hasId` is `id.includes(token)`, so a token
  that is a fragment of other ids leaks: `includes: 'pine'` matched pineapple and
  pineberry. Families are exact id lists for this reason.
- **Every reader must know every substrate kind.** `recipesUsing` had no `oneOf`
  case, so the ingredient panel told the player a maitake went into nothing.
  Adding a kind means grepping for `substrate.kind`.
- **Differential-test any matrix change.** Resolve every old substrate × every
  reagent set of up to three × every vessel against HEAD (a `git worktree`) and
  against the working tree — 284,200 combinations. A change is fine when it moves
  a combination off Bio-Sludge or a generated recipe; it is a regression when a
  named recipe moves. That run caught the new vinegars accepting a salted koji
  mash — 340 combinations — which reading the table had missed. Every vinegar
  forbids salt and koji now.

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

## Seasons

**Season is for things that are picked, not things that are stored.** A sack of
einkorn is a sack of einkorn in March; a maitake is six weeks at the foot of an
oak. `Ingredient.season` is optional and absent means always, so every commodity
is untouched — read it through `inSeason`, never directly, so that rule lives in
one place.

- **Gate the purchase, not just the row.** `handleBuyIngredient` refuses stock
  that is out of season or above the supplier's level. The shelf greying them
  out is presentation — the same lesson as the vendor unlock routes.
- **A missing supplier relationship is level 1, never "no gate".** The shelf
  skipped the tier check whenever `relationships[id]` was undefined, so on any
  save made before a supplier existed, its tier-2 and tier-3 stock went on sale
  at once. `migrate()` seeds missing suppliers, the new-game state is derived
  from `SUPPLIERS`, and the shelf defaults to level 1 regardless.
- **Out of season is not a lock.** Nothing the player does brings it back
  sooner, so the row says when ("Back in September") rather than why, and the
  window is small print on every picked row, in season or out — knowing a window
  is how you plan around one. The last month of a run says so.
- **Say what came in.** The month turning announces what arrived and what is in
  its last month — from an effect, and only for a single step forward, so loading
  a save made in another month announces nothing.
- **An import has a season too — someone else's.** A finger lime arrives in our
  winter. Who picks a thing decides its supplier: hedge fruit and mushrooms are
  the forager's, grown and shipped produce is Prime's or Silk Road's.

## The koji room

**A place, a vessel and a person — each doing one job.** Beds on its shelves
carry `kojiRoom` and the built-in `koji_room_bed` vessel: off the bench (no
slot, no power, no hygiene load), held warm by `heatedTo`. That is ALL the room
does. The `toji` keeper is what turns beds, takes them at peak, lays new ones
and keeps spore — without one the room is a warm shelf.

- **Built-in vessels never reach a shop.** `Vessel.builtIn` is filtered out of
  Supply and the bench's picker. Anything new that lists `VESSELS` must do the
  same, or the room bed goes on sale for $0.
- **The keeper's round is pure and runs from an effect keyed on the date.**
  `keeperRound(state, dayKey)` is called inside `setGameState`, which StrictMode
  runs twice — so it has no `Date.now`, no `Math.random` and posts no notices;
  ids come from the day key. The notice is posted once, from the effect.
- **It works to a target, not to a full room.** Measured before building: a 3 kg
  bed peaks in ~5 game days and scores the same on the bench or in the room, so
  the room does not make better koji. Twelve beds make ~43 kg a week; a full
  bench of casks and barrels at 20% koji (full enzyme strength) uses ~10; selling
  the surplus settles koji demand at 0.33. The target is what stops a late-game
  room turning into a koji mill. Re-measure that spread if you touch bed size,
  capacity or the target default.
- **Spore is the binding constraint, not beds.** A spore bed returns three
  packets and every bed takes one, so a room growing only its own spore stalls
  for a week at a time: measured over twelve weeks it fed a 10 kg/week bench 75%
  of its koji and a 25 kg/week sake season 30%. The keeper lays spore beds ahead
  of need (0.6 per koji bed) and buys founder spore only when the house has none:
  94% both ways, never short, $165 / $375 of spore across the twelve weeks. The
  target counts beds already growing, so the pantry settles ~7 kg under it.
- **One spore helper.** `mintSporeHarvest` is shared by the player's Sporulate
  and the keeper, so a strain taken by hand and by the keeper is the same strain.
- **A keeper-run bed teaches nothing.** Mastery is information earned at the
  bench; a room you do not touch has nothing to tell you.
- **A role added after saves exist needs migrating twice**: the flag in
  `staff` (a missing key is not `false` to every reader) and the pool, which
  only offers a keeper once `kojiRoomOwned`.

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

**The supplied sheet is a RULED sheet, and the rules are the grid.** The first
slicer assumed a uniform pitch (137 across, 111 down from y=8). The columns are
a true 137; the ROWS are not — measured off the drawn rules they are
145, 143, 142, 142, 142, 139, 137, 114, because the sheet is hand composed. A
fixed slice therefore drifted: by the third row it was printing that row's own
caption inside the icon and clipping the subject at the bottom. The cream 2px
rules were also being caught by every bounding box, which is what pushed several
subjects off-centre.

`art/ingredients.jpg` is now built by *detecting* rather than assuming:

- read the rules (`>85%` neutral-light down a whole column or across a row) and
  mask them, so they cannot inflate a box;
- every cell is exactly **two blocks** of occupied rows — the artwork, then the
  printed caption at 14-18px (32px where the name runs to two lines). So peel
  the last block, and peel once more if what remains is a second text line
  (SCOBY / Kombucha mother). Measured across all 49 before relying on it;
- crop each subject to its own box and centre it in a **square** cell, so an
  icon drops into a square plate already centred and the caller never has to
  reason about the sheet's aspect. Max bbox-centre error is now 1px in 138.

If the sheet is ever redrawn, ask for **no captions and a uniform grid** and all
of the above collapses to a slice.

**The second sheet broke the two-block rule.** Cells 49 onwards come from a
10-column ruled sheet whose captions run to two and three lines and sometimes
touch the art, so a gap-based peel left half of them captioned. Its columns also
differ from one row band to the next, so the rules are detected per band. What
worked for the captions: a caption row has many cream STROKES — at least four
on/off transitions and a quarter of its occupied pixels cream — chained upward
across gaps of up to ten rows (the descender and ascender rows between two lines
carry few strokes, which is where the first attempt stopped), capped at 44 rows,
then snapped up to the nearest empty row so no letter tops survive. Build a
contact sheet and look at it; one cell (the anchovy jar) still needed the other
method.

**The ingredient sheet is sliced by index, and the order is load-bearing.**
Entry N of `SHEET_ORDER` in `ingredientSheet.ts` is cell N of the picture. The
lookup is by id, so the ingredient arrays in `constants.ts` can sit in any order,
but the list and the sheet must agree: append to both, never insert — one cell in
the middle and every icon after it becomes the wrong picture, silently. A
finished product can have a cell too, keyed by the id harvest mints for it
(`garum_bottle`), and it then shows wherever that product does.

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

**The sheet's ground is `#1a130b`, and an icon plate should be set to exactly
that.** The cell is opaque, so on light label stock it reads as an engraved
illustration block rather than a square pasted on — but only if the plate behind
it matches. The plate must also be square now that the cells are, or the icon
overhangs it.

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

**Every vessel is a painting; the drawings are the fallback.** They live in
`vesselSheet.ts`, keyed at build time — the first six off a cream sheet (ground
flooded in from each cell's edges, anti-aliased rim un-mixed from the cream,
without which every vessel wears a pale halo on the dark room) and the Cedar
Tray off flat magenta, which is the easier key and what every sheet since has
used. The tray ships in two states, bare and lid-propped, because a painting
cannot open its own lid.
`IsoVessel` stands each one on the foot of the drawing it replaced
(`PAINTED_FOOT`), so shadows, pips and hit areas did not move, and the group
takes `.iso-lift.painted`, which drops the ink filter (a painting is already
painted) and keeps the hover brightness. A painting cannot show its own brine
level, so `fill` reaches nothing now; the pip and the bar carry progress.

- **Never name two modules apart only by case.** macOS is case-insensitive:
  `vesselArt.ts` beside `VesselArt.tsx` made `./VesselArt` resolve to the data
  file and the app mounted nothing. Data modules are `*Sheet.ts` / `*Plate.ts`.
  Vite caches the bad resolution too — after a rename, touch the importers.
- **Round vessels survive a single-angle painting; boxes may not.** The tool
  lesson (a one-angle picture in a receding room faces out of it) bites the muro
  and the chamber, not crocks and casks, which look the same from every side.

**Stains are multiply maps, not cut-outs.** `paperArt.ts` holds a coffee ring
and a splash lifted off a photographed docket: each pixel is the stain divided
by the paper beneath it, so white means "no change" and they lie on any stock
without an alpha channel. Key on the stain's actual hue — coffee is
orange-brown, red well above green — because "warm" alone took the yellow legal
pad with it, and "not grey" is what drops the type. The same photo's torn edge
lies over a ruled pad in its own colours and could not be traced cleanly; ask
for any future tear on a contrasting ground.

## The label

**Five faces, five jobs, and the monospace is not one of them.** `IBM Plex Mono`
was on 55 rules — prices, wages, supplier tags, section headings, tasting-note
labels — and that single fact is what made the game read as a spreadsheet. The
faces are tokens in `:root`, never literals:

- `--f-name` (Playfair Display) — names of things
- `--f-desc` (Cormorant Garamond italic) — what a thing is FOR
- `--f-spec` (Barlow Condensed) — specs, prices, small print, stamps
- `--f-body` (Work Sans) — the game talking
- `--f-instr` (IBM Plex Mono) — an actual instrument reading, and nothing else

Ten rules kept the monospace: the dial values, the bench telemetry, the evenness
readout, the spectrometer's bar figures, the run trace and the dev panel. If you
reach for it anywhere else, the thing you are setting is probably small print.

- **Barlow Condensed ships PROPORTIONAL figures.** Every rule that swapped off
  the monospace needs `font-variant-numeric: tabular-nums` or the numbers jitter
  down a column — prices in the catalogue, wages in the payroll.
- **It also runs spindly below 11px**, so the swap came with +1px on the small
  print. It is still narrower than the monospace it replaced, so nothing can
  overflow that did not overflow before.

**The stock is `#e3d6b8`, not white.** A bright card in a dark room is a lamp; an
aged one is a lit object on a bench, which is what a label is. Marks printed ON
it take the ink tones (`--ink-moss`, `--ink-amber`, …) — the room's amber on
cream is mud.

- **An inline `style` beats any override.** `MolecularScan` hands its bars a
  `tone` prop, so the paper form picks its palette in the component (`T`), not
  in CSS. Anything else drawn on stock has the same constraint.
- **The painted sheet's own ground is `#1a130b`.** Give an icon plate that exact
  background and the cell reads as an engraved illustration block; give it
  anything else and it reads as a square pasted on.

**The room is made of materials, not brown.** Oak for the frame (header, rails,
every dark screen), leather for the bound things (the Codex, the underground
shelf), green linen bookcloth for tabs and nav buttons — colour tiles in
`materialPlate.ts`, set as `--tex-*` properties at startup. Two rules that are
not visible from any one rule:

- **Paper never takes a material.** The ingredient panel (`.ing-modal`) and the
  harvest docket (`.hreport`) were swallowed by an early materials list and
  turned to wood, with ink-coloured type on a dark ground. Anything that would
  exist as a piece of paper keeps its stock rules; a new material list is
  checked against them before it ships.
- **Each textured surface restates its own ground.** A `background` list
  replaces the gradient it sits on rather than adding to it, so the materials
  block at the end of `index.css` carries each surface's tone as its last
  layer. Change a surface's colour there, not in its original rule.
- **Measure type against the LIGHT end of a texture.** A textured ground is
  not one colour; the 95th-percentile luminance is where text fails. That is
  why `--text-lo` went from `#8a7c65` (2.6:1 on the oak's light end) to
  `#b19f81` (4.5:1 on all three), and why the tiles are built dark. A new
  material gets the same check before it ships.

**A label has two forms, and the second one is what makes long lists work.**
Turned edge-on it is a spine — type stripe, name, small print, price — and
sixty spines is a shelf. Sixty full cards is a wall. The catalogue and the
reagent picker are spines; the ingredient panel, the culture bank and the
inspector head are full labels.

**Never drop a column to make a list fit a phone.** The catalogue's narrow form
used to hide composition, enzymes and quality — three columns, two of which are
what decides a purchase. A spine STACKS instead: name and price on one line, the
readings and the button beneath.

**State happens to the paper.** Spoiled is a stain and an overstamp, contraband
is cheaper stock with no printed supplier, sold is overstamped. `.label-plate`
carries these and none of them needs a legend. One catch: a stamp lands ON the
label, so `.stamped` has to reserve the padding — without it the name runs under
the stamp, which is a smudge rather than a stamp.

**One line decides which side of the game a surface falls on.** Anything that
would exist as a piece of PAPER or a labelled object in the workshop is printed
stock — a recipe in the Codex, a vessel or book you are buying, a hired hand's
reference, a contract, a harvest docket, an ingredient anywhere. Anything that is
the ROOM or an INSTRUMENT stays dark — the rails, the gauges, the dials, the
telemetry, the scene. That is why the tool rack in the rail is dark (it answers
"is it running") and the same tools in the Hardware screen are paper (they answer
"what do I own"). Apply the rule, do not restyle by screen.

**A stamp lands ON the card, so the card must reserve room for it.** This has
now bitten twice — the batch label and the Owned stamp on a vessel — and both
times it printed the stamp across the name. `.stamped` / `.eq-card.owned` carry
the padding.

**Measure the ink against the stock.** `--ink-faint` started at `#8a7454`, which
is **2.83:1** on the mid-stock — below AA for text you actually read while
shopping ("99 in store"). The three ink levels are 10.1 / 5.6 / 4.7 now, and the
hierarchy is carried by weight and size as much as tone, which is what a printed
label does anyway. Anything new drawn on stock gets checked the same way — the
season line was the next one caught: `--ink-moss` is 3.25:1, fine for a bar and
too light for text. **Measure against the darker stop of the stock's gradient**,
not the top: the top flatters every ink by nearly a whole point — `--stamp-good`
is 5.2:1 up there and 4.32 at the other end. The season prints in #3b5429
(4.86:1 at the dark end). By the same measure `--ink-faint` is 4.29:1 at the dark
end, so the "4.7" above holds only on mid-stock.

**Sorting is a control, not a column head.** Five sort buttons were dropped into
the catalogue's six-track grid, which already held three labels — eight children,
six tracks — so they wrapped onto a second row and printed NAME, PRICE and
PROTEIN under column positions they had nothing to do with. They live in
`.sort-rail` now and `.cat-head` is six plain labels that line up with the row.

## Layout

**Anything `position: fixed` to a screen edge is dated the moment the chrome
moves.** `.guide-recall` was pinned at `left: 18px; bottom: 76px` — clear of the
Supply drawer's 58px bar, which is the layout this game had two rewrites ago.
With the HUD in side rails that put it straight over the pantry. It is offset to
the stage at each of the three breakpoints now.

**The HUD lives in side rails, not along the top.** The room is limited by
HEIGHT, so on any wide window there was dead space either side of it while the
status bar fought for a thin strip — three gauge rings the size of thumbnails, an
almanac with no room to say what the weather meant, and a Supply drawer that slid
up over the very thing you were looking at. `.lab-grid` is three columns: the
world and what you own on the left, the room in the middle, money and navigation
and stock on the right.

**The bench gauges belong along the top.** Power, hygiene and inspector heat
describe the whole operation, so they want to be in the same place whichever pane
a phone happens to be showing — a rail would hide them behind a tab.

**Hardware and Supply are different questions.** Supply is what you can BUY;
Hardware is what you OWN and whether it is working. They were the same button for
a while, which is why neither had a clear answer. Both are modals in the nav now.

**Hovering answers "what is this"; opening answers "what do I make with it".**
`MolecularScan` takes `full` for the opened form — a bigger picture and a "what it
goes into" section built from `recipesUsing`, which reads `RECIPE_MATRIX` for the
same reason everything else does: `requiredIngredients` says
`{substrate: true, additive: 'salt'}` for Colatura and never names anchovies.

- **A shopping list must not teach the recipe book.** A recipe the player has met
  is named; one they have not is a count — "4 more ferments use this, still
  unread". That is a lead, not an answer, and it is what mastery and the Codex
  are selling.
- **A modal opened from inside a modal needs to outrank it.** The ingredient panel
  is opened from the Supply catalogue, so it renders earlier in the DOM and
  painted behind it — it looked like the click did nothing. `.ing-overlay` sits
  above.

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

## Header instruments and the weather glass
- The header is `components/BrassHud.tsx` over `brassSheet.ts` (painted brass cut to about twice drawn size). Every instrument still prints its reading; the pictures never carry a number alone.
- Painted glass is opaque paint, so a tube's liquid and the thermometer's mercury sit ON the glass with `mix-blend-mode: multiply`, not under it.
- Class names in the header are prefixed (`bdial`, `blever`, `bgauge`, `bticket`): `.dial` and `.lever` are already the inspector's controls and their rules leak in.
- The weather glass picks one of twelve painted skies with `weatherScene(type, season)`; the window's moving life (IsoWindow `window-life`) is SVG + CSS keyframes, no filters on animated things, and stops under prefers-reduced-motion.

## Koji beds by contents
- `kojiBedChart.ts` is the room's tray sprites with the grain-and-mould chart warped into the tray interior at four stages (built from the chart swatches, keeping the tray's shading). `bedRow` in KojiRoomView reads the row from the words in `starterId` then `substrateId`, so bred spore generations and new grains still resolve; `KOJI_BED` remains the fallback.

## Performance
- **Never put a data URI in an inline style that renders per item.** `IngredientIcon` and `GameIcon` each wrote `url(<the whole sheet>)` into every element's style attribute: 111 catalogue rows carried 57 MB of style text and Supply took 1,078 ms to open. Each sheet is one injected rule now (`.ing-icon.sheet-*`, `.gicon`) and the inline style is size and position — 89 ms, 16 KB. A single image drawn once (a plate, a crest) is fine inline.
- **Supply shows only what can be bought today.** Locked ingredients, tools and books, and out-of-season stock, are counted in one line, not listed (the owner asked for this; it overrides the older "out of season stays on the shelf" rule in Seasons).

## Rail widgets
- Go To is a grid of walnut tiles with the painted `PanelMark` each screen opens under; the pantry is jars (a painted `IngredientIcon` in a `#1a130b` medallion, count on a brass plate). The global `.dot` is a 5x5 status dot and `.rail .tab-btn-hud span` is forced inline, so tile rules restate both.
- The window paints the same weather painting as the weather glass (`weatherWindowSheet.ts`, cut from the discs to the 4:5 opening, picked by `weatherScene`); `window-life` only adds motion on top and never greys it over. `windowPlate.ts` (the four season paintings) is no longer drawn.

## The restored rooms (plates v2)
- All three rooms are one building now: an old stone farmhouse restored as a modern studio (lime plaster, pale oak, black steel, brass, concealed light), painted by the same hand from the same one-point camera. Sources are `art/lab-v2.jpg`, `art/cellar-v2.jpg`, `art/koji-v2.jpg`, cropped from 1376x768 (16:9) to the 1344x800 grid by scaling to 800 tall and trimming 44px off each side. Ask for any future plate at 16:9 with the outer 4% of each side kept clear.
- **Workshop:** the window opening is x601-743, y203-418 with steel glazing bars at x672 / y313, which LabView draws back over the weather view. The bench top is a narrow strip (back edge y~463, front y~503), so the table rows are 30px apart and smaller than on the old plate.
- **Cellar and koji room share board geometry:** top boards run (0,198)->(355,290) (above eye level), middle (0,370)->(355,378), bottom from front y~540 near to y~478 far; the right wall is the mirror at 1344-x. The cellar's stair and drain are at the bottom centre.
- The cellar plate is painted warm, so its grade is a 0.12 multiply only; the 0.34 multiply and orange overlay were for the old blue-grey stone.

## The frame and the studio head
- The page frame (body, header, rails) and the studio heads are the plaster tile smoked to charcoal with a `color` blend layer (a micro-cement look), edged in black steel with a brass hairline. Smoked oak still read as planks; wood is kept for furniture (Go To tiles, jars).
- Every dark screen's header is the studio head: painted mark in a brass-ringed medallion, a kicker, a short title, numbers on brass plates (`.sh-plate`), one round brass close. Supply and the Codex use `.studio-head`; `.pr-head`, `.ob-head`, `.cw-head` and `.inoc-head` take the same rules. **Writing the house MARKUP is not enough — the class has to be added to those selector groups.** The Inoculation Bench had the medal, kicker, title and round close for weeks and still rendered as a brown gradient with unstyled type, because `.inoc-head` was never listed. When adding a dark screen, grep the `.studio-head` groups.
- The batch inspector's header is deliberately NOT a studio head: it is a `.label-plate`, the printed label on the jar, which is the paper side of the one-line rule. Leave it paper. No engraved dividers, watermarks or "Rev" footers on dark screens — printed paper (recipe card, harvest docket) keeps its ornaments.
- Every modal closes on a backdrop click (`e.target === e.currentTarget`, so a click inside, or on a card opened from it, does not) and on Escape. A modal opened from another closes first.
- Supply and the Codex wear the house style below the head too: section tabs are uppercase brass labels with an underline (`.sup-tab`, `.sec-tab`), filter chips are outlines with a brass plate for the active one, fields are 4px-radius outlines, bars are separated by brass hairlines. Scoped to `.supply` and `.codex-panel` so other chip-tab users keep their look. An unmet Codex recipe is blank paper stock, not a dark tile.

## The press at work, the seasonal view, the pantry chest
- `PressRoom` plays the painted machine (`pressSheet.ts`: empty, loaded, pressing, pressed, cake; `centrifugeSheet.ts`: open, closed, plus the jug and pressed cake used as output thumbnails) BEFORE calling `onPress`, because the App closes the screen the moment `onPress` runs. Reduced motion skips straight to the press.
- The window and the weather glass share `weatherSheet.ts`: sixteen tall painted panels, four per season (rows spring→winter; `art/weather-<season>.jpg`), in the style of the earlier round paintings. The window shows a panel as painted, the glass takes a circle centred on the tree. `weatherScene(type, season)` is a table, so the tree always matches the season. An earlier 2:1 photographic landscape set was rejected: small and flat next to these. Ask for any replacement as tall panels, one sheet per season, painterly.
- Window life is painted (`windowLifeSheet.ts`: swallows, crows, grazing sheep, blossom, leaves), keyed harder than a sheet because at 4-10px a magenta fringe is the whole outline.
- The pantry is a chest of drawers rebuilt from parts (`drawerPlate.ts`: the oak front with the hardware painted out, the brass card-holder, the cup handle; set once as `--drawer-front`, `--drawer-label`, `--drawer-handle`). The whole painting was too tall at the rail's width, and cropping it to stack cut the top label and left a handle at the bottom.

## Notices from inside a state updater
- Never call `setLabNotification` inside `setGameState(prev => ...)`. Use `queueNotice`: it keys by type and text, so StrictMode's second run overwrites the first, and an effect posts the queue once after the commit. The weekly loop's nine notices went through here.

## Picture weight
- Every picture module is WebP. PNG and JPEG data URIs were the heaviest thing in the page (the tool sheet PNG 244 KB, 51 KB as WebP; the ingredient JPEG halved). When adding art, encode WebP at quality ~80 (icon masks ~90) and keep a re-encode only when it saves 8% or more. A single HTML file downloads whole, so "load pictures later" does not shrink it — size does.

## Composition, not recovery tables (services/massBalance.ts)
- A batch carries its composition, derived on demand from the charge (per UNIT quantities), progress, its enzymes and its loss account: liquid phase (water, dissolved salt up to ~36 g/100 g water, amino acids, sugars, acids, ethanol) and solids (intact protein, starch, fibre/cell wall/bone, fat, undissolved salt). Never store a recovery share per family — the owner rejected that. A press takes the liquid phase minus what the solids hold (fibre 2.8 g/g ×2.5 for whole pieces, protein 1.4, gelatinised starch 2.2, fat 0.7, undissolved salt 1.0), and the pressed liquid is minted from its own concentrations and named for its family (`amino_*` keeps the token ponzu reads). The cake stays as the batch.
- The loss account (`batch.massLoss`: water, gas, pressed, lees, removed components) is advanced in `processBatchTick`; `yieldVolume` follows current mass, so offers, market saturation and units see evaporation, CO2, drying and separation. Water leaves with progress to the start of the peak window, scaled by vessel openness, vent, and air dryness/temperature against the recipe's own; gas is what the composition says fermented away. The critic scores `concentratedProfile`, which is the batch's own profile at no reduction — a sealed ferment scores as before.
- A dry press no longer adds mass. Moromi, tamari, shio koji and amazake have their own products instead of `amino_sauce`.
- Balance claims here were measured with a throwaway harness over every recipe (loss, liquid share, liquid salt against practice ranges used as CHECKS: shoyu 60–80% liquid, fish sauce 35–60%, salumi 28–45% lost, katsuobushi 55–80%, koji bed does not run off, sauerkraut brine ~45%). Re-run one before changing retention, moisture or process constants.

## The salt dial is a share of the mash
- `requiredSaltMass` was `solidsMass * salinity/100` — a baker's percentage. Nothing else read it that way: `params.salinity` feeds the safety model, `filmGrowthRate`, the critic and the tasting notes, and all of them mean the salinity OF THE BATCH. A moromi dialled to 18 was charged 18% of the beans, which is 8.3% of the mash once the brine is in, while the simulation went on believing it was at 18 — and the pressed shoyu came out at half the salt of the real thing. Salt is `salinity`% of what comes out (solids + water + salt) now. **Hydration stays a percentage of the solids**; that one really is a baker's percentage and has no other reader to disagree with.
- With the dial fixed, the mash reads its own target exactly and the recipes' targets were re-pointed at the sauce: moromi 18→15 and tamari 16→14, which press out at 17.6% and 16.5% salt (a raw shoyu is 16–18%). Fish sauces land at 24%, which is where they belong. Salt costs more per batch than it did — the charge roughly doubles on a wet mash.
- Measured over all 66 recipes with the harness charging batches **the way the bench charges them**: salt as a share of the mash, hydration from `HYDRATION_TARGETS`. Charging salt against the solids halves every brine, and inventing hydration numbers instead of reading the game's own is what made sake look broken.
- **A supersaturated mash is the tell that a brine is wrong.** A real moromi is never supersaturated; when the model put one over 0.357 g salt per g water, the too-dry hydration was the cause, not the salt.
- **Check a recipe against the substrate it is actually made from.** Sake pressed 41% and looked broken; the harness was charging *einkorn*, a whole wheat berry whose bran and protein hold the liquid back. On rice it presses 62%. Sake rice is polished precisely to strip that protein — the model was reproducing the real difference. Colatura's famous 25% is the gravity-drawn first run, not a press; pressed, it is a nuoc mam and gives up the same 47%.

## The title screen
- The card is the studio's own language, like every other dark screen: charcoal plaster edged in black steel with a brass hairline along the top, the crest in the same brass-ringed medallion as every panel mark (`.sh-medal`), rows separated by brass hairlines rather than boxed in rules, 4px radii, and the primary action as a brass plate. It was the last screen still wearing the old direction — an 18px rounded brown card with an amber pill — and its overrides live at the END of `index.css`, because `.welcome-card` is declared twice earlier.
- No "Physics Engine Active" stamp: the same rule as every other dark screen, which carries no watermark or Rev footer.
- **The background is `LAB_PLATE`, the workshop itself.** `KEY_ART` / `KEY_ART_TALL` were a dim brown cottage larder painted before the rooms were restored, so the first thing anyone saw was the one building the game no longer has. They are deleted (170 KB of source, ~127 KB of picture) and the title screen shows the restored workshop until a title painting exists — same hand, same camera, same house. `background-size: cover` takes the portrait crop, so there is no second cut to keep in step.
- **A scrim is tuned to its picture.** The vignette was sunk deep enough to hold type over the dark larder, and that same scrim buried the pale, lit workshop. If the plate changes, re-tune `.welcome-scene::before`.
- A bespoke title painting is still wanted: 16:9 and 9:16, the restored farmhouse seen from the entrance hall through into the workshop, edges furnished and the middle left calm for the card.

## "Discovered" meant three different things in the Codex
The owner reported that a book's recipes never showed under Discovered. Three
defects, all from one word being reused for three different sets:

- **The shelf chip's count had no branch of its own.** The count ternary ran
  `all → cooked → book → else unknown`, with nothing for `discovered`, so that
  chip fell through and displayed the **unknown** count. It advertised 68 and its
  shelf held 0. **Every shelf needs its own branch**; a ternary chain with a
  catch-all else silently mislabels any id you forget.
- **The word collided.** The head plate's "Discovered" counts `analyzedRecipeIds`
  (what you have cooked, with `+N` for book-only); the shelf filtered
  `discoveredRecipeIds`, which App.tsx writes ONLY when you produce something you
  had *not* read first. So a player who had just bought a book looked under the
  one word that specifically excludes books. The shelf takes the card badge's own
  words now — **"Found it yourself"** — and "Discovered" appears once, on the plate.
- **The "Found it yourself" badge was unreachable.** `discoveredRecipeIds` is
  written in the same updater as `analyzedRecipeIds` (App.tsx ~1321 and ~1686), so
  it is always a SUBSET of it, and the badge chain tested `isAnalyzed` first —
  "Analyzed" won every time. The more specific fact goes first.

Measured in the browser after the fix, with The Bench Primer bought and nothing
cooked: Everything 71, Found it yourself 0, Cooked 0, In the book 3, Unknown 68 —
and every chip's count equals the number of cards its shelf renders. That
count-equals-contents check is the regression test for this panel.

Note the Codex lists `RECIPES` only, so a procedural recipe (`*_gen`) never
appears on any shelf and cannot be used to test it.

## Under-salting sets odds, it does not pass sentence
`safetyDecay += 2` every tick below 40% of the salt target killed any under-salted
batch in about forty ticks whatever the conditions — a low-salt kraut in a cold
January cellar died exactly as fast as one in an August crock. The owner called
this out: it should be a gamble on factual grounds. `contaminationRisk` is that
gamble, and it is a pure function so the tick, the inspector and a harness all
read the same number.

- **The deficit is continuous and squared.** No cliff at 40%: 90% of target is
  nearly as safe as 100%, and the curve only gets steep near the bottom.
- **The room is the season and the week's weather, through TWO channels.** Heat
  conducts through oak and glass as well as through an open crock, so warmth
  couples nearly fully; what a lid keeps out is everything airborne, so the
  damp channel is the one `vesselOpenness` gates. Gating both on the lid made the
  season almost irrelevant, which was the opposite of the point.
- **The other hurdles are real alternatives**, which keeps the "salt and heat are
  alternative preservatives" rule intact: batch temperature (the danger zone, and
  the two ways out of it), a live starter, a koji's citric acid, the acidity the
  ferment has already built, the family (an anaerobic lacto brings its own
  lactobacillus; a garum is raw fish and time), the substrate's protein and fat,
  and bench hygiene.
- **A hit is a BLOOM, not a bleed** — one event costing 9 + 10×deficit safety,
  with a message. Several still ruin a batch; one does not.
- **The roll is seeded on the batch id and the tick, never `Math.random`.**
  `processBatchTick` runs inside `setGameState(prev => ...)`, which StrictMode
  double-invokes, so a bare `Math.random()` fires twice per game tick and the
  batch keeps whichever answer the second pass gave — the raid bug again, and it
  would have made the stated odds roughly double the real ones. Every other
  `Math.random()` still in that function has the same defect.
- **The odds are shown.** `.spoil-odds` in the inspector prints the chance and
  its four heaviest terms, worst first, because a risk the player cannot see is
  noise rather than a decision. It is an instrument, so it is dark and monospaced.
- A factor's NOTE must agree with the sign of its weight; "+25% — lean, and slow
  to turn" was the first thing that read as broken.

Measured (expected blooms against the number needed to spoil, colatura at half
salt): January snow 0% lost, April 6%, July heatwave 67%, open koji tray in that
heat 98%, sealed jar 61%. By deficit in a July heatwave: at target 0%, 15/25 33%,
10/25 91%, no salt 100%. Same July, half salt: sauerkraut 0%, colatura 67%,
colatura with a live starter 7%, colatura held at 60 C 0%, filthy bench 99%.
A properly salted batch is safe even in a heatwave. Re-run `sim/spoil.ts` against
that spread before touching any coefficient.

A July heatwave and a July thunderstorm come out at exactly the same risk by
opposite routes — hot and dry (thermal 5.25 x airborne 1.24) against warm and
soaking (4.23 x 1.54). That is a coincidence of the numbers, not a bug.

## Tasting notes: three faults of one kind
All three were the generator asserting something absolute where the thing it was
describing is relative. The owner reported the notes reading wrong; these are
independent of the flavour numbers.

- **A missing key in a `Partial` record fails silently.** `FAMILY_COLOUR` had no
  ALCOHOL or KOMBUCHA entry and the colour note is skipped when the family is
  absent, so every brew, wine, mead, kvass, tepache, chicha and kombucha printed
  notes with NO COLOUR LINE AT ALL. Both families added, plus FAIL.
- **The lead verb is the FORM, not the family.** It was "Pours" for everything
  but koji: a miso paste does not pour, black garlic does not pour, tempeh and
  natto are cakes. `COLOUR_LEAD` is keyed on `processModel(recipe).form` — the
  same source of truth the mass balance uses, so a recipe cannot be a liquid to
  one and a cake to the other.
- **FAMILY is a PROCESS bucket, not an appearance one.** Miso/Paste holds
  bottarga, katsuobushi, salumi, blue cheese, cultured butter and casu marzu,
  none of which is "the brown of wet clay". `RECIPE_COLOUR` overrides those;
  the family stays the fallback.
- **"Spoiled" has to be relative to the target.** `q.safety < 60` described a
  PERFECT example as rotten for every recipe whose target safety is under 60 —
  casu marzu targets 10 and primordial garum 50, and both are deliberately
  dangerous. It is `Math.min(60, target - 25)` now, so a normal recipe (target
  100) keeps the old 60 and a casu marzu on its number is correct rather than
  grey and weeping. `generateCriticFeedback` had the same flat test and the same
  fix.

Checked over all 72 recipes: 0 with no colour, 0 non-liquids that pour.

## The flavour targets are the owner's (all 71)
Every `idealFlavorProfile` in `constants.ts`, `constants.forage.ts`,
`constants.heritage.ts` and `constants.market.ts` was rewritten from the owner's
own worksheet. Do not adjust one to make a recipe easier to score — the number is
a statement about what the ferment tastes like, and if a batch cannot reach it
the fault is in the simulation, not the target.

Two things the recipes live in four files, not one: `id: 'barley_koji'` matches
an INGREDIENT before it matches the recipe, so a scripted edit keyed on the id
alone hits the wrong block.

**Measured after applying them: a perfectly-run batch at ideal conditions misses
its target by 46-192 points.** Two structural gaps, both found by reading rather
than guessing, and both larger than any number on the worksheet:

- **Acidity is not produced by fermentation.** The only sources are
  `surfaceFilm * 0.0035`, a hardcoded `+0.2` for `coconut_vin`, and `+0.05` a
  tick past the peak. There is no lactic or acetic acidification anywhere, so
  every LACTO, VINEGAR and KOMBUCHA recipe — the three families DEFINED by
  acidity — tops out near zero against targets of 60-92. A sauerkraut targets 82
  and reaches 0.
- **Flesh does not autolyse in `getFlavorPotential`.** Umami is
  `protein * 11 * concentration * proteolysis`, and `proteolysis` is only
  `0.18 + protease/100 * 0.95` — the 0.18 floor is all a garum gets, because
  there is no koji in one. Anchovies therefore cap at umami 16 against a target
  of 94. `massBalance.enzymeScale` already knows fish break themselves down
  ("Fish and flesh break themselves down"); `getFlavorPotential` does not, and
  the two disagree.

## Making the targets reachable (the flavour pipeline)
The owner's 71 targets were unreachable because four things the game DESCRIBES
were never simulated. All four are in `getFlavorPotential` and the tick.

- **Flesh digests itself.** Cathepsins in fish and meat cut their own protein up
  with no koji anywhere near them — the entire mechanism of a garum. Proteolysis
  was `0.18 + protease/100 * 0.95` and a garum has no koji, so an anchovy got the
  0.18 wild floor and capped at umami 16 against a target of 94. `isFlesh` adds
  0.82. `massBalance.enzymeScale` has always returned 1 for a garum's protease;
  the two models agree now. Colatura went from miss 113 / score 67 to **miss 42 /
  score 88**, bottarga to miss 13.
- **A culture grows wherever you put it.** `advanceEnzymes` was called only
  inside `if (isKoji)`, so any ferment that charges SPORES rather than a finished
  koji never developed a protease — and a moromi, doenjang, douchi and hatcho
  miso are all built exactly that way. Soybeans capped at umami 18 against
  targets in the nineties. Enzymes now grow in a mash too, at 0.45 of the rate of
  an open bed. Moromi went from miss 128 / score 62 to **miss 36 / score 85**.
  `getFlavorPotential` takes the DEVELOPED enzymes, not just the charged ones —
  without that the growth is invisible to flavour.
- **Acid is a fermentation product.** The only acid in the whole tick came from
  surface film, one hardcoded rule for coconut vinegar, and `+0.05` past the
  peak, so the three families DEFINED by acid could not make any: a sauerkraut
  targeting 82 sat at 0. Acid is made from fermentable sugar and how much of it
  becomes acid is `processModel.toAcid`, which the mass balance already states
  per family — reused rather than re-invented. Sauerkraut now reaches **83**
  against its 82. `ACID_SCALE` is the one tunable.
- **Sugar is usually something you ADD, and something gets eaten.** Potential read
  the SUBSTRATE alone, so the kilo of sugar in a cheong, the honey in a mead and
  the sugar feeding a kombucha were invisible. Sugar and starch are summed over
  everything in the vessel now, mass-weighted (protein and fat stay on the
  substrate — averaging those over salt and water only dilutes them). And the
  result is multiplied by `1 - attenuation * 0.85`, because a vinegar ferments
  0.95 of its sugar away and a koji bed only 0.30. That one factor is why an
  amazake is a syrup and a cider vinegar is bone dry.

**Clamp the axes at the END of the tick.** They are 0-100 by definition and
nothing held them there: katsuobushi, which loses 92% of its mass, ran to umami
257 and an aged chili mash to acidity 127. Scoring is a sum of absolute
distances, so an overshoot costs exactly what a shortfall does — 257 scores worse
than making nothing. An earlier clamp is undone by whatever runs after it.

Mean miss over all 71 went from about 130 to **85**, with 0 axes out of range.

## Alcohol
Ethanol was in the composition from the start — it decides what a pressed sake
bottles at — and nothing upstream could see it. `alcoholPct` reads it off
`compositionOf`, so there is one number, not two.

- It is **not a flavour axis** and is not scored. Adding a fifth axis means 71
  more numbers from the owner; ask before doing it.
- It is **a preservative**, the fourth hurdle in `contaminationRisk` after salt,
  heat and acid. Little establishes in a ferment that has made its own spirit.
- It is **visible**: a `Strength` tasting note, which is why `TastingNote.facet`
  gained a sixth value.
- **Yeast dies in its own alcohol.** `attenuation` caps how much sugar ferments
  but said nothing about what the result may REACH, so a sugar-heavy must ran to
  30% ABV. Sake tops out near 20 (multiple parallel fermentation), other brews
  16, a kombucha 4. Sugar the yeast could not eat stays sugar — which is exactly
  why a stuck mead is sweet.

## Innate savour and innate sourness (HiddenStats)
Two optional stats, because two things are simply PRESENT in an ingredient and
need no organism and no enzyme to appear:

- **`innateUmami`** — free glutamate and nucleotides. A cep, a ripe heirloom
  tomato and a dried scallop are savoury raw. Umami read `proteinContent` alone,
  which is protein a protease still has to cut up, so every mushroom ferment
  capped far under its target (mushroom garum 13 against 88).
- **`innateAcidity`** — how sour the raw thing is. A wine's sharpness is the
  fruit's, not the yeast's; a ponzu is sour because a yuzu is. With no term for
  it, ponzu could reach acidity 0 against a target of 76.

Both are on the 0-10 scale of every other hidden stat and default to 0, so an
ingredient without them behaves exactly as before. **Ingredients are built two
ways** — object literals with `id:` in `constants.ts`, and FACTORY CALLS
(`fruit('yuzu', …)`) in `constants.market.ts` and friends — so a scripted edit
keyed on `id: '…'` silently misses two thirds of the pantry.

## Other things measurement turned up
- **Funk read the substrate's wild population only.** Bacillus natto carries a
  diversity of 9 and soybeans a 3, so a natto — a ferment that is nothing but
  that bacillus — was scored on the beans. The stronger of substrate and STARTER
  wins now; you cannot make a ferment less funky by inoculating it.
- **Funk is damped by how much is actually fermenting.** A cheong is sugar
  drawing juice out of pine needles and nothing ferments in it, yet it scored on
  the needles' microbes and came out funkier than a blue cheese.
- **Only fermented sugar makes acid.** `toAcid` is the share of the FERMENTED
  part, so it must be multiplied by `attenuation`. Without that a garum, which
  ferments barely a fifth of itself, reached acidity 100 against a target of 14.
- **A wild brew sours.** `ALCOHOL.toAcid` was 0, so a makgeolli, chicha, kvass
  and tepache — all mixed ferments where lactic bacteria work alongside the
  yeast — could not be sour. The family gets a little; those four get their own
  entries. A pitched wine or mead is not like this, which is why it is per-recipe.
- **Safety is scored against the recipe's own target.** A flat floor of 50 and a
  flat `safety/100` multiplier meant the two deliberately dangerous recipes could
  never be made well. Casu marzu is back to its honest target of 10.
- **Only the SLUDGE is worthless.** `calculateCriticScore` returned 0 for the
  whole Bio-Hazard TYPE, which also holds Primordial Garum — a profiled,
  high-value gamble that could therefore never score. Gated on `bio_sludge` now;
  that recipe went from score 0 to 89.
- **`ancient_garum`'s "30% chance" was 98%.** 2% per tick over a 200-tick run.
  Solved for the 30% it advertises, and seeded like every other roll.
- **`black_apple` accepted only GREEN PLUMS** while being called Black Apple —
  the owner found it profiling the catalogue. Blackening is one process on a firm
  acidic fruit, so it is a `oneOf` of apples and plums named "Blackened Fruit".
  The id stays: it is load-bearing in the matrix, the books and the product sheet.

## Alcohol is a spec, not a fifth axis
`Recipe.targetAbv` is optional and only the ferments that are supposed to make
alcohol declare one; `calculateCriticScore` scores the miss only for those. A
fifth `FlavorProfile` axis would have made all 71 recipes carry a number that is
zero for most of them, and would have needed 71 more decisions from the owner.
A sake at 4% is not a sake and nothing in the four axes could say so; this can.

**Measured across all 71, charged the way the RESOLVER matches** (requires-tokens
are substring tests; a kojiBase substrate means a koji IS the substrate; a
competent player adds sugar where the process needs it and the matrix allows):
mean miss **~130 → 69**, recipes missing by more than 90 down to **16**, mean
score **71 → 77**, nothing out of the 0-100 range.

## Any animal protein is a garum; any plant protein is an amino sauce
The owner's rule, and the resolver now states it. Every garum was a NAMED entry —
anchovies, mackerel, herring — so a pork belly, a bonito, a tray of egg yolks or
a sack of dried scallops under salt fell through to the lacto rule and became a
pickle. Garum is not a fish recipe: it is what protein does under salt while its
own proteases take it apart. The plant-protein version needs a koji to supply the
protease the plant has not got, and that is an amino sauce. One mechanism, two
names, decided by where the protein came from.

- Both are PROCEDURAL rules and sit FIRST in that chain, because the lacto rule
  would otherwise swallow anything salted in a jar or an onggi.
- **`isFlesh` decides which**, so a plant marker wins over the numeric test. The
  differential caught "Hazelnuts Garum" and "Soybeans Garum" — a hazelnut and an
  aged soybean are both high-protein, high-fat and low-starch, which is exactly
  what the numeric fallback looks for. A plant is never flesh however rich it is.
- Dairy counts as animal protein, so a milk garum is reachable. The named dairy
  recipes (ricotta forte, blue cheese) match first and are unaffected.

**Differential test, 86,450 combinations** (every substrate x every reagent set of
up to three x every buyable vessel, working tree against HEAD in a git worktree):
3,783 moved, **no named recipe lost and no named recipe moved** — the criterion
this file already sets. Moves are off Bio-Sludge, or off a generated lacto onto a
generated garum. 15 animal proteins now make garums and 25 plant proteins make
amino sauces.

**`barley_koji` is TYPED as a substrate but used as a reagent.** Building the
differential's reagent pool by type silently dropped every koji combination —
a quarter of the matrix — and made the amino rule look like dead code. Build that
pool from explicit ids.

## Koji grows on almost anything, with a different output each time
The catch-all — anything sporulated on a tray — turned EVERY substrate into
barley koji, which is the same complaint this file already makes about einkorn.
Four named entries sit above it so the substrate decides what you get: a pork
loin, an oily mackerel fillet, a lion's mane and a beetroot (added for this; a
cabbage heart is the cheap route). Grains still fall through to `barley_koji`
and heritage grains to `heritage_koji`, both untouched.

Differential-tested over 86,450 combinations: 102 moved, all of them off the
catch-all onto the four new recipes, and `barley_koji` is still reachable.

**A fifth was asked for and NOT added: a koji-pelted corn cob.** Corn plus spores
on a tray is already `heritage_koji`, and there is no ingredient that tells a
whole cob from cracked corn — so the entry could only sit above heritage_koji and
shadow a named recipe, which this file forbids. It needs its own substrate first.

## Three ways a batch could not progress at all
All three were invisible because flavour developed on a batch whose progress was
frozen, so it looked slow rather than broken. Tying development to progress is
what exposed them.

- **`temp > 10` gated ALL progress**, and two named recipes are held below that
  by their own ideal: kimchi ferments at 8 C and shio-tamago at 6. Held exactly
  where their recipe says, both sat at progress 0 forever while printing "Too
  cold to develop" at the correct temperature. Cold is slow, not stopped, and
  the warning now fires where it is true — far below what THIS ferment wants,
  not below an absolute ten degrees.
- **The koji branch's `speedMult` is `1 + (temp - 30) / 20`**, which is exactly
  zero at 10 C and negative below. Floored.
- **Casu marzu's `progress *= 0.1` multiplied CUMULATIVE progress**, so a clean
  bench did not slow the larvae, it drove the batch backwards every tick and
  pinned it near zero. Only the gain is damped now.

## Character develops with progress, not with ticks
`convert` was a flat 0.035 per tick, so how far a ferment got depended on its
`baseDurationSeconds`: a 400-tick colatura converged completely while a 45-tick
amazake reached about three quarters and a koji bed less. Same defect as the
sporulation window — the timer deciding the outcome instead of the process.
Against progress every ferment arrives at its peak having become itself, and a
long one is long because it is slow, not because it ends up different.

## The last four, and what they each turned out to be
- **`tears_garum` was a harness fault, twice over.** Its substrate is `any`, so
  the PLAYER picks and the harness was picking barley; and the `koji` token means
  LIVE koji, never spores, which the harness got wrong so it was charging a
  koji recipe with no koji at all. On a protein substrate with real koji: miss
  161 → 47, score 89. Nothing in the game was broken.
- **`ponzu` needed two real things.** A finished amino sauce carries its
  glutamate ALREADY FREE — that is what finished means — so it is `innateUmami`,
  not protein waiting for a protease. And **protein is not only the substrate's**:
  potential read `h.proteinContent` alone, so the shoyu a ponzu is steeped in,
  and the koji in a rose garum, counted for nothing. Both are mass-weighted over
  everything but water and salt now. Miss 122 → 72, score 81.
- **`meju` was getting a deliberate koji's enzymes from wild inoculation.** It is
  bricks hung in the air to catch whatever lands, and it ran to umami 100 against
  a target of 64 — savourier than the hatcho miso you make by ageing a meju for
  years. **Wild inoculation cuts both ways**: weaker, slower enzymes (0.55 of a
  pitched bed) and a far MORE MIXED population, which is why every house's
  doenjang differs and why its funk target is 78 against a clean koji's 18.
  Miss 113 → 85, score 68 → 83.
- **`rose_garum` is a RATIO question, not a bug.** Rose petals carry protein 1;
  all of its umami is the koji's. Measured: petals-heavy (3:1) gives umami 8,
  balanced 18, koji-heavy (6:1) **39** against a target of 42. The recipe is
  reachable — it is a koji extraction that happens to be flavoured with roses,
  not a rose ferment. Left as is; the dial is the player's.

**A live koji is an organism, not an ingredient that sits there.** Enzyme growth
outside the koji branch looked only for an `IngredientType.STARTER`, and a
finished koji is typed SUBSTRATE — so a moromi or a tamari was frozen at whatever
protease the koji arrived with. It keeps making protease for as long as the mash
allows, which is why a tamari left a year is savoury and one left a week is not.

## Salt stops the mould; time does the rest
The owner's correction, and it overturns something written here a commit earlier.
A koji put into brine DIES there. It secretes no further enzyme from the moment
the salt goes in. What carries a moromi through a year is not a growing organism
— it is the enzyme pool the koji ALREADY made, still working on the protein,
plus what moves in behind it.

- **Enzyme concentration is a RATE, not a ceiling.** `proteolysis` was linear in
  protease, so a koji at 52 could free only 67% of the protein in the vessel
  however long you left it, and a tamari stalled near umami 45 against 94. A
  modest pool given a year gets through what a strong pool does in a month, so
  extent saturates (`1 - exp(-e/26)`) instead of scaling.
- **One recipe here covers two real stages.** A moromi charges spores AND salt,
  because growing the koji and brining it are a single step in this game. So the
  culture establishes through the first quarter of the run — that is the koji
  stage, on its own clock and at a bed's full rate — and the pool is fixed after
  it. Gating on salt alone killed moromi outright (umami 13).
- **Secondary fermentation is most of what a long mash does.** Halophilic
  lactobacillus and yeasts move in behind the enzymes and work for months,
  souring the mash and taking most of the sugar. `attenuation` for the salted
  families was set as if only the mould acted: SHOYU 0.30 → 0.62, MISO
  0.25 → 0.55, with `toAcid` raised to match. A shoyu was sitting at acidity 6
  against a target of 38.
  **But a short miso is not a long one**: shiro miso is deliberately quick and
  koji-heavy so the sugar survives, and the family's new attenuation ate it
  (sweetness 74 → 25). It and yellow peaso carry `BY_RECIPE` overrides.
- **Not every mould is Aspergillus.** `advanceEnzymes` produced a full koji's
  output whatever was inoculated, so a tempeh — whose own description says it
  "binds rather than digests, there is very little enzyme here" — freed as much
  protein as a shoyu koji and ran to umami 99 against a target of 34. Rhizopus
  knits (0.30), Bacillus is protease without amylase (0.75), surface moulds and
  larvae are weaker still (0.45).
- **A rate term on the umami convergence was tried and REMOVED.** It looked
  principled — a short ferment should not finish — but measured worse across the
  catalogue (mean 66 → 69, recipes over 90 13 → 16), because the saturating
  extent curve already handles it. Do not re-add it without measuring.

Measured across all 75: mean miss **66**, thirteen still over 90, down from about
130 when the owner's targets first went in.

## Publishing the page
The game ships as ONE page on claude.ai. Three things about that page, each
learned by breaking it:

- **Upload content only.** The host wraps every upload in its own
  `<!doctype html><head><body>` skeleton, so the file is: a `<title>` (read from
  the first 8 KB), the Google Fonts `<link>`, `<style>`, `<div id="root"></div>`,
  `<script type="module">`. A packager that reused a DOWNLOADED page as its
  template double-wrapped everything and cut out the `#root` that sat between
  `</style>` and `<script>` — so `index.tsx` threw "Could not find root element"
  and three published versions showed only the background. Assert `#root` is
  present and precedes the script before every publish.
- **Keep the Google Fonts link.** It is the one font host the artifact CSP
  admits. The old inliner handled only `<script>` and `<link rel=stylesheet
  crossorigin>` and silently dropped it, so the published game rendered on
  fallback fonts for its entire life — the five-faces rule above never reached a
  player. Check `document.fonts` after a local load.
- **Readable identifiers (`esbuild.minifyIdentifiers: false` in vite.config).**
  Every build after commit `eef2301` was rejected with "This page carries the
  artifact-pr-review machinery … too large for a review page". Bisected, with
  controls: the minified bundle of that commit fails; the SAME code built with
  readable names publishes; the previous commit's minified bundle publishes;
  cutting half out of the passing bundle still publishes while cutting either
  half out of the failing one does not. Rewording or removing our own strings
  changed nothing. The minifier's short names reshuffle on every code change
  and some arrangement of them trips the host's classifier. Below ~300 KB the
  error changes type (it complains about a missing "approve control"), so a
  byte-level bisection cannot be trusted past that point and no single name is
  proven. Readable names cost ~0.5 MB of a 5.5 MB page and remove the lottery.

**`npm run package`** builds and folds the page into `dist/artifact/index.html`
with `scripts/package_artifact.py`, which asserts `#root`, the fonts link and no
wrapper tags — it lives in the repo because the ad-hoc packager that caused both
bugs above was rewritten from memory each session. Before publishing, start the
`artifact-check` preview (it serves `dist/artifact`), confirm the title card
renders, `document.fonts` holds the faces, and a batch ticks at 8x with nothing
after a `console.error` marker. Then publish to the same URL.


## A drink is its liquid (and the rest of the last flavour round)
Mean miss over all 75 recipes, charged the way a competent player charges each
kind of ferment and scored on the profile the CRITIC scores (after drying has
concentrated it): **~130 when the owner's targets went in → 51, none over 90.**

- **Taste the liquid.** For `form === 'liquid'`, sweetness and sourness are the
  concentrations of sugar and acid DISSOLVED IN THE LIQUID, in grams from
  `chargeOf`, through a saturating perceptual curve (`LIQUID_SWEET_K`,
  `LIQUID_SOUR_K`). The index model treated water as diluting the taste and
  averaged over solids that are strained out: a realistic kombucha — mostly
  water — tasted of nothing, and a 1:1 cheong, whose syrup is 43% sugar,
  reached sweetness 34 because the needles were averaged in. Pastes and solids
  are eaten whole and keep the index model. Umami in a liquid takes a power-law
  (c^0.4) rather than linear dilution for the same reason.
- **Salt masks sourness and sweetness** (`1 / (1 + salt%/14)` of the liquid's
  dissolved salt). The same 1% acid is loud in unsalted kombucha and quiet in a
  16% shoyu; without it every shoyu read as sour as a vinegar.
- **Shoyu's split is what raw shoyu carries**: attenuation 0.63, toEthanol 0.42,
  toAcid 0.18, toGas 0.40 (CO2 is what the alcohol releases, ~51/49, not more).
  A moromi now presses 67% at 17.7% salt, 1.3% acid, 4.8% sugar, 2.9% alcohol.
- **Weak brine lets bacteria ferment the protein.** Garum-family, below ~15%
  salt, no heat, no koji: amino acids become propionic/butyric/acetic acid and
  H2S — acid and funk from PROTEIN, the only route for a fish that has no sugar.
  Surströmming went from acidity 0 to 28 and funk 54 to 74. It applies whatever
  the form (surströmming is modelled as solid fillets).
- **Blackening is chemistry.** Sterile (no microbial funk), fructans and starch
  hydrolysed by heat alone, and the Maillard reaction bounded by the scarcer of
  sugar and amino acid — sweetness kept, umami and balsamic acid gained, a sweet
  thing's acid masked by its sugar. Black apple 92 → 46, black garlic 72 → 54.
- **Time darkens** (`AGEING_MAILLARD`, swept, 0.45). Every long maturing paste
  and sauce was short on funk (-17 to -44) and too sweet while the short white
  miso was the opposite — the signature of a time-driven reaction. It grows with
  the process's length and warmth and needs both reactants.
- **Extent is enzyme x time, and it saturates — in BOTH models.** Strength sets
  how fast; the process's own length sets how far. Saturating on strength alone
  let a 55-second tempeh break down its protein as far as a year-old moromi;
  scaling linearly in the mass balance let a sake's koji convert only a quarter
  of the grain's starch however long the mash ran.
- **A blue mould eats the acid** (P. roqueforti deacidifies ripening cheese, pH
  4.6 → 6). **Bacillus deaminates**: natto's funk is ammonia, which is also why
  natto is alkaline. Bacillus is a protease powerhouse (1.3), not a weak mould.
- **The wild-bloom funk is KOJI-type only.** Gating it on Miso/Paste too handed
  salumi, bottarga and bagoong — salted and hung, never bloomed — a meju's wild
  funk (salumi 92 against 48).
- **The mass balance reads the enzymes the batch GREW**, not only a charged koji
  (a moromi grows its own from spores), and growth is SEEDED from what the charge
  brought — growing from zero left a sake charged with good koji at amylase 5.
- Short, sweet pastes (shiro miso, gochujang, corn miso) carry `BY_RECIPE`
  overrides so the long-miso souring does not reach them.

Harness lessons, each of which produced a false failure first:
- Charge salt at the recipe's salinity with the BENCH formula, never a flat kilo
  (surströmming is a 6% brine, not 25%).
- A `/koji/` quantity rule matches `koji_spores`: a kilo of spores has no
  composition stats, so the mass balance counts it all as fibre and a moromi
  "pressed" 29%.
- A drink is charged as a drink (tea is a pinch, water is the bulk); a white
  miso is koji-heavy by definition; a tomato kombucha is fed the fruit's own
  water. A new batch has NO enzymes field — start the harness the same way.

Still apart from target, with causes known: rose garum is a koji extraction and
wants a koji-heavy charge; kimchi's umami target assumes the fish sauce its
matrix entry does not take; corn chicha's open-pot funk; einkorn sake presses
41% where rice presses 62% (documented above — sake rice is polished for this).

## Four things the general model cannot see
Four recipes stayed short of the owner's targets for reasons that are true of
the real food and invisible to a model that only reads the charge. They are
declared together at the top of `gameLogic.ts` rather than hidden as conditions
further down, because each is a statement about the food, not a fudge factor.

- **`AROMATIC_INFUSION` — an aromatic is infused and strained, not body.** Rose
  petals flavour a garum; the KOJI is its substrate and does all the work.
  Weighed as body in the mass-weighted composition, 300 g of petals diluted
  1 kg of koji and umami came out 19 against a target of 42 unless the player
  charged six parts koji to one of petals. Skipped in the body loop alongside
  water and salt.
- **`IMPLIED_SEASONING` — some recipes name only their headline reagents.**
  Kimchi's yangnyeom is not just chili: it carries jeotgal or fish sauce, and a
  pear and a rice porridge. The matrix asks for chili and salt, so that savour
  and sweetness had nowhere to come from (umami 2 against 48). Rose garum takes
  its acidity here for a different reason — see below.
- **`SPONTANEOUS_BREWS` — a wild brew catches its population like a meju.**
  `wildBloom` was gated on `FermentType.KOJI`, so a chicha with "no starter at
  all, the oldest way there is" was scored on the corn's own microbes.
- **`PRESSED_HARD` (massBalance) — some things are squeezed, most are drained.**
  A sake moromi goes into a fune and the kasu comes out as dry sheets; a
  colatura runs through a hole under gravity. The general retention is a
  gravity-and-cloth number, so sake on a whole heritage grain pressed 41%
  against a real 45–85%.

Two more of the same kind, found while measuring these:

- **A 60 °C garum is ENZYMATIC, not microbial.** Nothing is alive at that
  temperature — that is the whole point of the modern route, and why its salt is
  for flavour rather than safety. The Garum family's `attenuation` assumed
  microbes eating the sugar, which soured a rose garum to acidity 52 against 30
  and dried it to sweetness 40 against 68. `BY_RECIPE` gives it 0.05/0.10: the
  koji's enzymes still work, nothing ferments what they free. Its brightness is
  the flower's own, and no hidden stat carries "aromatic acidity", so it is
  declared.
- **Aroma rides in the liquid, the same as savour.** The liquid model compresses
  dilution for umami (`c^0.4`) because taste follows a power law; funk was still
  scaled straight down by the solids fraction, so a chicha that is four parts
  water was an open-pot spontaneous brew smelling of nothing (funk 14 against
  58). Both axes take the compression now.

**Tried and reverted: "koji makes citric acid above 50 °C."** It would have
supplied the rose garum's acidity from the model rather than by declaration, but
the mould is long dead at that temperature, and crediting it soured the amazake
held at the same heat to acidity 64 against a target of 6.

Measured after: rose garum miss 85 → 28 (score 90), kimchi 77 → 37 (85),
corn chicha 81 → 45 (84), sake press 41% → 53% and miss 65 → 60. Catalogue-wide,
mean miss 49 over 75 recipes, none over 90, and 24 of 24 mass/press checks in
their practice bands.

**The press bands in the harness are PRACTICE ranges, not invented ones.** Two
bands written for the koji-extraction garums were guesses at what a number
should be, and a guessed band is not a test — it fails the code for disagreeing
with the guess. If there is no real figure for a process, do not check it.

## One clock for the lab and the land
- `GameState.minute` is minutes since midnight. A bench tick is 180 minutes (eight a day), and `advanceWorld(prev, minutes)` runs `runLabTick` at every 180-minute boundary and `runLabDay` at midnight, with the estate's day FIRST. The lab's live loop is `advanceWorld(prev, 180)` on the speed interval; out on the estate the loop stops and every action spends its own minutes. The lab never pauses while you are out, which is the owner's call: the field runs in parallel so nothing loses its logic.
- The technician's standing orders (`labOrders`: hold at peak, cellar when ready, skim, turn) run inside `runLabTick`, so they are pure. `Batch.held` stops a batch ticking.
- The climate is 45°N (Piedmont / Provence), from `services/climate.ts`: monthly normals, seeded daily weather from `weatherForWeek`, real sunrise and sunset with DST. The game year is 336 days, so degree days are scaled by `DAY_SCALE = 365/336` — without it every crop ripened late.

## The estate (services/estate.ts, growth.ts, livestock.ts)
- **`estateDay` is pure** and runs inside the day's updater. Anything it wants to post comes back in the report. Pantry changes during the round go into one `Pantry` object (`pantryOf` / `pantryPut`) and are written back at the end, because produce is stored after it with `storeProduce`, which reads the same `estate.carry`.
- **Waste and soil products live in the pantry**, not in the estate. That covers green waste, straw, eggshells, rice rinse and the rest, and everything the soil lab and the shed make. They are 1 kg units in `inventory`, and the part-kilo is carried in `estate.carry`. A soil product is minted like produce, with its grade in the id (`compost__q86`, `legitCounterpartId` = base). So `isEstateProduce` must exclude `SOIL_PRODUCT_IDS`, or the van offers to buy your compost.
- **A strong batch goes further**: a dose is `perM2 × area / strengthOf(grade)`. A grade-50 compost needs 19 kg for a 6 m² bed; grade 80 needs 12.
- Compost tea loses 40% a day on the shelf. It is alive only while it has air.
- **The model follows the picture.** The painted kitchen garden has seven raised beds, three small at the back and two pairs in front, so the spec has seven (3 × 4 m² + 4 × 6 m², the same 36 m² as the six it replaced). `migrate()` reconciles saved plots with the spec: new beds are added empty, and a resized bed takes its new area only when nothing grows in it.

## The soil lab (services/soil.ts, constants.soil.ts)
- Soil batches **bypass `processBatchTick`**. `runLabTick` routes them to `soilBatchTick` before the ageing gate, and they keep ticking past ready, because a compost cures and a plant juice left too long turns. They never reach the critic or the market. Their Harvest tab is "Into the pantry", and "Keep" mints the product at `soilGrade` × `soilYieldKg`.
- **Air decides; cold only slows.** Each kind wants one air setting from the vent: a bokashi sealed, a juice under a cloth (vent 1), a compost tea pumped (forced vent plus power), a heap its own oxygen. Temperature drives the rate, and the grade only weakly (`0.55 + 0.45 × fit`). Judging on temperature too marked a January juice down twice.
- **A heap is judged on heat while it should be hot and on air while it cures.** Judging a curing heap on temperature capped the best compost at 64. It must pass 55 °C for three days, which a turn every day or two achieves. Oxygen falls 3.2 a tick and a turn resets it. The technician's "turn" order turns a heap below 40% oxygen.
- **Measured** (42 kg, turned below 45% O2): autumn 11 °C grade 97, summer 24 °C grade 99, about 21 days and 11 turns. Unturned it grades about 50. In deep winter (4 °C) it cannot cook and caps at 55, and so does a 12 kg heap in any season. Bokashi grades 94 sealed, 70 under a cloth and spoils open. Juices grade 98 under a cloth and about 80 sealed or open. Compost tea grades 97 pumped and 52 without. An FPJ left to 200 turns and drops to 53. Re-run a harness against that spread before touching a coefficient.
- **Matrix:** `SOIL_MATRIX` sits at the top of `RECIPE_MATRIX`, and every entry needs a soil-only ingredient, so no old combination can reach one. Differential over 254,016 combinations (96 old substrates × 378 reagent sets × 7 vessels, HEAD in a worktree): **0 moved**. A second check puts each soil ingredient into old combinations. No soil reagent moves a named recipe. Eggshells on a koji tray DID fall through to the barley-koji catch-all, so eggshells are in `COMPOSTABLE` and go to the heap.
- Rice rinse arrives when a batch starts with rice (0.5 kg per kg of rice). A discarded batch goes to the waste as press cake if it was pressed, fish waste if its substrate is flesh (`isFlesh`), spent grain if starchy, and vegetable waste otherwise.
- Black soldier flies and worms live on the farm (the shed), not in the lab. The owner decided that.

## The painted estate plates
- The owner's plates come from a generator that paints at **480×268 and upscales to 1376×768 by 2.867**. Measured by FFT of the edge profile, every plate has that pitch and the same phase. `scripts/forage_art/snap_plates.py` reads each cell as the median of the four source pixels round its centre, repeats one row top and bottom (true 16:9, 480×270), cuts to 64 colours with no dither, and writes `art/estate/<place>-<variant>.png`. Snapping to the old 384×216 grid would have resampled every pixel by 0.8.
- A new batch needs one line in `SOURCES` (the image stem, the place, and the order its seasons were saved in). The brief asked for summer, spring, autumn, winter, snow. Then run `export_estate.py`, which replaces a place's placeholder plates with the painted ones and takes its geometry from `PAINTED_GEOM`.
- **The canvas takes the plate's size** (`sceneSize(place)`, from `geom.size`). Painted places are 480×270 and placeholders 384×216. Resizing a canvas resets its context, so `imageSmoothingEnabled` is set every frame. Weather and light read `ctx.canvas`, never the constants.
- **Beds and strips are quads** (TL, TR, BR, BL), because the paintings are in perspective. A thing standing at y is scaled `k × (y − horizon)`, rows are spaced in real ground depth (`depthV`), and `FORESHORTEN` sets how a metre of field shrinks going away. Hit areas are an SVG of polygons on the plate's own grid, sorted far to near so the near shape takes the click. The tunnel's plants stand where the painted strings end.
- A painted place may lack a variant (the lemon house came without a clear winter). `plateKey` falls back from the variant to the plain season, then to the other winter, then to summer.
- Fruit and flowers on a painted tree are sized to the canopy: 2 px specks on a 480-wide plate were drawn and invisible.
- **The ≤1100 px estate layout needs `grid-auto-rows: max-content`.** With auto rows and `min-height: 0`, the grid squeezed the scene column to 225 px and the bed cards printed over the picture.

## The wild (services/wild.ts, constants.wild.ts, components/WildView.tsx)
- Ported from the Understory prototype onto the world clock. Walking out costs the ground's own minutes (the moss is an extra hour until you have found the path). A look is 15, a test under the lens 10, and each piece picked costs by kind. Everything sits inside the estate modal: "The wild →" from the farm map opens a board of postcards cut from each ground's plate. That stands in until a painted estate map exists.
- **Most signs are nothing, on purpose.** The skill is knowing what to ignore, so a look costs time whatever it shows. A `find` exists only in season, with the patch above 0.3 vigour and not resting. A patch rests a week after it is picked.
- **A patch remembers how it was picked.** Prime only keeps it level. Taking young and past as well lowers it, and a patch left alone recovers ×1.15 a year. The patch takes its new vigour at the turn of the year (`wildDay`, January), not at once, as in the prototype.
- **Lookalikes are real and so are their tells.** Real or fake is seeded on species and day, except the shrub by the gate, which is fixed for good the first time anyone looks. Each test you run teaches its tell, whatever you decide. A wrong call on a poor lookalike fills the basket at its low quality. On a ruinous or deadly one there is nothing to pick: the verdict is the lesson. "Unnamed" goes home in a bag for the bench's spectrometer, which bins a fake and passes a real one 10 grade points down.
- Picks go into the pantry through `storeProduce`, as graded estate produce like anything grown.
- **The forager's apprentice** goes out on Mondays (`date.day === 1`). They go only to what you have found, take only the prime, and skip anything with a lookalike until you know at least two of its tells. Their picking nudges a patch UP (×1.02), so a hand is a sustainable harvest, not a free one.
- Sign coordinates live in `signalsFor`, on each plate's own grid (480×270). Pins go on something PAINTED: the pine plantation has no stump in its picture, so the stump sign stands on the needle floor by the big trunks, not in the grass of the ride.
- The wild board is the owner's painted map (`wild_map`) with a pin and label per ground from `MAP_PINS`; the postcards remain the fallback when that plate is missing.

## The estate's economy (measured, three years, every place owned)
- **By hand**: ~$11,400 a year of produce at the van's prices (what you no longer buy), $1,700 of running costs, and 10.6 hours a week of the player's time (145 minutes a day in July at the peak).
- **Fully staffed at skill 3** (wages scale ×(0.55 + 0.22 × skill), so ×1.21): $13,300 of wages plus $1,800 running, against $11,750 of produce plus about $2,100 of wild haul. **About −$1,200 a year for 0.2 hours a week.** Staff buy time, not profit. The profit is the ingredients themselves, in the lab.
- **Each role roughly pays for itself** at skill 3: gardener 1.06×, orchardist 1.6×, beekeeper 1.4×, poultry keeper 1.04× (wage $15, was $20 at 0.95×), forager 1.06× at one ground a week and 1.4× at skill 4. The soil technician is $35 (was $60, for almost nothing in kilos): what they buy is soil life, which shows in grade, not weight.
- **The forager walks ONE ground a week** (two at skill 4), the best in season. Walking all ten every Monday paid 2.5× the wage.
- **The van saturates by design.** Selling everything weekly pays ~$2,300 a year, about 20% of replacement value, which just covers the running costs. A glut dumped at once pays ~5%. Do not "fix" this: the van is the outlet for a surplus, not the business.
- **Estate quality reaches the critic only through the terroir cap** (`60 + 0.4 × average quality of what is charged`) and the stat nudges in `makeProduce`. Grade-93 tomatoes against the van's 82 lift the cap by ~4 points, which binds only on an otherwise excellent batch. If the lab payoff should be larger, that is a design decision for the owner, not a retune.

## The biodynamic label and the home-grown premium
- **Home-grown is worth more; biodynamic is scarce.** Estate produce sells to the van at ×1.25 (`HOME_GROWN_PREMIUM`). Biodynamic produce (`__bio` on the id, tag BIODYNAMIC) adds ×(1 + 1.6 × demand), and that demand has its own small appetite (`BIO_APPETITE_KG` 6 kg), so a crate of it pays well and a cartload does not.
- **At market the label follows the batch** (`provenanceOf`: the share of the units charged that are estate-grown and that are biodynamic, ignoring salt, water, sugar, vinegar, starters and tools). `labelPremium = 1 + 0.2 × estate + 0.9 × bio × demand['label:biodynamic']`. Every biodynamic sale spends that demand (0.3 × bio share, floor 0.25) and it recovers on the weekly drift, so the premium is up to ~2.1× and thins if you flood it.
- **A bed earns the label; it is not a setting.** 336 days (one game year) with no synthetic spray and no bought manure, and soil life ≥ 60. Land is "sprayed" on the day it is bought, so conversion starts then. Spraying (a standing order or the button) stops SPRAYABLE problems for 14 days and restarts the clock. The manure fallback (no compost in the pantry) counts as bought feed. Measured over three years, staffed with compost: 0 kg biodynamic in year one, ~97% after. Without soil-lab feed, ~77% (mostly trees, whose soil does not matter). Van: a biodynamic plum ~$20 against $7.69 home-grown.

## The hen run and the shed, painted
- Hens are a 9×9 template at 2 px a cell, about as tall as the painted waterer, depth-sorted and mirrored to the way they walk. The nest box is painted shut, so eggs are counted in the panel, not drawn on it.
- **The shed's plates are painted shut.** Nothing is drawn on the bins or towers (dots on a closed lid read as a different picture pasted on). What the colony is doing shows where it would really show: prepupae crawling down the two painted ramps to the lidded buckets, adults inside the mesh cage. `SHED_RAMPS` and `FLY_CAGE` are measured off the plate.
- **A flock the fox can empty must be restockable.** Point-of-lay pullets, two for $44, up to 12 in the coop. Without that an open door every night ended the run for good.

## Crop sprites and variation
- `art/estate/crops/` is cut from two magenta sheets by `cut_crops.py` (via `cut_sheet.py`: keyed, blobs merged, rows by bottom edge); seven stages per family. `export_estate.py` exports them as `CROP_STAGES` / `CROP_EXTRA`. The drawn plants remain the fallback for any family without a set.
- **The owner's rows are not all in growth order.** Tomato flowers come after green fruit on the sheet, garlic's last two cells are lifted bulbs, a pea row has no dead cell, and a rose dies back to canes. `STAGE_MAP` / `DEAD_SPRITE` fix this at draw time; check a new row as a contact strip before trusting its order.
- **Sprites only where they read.** In the top field a pea is a few pixels and a row of sprites turns to static, so field pulses are drawn as rows closing over (two greens, flowers, pods, straw); corn and grain keep their sprites because they are tall or tiled.
- Every plant has a seeded jitter: ±10% pace through the stages, size 0.86–1.14, mirror, and a small offset. Poor health leaves GAPS in a bed rather than shrinking every plant. Seeds come from the bed and slot, never `Math.random` — the scene redraws every frame.

## What the animals eat (services/livestock.ts)
- **Worms and flies eat different things, for real reasons.** `WORM_FOOD`: greens, a little acid windfall, straw bedding near a third of the weight, crushed shell as grit. `WORM_REFUSE`: fish (rots and draws flies), press cake (salt kills worms), prunings (wood). `BSF_FOOD` is kilos of prepupae per kilo fed: fish and spent grain 0.20, press cake 0.14, veg 0.12, green waste 0.05; straw, wood and shell are not food. Each has its own button, and the technician's order routes waste the same way: `FLY_FIRST` (fish, press cake, spent grain) to the flies, the greens with straw to the worms.
- **The worms' bedding sets the castings' grade**: greens alone 67, greens with 30% straw 96, windfall-heavy 76 (84 with shell). A bale of straw is $8. Worms above a 3 kg breeding colony can go to the hens.
- **The hens' diet is simulated, not flagged.** `henEat` fills 110 g of dry matter a hen a day from the bin in order of preference, each feed capped at what a hen will eat of it, pellets last. Protein (want 16% of dry matter) sets the lay with hunger and daylight; free-choice crushed shell or pellets keep the shell sound, and without calcium thin eggs break in the nest; greens and maize colour the yolk. Dried pulses cost 40 minutes because they are cooked: raw beans carry lectins.
- **The diet is in the egg, and the egg is sold on its yolk.** `eggGrade` = 56 + 18·yolk + 10·protein + 8·calcium + health. `QUALITY_ELASTIC` prices eggs at (grade / 86)^3 at the van, so the gentle default for other produce is untouched. Measured over 30 summer days, six hens:
  pellets 0.84 eggs/hen/day grade 84 ($7.83 per ½ kg of yolks before the home-grown premium); own grain alone 0.33, grade 68 ($4.15); grain + shell 0.62, 76; grain + cooked pulses + shell 0.84, 81; + greens 84; maize, grain, fly larvae, greens and shell 0.93, **91** ($9.95). Re-run a harness against that spread before touching a coefficient.
- A keeper returns the shells to the flock and buys pellets only when the bin holds under three days of feed. They never feed your crops: whether the grain goes to the hens or the koji room is the player's decision.

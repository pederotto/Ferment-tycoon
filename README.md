# Fermenta Tycoon

A culinary fermentation tycoon sim. You run a small atelier: culture koji, press garums,
bury misos, and sell what comes out — to restaurants if it is clean, to the underground if
it is not.

The simulation is entirely local and deterministic. No backend, no API keys.

## Running it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | `tsc --noEmit` — typecheck only |

## How the game works

**The bench.** Eight slots. Each running batch occupies one to four of them depending on its
vessel, so bench space is the real constraint on how much you can have going at once.

**Inoculating a batch.** The Inoculation Bench is four stations: draw reagents from the
pantry, charge the chamber, pick a vessel, then set temperature and moisture and seal it.
Batch size is bounded by the vessel's capacity, not by a fixed reagent count — a 60L Oak
Cask genuinely holds more than a 3L Cedar Tray.

**Recipes are discovered, not listed.** `resolveRecipeFromMatrix` maps an ingredient and
vessel combination onto a recipe. Until you have actually made something it shows as
`Unknown Reaction ???`.

**The simulation** (`services/gameLogic.ts`) runs a tick per second, faster at higher game
speeds. Koji has its own thermal model — it generates metabolic heat, and an insulated
vessel with the lid closed will cook it. Everything else runs a liquid/paste model with
thermal inertia scaled by mass. Salinity gives osmotic protection, acidity suppresses
pathogens, and heat plus fat gives you rancidity.

## The economy

Sale price flows through one function, `calculateOffer`:

```
50 × difficulty × (score / 50) × yieldMultiplier × buyerMultiplier × chefMultiplier × demand
```

- **Volume pays sublinearly** (`pow(volume, 0.62)`). Bulk trades margin for throughput
  instead of dominating: a full Oak Cask is worth ~12.7× a 1L batch, not 60×.
- **Every sale saturates its ferment type.** Selling the same thing repeatedly drives its
  demand toward a floor of 0.35; appetite recovers weekly. Bulk floods the market hardest.
- **The week has a bill**: `120 rent + 18/vessel beyond the first two + 1.10/watt + wages`.
- **Three consecutive weeks in the red closes the lab.**

## Learning recipes

Recipes are not listed for you. There are three states:

| state | how you get there | what it gives you |
| --- | --- | --- |
| unknown | — | `Unknown Reaction ???` |
| **known** | buy a book, or cook it | the name, the description, and **the formula** — what goes in, and in what vessel |
| **analyzed** | cook it | the flavour target and the peak window |

Books are sold from **The Bindery** in the sourcing drawer, gated on lifetime bench
XP as well as price, so the opening float can't be spent on the whole shelf.

The formula card reads from `RECIPE_MATRIX` — the same table `resolveRecipeFromMatrix`
matches on — so the book and the resolver can never drift. If you add a named recipe,
add its matrix entry, or it is unreachable and unprintable.

## Mastery — "the Hand"

Every recipe carries its own 1–5 track. XP comes from cooking *that* recipe, convex
in the critic score, so a good run teaches much more than a sloppy one and anything
under 25 teaches nothing. The top rung also needs a run scoring 80+.

The rungs escalate from direction to precision: flavour text → which dial is the
lever → coarse bands → the peak window and duration → the exact figures and the
flavour target. **Mastery grants information only, never a score bonus** — a bonus
would land before the terroir cap and so be worth nothing with good ingredients and
everything with cheap ones, letting mastery substitute for buying quality.

Because of this, the Codex and the molecular scan deliberately show `??` for target
temp/humidity until the track is high enough. Don't "fix" that.

## The Underground

Three currencies, three jobs:

- **Money** — what the fence charges and what every fence pays.
- **Heat** — the risk budget you spend for the edge. Raids scale with it.
- **Renown** — buys nothing. It only makes heat go away (the Grease action).

Access gates on bench XP, not supplier loyalty. Supply is grey-market copies at ~48%
of list, generated from their legal counterparts and paying their penalty through the
existing terroir cap. Demand is three fences that buy what the licensed trade refuses
— spoiled, unsafe, contraband — priced on funk, hazard and potency rather than the
critic score, and deliberately outside `marketDemand` so the underground doubles as
the release valve for a glutted market.

## Layout

```
App.tsx                    game loop, day/week tick, harvest and sale handlers
types.ts                   GameState, Batch, Recipe, Ingredient, Buyer
constants.ts               ingredients, recipes, buyers, suppliers, vessels, economy tuning
services/gameLogic.ts      simulation, economy, recipe matrix, underground valuation
services/mastery.ts        per-recipe XP and the advice ladder
services/persistence.ts    versioned localStorage save with forward migration
components/
  LabView.tsx              the bench and its cubbies
  BatchController.tsx      the Inoculation Bench modal
  BatchInspector.tsx       telemetry, interventions, harvest and buyers
  Marketplace.tsx          Sourcing & Exchange drawer
  HardwareStore.tsx        vessels, tools and grid upgrades
  StaffManager.tsx         hiring
  LogbookModal.tsx         Codex and archive
  icons.tsx                hand-drawn vessel and ingredient art
index.css                  the "warm artisan workshop" design system
```

### Design system

Everything is built from CSS custom properties and component classes in `index.css` —
wood, clay and brass rather than a neon lab dashboard. `--bg-void`, `--amber`, `--brass`,
`--moss`, `--brick`, `--plum` and the `.wood-panel` / `.ticket` / `.btn-amber` /
`.station` / `.chip-tab` vocabulary. Prefer those over ad-hoc Tailwind colour utilities so
screens stay consistent.

### Stacking order

Layered deliberately, and easy to break:

```
scrim (20) < hardware drawer (25) < HUD (30) < marketplace drawer (50) < modals (100)
```

The hardware drawer sits below the HUD so its closed grab-tab does not cover the gauge
rings, and above the scrim so opening it does not dim itself.

## Saves

Progress autosaves to `localStorage` once per in-game day, and on unload. Saves are
versioned; `migrate()` in `services/persistence.ts` fills defaults for fields added later,
and an unrecognised or malformed save is discarded rather than crashing the bench.

**Any new `GameState` field must be added in three places**: `types.ts`, the initial state
in `App.tsx`, and `migrate()` in `services/persistence.ts`.

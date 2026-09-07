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

## Layout

```
App.tsx                    game loop, day/week tick, harvest and sale handlers
types.ts                   GameState, Batch, Recipe, Ingredient, Buyer
constants.ts               ingredients, recipes, buyers, suppliers, vessels, economy tuning
services/gameLogic.ts      simulation + the economy (one source of truth for pricing)
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

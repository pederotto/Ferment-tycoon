import { Batch, GameState, Ingredient, IngredientType, Lineage, FermentType } from '../types';
import {
  INGREDIENTS, KOJI_ROOM_CAPACITY, KOJI_ROOM_BED_KG, KOJI_ROOM_TEMP, KOJI_ROOM_SPORE_FLOOR,
  KOJI_INOCULATION_TEMP, SPORULATION_START, SPORULATION_FULL, SPORULATION_SPOIL,
} from '../constants';
import { GRAIN_IDS, CORN_IDS } from '../constants.heritage';
import {
  getRecipeForBatch, resolveRecipeFromMatrix, calculateBatchDynamics, generateInitialQuality,
  applyBatchIntervention, getAmbientConditions, getLineage, sporeYield, sporeValue,
} from './gameLogic';
import {
  propagateLineage, lineageStrainKey, lineageStrainLabel, describeLineage, sporePotency, mintKojiProduct,
  bedSpore, blackKojiTag,
} from './koji';

/* =============================================================================
   THE KOJI ROOM, AND THE PERSON WHO RUNS IT

   The room is a place: beds on its shelves are off the bench (no slot, no power,
   no hygiene load) and held warm by the built-in bed vessel. Without a keeper
   that is all it does — nobody turns a bed or takes it at its peak.

   The keeper's round runs once a game day and does what a player at the bench
   would, through the same functions: holds each bed at the recipe's target,
   turns it when it stratifies (`applyBatchIntervention('Flip')`), takes it to
   the pantry at its peak (`mintKojiProduct`, as Keep does), lays new beds from
   pantry grain and spore, and lets a bed run on to spore when the house is low
   (`mintSporeHarvest`, shared with the player's own Sporulate), buying founder
   spore at the supplier's price only when the house has none.

   It works to a TARGET of koji in the pantry, not to a full room. Measured: a
   full room makes ~43 kg a week and a full bench of casks and barrels uses ~10,
   and selling the difference drives koji demand to a third. Headroom, not a mill.

   PURE. It takes a state and returns a state. The App calls it inside a state
   updater, which StrictMode runs twice — so no Date.now, no Math.random, no
   notifications in here. Ids come from the day key.

   A keeper-run bed teaches the player nothing: mastery is information you earn
   at the bench, and a room you do not touch has nothing to tell you.
   ============================================================================= */

export const KOJI_ROOM_VESSEL = 'koji_room_bed';

/** Grains a keeper will lay a bed on, in whatever the pantry holds most of. */
export const KOJI_GRAINS: string[] = Array.from(new Set(['barley', 'glutinous_rice', ...GRAIN_IDS, ...CORN_IDS]))
  .filter(id => INGREDIENTS.some(i => i.id === id));

const GROWN_KOJI = /^koji_(?!spores).+_a\d+_p\d+$/;
export const isKojiStock = (id: string): boolean => GROWN_KOJI.test(id) || id === 'barley_koji' || id === 'koji_rice';

/** Koji in the pantry, in kilograms (every koji unit is a 1 kg bed's worth). */
export const kojiStockKg = (inventory: Record<string, number>): number =>
  Object.entries(inventory).reduce((a, [id, n]) => a + (isKojiStock(id) ? Math.max(0, n) : 0), 0);

export const sporePackets = (inventory: Record<string, number>): number =>
  Object.entries(inventory).reduce((a, [id, n]) => a + (id.startsWith('koji_spores') ? Math.max(0, n) : 0), 0);

/**
 * Take spores off a bed. Moved here out of the App's harvest so the keeper and
 * the player's own Sporulate mint exactly the same strain from the same bed.
 */
export const mintSporeHarvest = (
  batch: Batch,
  sporeAmount: number,
  inventory: Record<string, number>,
  customIngredients: Ingredient[],
): { inventory: Record<string, number>; customIngredients: Ingredient[]; sporeId: string } => {
  const newInventory = { ...inventory };
  const newCustomIngredients = [...customIngredients];
  const parent = getLineage(batch);
  // How well THIS bed was run decides what its children are worth. Without it
  // every sporulation was a free step up the ladder.
  const potency = sporePotency(batch.quality.safety, batch.stress ?? 0, batch.enzymes);
  const child = propagateLineage(parent, batch.history, batch.lineageDamaged, potency);
  const strain = lineageStrainKey(child.bias);
  const nextGen = child.generation;
  // Spores off a black koji bed are black koji. Without this the strain's
  // citric acid was lost at the first sporulation, and its children were
  // blended into the yellow house strain of the same generation.
  const acid = bedSpore(batch, [...INGREDIENTS, ...customIngredients])?.acidProtection;
  const sporeId = `koji_spores_gen${nextGen}_${strain}${blackKojiTag(acid)}`;
  const existingIdx = newCustomIngredients.findIndex(i => i.id === sporeId);

  // Re-propagating into a strain you already hold blends the two rather than
  // overwriting: a house culture is the average of how you have treated it.
  const merged: Lineage = existingIdx >= 0 && newCustomIngredients[existingIdx].lineage
    ? {
        generation: nextGen,
        vigor: (newCustomIngredients[existingIdx].lineage!.vigor + child.vigor) / 2,
        resilience: Math.round((newCustomIngredients[existingIdx].lineage!.resilience + child.resilience) / 2),
        bias: (newCustomIngredients[existingIdx].lineage!.bias + child.bias) / 2,
        potency: ((newCustomIngredients[existingIdx].lineage!.potency ?? 1) + (child.potency ?? 1)) / 2,
      }
    : child;

  const spore: Ingredient = {
    id: sporeId,
    name: `Master ${acid ? 'Black Koji ' : ''}Spores (Gen ${nextGen} · ${lineageStrainLabel(merged.bias)})`,
    type: IngredientType.STARTER,
    // Priced on strength, not on how many times you have propagated it.
    baseCost: sporeValue(merged),
    currency: 'money',
    quality: Math.round(Math.max(20, Math.min(100, (merged.potency ?? 1) * 78))),
    description: describeLineage(merged) +
      (acid ? ' Black koji: the beds you grow from it carry citric acid into whatever they go into.' : ''),
    idealFor: ['koji'],
    supplierId: 'in_house',
    tierRequired: 0,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0 },
    mass: 10,
    unitDisplay: 'g',
    isLiving: true,
    generation: nextGen,
    // strainBias is what advanceEnzymes reads, so the drift reaches the
    // simulation through the same door a bought spore does.
    strainBias: merged.bias,
    lineage: merged,
    ...(acid ? { acidProtection: acid } : {}),
  } as Ingredient;

  if (existingIdx >= 0) newCustomIngredients[existingIdx] = spore;
  else newCustomIngredients.push(spore);
  newInventory[sporeId] = (newInventory[sporeId] || 0) + sporeAmount;
  return { inventory: newInventory, customIngredients: newCustomIngredients, sporeId };
};

export interface KeeperReport {
  turned: number;
  harvested: number;
  kg: number;
  laid: number;
  spores: number;
  spoiled: number;
  reserved: number;
  /** Why the keeper could not reach the target, if they could not. */
  short: '' | 'grain' | 'spores';
  /** Founder spore bought because the house had none, and what it cost. */
  bought: number;
  spent: number;
}

const find = (state: GameState, id: string): Ingredient | undefined =>
  [...INGREDIENTS, ...state.customIngredients].find(i => i.id === id);

/** The strongest spore the house holds, else bought founder stock. */
const bestSpore = (state: GameState, inventory: Record<string, number>): Ingredient | undefined => {
  const house = state.customIngredients
    .filter(i => i.id.startsWith('koji_spores') && (inventory[i.id] ?? 0) > 0)
    .sort((a, b) => ((b.lineage?.potency ?? 1) - (a.lineage?.potency ?? 1)));
  if (house.length) return house[0];
  return (inventory['koji_spores'] ?? 0) > 0 ? find(state, 'koji_spores') : undefined;
};

const layBed = (state: GameState, grain: Ingredient, spore: Ingredient, id: string): Batch | null => {
  const units: Ingredient[] = [...Array(KOJI_ROOM_BED_KG).fill(grain), spore];
  // Per UNIT, not per ingredient (see CLAUDE.md): a kilo of grain per unit drawn.
  const q: Record<string, number> = { [grain.id]: grain.mass ?? 1000, [spore.id]: spore.mass ?? 10 };
  const recipe = resolveRecipeFromMatrix(units, 'koji_tray');
  if (recipe.type !== FermentType.KOJI) return null;
  const dyn = calculateBatchDynamics(units, q);
  const generation = spore.generation || 1;
  return {
    id, recipeId: recipe.id, cachedRecipe: recipe, substrateId: grain.id, starterId: spore.id,
    inputIngredientIds: units.map(u => u.id), ingredientQuantities: q,
    totalMass: dyn.totalMass, yieldVolume: dyn.yieldVolume, vesselId: KOJI_ROOM_VESSEL,
    startTime: state.year * 100000 + state.month * 1000 + state.week * 10 + state.day,
    lastTick: 0, progress: 0,
    params: { temp: KOJI_INOCULATION_TEMP, humidity: recipe.idealParams.humidity, salinity: 0 },
    quality: generateInitialQuality(units), status: 'active',
    messages: ['Laid by the koji keeper.'],
    generation,
    lineage: spore.lineage ?? { generation, vigor: 1, resilience: 0, bias: spore.strainBias ?? 0.5 },
    lineageDamaged: false, stress: 0, disturbanceTimer: 0, flags: { isLidPropped: false },
    controls: { vent: 0, mist: 0, heat: KOJI_ROOM_TEMP }, surfaceWater: 0,
    kojiRoom: true,
  };
};

/**
 * How the keeper keeps spore coming. MEASURED over twelve game weeks (bench
 * drawing 10 kg a week, target 25; and a sake season at 25 kg a week, target 60):
 *
 *   floor rule, house spore only      bench got 75% / 30% of its koji, short 65 / 72 days
 *   demand 0.6, house spore only      75% / 30%, short 72 / 72 days
 *   demand 0.6 + buy founder spore    94% / 94%, never short, $165 / $375 of spore
 *   demand 0.4 + buy founder spore    94% / 94%, never short, $285 / $720 of spore
 *
 * A spore bed returns three packets and every bed takes one, so a room that only
 * grows its own spore spends a third of its beds on spore and still stalls for a
 * week at a time. The default lays spore beds ahead of need (0.6 per koji bed,
 * which is where three-for-one balances) and buys founder spore only when the
 * house has none — so the strain is still mostly yours and the room never idles.
 * The 6% the bench did not get is the first week, before any bed has peaked.
 */
export interface KeeperOptions {
  reserve?: 'floor' | 'demand';
  /** Floor rule: packets on hand plus packets growing below which a bed is held back. */
  sporeFloor?: number;
  /**
   * Demand rule: spore beds kept growing per koji bed. A spore bed returns three
   * packets and every new bed takes one, which balances at about 0.6.
   */
  sporeRatio?: number;
  /** Buy founder spore at the supplier's price when the house has none and the room would otherwise stall. */
  buySpores?: boolean;
}

/** One day of the keeper's work. Pure: same state and key in, same state out. */
export const keeperRound = (
  state: GameState,
  dayKey: string,
  options: KeeperOptions = {},
): { state: GameState; report: KeeperReport; acted: boolean } => {
  const reserveRule = options.reserve ?? 'demand';
  const sporeFloor = options.sporeFloor ?? KOJI_ROOM_SPORE_FLOOR;
  const sporeRatio = options.sporeRatio ?? 0.6;
  const founder = INGREDIENTS.find(i => i.id === 'koji_spores');
  const report: KeeperReport = { turned: 0, harvested: 0, kg: 0, laid: 0, spores: 0, spoiled: 0, reserved: 0, short: '', bought: 0, spent: 0 };
  if (!state.kojiRoomOwned || !state.crew?.some(c => c.role === 'toji')) return { state, report, acted: false };

  const ambient = getAmbientConditions(state.month, state.weather).ambientTemp;
  let inventory = { ...state.inventory };
  let customIngredients = [...state.customIngredients];
  const kept: Batch[] = [];
  const others: Batch[] = [];

  for (const original of state.batches) {
    if (!original.kojiRoom) { others.push(original); continue; }
    let b = original;
    const recipe = getRecipeForBatch(b);

    if (b.status === 'spoiled') { report.spoiled++; continue; }

    // Hold the room at what this bed wants.
    const ideal = recipe.idealParams;
    const h = b.params.humidity;
    b = { ...b, controls: { ...(b.controls ?? { vent: 0, mist: 0, heat: null }), heat: Math.min(KOJI_ROOM_TEMP, ideal.temp), mist: h < ideal.humidity - 5 ? 1 : 0, vent: h > ideal.humidity + 8 ? 1 : 0 } };
    if ((b.evenness ?? 100) < 85) { b = applyBatchIntervention(b, 'Flip', ambient, recipe, inventory); report.turned++; }

    const toSpore = b.kojiReserve || b.progress >= SPORULATION_START;
    if (toSpore && (b.progress >= SPORULATION_FULL || b.progress >= SPORULATION_SPOIL - 4)) {
      const amount = sporeYield(b, recipe);
      if (amount > 0) {
        const minted = mintSporeHarvest(b, amount, inventory, customIngredients);
        inventory = minted.inventory; customIngredients = minted.customIngredients;
        report.spores += amount;
      }
      continue;
    }
    if (!toSpore && b.progress >= recipe.peakWindowStart + 5) {
      const amount = Math.max(1, Math.floor(b.yieldVolume || 1));
      const substrate = find({ ...state, customIngredients }, b.substrateId);
      if (b.enzymes) {
        const product = mintKojiProduct(b, recipe, substrate, bedSpore(b, [...INGREDIENTS, ...customIngredients]));
        if (!customIngredients.some(i => i.id === product.id) && !INGREDIENTS.some(i => i.id === product.id)) customIngredients.push(product);
        inventory[product.id] = (inventory[product.id] || 0) + amount;
      } else {
        const out = recipe.outputIngredientId || 'barley_koji';
        inventory[out] = (inventory[out] || 0) + amount;
      }
      report.harvested++; report.kg += amount;
      continue;
    }
    kept.push(b);
  }

  // Let a bed run on to spore when the house is running low — counting the
  // packets already growing on beds held back for it.
  const reservedNow = kept.filter(b => b.kojiReserve).length;
  if (reserveRule === 'floor' && sporePackets(inventory) + reservedNow * 3 < sporeFloor) {
    const candidate = kept.filter(b => !b.kojiReserve && b.progress < 60).sort((a, b) => b.progress - a.progress)[0];
    if (candidate) {
      const idx = kept.indexOf(candidate);
      kept[idx] = { ...candidate, kojiReserve: true, messages: [...candidate.messages, 'The keeper is letting this bed run on to spore.'] };
      report.reserved++;
    }
  }

  // Lay beds until the pantry, plus what is already growing, reaches the target.
  let free = KOJI_ROOM_CAPACITY - kept.length;
  let pipeline = kept.filter(b => !b.kojiReserve).length * KOJI_ROOM_BED_KG;
  let n = 0;
  const target = state.kojiTargetKg ?? 0;
  while (free > 0 && kojiStockKg(inventory) + pipeline < target) {
    const grainId = KOJI_GRAINS.filter(id => (inventory[id] ?? 0) >= KOJI_ROOM_BED_KG).sort((a, b) => (inventory[b] ?? 0) - (inventory[a] ?? 0))[0];
    if (!grainId) { report.short = 'grain'; break; }
    let spore = bestSpore({ ...state, customIngredients }, inventory);
    // Nothing in the house and nothing about to fruit: buy founder stock rather
    // than leave the room idle. Priced as the supplier prices it.
    if (!spore && (options.buySpores ?? true) && founder && (state.money - report.spent) >= founder.baseCost) {
      inventory['koji_spores'] = (inventory['koji_spores'] ?? 0) + 1;
      report.bought++; report.spent += founder.baseCost;
      spore = founder;
    }
    if (!spore) { report.short = 'spores'; break; }
    // Demand rule: keep spore beds growing in proportion to koji beds, laid AHEAD
    // of need, so packets arrive steadily instead of in one lump after a stall.
    const growingKoji = kept.filter(b => !b.kojiReserve).length;
    const growingSpore = kept.filter(b => b.kojiReserve).length;
    const forSpore = reserveRule === 'demand' && growingSpore < Math.ceil(growingKoji * sporeRatio);
    const grain = find({ ...state, customIngredients }, grainId)!;
    const laid = layBed(state, grain, spore, `kr_${dayKey}_${n++}`);
    if (!laid) break;
    const bed = forSpore ? { ...laid, kojiReserve: true, messages: [...laid.messages, 'Laid to run on to spore.'] } : laid;
    inventory[grainId] = (inventory[grainId] ?? 0) - KOJI_ROOM_BED_KG;
    inventory[spore.id] = (inventory[spore.id] ?? 0) - 1;
    kept.push(bed); free--; report.laid++;
    if (forSpore) report.reserved++; else pipeline += KOJI_ROOM_BED_KG;
  }

  const acted = report.turned + report.harvested + report.laid + report.spores + report.spoiled + report.reserved + report.bought > 0;
  if (!acted) return { state, report, acted: false };
  return { state: { ...state, batches: [...others, ...kept], inventory, customIngredients, money: state.money - report.spent }, report, acted: true };
};

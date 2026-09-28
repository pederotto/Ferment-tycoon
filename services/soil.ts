import { Batch, Recipe, SoilState, ChamberControls } from '../types';
import { SOIL_EFFECTS } from '../constants.soil';

/* =============================================================================
   THE SOIL LAB'S PHYSICS

   A soil batch is judged on heat, air and time rather than on umami and funk.
   Each kind wants something different, and getting it right is the whole game:

     hot compost   air, and enough mass to heat itself past 55 °C for three days;
                   it burns its oxygen and cools, and a turn puts both back.
     bokashi, EM,  sealed. Air in a bokashi bucket is rot instead of pickle.
     fish amino
     plant and     a cloth, not a lid: breathing but covered. Sealed they build
     fruit juices, pressure and go to wine; open they draw flies and mould.
     calcium,
     lactic serum,
     IMO
     compost tea   air all the way through (the pump, on the vent's forced
                   setting). Without it, it is anaerobic slime within hours.

   `rightness` is a running mean of how right the conditions were, which becomes
   the product's grade. Pure: it runs inside the bench tick's state updater.
   ============================================================================= */

type Air = 'aerobic' | 'sealed' | 'cloth' | 'pumped';

interface SoilKind {
  air: Air;
  /** Where it works best, °C. */
  optimum: number;
  /** Heats itself (a hot compost). */
  selfHeats?: boolean;
  /** Past this much progress it has turned into something else. */
  turnsAt?: number;
  /** Kilos of product per kilo charged. */
  yield: number;
}

export const SOIL_KINDS: Record<string, SoilKind> = {
  hot_compost: { air: 'aerobic', optimum: 58, selfHeats: true, yield: 0.5 },
  cold_heap: { air: 'aerobic', optimum: 20, yield: 0.45 },
  bokashi: { air: 'sealed', optimum: 24, yield: 0.95 },
  fpj: { air: 'cloth', optimum: 22, turnsAt: 150, yield: 0.55 },
  ffj: { air: 'cloth', optimum: 22, turnsAt: 150, yield: 0.6 },
  faa: { air: 'sealed', optimum: 28, yield: 0.8 },
  wca: { air: 'cloth', optimum: 22, yield: 0.9 },
  lab_serum: { air: 'cloth', optimum: 26, turnsAt: 160, yield: 0.8 },
  imo: { air: 'cloth', optimum: 30, turnsAt: 140, yield: 1.0 },
  em_active: { air: 'sealed', optimum: 30, yield: 1.0 },
  compost_tea: { air: 'pumped', optimum: 22, turnsAt: 170, yield: 1.0 },
};

export const isSoilRecipe = (r?: Recipe): boolean => !!r && !!SOIL_KINDS[r.id];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export const newSoilState = (ambient: number): SoilState => ({ rightness: 0.7, samples: 0, peakTemp: ambient, hotTicks: 0, oxygen: 70, turns: 0 });

/** How right the air is for this kind, 0-1, from the vent setting and whether the power is on. */
const airFit = (kind: SoilKind, vent: number, power: boolean, oxygen: number): number => {
  switch (kind.air) {
    case 'sealed': return vent === 0 ? 1 : vent === 1 ? 0.55 : 0.25;
    case 'cloth': return vent === 1 ? 1 : vent === 0 ? 0.75 : 0.7;
    case 'pumped': return power && vent >= 2 ? 1 : 0.2;
    case 'aerobic': return clamp(oxygen / 45, 0.2, 1);
  }
};

const tempFit = (kind: SoilKind, t: number): number => {
  const d = Math.abs(t - kind.optimum);
  return clamp(1 - d / (kind.selfHeats ? 25 : 14), 0.25, 1);
};

export const soilBatchTick = (batchIn: Batch, recipe: Recipe, ambient: number, power: boolean, controls: ChamberControls): Batch => {
  const kind = SOIL_KINDS[recipe.id];
  if (!kind) return batchIn;
  const batch: Batch = { ...batchIn, params: { ...batchIn.params }, messages: [...batchIn.messages] };
  const s: SoilState = { ...(batch.soil ?? newSoilState(ambient)) };
  const vent = controls.vent ?? 0;
  const massKg = Math.max(0.5, (batch.totalMass || 1000) / 1000);
  const f = batch.progress / 100;

  // --- Heat ---
  let target = ambient + 2;
  if (kind.selfHeats) {
    // A heap heats on its own if it is big enough and has air; the heat peaks
    // early and falls away as the easy food is eaten.
    const massF = clamp(massKg / 40, 0.15, 1);
    const early = f < 0.55 ? 1 : clamp(1 - (f - 0.55) / 0.5, 0, 1);
    target = ambient + 48 * massF * clamp(s.oxygen / 50, 0, 1) * early;
  }
  const inertia = 0.18;
  batch.params.temp = batch.params.temp + (target - batch.params.temp) * inertia;
  const t = batch.params.temp;
  s.peakTemp = Math.max(s.peakTemp, t);
  if (t >= 55) s.hotTicks += 1;

  // --- Air ---
  if (kind.air === 'aerobic') s.oxygen = clamp(s.oxygen - (kind.selfHeats ? 3.2 : 1.2) + vent * 0.9, 0, 100);
  else s.oxygen = clamp(s.oxygen + (vent * 25 - s.oxygen) * 0.2, 0, 100);

  // --- Progress ---
  const activity = clamp(kind.selfHeats ? 0.4 + (t - ambient) / 40 : tempFit(kind, t), 0.15, 1.3);
  const air = airFit(kind, vent, power, s.oxygen);
  const rate = (100 / Math.max(4, recipe.baseDurationSeconds)) * activity * (kind.air === 'pumped' ? air : 1);
  batch.progress = Math.min(1000, batch.progress + rate);

  // --- Judgement ---
  // Cold makes a brew SLOW (the activity above), and only a little worse: a
  // January plant juice takes longer, it is not ruined. Air is what decides.
  // A heap is judged on its heat while it should be hot, and on its air while
  // it cures — a curing heap sits at the temperature of the day, as it should.
  let sample = air * (0.55 + 0.45 * tempFit(kind, t));
  if (kind.selfHeats) sample = f < 0.6 ? air * (t >= 55 ? 1.05 : t >= 45 ? 0.85 : 0.55) : air;
  s.rightness = (s.rightness * s.samples + clamp(sample, 0, 1.05)) / (s.samples + 1);
  s.samples += 1;

  // --- Status ---
  if (batch.progress >= recipe.peakWindowStart && batch.status === 'active') {
    batch.status = 'ready';
    batch.messages.push(`${recipe.name} is ready for the store.`);
  }
  if (kind.turnsAt && batch.progress > kind.turnsAt && !s.turned) {
    s.turned = true;
    batch.messages.push(kind.air === 'pumped' ? 'The air has gone out of it: it has turned anaerobic.' : 'Left too long: it has turned.');
  }
  if (s.turned) s.rightness = Math.max(0, s.rightness - 0.02);
  if (kind.air === 'sealed' && vent >= 2 && s.samples > 4 && s.rightness < 0.45 && batch.status !== 'spoiled') {
    batch.status = 'spoiled';
    batch.messages.push('Air got into it. It has rotted instead of pickling.');
  }

  batch.soil = s;
  return batch;
};

/** A turn: heat released, air back in. The only thing that keeps a hot heap hot. */
export const turnSoil = (batch: Batch): Batch => {
  const s: SoilState = { ...(batch.soil ?? newSoilState(batch.params.temp)) };
  s.oxygen = 92;
  s.turns += 1;
  return { ...batch, soil: s, params: { ...batch.params, temp: batch.params.temp - 6 }, messages: [...batch.messages, 'Turned: air back into the heap.'] };
};

/**
 * The grade of what comes out, 30-100. A hot compost earns its grade by
 * cooking: it must pass 55 °C for about three days (24 ticks) or the weed seed
 * and the pathogens survive, and that caps it.
 */
export const soilGrade = (batch: Batch, recipe: Recipe): number => {
  const s = batch.soil;
  if (!s) return 50;
  let g = 40 + 58 * s.rightness;
  if (recipe.id === 'hot_compost') {
    const cooked = clamp(s.hotTicks / 24, 0, 1);
    g = Math.min(g, 55 + 45 * cooked);
    if (batch.progress > 160) g += 4;   // well cured
  }
  if (recipe.id === 'cold_heap') g = Math.min(g, 58);
  if (s.turned) g -= 15;
  return Math.round(clamp(g, 30, 100));
};

/** Kilos of product this batch will give. */
export const soilYieldKg = (batch: Batch, recipe: Recipe): number => {
  const kind = SOIL_KINDS[recipe.id];
  return Math.max(0, ((batch.totalMass || 0) / 1000) * (kind?.yield ?? 0.5));
};

/** The dose a product's grade buys: a strong batch goes further on the land. */
export const strengthOf = (grade: number): number => clamp(grade / 80, 0.4, 1.25);

export const soilEffect = (productId: string) => SOIL_EFFECTS[productId];

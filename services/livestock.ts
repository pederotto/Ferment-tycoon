import { Hive, HenRun, SaltPan, WormShed } from '../types.farm';
import { DayWeather, roll, sunTimes } from './climate';
import { clamp } from './growth';

/* =============================================================================
   BEES, HENS, SALT AND THE BINS

   Four small models, one day at a time, pure. Each is set to what the real
   thing does at 45°N and was measured in sim/farm.ts before it was trusted.
   ============================================================================= */

export interface LiveCtx {
  day: number;
  month: number;
  doy: number;
  year: number;
  wx: DayWeather;
}

/* -----------------------------------------------------------------------------
   THE APIARY

   The flows of a Piedmont hillside: willow and fruit blossom in March and April,
   ACACIA (robinia) for three weeks in May — the big one — chestnut and lime in
   June, a thin July, a dead August, and ivy in October to see them into winter.
   A colony eats about 12 kg between November and February and far more in the
   hungry weeks of March, when the queen is laying and nothing is flowering.
   --------------------------------------------------------------------------- */
export const HIVE_BROOD_STORES = 22;     // kg the brood box holds before honey goes up into the supers

/** kg a standard colony brings in on a good flying day, by where we are in the year. */
export const nectarFlow = (doy: number): { kg: number; source: string } => {
  const m = Math.floor(doy / 28);
  const dim = doy % 28;
  if (m === 2) return { kg: 0.15, source: 'willow' };
  if (m === 3) return { kg: 0.4, source: 'fruit blossom' };
  if (m === 4) return dim >= 4 && dim <= 22 ? { kg: 1.55, source: 'acacia' } : { kg: 0.5, source: 'meadow' };
  if (m === 5) return dim < 14 ? { kg: 1.0, source: 'chestnut' } : { kg: 0.6, source: 'lime' };
  if (m === 6) return { kg: 0.3, source: 'clover' };
  if (m === 7) return { kg: 0.05, source: 'dearth' };
  if (m === 8) return { kg: 0.15, source: 'late flowers' };
  if (m === 9) return { kg: 0.45, source: 'ivy' };
  return { kg: 0, source: 'none' };
};

export const flyingDay = (wx: DayWeather): boolean => wx.tMax > 13 && wx.rainMm < 2;

export const newHive = (id: string, month: number): Hive => ({
  id, alive: true, strength: month >= 3 && month <= 8 ? 1 : 0.8,
  // A colony sold in autumn comes with its winter stores; one sold in spring with what is left.
  stores: month >= 7 || month <= 1 ? 20 : 12,
  surplus: 0, varroa: 12, queenAge: 1, lastTake: -99, problems: [], takenKg: 0,
});

export const hiveDay = (hIn: Hive, ctx: LiveCtx, tended: { inspectedDay?: number }): { hive: Hive; events: string[] } => {
  const h: Hive = { ...hIn, problems: hIn.problems.map(p => ({ ...p })) };
  const events: string[] = [];
  if (!h.alive) return { hive: h, events };
  const { month: m, wx } = ctx;
  if (ctx.doy === 0) { h.takenKg = 0; h.queenAge += 1; }

  // Income
  const flow = nectarFlow(ctx.doy);
  const income = flyingDay(wx) ? flow.kg * h.strength * (wx.sun > 0.7 ? 1.15 : 0.85) : 0;
  // Consumption: a winter cluster sips, a spring colony raising brood gulps.
  const eats = m >= 10 || m <= 0 ? 0.075 : m === 1 || m === 2 ? 0.16 : (m <= 4 ? 0.24 : m <= 6 ? 0.2 : 0.12) * h.strength;
  h.stores += income - eats;
  if (h.stores > HIVE_BROOD_STORES && m >= 3 && m <= 8) {
    h.surplus += h.stores - HIVE_BROOD_STORES;
    h.stores = HIVE_BROOD_STORES;
  }
  // A hungry colony eats its own surplus before it starves.
  if (h.stores < 3 && h.surplus > 0) { const t = Math.min(h.surplus, 3 - h.stores); h.surplus -= t; h.stores += t; }

  // Strength follows the season, and the mites.
  const build = m >= 2 && m <= 4 && h.stores > 4 ? 0.009 : m === 5 ? 0.002 : m >= 7 && m <= 9 ? -0.004 : m >= 10 || m <= 1 ? -0.0012 : 0;
  h.strength = clamp(h.strength + build - (h.varroa > 50 ? (h.varroa - 50) * 0.0002 : 0), 0.2, 1.4);
  h.varroa = clamp(h.varroa + (m >= 3 && m <= 8 ? 0.33 : m >= 9 && m <= 10 ? 0.12 : 0.02), 0, 100);

  // Swarming: a strong colony in May or June with no one checking on it.
  const inspected = tended.inspectedDay !== undefined && ctx.day - tended.inspectedDay <= 9;
  if ((m === 4 || m === 5) && h.strength > 1.05 && !inspected && h.swarmedYear !== ctx.year) {
    const odds = 0.035 + (h.queenAge >= 2 ? 0.02 : 0) + (h.surplus > 15 ? 0.02 : 0);
    if (roll('swarm', h.id, ctx.day) < odds) {
      h.strength *= 0.55;
      h.surplus *= 0.7;
      h.queenAge = 0;
      h.swarmedYear = ctx.year;
      events.push(`Hive ${h.id.slice(-1)} swarmed — half the bees went over the hedge with the old queen.`);
    }
  }

  // Death: by starving, or by mites in the winter.
  if (h.stores < 0) {
    h.alive = false;
    events.push(`Hive ${h.id.slice(-1)} starved. The cluster was found dead on empty comb.`);
  } else if ((m >= 10 || m <= 1) && h.varroa > 75 && roll('collapse', h.id, ctx.day) < 0.012) {
    h.alive = false;
    events.push(`Hive ${h.id.slice(-1)} collapsed over winter. Crumpled wings at the entrance: varroa.`);
  }
  return { hive: h, events };
};

/** What a hive needs attention for, most urgent first. */
export const hiveNeeds = (h: Hive, month: number): string[] => {
  if (!h.alive) return ['dead'];
  const out: string[] = [];
  const winterFloor = month >= 7 || month <= 2 ? 16 : 5;
  if (h.stores < winterFloor) out.push('feed');
  if ((month === 7 || month === 8) && h.varroa > 30) out.push('varroa');
  if ((month === 4 || month === 5) && h.strength > 1.05) out.push('swarm');
  if (h.surplus >= 4) out.push('honey');
  return out;
};

/** Honey quality: acacia is pale and prized, a crushed comb loses some of it. */
export const honeyQuality = (month: number, extractor: boolean): number =>
  Math.round(clamp(84 + (month === 4 || month === 5 ? 6 : month === 6 ? 3 : 0) + (extractor ? 3 : -2), 60, 100));

/* -----------------------------------------------------------------------------
   THE HENS

   Laying follows the light: a hen needs about fourteen hours to lay near every
   day, and at 45°N December gives her nine. Heat stops her too, and so does a
   moult in October. Fly larvae are the best thing you can put in front of her.
   --------------------------------------------------------------------------- */
export const henDay = (rIn: HenRun, ctx: LiveCtx, tended: { collected?: boolean; shutByDusk?: boolean; autoDoor?: boolean }): { run: HenRun; events: string[] } => {
  const r: HenRun = { ...rIn, problems: rIn.problems.map(p => ({ ...p })) };
  const events: string[] = [];
  if (r.hens <= 0) return { run: r, events };
  const light = sunTimes(ctx.doy).daylight / 60;
  let rate = clamp((light - 9) / 5, 0.1, 0.85);
  if (ctx.wx.tMax > 32) rate *= 0.7;
  if (ctx.month === 9) rate *= 0.35;                        // the autumn moult
  if (r.feedKg <= 0) rate *= 0.35;
  if (r.mites > 50) rate *= 0.7;
  const larvae = r.larvaeKg > 0;
  if (larvae) rate = Math.min(0.95, rate * 1.15);
  rate *= r.health / 100;
  // A deterministic lay: expected eggs, with the fraction carried by a seeded roll.
  const expected = r.hens * rate;
  const eggs = Math.floor(expected) + (roll('lay', ctx.day) < expected - Math.floor(expected) ? 1 : 0);
  r.eggs += eggs;
  r.laidTotal += eggs;
  r.feedKg = Math.max(0, r.feedKg - r.hens * (larvae ? 0.1 : 0.12));
  if (larvae) r.larvaeKg = Math.max(0, r.larvaeKg - r.hens * 0.02);
  r.mites = clamp(r.mites + (ctx.month >= 4 && ctx.month <= 8 ? 0.7 : 0.15), 0, 100);
  if (r.mites > 60) r.health = clamp(r.health - 0.4, 20, 100);
  else r.health = clamp(r.health + 0.2, 0, 100);
  // Uncollected eggs get broken and eaten.
  if (r.eggs > r.hens * 3) { const lost = Math.floor(r.eggs * 0.2); r.eggs -= lost; }
  // The fox, on a night the coop stood open.
  if (!tended.autoDoor && !tended.shutByDusk && roll('fox', ctx.day) < 0.05) {
    r.hens -= 1;
    events.push('A fox got into the run in the night. One hen fewer.');
  }
  return { run: r, events };
};

/** Twenty-eight yolks to the half-kilo unit the lab uses. */
export const YOLKS_PER_UNIT = 28;

/* -----------------------------------------------------------------------------
   THE SALT PANS

   Seawater at 35 g/l, in pans eight square metres a side. The sun and the wind
   take the water off; at about 300 g/l it crystallises on the floor. On a hot
   still bright day a crust forms on the surface as well — the flor de sal —
   which is the prize. Rain on an open pan puts the salt back in solution.
   --------------------------------------------------------------------------- */
export const PAN_AREA_M2 = 8;
export const PAN_FILL_MM = 40;
export const SATURATION_G_L = 300;

export const panDay = (pIn: SaltPan, ctx: LiveCtx): { pan: SaltPan; events: string[] } => {
  const p: SaltPan = { ...pIn };
  const events: string[] = [];
  const litres = p.brineMm * PAN_AREA_M2;
  let saltG = litres * p.gPerL;
  if (!p.covered) {
    const evap = ctx.wx.et0 * 1.25;                           // open water in the wind off the sea
    p.brineMm = Math.max(0, p.brineMm - evap + ctx.wx.rainMm);
  } else {
    p.brineMm = Math.max(0, p.brineMm - ctx.wx.et0 * 0.25);
  }
  // Rain dissolves crust back into the brine.
  if (!p.covered && ctx.wx.rainMm > 1 && p.crustKg + p.florKg > 0) {
    const room = Math.max(0, p.brineMm * PAN_AREA_M2 * SATURATION_G_L - saltG) / 1000;
    const back = Math.min(p.crustKg + p.florKg, room);
    const fromFlor = Math.min(p.florKg, back);
    p.florKg -= fromFlor;
    p.crustKg -= back - fromFlor;
    saltG += back * 1000;
    if (back > 0.5) events.push('Rain on the open pans put salt back into the brine.');
  }
  const newLitres = p.brineMm * PAN_AREA_M2;
  const capacityG = newLitres * SATURATION_G_L;
  if (saltG > capacityG) {
    const crystal = (saltG - capacityG) / 1000;
    const still = ctx.wx.tMax > 26 && ctx.wx.sun > 0.8 && ctx.wx.rainMm === 0;
    const flor = still ? crystal * 0.14 : 0;
    p.florKg += flor;
    p.crustKg += crystal - flor;
    saltG = capacityG;
  }
  p.gPerL = newLitres > 0 ? saltG / newLitres : 0;
  if (newLitres <= 0) p.gPerL = 0;
  return { pan: p, events };
};

/* -----------------------------------------------------------------------------
   THE WORM AND FLY SHED

   Both eat the lab's wet waste. Worms are slow, steady and happy between 15 and
   25 °C; they give castings, the richest soil amendment there is. Black soldier
   fly larvae are fast and hungry and want it warm — above 18 °C, so April to
   October here — and give frass for the beds and fat larvae for the hens.
   --------------------------------------------------------------------------- */
export const shedDay = (sIn: WormShed, ctx: LiveCtx): { shed: WormShed; events: string[] } => {
  const s: WormShed = { ...sIn };
  const events: string[] = [];
  const t = ctx.wx.tMean + 4;                                 // sheltered, and the bins make their own warmth
  const wormT = t < 6 ? 0.05 : t < 15 ? (t - 6) / 9 : t <= 25 ? 1 : t < 32 ? 1 - (t - 25) / 10 : 0.2;
  const wormEat = Math.min(s.wormFeedKg, s.wormsKg * 0.35 * wormT);
  s.wormFeedKg -= wormEat;
  s.castingsKg += wormEat * 0.45;
  s.wormsKg = clamp(s.wormsKg + (wormEat > s.wormsKg * 0.2 ? 0.004 : -0.002) * s.wormsKg, 0.2, 8);

  const bsfT = t < 16 ? 0 : t < 24 ? (t - 16) / 8 : t <= 34 ? 1 : 0.4;
  if (s.bsfLarvaeKg > 0) {
    const bsfEat = Math.min(s.bsfFeedKg, 3.5 * bsfT * clamp(s.bsfLarvaeKg / 2, 0.2, 2));
    s.bsfFeedKg -= bsfEat;
    s.prepupaeKg += bsfEat * 0.17;
    s.frassKg += bsfEat * 0.28;
    // The colony lives on through what it feeds; a cold winter with no heat ends it.
    if (bsfT === 0 && ctx.wx.tMean < 5) s.bsfLarvaeKg = Math.max(0, s.bsfLarvaeKg - 0.02);
    if (s.bsfLarvaeKg < 0.05 && sIn.bsfLarvaeKg >= 0.05) events.push('The fly colony has died back in the cold. Restock it in spring.');
  }
  return { shed: s, events };
};

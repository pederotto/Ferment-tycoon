import { Planting, Plot, Tree, CropStage, ActiveProblem, FacilityId, CropCover } from '../types.farm';
import { FAMILIES, CROPS, TREE_SPECS, FACILITIES, PROBLEMS, SPRAYABLE, CropFamily, CropSpec } from '../constants.farm';
import { DayWeather, roll } from './climate';

/* =============================================================================
   HOW THINGS GROW

   One day at a time, for one planting or one tree. Pure: the same state and the
   same day always give the same answer, so this can run inside a StrictMode
   updater and inside a harness that plays a hundred years.

   A planting has three gauges the player can act on — the plot's WATER and
   FERTILITY, and the crop's HEALTH — and three things they form over its life:

     vigour   the plant's frame, built while it is young
     set      how well the flowers turn into fruit
     fill     how well the fruit, the head or the grain fills out

   Stress in a stage costs that stage's part of the yield, which is how real
   crops behave and what makes timing matter: water a bean when it flowers, not
   when it is ripe. Flavour is formed while it ripens — sun, restraint, a live
   soil — and becomes the quality of what you pick.
   ============================================================================= */

export interface DayCtx {
  day: number;            // absolute day
  month: number;          // 0-11
  doy: number;            // day of the game year
  wx: DayWeather;
  /** Consecutive days with rain, and without, ending today. */
  wetStreak: number;
  dryStreak: number;
  /** Tools and covers the facility has. */
  kit: Record<string, boolean>;
  /** The apiary is on the estate and alive: bee-pollinated crops set better. */
  bees: boolean;
  /** The orangery stove is in. */
  stoveLit?: boolean;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/**
 * A game month is four weeks, so a game year is 336 days standing for 365.
 * Crops are timed in real degree days, so each game day carries 1.09 real
 * days of warmth — otherwise every crop ripens a month late and a corn that is
 * ready in September at 45°N would still be standing in November.
 */
export const DAY_SCALE = 365 / 336;

/** Degree days for one day by the triangle method, so a cool day with a warm afternoon still counts. */
export const degreeDays = (tMin: number, tMax: number, base: number, cap: number): number => {
  // Above the cap the plant stops speeding up (horizontal cut-off).
  const hi = Math.min(tMax, cap);
  const lo = Math.min(tMin, hi);
  if (hi <= base) return 0;
  if (lo >= base) return Math.min((lo + hi) / 2, cap) - base;
  // part of the day above base
  const above = (hi - base) * (hi - base) / (2 * Math.max(0.5, hi - lo));
  return Math.min(above, cap - base);
};

/** The temperatures a bed actually feels: plastic, glass, fleece and the stove all move them. */
export const localTemps = (facility: FacilityId, wx: DayWeather, fleece: boolean, stoveLit: boolean) => {
  const f = FACILITIES[facility];
  // Doors and vents stand open on a warm day, so plastic and glass add far less
  // heat in July than in April. Shut, a tunnel in a Piedmont summer cooks.
  const dayUp = f.covered ? (wx.tMax > 24 ? Math.max(2.5, f.covered.dayUp - (wx.tMax - 24) * 0.6) : f.covered.dayUp) : 0;
  let tMax = wx.tMax + dayUp;
  let tMin = wx.tMin + (f.covered?.nightUp ?? 0) + (fleece ? 2 : 0);
  if (facility === 'orangery' && stoveLit) tMin = Math.max(tMin, 7);
  if (tMin > tMax) tMin = tMax - 1;
  return { tMin, tMax, tMean: (tMin + tMax) / 2 };
};

/** Available water the soil holds, mm. A raised bed holds less than a field, which roots deeper. */
export const awcMm = (facility: FacilityId): number => facility === 'top_field' ? 110 : 60;

export const stageLabel = (cropId: string, stage: CropStage): string => {
  const fam = FAMILIES[CROPS[cropId]?.family];
  const w = fam?.words?.[stage];
  if (w) return w;
  return ({ sown: 'sown', seedling: 'seedlings', leafy: 'growing', flowering: 'flowering', fruiting: 'fruiting', ripe: 'ripe', over: 'going over', spent: 'finished', dead: 'dead' } as Record<CropStage, string>)[stage];
};

/** A crop coefficient for where the plant is in its life. */
const cropKc = (fam: CropFamily, stage: CropStage, f: number): number => {
  if (stage === 'sown' || stage === 'seedling') return fam.kc[0];
  if (stage === 'leafy') return fam.kc[0] + (fam.kc[1] - fam.kc[0]) * clamp((f - fam.stages.leafy) / Math.max(0.05, fam.stages.flower - fam.stages.leafy), 0, 1);
  if (stage === 'flowering' || stage === 'fruiting') return fam.kc[1];
  if (stage === 'ripe') return fam.harvest === 'continuous' ? fam.kc[1] * 0.95 : fam.kc[2];
  return fam.kc[2] * 0.6;
};

const stageFromGdd = (fam: CropFamily, f: number): CropStage =>
  f < 0.03 ? 'sown' : f < fam.stages.leafy ? 'seedling' : f < fam.stages.flower ? 'leafy' : f < fam.stages.fruit ? 'flowering' : f < 1 ? 'fruiting' : 'ripe';

/** How fast a ripe crop is lost once it has waited too long, per day. */
const overLoss = (fam: CropFamily): number => {
  switch (fam.id) {
    case 'wintergrain': case 'springgrain': return 0.05;     // shed and taken by birds
    case 'fava': case 'pea': case 'chickpea': case 'lentil': case 'bean': return 0.06; // pods shatter
    case 'brassica': case 'napa': return 0.03;               // split, bolt
    case 'allium': return 0.035;                             // bulbs split, skins go
    case 'corn': return 0.02;                                // mould, boar, birds
    default: return 0.18;                                    // soft fruit and petals
  }
};

/* -----------------------------------------------------------------------------
   PROBLEMS: the daily odds
   --------------------------------------------------------------------------- */
const hasTreatment = (pl: { treated: Record<string, number> }, key: string, day: number) => (pl.treated[key] ?? -1) >= day;

export const problemOdds = (id: string, pl: Planting, plot: Plot, facility: FacilityId, ctx: DayCtx): number => {
  const fam = FAMILIES[CROPS[pl.cropId].family];
  const { wx, month } = ctx;
  const wet = wx.rainMm > 2;
  const covered = !!FACILITIES[facility].covered;
  const young = pl.stage === 'sown' || pl.stage === 'seedling' || pl.stage === 'leafy';
  const recent = (fams: string[], n: number) => plot.history.slice(0, n).some(h => fams.includes(h));
  const actOrLab = hasTreatment(pl, 'act', ctx.day) || hasTreatment(pl, 'lab', ctx.day);
  switch (id) {
    case 'weeds':
      if (pl.cover.mulch) return 0;
      if (wx.tMean < 6) return 0.004;
      return covered ? 0.02 : (wet || plot.water > 55 ? 0.04 : 0.018);
    case 'slugs':
      if (covered && !young) return 0.004;
      return (wet && wx.tMean > 5 && wx.tMean < 22 ? 0.05 : 0.005) * (young ? 2.4 : 1);
    case 'whites':
      return month >= 4 && month <= 8 && wx.sun > 0.55 ? 0.035 : 0;
    case 'pigeons':
      return (month >= 10 || month <= 2) ? 0.03 : 0;
    case 'flea':
      return young && !wet && wx.tMax > 18 ? 0.06 : 0;
    case 'clubroot':
      return recent(['brassica', 'napa'], 2) ? 0.02 : 0;
    case 'white_rot':
      return recent(['allium'], 2) ? 0.016 : 0;
    case 'blight': {
      if (month < 5 || month > 9) return 0;
      const warm = wx.tMean > 14 && wx.tMean < 26;
      // Plastic keeps the leaves dry, which is most of why tomatoes are grown under it here.
      const base = covered ? (warm && wx.sun < 0.45 ? 0.008 : 0.0015) : (warm && ctx.wetStreak >= 2 ? 0.12 : warm && wet ? 0.04 : 0.003);
      const trained = (pl.trainedUntil ?? -1) >= ctx.day;
      return base * (actOrLab ? 0.25 : 1) * (trained ? 0.8 : 1.3);
    }
    case 'whitefly':
      return covered && month >= 5 && month <= 9 ? 0.02 : 0;
    case 'ber':
      return (pl.stage === 'fruiting' || pl.stage === 'ripe') && plot.water < 25 ? 0.06 : (pl.stage === 'fruiting' || pl.stage === 'ripe') && plot.fertility < 20 ? 0.02 : 0;
    case 'tuta':
      return covered && month >= 6 && month <= 9 ? 0.016 : 0;
    case 'aphids':
      return month >= 3 && month <= 6 && wx.tMax > 15 ? 0.025 : 0;
    case 'blackfly':
      return ((fam.id === 'fava' && month >= 3 && month <= 5) || (fam.id === 'bean' && month >= 5 && month <= 7)) && wx.tMax > 16 ? 0.04 : 0;
    case 'chocolate_spot':
      return wet && wx.tMean > 9 && wx.tMean < 21 ? 0.03 : 0;
    case 'pea_moth':
      return month === 5 && (pl.stage === 'flowering' || pl.stage === 'fruiting') ? 0.05 : 0;
    case 'mildew':
      return month >= 5 && month <= 8 && ctx.dryStreak >= 3 ? 0.02 : 0;
    case 'ascochyta':
      return wet && wx.tMean > 8 ? 0.06 : 0;
    case 'rust':
      return month >= 3 && month <= 5 && wet && wx.tMean > 8 ? 0.04 : 0;
    case 'grain_rust':
      return month >= 3 && month <= 5 && (wet || wx.sun < 0.4) && wx.tMean > 10 && wx.tMean < 22 ? 0.015 : 0;
    case 'birds_grain':
      return pl.stage === 'ripe' || pl.stage === 'over' ? 0.2 : 0;
    case 'birds_fruit':
      return pl.stage === 'ripe' ? 0.1 : 0;
    case 'botrytis':
      return (pl.stage === 'fruiting' || pl.stage === 'ripe') && (wet || wx.sun < 0.3) ? 0.05 : 0;
    case 'crows':
      return pl.stage === 'sown' || pl.stage === 'seedling' ? 0.04 : 0;
    case 'borer':
      return month >= 6 && month <= 8 ? 0.02 : 0;
    case 'boar':
      return month >= 7 && month <= 9 && (pl.stage === 'fruiting' || pl.stage === 'ripe') ? 0.012 : 0;
    case 'blackspot':
      return month >= 5 && month <= 8 && wet ? 0.03 : 0;
    default:
      return 0;
  }
};

/** A problem does nothing on a plot that has the thing that stops it. */
export const isStopped = (id: string, pl: { cover: CropCover; treated: Record<string, number> }, kit: Record<string, boolean>, day: number): boolean => {
  if (SPRAYABLE.has(id) && (pl.treated.chem ?? -1) >= day) return true;   // a synthetic spray keeps it off for a fortnight
  const by = PROBLEMS[id]?.stoppedBy ?? [];
  return by.some(k => !!(pl.cover as Record<string, boolean | undefined>)[k] || !!kit[k] || (pl.treated[k] ?? -1) >= day);
};

const PROGRESSIVE = new Set(['blight', 'boar', 'clubroot', 'white_rot', 'ascochyta']);

/** Some problems go on their own when the weather turns against them. */
const clearsItself = (p: ActiveProblem, ctx: DayCtx): boolean => {
  switch (p.id) {
    case 'slugs': return ctx.dryStreak >= 5;
    case 'flea': return ctx.wetStreak >= 2;
    case 'whites': return ctx.month >= 9 || ctx.month <= 2;
    case 'pigeons': return ctx.month >= 3 && ctx.month <= 9;
    case 'aphids': return ctx.day - p.since > 18 && roll('ladybirds', p.since, ctx.day) < 0.1;
    case 'blackfly': return ctx.day - p.since > 25;
    case 'pea_moth': return ctx.month > 6;
    case 'birds_grain': case 'birds_fruit': return false;
    default: return false;
  }
};

/* -----------------------------------------------------------------------------
   A NEW PLANTING
   --------------------------------------------------------------------------- */
export const newPlanting = (plot: Plot, cropId: string, day: number, id: string, line = 0): Planting => {
  const spec = CROPS[cropId];
  const plants = Math.max(1, Math.floor(plot.areaM2 * spec.perM2));
  return {
    id, cropId, plants, plantedDay: day, gdd: 0, stage: 'sown', health: 100,
    vigour: 1, setAvg: 1, fill: 1, vigourDays: 0, fillDays: 0,
    flavour: 0, flavourDays: 0, potentialKg: 0, ripeKg: 0, ripeAge: 0, released: 0,
    pickedKg: 0, lostKg: 0, pickedQ: 0, daysRipe: 0,
    problems: [], cover: {}, treated: {}, line, seasons: 0,
  };
};

/* -----------------------------------------------------------------------------
   ONE DAY FOR ONE PLOT
   --------------------------------------------------------------------------- */
export interface DayResult {
  plot: Plot;
  /** What happened, for the morning note. */
  events: string[];
}

/** Season shape for a continuous crop: a ramp, a plateau, a tail. Integrates to 1 over 0..1. */
const seasonShape = (x: number): number => {
  if (x < 0) return 0;
  if (x < 0.2) return 0.5 + 2.5 * x;           // 0.5 → 1.0
  if (x < 0.65) return 1.0 + 0.1;              // plateau a touch above 1
  if (x < 1) return 1.1 - 2.4 * (x - 0.65);    // 1.1 → 0.26
  return 0;
};
const SHAPE_NORM = (() => { let s = 0; for (let i = 0; i < 1000; i++) s += seasonShape((i + 0.5) / 1000) / 1000; return s; })();

export const plotDay = (plotIn: Plot, facility: FacilityId, ctx: DayCtx): DayResult => {
  const plot: Plot = { ...plotIn };
  const events: string[] = [];
  const fac = FACILITIES[facility];
  const covered = !!fac.covered;
  const awc = awcMm(facility);
  const rainIn = covered ? 0 : ctx.wx.rainMm * 0.9;

  // Soil life slowly turns organic matter into food while the soil is warm.
  const mineral = ctx.wx.tMean > 8 ? 0.05 * (plot.life / 50) : 0.01;

  if (!plot.planting || plot.planting.stage === 'spent' || plot.planting.stage === 'dead') {
    // A bare plot still dries and wets, and a green manure feeds it.
    const bareEt = ctx.wx.et0 * (plot.greenManure ? 0.7 : 0.35);
    plot.water = clamp(plot.water + (rainIn - bareEt) / awc * 100, 0, 100);
    plot.fertility = clamp(plot.fertility + mineral * 0.6 + (plot.greenManure ? 0.08 : 0), 0, 100);
    if (plot.greenManure) plot.life = clamp(plot.life + 0.05, 0, 100);
    return { plot, events };
  }

  const pl: Planting = {
    ...plot.planting,
    problems: plot.planting.problems.map(p => ({ ...p })),
    cover: { ...plot.planting.cover },
    treated: { ...plot.planting.treated },
  };
  const spec = CROPS[pl.cropId];
  const fam = FAMILIES[spec.family];
  const t = localTemps(facility, ctx.wx, !!pl.cover.fleece, !!ctx.stoveLit);

  // --- Perennials rest in winter and start again at the new year ---
  if (fam.perennial && ctx.doy === 0) {
    pl.gdd = 0; pl.stage = 'leafy'; pl.released = 0; pl.ripeKg = 0; pl.daysRipe = 0;
    pl.vigour = 1; pl.vigourDays = 0; pl.setAvg = 1; pl.fill = 1; pl.fillDays = 0;
    pl.flavour = 0; pl.flavourDays = 0; pl.seasons = (pl.seasons ?? 0) + 1;
  }

  // --- Frost ---
  const fNow = pl.gdd / spec.gddToRipe;
  const young = fNow < 0.2 && !fam.perennial;
  const killAt = young ? fam.killYoung : fam.kill;
  if (t.tMin <= killAt) {
    const dmg = clamp((killAt - t.tMin + 1) * 30, 25, 100);
    pl.health = clamp(pl.health - dmg, 0, 100);
    events.push(pl.health <= 0 ? `Frost killed the ${fam.label.toLowerCase()} on ${plot.label.toLowerCase()}.` : `Frost burned the ${fam.label.toLowerCase()} on ${plot.label.toLowerCase()}.`);
    if (pl.health <= 0) {
      // A tender crop cut down in autumn is finished, not a failure: what was ripe is still there.
      pl.stage = fam.harvest === 'continuous' && pl.released > 0.3 ? 'spent' : 'dead';
      pl.deathCause = 'frost';
      plot.planting = pl;
      return { plot, events };
    }
  }
  if (fam.flowerKill !== undefined && pl.stage === 'flowering' && t.tMin <= fam.flowerKill) {
    pl.setAvg *= 0.6;
    events.push(`A frost took the flowers on ${plot.label.toLowerCase()}.`);
  }

  // --- Warmth ---
  // A perennial spends the year it goes in getting its roots down: it flowers
  // from the spring after.
  const establishing = !!fam.perennial && (pl.seasons ?? 0) === 0;
  const g = degreeDays(t.tMin, t.tMax, fam.tBase, fam.tCap) * DAY_SCALE;
  pl.gdd = establishing ? Math.min(pl.gdd + g, spec.gddToRipe * fam.stages.leafy * 1.5) : pl.gdd + g;
  const f = pl.gdd / spec.gddToRipe;

  // --- Water ---
  const weeds = pl.problems.some(p => p.id === 'weeds');
  const stageNow = pl.stage;
  const kc = cropKc(fam, stageNow, f);
  const et = ctx.wx.et0 * kc * (covered ? 1.12 : 1) * (pl.cover.mulch ? 0.72 : 1) * (weeds ? 1.25 : 1);
  plot.water = clamp(plot.water + (rainIn - et) / awc * 100, 0, 100);
  const ws = plot.water < 40 ? Math.pow((40 - plot.water) / 40, 1.3) : 0;
  const logged = !covered && plot.water >= 99 && ctx.wetStreak >= 4 ? 0.25 : 0;

  // --- Feed ---
  const growing = stageNow !== 'ripe' || fam.harvest === 'continuous';
  const draw = growing ? fam.feedDraw * (g / spec.gddToRipe) * (fam.harvest === 'continuous' && stageNow === 'ripe' ? 0.5 : 1) * (weeds ? 1.3 : 1) : 0;
  plot.fertility = clamp(plot.fertility - draw + mineral, 0, 100);
  const fs = plot.fertility < 35 ? (35 - plot.fertility) / 35 : 0;
  const lush = plot.fertility > 88 ? (plot.fertility - 88) / 12 : 0;

  // --- Health: problems do their damage ---
  let qPenalty = 0;
  for (const p of pl.problems) {
    const spec2 = PROBLEMS[p.id];
    if (!spec2) continue;
    const age = ctx.day - p.since;
    // Most pests settle into a balance with what eats them: the damage is worst
    // in the first fortnight. Blight spreads, a boar comes back every night and
    // a soil disease only deepens — those do not settle.
    const progressive = PROGRESSIVE.has(p.id);
    const shape = p.id === 'blight' ? 1 + Math.min(1.5, age * 0.1) : progressive ? 1 : 1 / (1 + age / 15);
    const hit = spec2.hit * (young ? 1.5 : 1) * shape;
    pl.health = clamp(pl.health - hit, 0, 100);
    qPenalty += spec2.qHit ?? 0;
  }
  pl.problems = pl.problems.filter(p => !clearsItself(p, ctx));
  // A plant with nothing wrong heals slowly.
  if (pl.problems.length === 0 && ws < 0.3) pl.health = clamp(pl.health + 0.6, 0, 100);
  if (pl.health <= 0) {
    pl.stage = 'dead';
    pl.deathCause = pl.problems[0]?.id ?? 'neglect';
    events.push(`The ${fam.label.toLowerCase()} on ${plot.label.toLowerCase()} are lost${pl.problems[0] ? ` to ${PROBLEMS[pl.problems[0].id]?.label.toLowerCase()}` : ''}.`);
    plot.planting = pl;
    return { plot, events };
  }
  const hs = pl.health / 100;

  // --- New problems ---
  for (const id of fam.problems) {
    if (pl.problems.some(p => p.id === id)) continue;
    if (isStopped(id, pl, ctx.kit, ctx.day)) continue;
    const odds = problemOdds(id, pl, plot, facility, ctx);
    if (odds > 0 && roll('prob', id, pl.id, ctx.day) < odds) {
      pl.problems.push({ id, since: ctx.day, seen: false });
      if (id === 'boar') {
        // A night's raid: part of the crop is simply gone.
        pl.potentialKg *= 0.75;
        pl.ripeKg *= 0.75;
        pl.vigour *= 0.85;
      }
    }
  }

  // --- The stage ---
  let stage = stageFromGdd(fam, f);
  // Napa sown before midsummer bolts in the long days.
  if (fam.id === 'napa' && stage === 'fruiting' && ctx.doy < 6 * 28 + 14 && roll('bolt', pl.id, ctx.day) < 0.08) stage = 'over';

  // --- Forming the yield ---
  const trained = (pl.trainedUntil ?? -1) >= ctx.day;
  const untrainedTomato = fam.id === 'tomato' && !trained;
  // Weeds do not kill a crop; they take its water, its food and its light.
  const weedDrag = weeds ? 0.82 : 1;
  const fpj = hasTreatment(pl, 'fpj', ctx.day) ? 0.06 : 0;
  if (stage === 'seedling' || stage === 'leafy') {
    const sample = clamp((1 - 0.55 * ws - 0.45 * fs - logged) * (0.55 + 0.45 * hs) * weedDrag + fpj, 0, 1.08);
    pl.vigour = (pl.vigour * pl.vigourDays + sample) / (pl.vigourDays + 1);
    pl.vigourDays += 1;
  }
  const flowering = stage === 'flowering' || (fam.harvest === 'continuous' && (stage === 'fruiting' || stage === 'ripe'));
  if (flowering) {
    let tempSet = 1;
    if (fam.heatSet !== undefined && t.tMax > fam.heatSet) tempSet = 0.35;
    else if (fam.nightSet !== undefined && t.tMin < fam.nightSet) tempSet = 0.55;
    const bees = fam.id === 'strawberry' || fam.id === 'fava' ? (ctx.bees ? 1 : 0.85) : 1;
    const sample = clamp((1 - 0.6 * ws - logged) * tempSet * bees * (0.7 + 0.3 * hs), 0, 1);
    pl.setAvg = pl.setAvg * (11 / 12) + sample / 12;
  }
  if (stage === 'fruiting' || (stage === 'ripe' && fam.harvest === 'continuous')) {
    const sample = clamp((1 - 0.5 * ws - 0.35 * fs - logged) * (0.6 + 0.4 * hs) * (untrainedTomato ? 0.9 : 1) * weedDrag + fpj * 0.5, 0, 1.05);
    pl.fill = (pl.fill * pl.fillDays + sample) / (pl.fillDays + 1);
    pl.fillDays += 1;
  }

  // --- Flavour, while it ripens ---
  if (stage === 'fruiting' || stage === 'ripe') {
    const sunT = (ctx.wx.sun - 0.5) * (covered ? 1.0 : 1.2);
    const waterT = plot.water > 85 ? -0.5 : plot.water < 15 ? -0.35 : plot.water <= 65 && plot.water >= 22 ? 0.3 : 0;
    const feedT = lush > 0 ? -0.45 * lush - 0.1 : plot.fertility < 20 ? -0.4 : 0.1;
    const lifeT = (plot.life - 50) / 100;
    const healthT = hs - 0.85;
    const treat = (hasTreatment(pl, 'ffj', ctx.day) ? 0.35 : 0) + (hasTreatment(pl, 'wca', ctx.day) ? 0.12 : 0);
    const sample = clamp(sunT + waterT + feedT + lifeT + healthT + treat - qPenalty * 0.4 - (untrainedTomato ? 0.2 : 0), -1, 1);
    pl.flavour = (pl.flavour * pl.flavourDays + sample) / (pl.flavourDays + 1);
    pl.flavourDays += 1;
  }

  // --- Ripening and the harvest ---
  if (fam.harvest === 'once') {
    if (stage === 'ripe' || stage === 'over') {
      if (pl.stage !== 'ripe' && pl.stage !== 'over') {
        // The crop is what it is now. Heading and bulbing crops have no flowering to set.
        const setsFlowers = !['brassica', 'napa', 'allium'].includes(fam.id);
        const set = setsFlowers ? pl.setAvg : 1;
        pl.potentialKg = pl.plants * spec.kgPerPlant * Math.pow(pl.vigour, 0.8) * set * Math.pow(pl.fill, 0.9) * (0.4 + 0.6 * hs);
        pl.ripeKg = pl.potentialKg;
        pl.ripeAge = 0;
        pl.daysRipe = 0;
        events.push(`The ${fam.label.toLowerCase()} on ${plot.label.toLowerCase()} are ready.`);
      }
      pl.daysRipe += 1;
      pl.ripeAge += 1;
      if (pl.daysRipe > fam.holdDays || stage === 'over') {
        stage = 'over';
        const birds = pl.problems.some(p => p.id === 'birds_grain') ? 0.03 : 0;
        const loss = pl.ripeKg * (overLoss(fam) + birds);
        pl.ripeKg -= loss;
        pl.lostKg += loss;
        if (pl.daysRipe > fam.holdDays * 3 + 10 || pl.ripeKg < 0.05) {
          stage = 'spent';
          pl.lostKg += pl.ripeKg;
          pl.ripeKg = 0;
        }
      }
    }
  } else {
    // Continuous: fruit ripens every day through the season, and waits to be picked.
    if (stage === 'ripe') {
      const tRipen = fam.id === 'tomato' ? clamp((t.tMean - 10) / 8, 0, 1)
        : fam.id === 'chili' ? clamp((t.tMean - 12) / 8, 0, 1)
        : clamp((t.tMean - 5) / 9, 0, 1);
      const dayShare = seasonShape(pl.released) / SHAPE_NORM / (spec.cropDays ?? 60) * tRipen;
      const cond = clamp((1 - 0.5 * ws - 0.3 * fs) * (0.5 + 0.5 * hs), 0, 1);
      // A young perennial crops lightly: bushes and crowns come into their own in the second year.
      const maturity = !fam.perennial ? 1 : fam.id === 'rose' ? [0, 0.45, 0.8, 1][Math.min(3, pl.seasons ?? 0)] : [0, 0.8, 1, 1][Math.min(3, pl.seasons ?? 0)];
      const kg = pl.plants * spec.kgPerPlant * maturity * dayShare * pl.setAvg * Math.pow(pl.vigour, 0.8) * cond * (untrainedTomato ? 0.88 : 1) * weedDrag;
      if (pl.ripeKg + kg > 0) pl.ripeAge = (pl.ripeKg * (pl.ripeAge + 1) + kg * 0) / (pl.ripeKg + kg);
      pl.ripeKg += kg;
      pl.released += dayShare;
      pl.potentialKg += kg;
      pl.daysRipe += 1;
      if (pl.ripeAge > fam.holdDays) {
        const loss = pl.ripeKg * overLoss(fam) * (pl.problems.some(p => p.id === 'birds_fruit') ? 1.5 : 1);
        pl.ripeKg -= loss;
        pl.lostKg += loss;
      }
      if (pl.released >= 1) stage = 'spent';
    }
    if (pl.stage === 'spent' && fam.perennial) stage = 'spent';
  }
  // A perennial that has finished for the year rests, it does not need clearing.
  if (fam.perennial && pl.stage === 'spent' && stage !== 'spent' && ctx.doy !== 0) stage = 'spent';
  pl.stage = stage;
  plot.planting = pl;
  return { plot, events };
};

/* -----------------------------------------------------------------------------
   QUALITY OF WHAT IS PICKED
   --------------------------------------------------------------------------- */
/**
 * The quality of a pick, from the variety's own quality (what the van sells),
 * the ripening flavour, the plant's health, the seed line and how long it has
 * waited. Expert care lands about ten above the van; neglect about fifteen below.
 */
export const pickQuality = (baseQ: number, pl: Pick<Planting, 'flavour' | 'health' | 'line' | 'ripeAge' | 'cropId'>): number => {
  const fam = FAMILIES[CROPS[pl.cropId].family];
  const over = Math.max(0, pl.ripeAge - fam.holdDays);
  const q = baseQ + 11 * pl.flavour + (pl.health - 80) / 5 + Math.min(4, pl.line ?? 0) - Math.min(15, over * 1.5);
  return Math.round(clamp(q, 20, 100));
};

/** Take what is ripe. Returns the kilos and their quality. */
export const pickPlanting = (pl: Planting, baseQ: number, maxKg = Infinity): { planting: Planting; kg: number; quality: number } => {
  const kg = Math.min(pl.ripeKg, maxKg);
  if (kg <= 0.001) return { planting: pl, kg: 0, quality: 0 };
  const quality = pickQuality(baseQ, pl);
  const fam = FAMILIES[CROPS[pl.cropId].family];
  const picked = pl.pickedKg + kg;
  const next: Planting = {
    ...pl,
    ripeKg: pl.ripeKg - kg,
    ripeAge: pl.ripeKg - kg > 0.01 ? pl.ripeAge : 0,
    pickedKg: picked,
    pickedQ: (pl.pickedQ * pl.pickedKg + quality * kg) / picked,
    problems: pl.problems.filter(p => p.id !== 'birds_grain' && p.id !== 'birds_fruit'),
  };
  // Picking a once-over crop clears it.
  if (fam.harvest === 'once' && next.ripeKg < 0.05) { next.stage = 'spent'; next.ripeKg = 0; }
  return { planting: next, kg, quality };
};

/* -----------------------------------------------------------------------------
   TREES
   --------------------------------------------------------------------------- */
export const treeDay = (treeIn: Tree, facility: FacilityId, ctx: DayCtx): { tree: Tree; events: string[] } => {
  const tree: Tree = { ...treeIn, problems: treeIn.problems.map(p => ({ ...p })), treated: { ...treeIn.treated }, cover: { ...treeIn.cover } };
  const spec = TREE_SPECS[tree.cropId];
  const events: string[] = [];
  const t = localTemps(facility, ctx.wx, false, !!ctx.stoveLit);
  const hanging = tree.fruitKg + tree.ripeKg > 0.05;

  // A new cycle starts at the new year — unless an evergreen is still carrying last year's fruit.
  if (ctx.doy === 0 && (!spec.evergreen || !hanging)) {
    tree.lastCropKg = tree.pickedKg + tree.lostKg;
    tree.gdd = 0; tree.bloom = 0; tree.set = 0; tree.fruitKg = 0; tree.ripeKg = 0;
    tree.pickedKg = 0; tree.lostKg = 0; tree.pickedQ = 0; tree.flavour = 0; tree.flavourDays = 0;
    tree.age += 1;
  }
  // An evergreen that carried fruit over starts its new cycle once that fruit is off.
  if (spec.evergreen && ctx.month <= 3 && tree.bloom > 0 && tree.gdd > spec.gddRipe && !hanging) {
    tree.lastCropKg = tree.pickedKg + tree.lostKg;
    tree.gdd = 0; tree.bloom = 0; tree.set = 0; tree.pickedKg = 0; tree.lostKg = 0; tree.pickedQ = 0; tree.flavour = 0; tree.flavourDays = 0;
  }

  // Frost can kill a tender tree outright.
  if (t.tMin <= spec.treeKill) {
    tree.health = clamp(tree.health - clamp((spec.treeKill - t.tMin + 1) * 25, 20, 100), 0, 100);
    events.push(`Frost in the ${facility === 'orangery' ? 'lemon house' : 'orchard'}: the ${tree.label.toLowerCase()} is hurt.`);
  }

  tree.gdd += degreeDays(t.tMin, t.tMax, 5, 30) * DAY_SCALE;

  // Blossom
  if (tree.bloom === 0 && tree.gdd >= spec.gddBloom) {
    const age = clamp(tree.age / spec.primeAge, 0, 1);
    const rest = spec.biennial && tree.lastCropKg > spec.prime * age * 0.8 && tree.thinnedYear === undefined ? 0.4 : 1;
    const pruned = tree.prunedYear !== undefined ? 1 : 0.88;
    tree.bloom = rest * pruned;
    tree.set = 1;
    events.push(`The ${tree.label.toLowerCase()} is in blossom.`);
  }
  const blooming = tree.bloom > 0 && tree.gdd < spec.gddBloom + 90;
  if (blooming) {
    if (t.tMin <= spec.bloomKill) {
      tree.bloom *= 0.5;
      events.push(`A late frost caught the blossom on the ${tree.label.toLowerCase()}.`);
    }
    const bees = spec.beePollinated ? (ctx.bees ? 1 : 0.72) : 1;
    const weather = ctx.wx.rainMm > 2 || ctx.wx.tMax < 12 ? 0.94 : 1;
    tree.set = Math.min(tree.set, 1) * (0.985 + 0.015 * weather) * (tree.gdd < spec.gddBloom + 20 ? Math.pow(bees, 1 / 8) : 1);
  }
  // Fruit forms at the end of blossom.
  if (tree.bloom > 0 && tree.fruitKg === 0 && tree.ripeKg === 0 && tree.pickedKg === 0 && tree.gdd >= spec.gddBloom + 90) {
    const ageF = Math.pow(clamp(tree.age / spec.primeAge, 0.1, 1), 1.3) * (tree.age > spec.primeAge * 3 ? 0.8 : 1);
    tree.fruitKg = spec.prime * ageF * tree.bloom * tree.set * (0.4 + 0.6 * tree.health / 100);
  }
  // Summer: a long drought costs size; problems run.
  if (tree.fruitKg > 0) {
    if (ctx.dryStreak > 18 && !FACILITIES[facility].covered) tree.fruitKg *= 0.997;
    for (const id of spec.problems) {
      if (tree.problems.some(p => p.id === id)) continue;
      const stopped = (SPRAYABLE.has(id) && (tree.treated.chem ?? -1) >= ctx.day) || (PROBLEMS[id]?.stoppedBy ?? []).some(k => !!ctx.kit[k] || (tree.treated[k] ?? -1) >= ctx.day);
      if (stopped) continue;
      let odds = 0;
      if (id === 'codling') odds = ctx.month >= 5 && ctx.month <= 7 ? 0.02 : 0;
      if (id === 'scab') odds = ctx.month >= 3 && ctx.month <= 5 && ctx.wx.rainMm > 2 ? 0.04 : 0;
      if (id === 'wasps') odds = tree.ripeKg > 0 && ctx.month >= 7 && ctx.month <= 9 ? 0.06 : 0;
      if (id === 'plum_moth') odds = ctx.month >= 5 && ctx.month <= 6 ? 0.02 : 0;
      if (id === 'brown_rot') odds = tree.ripeKg > 0 && ctx.wx.rainMm > 2 ? 0.05 : 0;
      if (id === 'aphids') odds = ctx.month >= 3 && ctx.month <= 5 ? 0.02 : 0;
      if (id === 'scale') odds = facility === 'orangery' ? 0.008 : 0.003;
      if (odds > 0 && roll('tprob', id, tree.id, ctx.day) < odds) tree.problems.push({ id, since: ctx.day, seen: false });
    }
  }
  let qPenalty = 0;
  for (const p of tree.problems) {
    const ps = PROBLEMS[p.id];
    tree.health = clamp(tree.health - (ps?.hit ?? 0) * 0.5, 0, 100);
    qPenalty += ps?.qHit ?? 0;
    if (p.id === 'codling' || p.id === 'plum_moth') tree.fruitKg *= 0.997;
  }
  if (tree.problems.length === 0) tree.health = clamp(tree.health + 0.3, 0, 100);

  // Ripening: flavour forms over the last stretch before ripe.
  if (tree.fruitKg > 0 && tree.gdd >= spec.gddRipe - 500) {
    const sample = clamp((ctx.wx.sun - 0.5) * 1.1 + (tree.prunedYear !== undefined ? 0.15 : -0.1) + (tree.thinnedYear !== undefined ? 0.25 : 0) + (tree.health / 100 - 0.85) + ((tree.treated['ffj'] ?? -1) >= ctx.day ? 0.3 : 0) - qPenalty * 0.4, -1, 1);
    tree.flavour = (tree.flavour * tree.flavourDays + sample) / (tree.flavourDays + 1);
    tree.flavourDays += 1;
  }
  if (tree.fruitKg > 0 && tree.gdd >= spec.gddRipe) {
    // Fruit ripens over about ten days rather than all at once.
    const move = Math.min(tree.fruitKg, Math.max(0.2, tree.fruitKg * 0.12));
    if (tree.ripeKg === 0 && tree.pickedKg === 0) events.push(`The ${tree.label.toLowerCase()} is ripe.`);
    tree.fruitKg -= move;
    tree.ripeKg += move;
  }
  // Ripe fruit hangs a while, then drops.
  if (tree.ripeKg > 0) {
    const daysRipe = (tree.gdd - spec.gddRipe) / Math.max(1, (t.tMean - 5));
    if (daysRipe > spec.hangDays || (!spec.evergreen && ctx.month >= 10)) {
      const drop = tree.ripeKg * (spec.evergreen ? 0.03 : 0.08) * (tree.problems.some(p => p.id === 'wasps' || p.id === 'brown_rot') ? 1.5 : 1);
      tree.ripeKg -= drop;
      tree.lostKg += drop;
    }
  }
  return { tree, events };
};

export const treePickQuality = (baseQ: number, tree: Tree): number =>
  Math.round(clamp(baseQ + 11 * tree.flavour + (tree.health - 80) / 5, 20, 100));

export const pickTree = (tree: Tree, baseQ: number, maxKg = Infinity): { tree: Tree; kg: number; quality: number } => {
  const kg = Math.min(tree.ripeKg, maxKg);
  if (kg <= 0.001) return { tree, kg: 0, quality: 0 };
  const quality = treePickQuality(baseQ, tree);
  const picked = tree.pickedKg + kg;
  return {
    tree: { ...tree, ripeKg: tree.ripeKg - kg, pickedKg: picked, pickedQ: (tree.pickedQ * tree.pickedKg + quality * kg) / picked },
    kg, quality,
  };
};

export const cropSpec = (id: string): CropSpec | undefined => CROPS[id];

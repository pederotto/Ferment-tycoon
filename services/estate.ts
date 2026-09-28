import { GameState, Ingredient, IngredientType, WeatherState, CrewMember } from '../types';
import {
  EstateState, FacilityId, FacilityState, Plot, Tree, Planting, StandingOrders, EstateLogEntry, Hive, HenRun, HenFeed, WormShed,
} from '../types.farm';
import {
  FACILITIES, CROPS, FAMILIES, TREE_SPECS, PROBLEMS, FARM_TOOLS, VAN_WHOLESALE, VAN_RECOVERY, PRODUCE_CLASS, produceClassOf, FACILITY_ORDER,
  BIO_CONVERSION_DAYS, BIO_LIFE_MIN, SPRAYABLE, QUALITY_ELASTIC, SPRAY_DAYS, SPRAY_COST_M2, HOME_GROWN_PREMIUM, BIO_VAN_PREMIUM, BIO_APPETITE_KG,
} from '../constants.farm';
import { makeCandidate } from './crew';
import { skill5, frac, crewLevel, gardenerLevel, gardenQualityBonus, gardenKgMult, gardenWalkMult } from './skills';
import { WILD } from '../constants.wild';
import { INGREDIENTS } from '../constants';
import { SOIL_EFFECTS, SOIL_PRODUCT_INGREDIENTS, SOIL_PRODUCT_IDS } from '../constants.soil';
import { strengthOf } from './soil';
import { dayWeather, dayOfYear, absoluteDay, CalendarDate, DayWeather, roll } from './climate';
import { plotDay, treeDay, newPlanting, pickPlanting, pickTree, DayCtx, clamp, pickQuality, treePickQuality, localTemps } from './growth';
import { hiveDay, henDay, panDay, shedDay, newHive, honeyQuality, YOLKS_PER_UNIT, HIVE_BROOD_STORES, PAN_FILL_MM, hiveNeeds, WORM_FOOD, BSF_FOOD, wormMixQ, castingsGradeOf, WORM_COLONY_KG, HEN_FEED, HEN_DM_KG } from './livestock';

/* =============================================================================
   THE ESTATE: one day, and the things a person does in it

   `estateDay` is the round the world runs once a game day, whoever is where: it
   grows every planting and tree, runs the hives, the hens, the pans and the
   bins, and then lets staff and tools carry out the standing orders. It is PURE
   — no Date.now, no Math.random, no notices — because the App calls it inside
   the day's state updater, which StrictMode runs twice. What it has to say is
   returned, and posted once from an effect.

   The player's own actions are separate functions, each returning the new state
   and the MINUTES it took, which the App spends on the world clock. Nothing here
   knows what time it is; the clock is the App's.
   ============================================================================= */

export const ESTATE_SUPPLIER = 'estate';

export const newEstate = (): EstateState => ({
  facilities: {}, vanDemand: {}, log: [], seedLines: {}, ledger: {},
  patches: {}, guide: {}, lastDay: -1,
});

export type Estate = EstateState;

export const facilityOwned = (e: Estate | undefined, id: FacilityId): boolean => !!e?.facilities[id];

export const newFacility = (id: FacilityId, day: number, month: number): FacilityState => {
  const spec = FACILITIES[id];
  const f: FacilityState = {
    id, boughtDay: day,
    // Land comes farmed conventionally: the conversion year starts today.
    plots: (spec.plots ?? []).map(p => ({ id: p.id, label: p.label, areaM2: p.areaM2, water: 60, fertility: 55, life: 45, history: [], sprayedDay: day })),
    trees: (spec.trees ?? []).map(t => ({
      id: t.id, cropId: t.cropId, label: t.label, age: t.age, health: 85, bloom: 0, set: 0, fruitKg: 0, ripeKg: 0, sprayedDay: day,
      pickedKg: 0, lostKg: 0, pickedQ: 0, lastCropKg: 0, flavour: 0, flavourDays: 0, gdd: 0,
      problems: [], treated: {}, cover: {}, potted: t.potted,
    })),
    orders: {},
    kit: {},
  };
  if (id === 'hives') f.hives = [1, 2, 3].map(n => newHive(`hive${n}`, month));
  if (id === 'hen_run') f.hens = { hens: 6, health: 95, eggs: 0, mites: 10, feedKg: 20, larvaeKg: 0, doorShut: true, problems: [], laidTotal: 0 };
  if (id === 'salt_pans') f.pans = [1, 2, 3].map(n => ({ id: `pan${n}`, brineMm: 0, gPerL: 0, crustKg: 0, florKg: 0, covered: false }));
  if (id === 'worm_shed') f.shed = { wormsKg: 2, wormFeedKg: 0, castingsKg: 0, bsfLarvaeKg: month >= 3 && month <= 9 ? 1 : 0, bsfFeedKg: 0, frassKg: 0, prepupaeKg: 0 };
  if (id === 'orangery') { f.stoveLit = false; f.fuelKg = 60; }
  // The garden's rose border comes planted.
  if (id === 'walled_garden') {
    const roses = f.plots.find(p => p.id === 'roses');
    if (roses) roses.planting = { ...newPlanting(roses, 'rose_petals', day, 'roses0', 0), stage: 'leafy', seasons: 3, gdd: 0 };
  }
  // So does the orchard: established trees, pruned last winter.
  return f;
};

/* -----------------------------------------------------------------------------
   PRODUCE: what is picked becomes an ingredient with its own quality
   --------------------------------------------------------------------------- */
const BASE = (id: string): Ingredient | undefined => INGREDIENTS.find(i => i.id === id);

/** Round to a band so a season's picks become a handful of pantry items, not hundreds. */
export const qualityBand = (q: number): number => Math.round(clamp(q, 20, 100) / 2) * 2;

export const produceId = (baseId: string, q: number, bio = false): string => `${baseId}__q${qualityBand(q)}${bio ? '__bio' : ''}`;
/** Carries the biodynamic label. */
export const isBio = (id: string): boolean => id.endsWith('__bio');

/** A bed earns the label: a year clean of sprays and bought feed, and a living soil. */
export const bedIsBiodynamic = (plot: Plot, day: number, boughtDay: number): boolean =>
  day - (plot.sprayedDay ?? boughtDay) >= BIO_CONVERSION_DAYS && day - (plot.boughtFeedDay ?? -1e9) >= BIO_CONVERSION_DAYS && plot.life >= BIO_LIFE_MIN;
/** A tree earns it with a year clean of sprays. */
export const treeIsBiodynamic = (tree: Tree, day: number, boughtDay: number): boolean => day - (tree.sprayedDay ?? boughtDay) >= BIO_CONVERSION_DAYS;
/** Why a bed is not (yet) biodynamic, for the ledger; null if it is. */
export const bioBlocker = (plot: Plot, day: number, boughtDay: number): string | null => {
  const clean = day - Math.max(plot.sprayedDay ?? boughtDay, plot.boughtFeedDay ?? -1e9);
  if (clean < BIO_CONVERSION_DAYS) return `in conversion, ${BIO_CONVERSION_DAYS - clean} days to go`;
  if (plot.life < BIO_LIFE_MIN) return `soil life ${Math.round(plot.life)}, needs ${BIO_LIFE_MIN}`;
  return null;
};
export const baseOfProduce = (id: string): string => id.split('__q')[0];
/** Something grown here for the kitchen — not a soil product, which carries the same grade suffix. */
export const isEstateProduce = (id: string): boolean => id.includes('__q') && !SOIL_PRODUCT_IDS.includes(baseOfProduce(id));

/**
 * The grown version of an ingredient. It resolves as its base in the recipe
 * matrix (`legitCounterpartId`), carries its own quality into the critic's
 * terroir cap, and its stats are nudged by how it was grown: a sun-ripened
 * tomato is sweeter and more savoury than the van's, a neglected one thinner.
 */
export const makeProduce = (baseId: string, q: number, bio = false): Ingredient | null => {
  const base = BASE(baseId);
  if (!base) return null;
  const band = qualityBand(q);
  const d = band - base.quality;
  const hs = { ...base.hiddenStats };
  const nudge = (v: number | undefined, by: number) => clamp(Math.round(((v ?? 0) + by) * 2) / 2, 0, 10);
  const fam = CROPS[baseId]?.family;
  if (fam === 'tomato') { hs.sugarContent = nudge(hs.sugarContent, d / 10); hs.innateUmami = nudge(hs.innateUmami, d / 12); }
  else if (['wintergrain', 'springgrain', 'corn', 'fava', 'pea', 'chickpea', 'lentil', 'bean'].includes(fam ?? '')) hs.proteinContent = nudge(hs.proteinContent, d / 20);
  else if (['yuzu', 'finger_limes', 'calamansi', 'buddhas_hand'].includes(baseId)) hs.innateAcidity = nudge(hs.innateAcidity, d / 15);
  else hs.sugarContent = nudge(hs.sugarContent, d / 12);
  return {
    ...base,
    id: produceId(baseId, q, bio),
    name: `${base.name} · estate${bio ? ', biodynamic' : ''}`,
    quality: band,
    supplierId: ESTATE_SUPPLIER,
    tierRequired: 0,
    season: undefined,
    legitCounterpartId: baseId,
    hiddenStats: hs,
    tags: Array.from(new Set([...(base.tags ?? []), 'ESTATE', ...(bio ? ['BIODYNAMIC'] : [])])),
    description: `${base.description} Grown here, graded ${band}${d > 0 ? ` — ${d} above the van’s` : d < 0 ? ` — ${-d} below the van’s` : ''}.${bio ? ' Biodynamic: no synthetic sprays, no bought feed, a living soil and heirloom seed.' : ''}`,
  };
};

/** Put kilos of produce into the pantry as whole units, carrying the remainder. */
export const storeProduce = (state: GameState, baseId: string, kg: number, q: number, bio = false): GameState => {
  if (kg <= 0) return state;
  const p = makeProduce(baseId, q, bio);
  if (!p) return state;
  const est = state.estate as Estate;
  const carry = { ...(est.carry ?? {}) };
  const unitKg = p.mass / 1000;
  const total = (carry[p.id] ?? 0) + kg / unitKg;
  const whole = Math.floor(total + 1e-6);
  carry[p.id] = total - whole;
  const customIngredients = state.customIngredients.some(i => i.id === p.id) ? state.customIngredients : [...state.customIngredients, p];
  const ledger = { ...est.ledger };
  const row = ledger[baseId] ?? { kg: 0, value: 0, q: 0, n: 0 };
  ledger[baseId] = { kg: row.kg + kg, value: row.value, q: (row.q * row.kg + q * kg) / (row.kg + kg), n: row.n + 1 };
  return {
    ...state,
    customIngredients,
    inventory: whole > 0 ? { ...state.inventory, [p.id]: (state.inventory[p.id] ?? 0) + whole } : state.inventory,
    estate: { ...est, carry, ledger },
  };
};

/* -----------------------------------------------------------------------------
   THE VAN
   --------------------------------------------------------------------------- */
/** What the van pays for one unit, right now. */
export const vanUnitPrice = (state: GameState, itemId: string): number => {
  const base = BASE(baseOfProduce(itemId));
  const item = state.customIngredients.find(i => i.id === itemId) ?? base;
  if (!base || !item) return 0;
  const cls = produceClassOf(base.id);
  const demand = (state.estate?.vanDemand[cls] ?? 1) * wildGlut(state, base.id);
  const k = QUALITY_ELASTIC[base.id];
  const qMult = k ? Math.pow(item.quality / Math.max(1, base.quality), k) : 0.7 + 0.3 * (item.quality / Math.max(1, base.quality));
  return Math.max(0, base.baseCost * VAN_WHOLESALE * demand * qMult * labelMult(state, itemId));
};

/* WILD THINGS ARE A SCARCE MARKET, AND IT FILLS FOR GOOD. The owner's call: a
   rare ingredient sells well at the gate early on, and then the few buyers who
   want it have had their fill, so a forager's haul has to go to the bench. Two
   terms, both on top of the class's weekly appetite: a tiny weekly appetite of
   its own (`WILD_APPETITE_KG`, recovering with the rest), and the kilos of it
   ever sold (`wildSoldKg`), which never recover — half price by the sixth kilo,
   a sixth by the thirtieth. */
export const WILD_APPETITE_KG = 1.5;
export const WILD_SATURATION_KG = 6;
const wildKey = (id: string) => `wild:${id}`;
export const wildGlut = (state: GameState, baseId: string): number => {
  if (!WILD[baseId]) return 1;
  const est = state.estate;
  return (est?.vanDemand[wildKey(baseId)] ?? 1) / (1 + (est?.wildSoldKg?.[baseId] ?? 0) / WILD_SATURATION_KG);
};

/** Home-grown sells over wholesale; biodynamic sells for a great deal more while its few buyers last. */
const labelMult = (state: GameState, itemId: string, bioDemand = state.estate?.vanDemand['biodynamic'] ?? 1): number =>
  !isEstateProduce(itemId) ? 1 : HOME_GROWN_PREMIUM * (isBio(itemId) ? 1 + BIO_VAN_PREMIUM * bioDemand : 1);

/** Sell units at the gate. Each kilo sold pushes that class's price down; it recovers weekly. */
export const sellToVan = (state: GameState, itemId: string, units: number): { state: GameState; paid: number } => {
  const have = state.inventory[itemId] ?? 0;
  const n = Math.min(have, Math.max(0, Math.floor(units)));
  if (n <= 0) return { state, paid: 0 };
  const base = BASE(baseOfProduce(itemId))!;
  const cls = produceClassOf(base.id);
  const appetite = PRODUCE_CLASS[cls]?.appetiteKg ?? 20;
  const unitKg = base.mass / 1000;
  const est = state.estate;
  let demand = est.vanDemand[cls] ?? 1;
  let bioDemand = est.vanDemand.biodynamic ?? 1;
  const wild = !!WILD[base.id];
  let wildDemand = est.vanDemand[wildKey(base.id)] ?? 1;
  let wildSold = est.wildSoldKg?.[base.id] ?? 0;
  let paid = 0;
  const item = state.customIngredients.find(i => i.id === itemId) ?? base;
  const qMult = 0.7 + 0.3 * (item.quality / Math.max(1, base.quality));
  const bio = isBio(itemId);
  for (let i = 0; i < n; i++) {
    const glut = wild ? wildDemand / (1 + wildSold / WILD_SATURATION_KG) : 1;
    paid += base.baseCost * VAN_WHOLESALE * demand * glut * qMult * labelMult(state, itemId, bioDemand);
    demand *= Math.exp(-unitKg / appetite);
    if (wild) { wildDemand *= Math.exp(-unitKg / WILD_APPETITE_KG); wildSold += unitKg; }
    if (bio) bioDemand *= Math.exp(-unitKg / BIO_APPETITE_KG);
  }
  paid = Math.round(paid * 100) / 100;
  const ledger = { ...est.ledger };
  const row = ledger[base.id] ?? { kg: 0, value: 0, q: 0, n: 0 };
  ledger[base.id] = { ...row, value: row.value + paid };
  return {
    state: {
      ...state,
      money: state.money + paid,
      inventory: { ...state.inventory, [itemId]: have - n },
      estate: {
        ...est, ledger,
        vanDemand: { ...est.vanDemand, [cls]: Math.max(0.05, demand), ...(bio ? { biodynamic: Math.max(0.05, bioDemand) } : {}), ...(wild ? { [wildKey(base.id)]: Math.max(0.02, wildDemand) } : {}) },
        ...(wild ? { wildSoldKg: { ...(est.wildSoldKg ?? {}), [base.id]: wildSold } } : {}),
      },
    },
    paid,
  };
};

export const recoverVanDemand = (e: EstateState): EstateState => ({
  ...e,
  vanDemand: Object.fromEntries(Object.entries(e.vanDemand).map(([k, v]) => [k, Math.min(1, v + (1 - v) * VAN_RECOVERY)])),
});

/* -----------------------------------------------------------------------------
   WHO IS ON THE ESTATE
   --------------------------------------------------------------------------- */
export type FarmRole = 'gardener' | 'orchardist' | 'beekeeper' | 'poultry' | 'soil_tech' | 'forager';

/** Which hand works which place. */
export const ROLE_FOR: Record<FacilityId, FarmRole> = {
  walled_garden: 'gardener', polytunnel: 'gardener', top_field: 'gardener',
  orchard: 'orchardist', orangery: 'orchardist',
  hives: 'beekeeper', hen_run: 'poultry', worm_shed: 'soil_tech', salt_pans: 'forager',
};

/** The estate's roles worth offering in the hiring pool: only for places you own. */
export const farmRolesFor = (e: EstateState | undefined): FarmRole[] => {
  if (!e) return [];
  const owned = Object.keys(e.facilities) as FacilityId[];
  const roles = new Set<FarmRole>(owned.map(id => ROLE_FOR[id]));
  if (Object.values(e.guide ?? {}).some(g => g.found)) roles.add('forager');
  return (['gardener', 'orchardist', 'beekeeper', 'poultry', 'soil_tech', 'forager'] as FarmRole[]).filter(r => roles.has(r));
};

const handOf = (crew: CrewMember[], role: FarmRole): CrewMember | undefined =>
  (crew as any[]).filter(c => c.role === role).sort((a, b) => b.skill - a.skill)[0];

/** A hand misses a little of what they are asked to do, less as they learn the place. */
const missRate = (c: CrewMember | undefined) => c ? clamp(0.3 - skill5(c) * 0.055, 0.02, 0.3) : 1;
/** A practised hand picks better, as the player does: up to +10 grade at level 15. */
const handGrade = (c: CrewMember | undefined) => (c ? Math.round(10 * frac(crewLevel(c))) : 0);

/* -----------------------------------------------------------------------------
   THE DAY
   --------------------------------------------------------------------------- */
export interface EstateReport {
  notes: EstateLogEntry[];
  /** Kilos picked by staff, by item, for the morning note. */
  picked: Record<string, number>;
  spent: number;
}

const log = (notes: EstateLogEntry[], day: number, text: string, kind: EstateLogEntry['kind'], facility?: FacilityId) =>
  notes.push({ day, text, kind, facility });

export const estateDay = (stateIn: GameState, date: CalendarDate, week: WeatherState): { state: GameState; report: EstateReport } => {
  let state = stateIn;
  const est0 = state.estate as Estate;
  const report: EstateReport = { notes: [], picked: {}, spent: 0 };
  const day = absoluteDay(date);
  if (!est0 || est0.lastDay >= day) return { state, report };
  const wx = dayWeather(date, week);
  const doy = dayOfYear(date);
  const wetStreak = wx.rainMm > 2 ? (est0.wetStreak ?? 0) + 1 : 0;
  const dryStreak = wx.rainMm > 2 ? 0 : (est0.dryStreak ?? 0) + 1;
  const crew = (state.crew ?? []) as CrewMember[];
  const bees = !!est0.facilities.hives?.hives?.some(h => h.alive);
  const facilities: Partial<Record<FacilityId, FacilityState>> = {};
  let money = 0;
  let est: Estate = { ...est0, wetStreak, dryStreak, lastDay: day };

  const produce: { id: string; kg: number; q: number; bio?: boolean }[] = [];
  // Waste and soil products in and out of the pantry, and grades to mint.
  const pan = pantryOf(state);
  const mints: [string, number][] = [];

  for (const [fid, f0] of Object.entries(est0.facilities) as [FacilityId, FacilityState][]) {
    const f: FacilityState = { ...f0, orders: { ...f0.orders }, kit: { ...f0.kit } };
    const hand = handOf(crew, ROLE_FOR[fid]);
    const miss = missRate(hand);
    const hq = handGrade(hand);
    const ctx: DayCtx = { day, month: date.month, doy, wx, wetStreak, dryStreak, kit: kitProvides(f.kit), bees, stoveLit: !!f.stoveLit };
    const orders = f.orders;
    const act = (salt: string) => hand && roll('hand', fid, salt, day) >= miss;

    // --- The orangery stove burns wood while it is lit ---
    if (fid === 'orangery' && f.stoveLit) {
      const need = wx.tMin < 6 ? 6 : 0;
      if (need > 0) {
        if ((f.fuelKg ?? 0) >= need) f.fuelKg = (f.fuelKg ?? 0) - need;
        else { f.stoveLit = false; log(report.notes, day, 'The lemon house stove went out: the wood ran out.', 'bad', fid); }
      }
    }
    if (fid === 'orangery' && hand && orders.protect && !f.stoveLit && wx.tMin < 4) {
      f.stoveLit = true;
      if ((f.fuelKg ?? 0) < 30) { f.fuelKg = (f.fuelKg ?? 0) + 100; money -= 22; }
    }

    // --- Plots ---
    f.plots = f.plots.map(p0 => {
      let plot = p0;
      // Frost cover goes on BEFORE the night, if someone is watching the sky.
      if (plot.planting && orders.protect && act('fleece' + plot.id) && f.kit.fleece) {
        const t = localTemps(fid, wx, false, false);
        const fam = FAMILIES[CROPS[plot.planting.cropId].family];
        const danger = t.tMin <= fam.kill + 3 || (fam.flowerKill !== undefined && t.tMin <= fam.flowerKill + 2);
        if (danger !== !!plot.planting.cover.fleece) plot = { ...plot, planting: { ...plot.planting, cover: { ...plot.planting.cover, fleece: danger } } };
      }
      const r = plotDay(plot, fid, ctx);
      plot = r.plot;
      r.events.forEach(t => log(report.notes, day, t, t.includes('killed') || t.includes('lost') ? 'bad' : t.includes('ready') ? 'good' : 'warn', fid));
      const pl = plot.planting;
      // Drip line: waters on its own.
      if (f.kit.drip && plot.water < 45 && fid !== 'top_field') plot = { ...plot, water: 80 };
      if (!pl || pl.stage === 'dead') return plot;
      // Standing orders, if there is someone to carry them out.
      if (orders.water && !f.kit.drip && fid !== 'top_field' && plot.water < 35 && act('water' + plot.id)) plot = { ...plot, water: 82 };
      let next: Planting = plot.planting!;
      // The conventional way, if you have asked for it: one spray clears every
      // pest, fungus and weed and keeps them off a fortnight — and the bed
      // starts its conversion year again.
      if (orders.spray && next.problems.some(p => SPRAYABLE.has(p.id)) && act('spray' + plot.id)) {
        next = { ...next, problems: next.problems.filter(p => !SPRAYABLE.has(p.id)), treated: { ...next.treated, chem: day + SPRAY_DAYS } };
        plot = { ...plot, sprayedDay: day };
        money -= sprayCost(plot.areaM2);
      }
      if (orders.pests || orders.weed) {
        const seen = next.problems.map(p => ({ ...p, seen: true }));
        const keep = seen.filter(p => {
          if (p.id === 'weeds') return !(orders.weed && act('weed' + plot.id));
          if (!orders.pests) return true;
          const spec = PROBLEMS[p.id];
          if (!spec || spec.minutes === 0 || p.id === 'clubroot' || p.id === 'white_rot') return true;
          return !act('fix' + p.id + plot.id);
        });
        next = { ...next, problems: keep };
      }
      if (orders.train && CROPS[next.cropId].family === 'tomato' && (next.trainedUntil ?? -1) < day && act('train' + plot.id)) {
        next = { ...next, trainedUntil: day + 7 };
        pantryPut(pan, 'green_tips', next.plants * 0.05);
      }
      if (orders.feed && plot.fertility < 38 && next.stage !== 'ripe' && act('feed' + plot.id)) {
        // From the pantry first — home-made, and it feeds the soil life too.
        // With nothing there, a sack of well-rotted manure from the farm down the road.
        const lot = soilLots(pan).find(l => FEEDS.includes(l.base) && l.kg >= doseKg(l, plot.areaM2));
        if (lot) {
          const r2 = applyLot(plot, next, lot, day);
          plot = r2.plot; next = r2.planting ?? next;
          pantryPut(pan, lot.id, -doseKg(lot, plot.areaM2));
        } else {
          plot = { ...plot, fertility: clamp(plot.fertility + MANURE.fertility, 0, 100), life: clamp(plot.life + MANURE.life, 0, 100), boughtFeedDay: day };
          money -= manureCost(plot.areaM2);
        }
      }
      if (orders.pick && next.ripeKg > 0.05 && act('pick' + plot.id)) {
        const fam = FAMILIES[CROPS[next.cropId].family];
        const due = fam.harvest === 'continuous' ? true : next.daysRipe >= 1;
        const grain = fam.id === 'wintergrain' || fam.id === 'springgrain';
        if (due && !grain) {
          const res = pickPlanting(next, BASE(next.cropId)?.quality ?? 70);
          next = res.planting;
          if (res.kg > 0) { produce.push({ id: next.cropId, kg: res.kg, q: Math.min(100, res.quality + hq), bio: bedIsBiodynamic(plot, day, f.boughtDay) }); report.picked[next.cropId] = (report.picked[next.cropId] ?? 0) + res.kg; }
        }
      }
      return { ...plot, planting: next };
    });

    // --- Trees ---
    f.trees = f.trees.map(t0 => {
      const r = treeDay(t0, fid, ctx);
      let tree = r.tree;
      r.events.forEach(t => log(report.notes, day, t, t.includes('frost') || t.includes('Frost') ? 'warn' : 'info', fid));
      if (orders.spray && tree.problems.some(p => SPRAYABLE.has(p.id)) && act('tspray' + tree.id)) {
        tree = { ...tree, problems: tree.problems.filter(p => !SPRAYABLE.has(p.id)), treated: { ...tree.treated, chem: day + SPRAY_DAYS }, sprayedDay: day };
        money -= sprayCost(10);
      }
      if (orders.pests && tree.problems.length) tree = { ...tree, problems: tree.problems.filter(p => !act('tfix' + p.id + tree.id)) };
      // The orchardist prunes in the dead of winter and thins in June.
      if (orders.train && hand) {
        if ((date.month === 11 || date.month <= 1) && tree.prunedYear !== date.year + (date.month === 11 ? 1 : 0) && act('prune' + tree.id)) {
          tree = { ...tree, prunedYear: date.year + (date.month === 11 ? 1 : 0) };
          pantryPut(pan, 'prunings', 6);
        }
        if (date.month === 5 && TREE_SPECS[tree.cropId].biennial && tree.thinnedYear !== date.year && tree.fruitKg > 0 && act('thin' + tree.id)) {
          tree = { ...tree, thinnedYear: date.year, fruitKg: tree.fruitKg * 0.75 };
        }
      }
      if (orders.pick && tree.ripeKg > 0.05 && act('tpick' + tree.id)) {
        const res = pickTree(tree, BASE(tree.cropId)?.quality ?? 70);
        tree = res.tree;
        if (res.kg > 0) { produce.push({ id: tree.cropId, kg: res.kg, q: Math.min(100, res.quality + hq), bio: treeIsBiodynamic(tree, day, f.boughtDay) }); report.picked[tree.cropId] = (report.picked[tree.cropId] ?? 0) + res.kg; }
      }
      return tree;
    });

    // --- Hives ---
    if (f.hives) {
      f.hives = f.hives.map(h0 => {
        const inspected = orders.bees && hand ? day - ((h0 as any).inspectedDay ?? -99) >= 7 && act('inspect' + h0.id) ? day : (h0 as any).inspectedDay : (h0 as any).inspectedDay;
        const r = hiveDay({ ...h0, ...(inspected !== undefined ? { inspectedDay: inspected } as any : {}) }, { day, month: date.month, doy, year: date.year, wx }, { inspectedDay: inspected });
        let h = r.hive as Hive & { inspectedDay?: number };
        if (inspected !== undefined) h.inspectedDay = inspected;
        r.events.forEach(t => log(report.notes, day, t, 'bad', fid));
        if (orders.bees && hand && h.alive) {
          const needs = hiveNeeds(h, date.month);
          if (needs.includes('feed') && act('feed' + h.id)) { h = { ...h, stores: h.stores + (date.month >= 10 || date.month <= 2 ? 2.5 : 6), fed: day }; money -= date.month >= 10 || date.month <= 2 ? 8 : 10; }
          if (needs.includes('varroa') && act('varroa' + h.id)) { h = { ...h, varroa: h.varroa * 0.15 }; money -= 15; }
          if (needs.includes('honey') && date.month >= 5 && date.month <= 7 && day - h.lastTake >= 14 && act('honey' + h.id)) {
            const take = Math.max(0, h.surplus - 1);
            h = { ...h, surplus: h.surplus - take, lastTake: day, takenKg: h.takenKg + take };
            produce.push({ id: 'honey', kg: take, q: honeyQuality(date.month, !!f.kit.extractor) });
            report.picked['honey'] = (report.picked['honey'] ?? 0) + take;
          }
        }
        return h;
      });
    }

    // --- Hens ---
    if (f.hens) {
      const keeper = handOf(crew, 'poultry');
      const shut = !!f.kit.auto_door || (orders.hens && !!keeper && roll('shut', day) >= missRate(keeper));
      const r = henDay(f.hens, { day, month: date.month, doy, year: date.year, wx }, { autoDoor: !!f.kit.auto_door, shutByDusk: shut || f.hens.doorShut });
      let run = { ...r.run, doorShut: false };
      r.events.forEach(t => log(report.notes, day, t, 'bad', fid));
      if (orders.hens && keeper) {
        if (run.eggs > 0 && act('eggs')) {
          produce.push({ id: 'egg_yolks', kg: run.eggs / YOLKS_PER_UNIT * 0.5, q: Math.round(run.eggQ ?? 80) });
          report.picked['egg_yolks'] = (report.picked['egg_yolks'] ?? 0) + run.eggs / YOLKS_PER_UNIT * 0.5;
          pantryPut(pan, 'eggshells', run.eggs * 0.006);
          run = { ...run, eggs: 0 };
        }
        // Shell back to the flock, then pellets only when the home feed in the bin runs short.
        if ((run.bin?.shells ?? 0) < 0.1 && pantryKg(pan, 'eggshells') > 0) { const k = pantryKg(pan, 'eggshells'); pantryPut(pan, 'eggshells', -k); run = { ...run, bin: { ...run.bin, shells: (run.bin?.shells ?? 0) + k } }; }
        if (henBinDays(run) < 3) { run = { ...run, feedKg: run.feedKg + 25 }; money -= 18; }
        if (run.mites > 45 && act('clean')) run = { ...run, mites: 8 };
      }
      f.hens = run;
    }

    // --- Pans ---
    if (f.pans) {
      f.pans = f.pans.map(p0 => {
        const r = panDay(p0, { day, month: date.month, doy, year: date.year, wx });
        r.events.forEach(t => log(report.notes, day, t, 'warn', fid));
        return r.pan;
      });
    }

    // --- The shed ---
    if (f.shed) {
      let shed = f.shed;
      // Waste from the lab goes into the bins if there is someone to carry it.
      const tech = handOf(crew, 'soil_tech');
      if (tech && orders.feed) {
        shed = routeWaste(pan, shed);
      }
      const r = shedDay(shed, { day, month: date.month, doy, year: date.year, wx });
      shed = r.shed;
      r.events.forEach(t => log(report.notes, day, t, 'warn', fid));
      if (tech && orders.feed) {
        // Castings and frass to the pantry, larvae to the hens.
        const cg = Math.round(shed.castingsGrade ?? CASTINGS_GRADE);
        if (shed.castingsKg >= 5) { pantryPut(pan, soilProductId('worm_castings', cg), shed.castingsKg); mints.push(['worm_castings', cg]); shed = { ...shed, castingsKg: 0 }; }
        if (shed.frassKg >= 5) { pantryPut(pan, soilProductId('fly_frass', FRASS_GRADE), shed.frassKg); mints.push(['fly_frass', FRASS_GRADE]); shed = { ...shed, frassKg: 0 }; }
        const hens = facilities.hen_run?.hens ?? est.facilities.hen_run?.hens;
        if (hens && shed.prepupaeKg >= 1) {
          const moved = shed.prepupaeKg * 0.8;
          shed = { ...shed, prepupaeKg: shed.prepupaeKg - moved };
          const run = { ...hens, larvaeKg: hens.larvaeKg + moved };
          if (facilities.hen_run) facilities.hen_run = { ...facilities.hen_run, hens: run };
          else if (est.facilities.hen_run) est = { ...est, facilities: { ...est.facilities, hen_run: { ...est.facilities.hen_run, hens: run } } };
        }
      }
      f.shed = shed;
    }
    facilities[fid] = f;
  }

  est = { ...est, facilities: { ...est.facilities, ...facilities } };
  // Weekly: the van's appetite comes back.
  if (date.day === 1) est = recoverVanDemand(est) as Estate;
  // Keep the log short.
  est = { ...est, log: [...est.log, ...report.notes].slice(-80) };
  // Compost tea dies on the shelf without its air.
  for (const id of Object.keys(pan.inventory).concat(Object.keys(pan.carry))) if (baseOfProduce(id) === 'compost_tea') pantryPut(pan, id, -pantryKg(pan, id) * COMPOST_TEA_DECAY);
  state = { ...state, inventory: pan.inventory, estate: { ...est, carry: pan.carry }, money: state.money + money };
  for (const [base, grade] of mints) state = mintSoilProduct(state, base, grade).state;
  report.spent = -money;
  for (const p of produce) state = storeProduce(state, p.id, p.kg, p.q, !!p.bio);
  return { state, report };
};

/** The covers and stoppers a facility's kit provides, as the growth model reads them. */
export const kitProvides = (kit: Record<string, boolean>): Record<string, boolean> => {
  const out: Record<string, boolean> = { ...kit };
  for (const t of FARM_TOOLS) if (kit[t.id] && t.provides) out[t.provides] = true;
  return out;
};

/* -----------------------------------------------------------------------------
   THE PANTRY: waste and soil products are stock like anything else

   Green waste, straw, eggshells and the rest, and everything the soil lab and
   the shed make, sit in `inventory` in 1 kg units, with the part-kilo carried
   in `estate.carry` — so the bench can draw a bokashi from them and the beds can
   be fed from the same shelf. A soil product is minted like produce, its grade
   in the id (`compost__q86`), and a strong batch goes further on the land.
   --------------------------------------------------------------------------- */
export interface Pantry { inventory: Record<string, number>; carry: Record<string, number> }
export const pantryOf = (s: GameState): Pantry => ({ inventory: { ...s.inventory }, carry: { ...((s.estate as Estate)?.carry ?? {}) } });
export const withPantry = (s: GameState, p: Pantry): GameState => ({ ...s, inventory: p.inventory, estate: { ...s.estate, carry: p.carry } });
/** Kilos of an item on the shelf, whole units and the carried part. */
export const pantryKg = (p: Pantry, id: string): number => (p.inventory[id] ?? 0) + (p.carry[id] ?? 0);
/** Add (or with a negative, take) kilos; never below nothing. */
export const pantryPut = (p: Pantry, id: string, kg: number): void => {
  const t = Math.max(0, pantryKg(p, id) + kg);
  const whole = Math.floor(t + 1e-6);
  p.inventory[id] = whole;
  p.carry[id] = t - whole < 1e-6 ? 0 : t - whole;
};
export const addToPantry = (s: GameState, id: string, kg: number): GameState => {
  if (kg <= 0) return s;
  const p = pantryOf(s);
  pantryPut(p, id, kg);
  return withPantry(s, p);
};
/** Several items at once. */
export const addWaste = (s: GameState, ...items: [string, number][]): GameState => {
  const p = pantryOf(s);
  for (const [id, kg] of items) if (kg > 0) pantryPut(p, id, kg);
  return withPantry(s, p);
};

export const soilProductId = (base: string, grade: number): string => `${base}__q${qualityBand(grade)}`;
/** The graded version of a soil product, registered so the pantry and the bench can read it. */
export const mintSoilProduct = (s: GameState, base: string, grade: number): { state: GameState; id: string } => {
  const b = SOIL_PRODUCT_INGREDIENTS.find(i => i.id === base);
  if (!b) return { state: s, id: base };
  const band = qualityBand(grade);
  const id = `${base}__q${band}`;
  if (s.customIngredients.some(i => i.id === id)) return { state: s, id };
  const strength = strengthOf(band);
  const item: Ingredient = {
    ...b, id, quality: band, legitCounterpartId: base,
    description: `${b.description} Graded ${band}: ${strength >= 1.1 ? 'strong, and it goes further than a standard dose' : strength <= 0.7 ? 'weak, so it takes more to do the same' : 'standard strength'}.`,
  };
  return { state: { ...s, customIngredients: [...s.customIngredients, item] }, id };
};

export interface SoilLot { id: string; base: string; grade: number; kg: number }
/** Every graded soil product on the shelf, strongest first. */
export const soilLots = (p: Pantry): SoilLot[] => {
  const ids = new Set([...Object.keys(p.inventory), ...Object.keys(p.carry)]);
  const out: SoilLot[] = [];
  for (const id of ids) {
    const base = baseOfProduce(id);
    if (!SOIL_EFFECTS[base]) continue;
    const kg = pantryKg(p, id);
    if (kg < 0.005) continue;
    const m = id.match(/__q(\d+)$/);
    out.push({ id, base, grade: m ? +m[1] : 80, kg });
  }
  return out.sort((a, b) => b.grade - a.grade);
};
/** Kilos of a lot one dose on this much ground takes. A strong batch goes further. */
export const doseKg = (lot: { base: string; grade: number }, areaM2: number): number =>
  (SOIL_EFFECTS[lot.base]?.perM2 ?? 0) * areaM2 / strengthOf(lot.grade);

/* -----------------------------------------------------------------------------
   SOIL-LAB PRODUCTS ON THE LAND
   --------------------------------------------------------------------------- */
/** What a treatment key on a planting (`treated.act`) is called. */
export const treatmentName = (key: string): string => {
  const base = Object.values(SOIL_EFFECTS).find(e => (e.key ?? e.id) === key)?.id ?? key;
  return SOIL_PRODUCT_INGREDIENTS.find(i => i.id === base)?.name ?? key;
};

/** Bought in when there is nothing home-made to hand: slower to build a soil, and it costs. */
export const MANURE = { fertility: 16, life: 4 };
export const manureCost = (areaM2: number) => Math.max(3, Math.round(areaM2 * 0.6));

/** A dose of one lot on one bed. The caller has checked there is enough. */
const applyLot = (plot: Plot, pl: Planting | undefined, lot: { base: string }, day: number): { plot: Plot; planting: Planting | undefined } => {
  const e = SOIL_EFFECTS[lot.base];
  const nextPlot: Plot = { ...plot, fertility: clamp(plot.fertility + (e.fertility ?? 0), 0, 100), life: clamp(plot.life + (e.life ?? 0), 0, 100) };
  const nextPl = pl && e.lasts ? { ...pl, treated: { ...pl.treated, [e.key ?? e.id]: day + e.lasts } } : pl;
  return { plot: nextPlot, planting: nextPl };
};

/** Compost tea is alive only while it has air: two days on the shelf and it is gone. */
export const COMPOST_TEA_DECAY = 0.4;
/** What a standing order to feed reaches for, richest first. */
const FEEDS = ['worm_castings', 'compost', 'bokashi', 'fly_frass'];
/** Castings from a shed that predates graded feed; new castings take the grade of what the worms ate. */
export const CASTINGS_GRADE = 84;

/* -----------------------------------------------------------------------------
   FEEDING THE SHED AND THE HENS

   Worms and soldier flies eat different things, for real reasons (see WORM_FOOD,
   WORM_REFUSE and BSF_FOOD in livestock.ts), so each has its own button and the
   technician's order routes waste by kind: fish and salty press cake to the flies,
   the greens with straw bedding to the worms, spent grain to whichever is alive.
   --------------------------------------------------------------------------- */
/** Put waste into the worm bins: greens, a little acid fruit, grit, and straw up to a third. */
export const feedWorms = (pan: Pantry, shed: WormShed, only?: string[]): { shed: WormShed; kg: number; q: number } => {
  const mix: Record<string, number> = {};
  for (const [k, role] of Object.entries(WORM_FOOD)) {
    if (role === 'carbon' || role === 'grit' || k === 'green_tips') continue;
    if (only && !only.includes(k)) continue;
    mix[k] = pantryKg(pan, k);
  }
  const wet = Object.values(mix).reduce((a, b) => a + b, 0);
  if (wet < 0.2) return { shed, kg: 0, q: shed.wormFeedQ ?? 0 };
  mix.straw = Math.min(pantryKg(pan, 'straw'), wet * 0.43);
  mix.eggshells = Math.min(pantryKg(pan, 'eggshells'), wet * 0.03);
  const q = wormMixQ(mix);
  let kg = 0;
  for (const [k, v] of Object.entries(mix)) { if (v > 0) { pantryPut(pan, k, -v); kg += v; } }
  const old = shed.wormFeedKg, oq = shed.wormFeedQ ?? q;
  return { shed: { ...shed, wormFeedKg: old + kg, wormFeedQ: (old * oq + kg * q) / (old + kg) }, kg, q };
};
/** Put waste into the fly bins; what it becomes depends on what it is. */
export const feedFlies = (pan: Pantry, shed: WormShed, only?: string[]): { shed: WormShed; kg: number } => {
  let kg = 0, conv = 0;
  for (const [k, c] of Object.entries(BSF_FOOD)) {
    if (k === 'green_tips' || (only && !only.includes(k))) continue;
    const v = pantryKg(pan, k);
    if (v <= 0) continue;
    pantryPut(pan, k, -v); kg += v; conv += v * c;
  }
  if (kg <= 0) return { shed, kg: 0 };
  const old = shed.bsfFeedKg, oc = shed.bsfConv ?? conv / kg;
  return { shed: { ...shed, bsfFeedKg: old + kg, bsfConv: (old * oc + conv) / (old + kg) }, kg };
};
/** What goes to the flies first: what worms cannot take (fish, salt) and what flies turn to
 *  larvae best (spent grain). The greens stay for the worms, which make better use of them. */
export const FLY_FIRST = ['fish_waste', 'press_cake', 'spent_grain'];
/** The standing order: each waste to the animal that can use it. */
export const routeWaste = (pan: Pantry, shed: WormShed): WormShed => {
  const flies = shed.bsfLarvaeKg > 0.05;
  let s = shed;
  if (flies) s = feedFlies(pan, s, FLY_FIRST).shed;
  s = feedWorms(pan, s).shed;
  return s;
};

/** Which bin a pantry lot goes in, if the hens can eat it. */
export const henFeedOf = (id: string): HenFeed | null => {
  if (id === 'eggshells') return 'shells';
  if (id === 'spent_grain') return 'mash';
  if (id === 'veg_waste' || id === 'green_waste') return 'greens';
  if (!isEstateProduce(id)) return null;
  const fam = CROPS[baseOfProduce(id)]?.family;
  if (fam === 'wintergrain' || fam === 'springgrain') return 'grain';
  if (fam === 'corn') return 'corn';
  if (fam === 'pea' || fam === 'fava' || fam === 'chickpea' || fam === 'lentil' || fam === 'bean') return 'pulses';
  return null;
};
/** Kilos in the pantry for each hen feed, and the lots behind it, poorest grade first. */
export const henFeedStock = (pan: Pantry): Record<HenFeed, { kg: number; lots: { id: string; kg: number; unitKg: number }[] }> => {
  const out = {} as Record<HenFeed, { kg: number; lots: { id: string; kg: number; unitKg: number }[] }>;
  const ids = new Set([...Object.keys(pan.inventory), ...Object.keys(pan.carry)]);
  for (const id of ids) {
    const k = henFeedOf(id);
    if (!k || k === 'worms') continue;
    const unitKg = isEstateProduce(id) ? (BASE(baseOfProduce(id))?.mass ?? 1000) / 1000 : 1;
    const kg = pantryKg(pan, id) * unitKg;
    if (kg < 0.01) continue;
    const row = out[k] ?? (out[k] = { kg: 0, lots: [] });
    row.kg += kg; row.lots.push({ id, kg, unitKg });
  }
  const grade = (id: string) => +(id.match(/__q(\d+)/)?.[1] ?? 0);
  for (const r of Object.values(out)) r.lots.sort((a, b) => grade(a.id) - grade(b.id));
  return out;
};
/** A sack for the bin: a feeding's worth, never the whole harvest. */
export const HEN_SACK_KG: Record<HenFeed, number> = { grain: 5, corn: 5, pulses: 3, greens: 5, mash: 5, worms: 0, shells: 2 };
/** Days of feed in the bin at the flock's appetite, counting everything they eat. */
export const henBinDays = (r: HenRun): number => {
  if (r.hens <= 0) return 99;
  let dm = r.feedKg * HEN_FEED.pellets.dm + r.larvaeKg * HEN_FEED.larvae.dm;
  for (const [k, kg] of Object.entries(r.bin ?? {})) if (k !== 'shells') dm += (kg ?? 0) * HEN_FEED[k as HenFeed].dm;
  return dm / (r.hens * HEN_DM_KG);
};
export const FRASS_GRADE = 78;

/* -----------------------------------------------------------------------------
   WHAT THE PLAYER DOES, AND HOW LONG IT TAKES
   --------------------------------------------------------------------------- */
export interface ActionResult { state: GameState; minutes: number; message: string; ok: boolean }
const fail = (state: GameState, message: string): ActionResult => ({ state, minutes: 0, message, ok: false });

const withFacility = (state: GameState, fid: FacilityId, f: FacilityState): GameState =>
  ({ ...state, estate: { ...state.estate, facilities: { ...state.estate.facilities, [fid]: f } } });

export const buyFacility = (state: GameState, fid: FacilityId, day: number): ActionResult => {
  const spec = FACILITIES[fid];
  if (state.estate.facilities[fid]) return fail(state, `${spec.name} is already yours.`);
  if (state.money < spec.cost) return fail(state, `${spec.name} costs $${spec.cost}.`);
  const f = newFacility(fid, day, state.month);
  // Someone who can work the place turns up now, rather than at the next
  // monthly roll — the same courtesy the koji room extends to its keeper.
  const role = ROLE_FOR[fid];
  const pool = state.crewPool ?? [];
  const known = pool.some(c => c.role === role) || (state.crew ?? []).some(c => c.role === role);
  const crewPool = known ? pool : [...pool, makeCandidate(role, day * 13 + FACILITY_ORDER.indexOf(fid) * 7 + 3)];
  return { state: { ...withFacility(state, fid, f), money: state.money - spec.cost, crewPool }, minutes: 0, message: `${spec.name} is yours.${known ? '' : ` A ${role === 'soil_tech' ? 'soil technician' : role === 'poultry' ? 'poultry keeper' : role} is asking after work — see Staff.`}`, ok: true };
};

export const buyTool = (state: GameState, fid: FacilityId, toolId: string): ActionResult => {
  const tool = FARM_TOOLS.find(t => t.id === toolId);
  const f = state.estate.facilities[fid];
  if (!tool || !f) return fail(state, 'Nothing to buy.');
  if (f.kit[toolId]) return fail(state, `${tool.name}: already here.`);
  if (state.money < tool.cost) return fail(state, `${tool.name} costs $${tool.cost}.`);
  return { state: { ...withFacility(state, fid, { ...f, kit: { ...f.kit, [toolId]: true } }), money: state.money - tool.cost }, minutes: 10, message: `${tool.name} set up.`, ok: true };
};

export const setOrder = (state: GameState, fid: FacilityId, key: keyof StandingOrders, on: boolean): GameState => {
  const f = state.estate.facilities[fid];
  if (!f) return state;
  return withFacility(state, fid, { ...f, orders: { ...f.orders, [key]: on } });
};

/** Walk the rows: every problem here becomes visible, in one go. */
export const walkRows = (state: GameState, fid: FacilityId, day: number): ActionResult => {
  const f = state.estate.facilities[fid];
  if (!f) return fail(state, 'Not yours.');
  const plots = f.plots.map(p => p.planting ? { ...p, planting: { ...p.planting, problems: p.planting.problems.map(x => ({ ...x, seen: true })) } } : p);
  const trees = f.trees.map(t => ({ ...t, problems: t.problems.map(x => ({ ...x, seen: true })) }));
  const count = plots.reduce((a, p) => a + (p.planting?.problems.length ?? 0), 0) + trees.reduce((a, t) => a + t.problems.length, 0);
  return {
    state: withFacility(state, fid, { ...f, plots, trees, walkedDay: day }),
    minutes: Math.round(FACILITIES[fid].walkRows * gardenWalkMult(gardenerLevel(state))),
    message: count === 0 ? 'Walked the rows. Nothing wrong.' : `Walked the rows: ${count} thing${count > 1 ? 's' : ''} to see to.`,
    ok: true,
  };
};

/** The problems in a place, grouped by kind — one action deals with every bed that has it. */
export const groupedProblems = (f: FacilityState): { id: string; plots: string[]; trees: string[]; seen: boolean }[] => {
  const g: Record<string, { id: string; plots: string[]; trees: string[]; seen: boolean }> = {};
  for (const p of f.plots) for (const x of p.planting?.problems ?? []) {
    g[x.id] = g[x.id] ?? { id: x.id, plots: [], trees: [], seen: false };
    g[x.id].plots.push(p.id); g[x.id].seen = g[x.id].seen || x.seen;
  }
  for (const t of f.trees) for (const x of t.problems) {
    g[x.id] = g[x.id] ?? { id: x.id, plots: [], trees: [], seen: false };
    g[x.id].trees.push(t.id); g[x.id].seen = g[x.id].seen || x.seen;
  }
  return Object.values(g);
};

export const fixProblem = (state: GameState, fid: FacilityId, problemId: string): ActionResult => {
  const f = state.estate.facilities[fid];
  const spec = PROBLEMS[problemId];
  if (!f || !spec) return fail(state, 'Nothing to fix.');
  const grp = groupedProblems(f).find(g => g.id === problemId);
  if (!grp) return fail(state, 'Nothing like that here.');
  const n = grp.plots.length + grp.trees.length;
  const hoe = problemId === 'weeds' && f.kit.stirrup_hoe ? 0.5 : 1;
  const big = (id: string) => (f.plots.find(p => p.id === id)?.areaM2 ?? 6) > 100 ? 4 : 1;
  const minutes = Math.round(grp.plots.reduce((a, id) => a + spec.minutes * hoe * big(id), 0) + grp.trees.length * spec.minutes);
  let cost = (spec.cost ?? 0) * (grp.trees.length || 0);
  // A fix that is a thing you put up stays up: nets, traps, the fence.
  const kit = { ...f.kit };
  if (problemId === 'crows') kit.scarecrow = true;
  if (problemId === 'boar' && !kit.electric_fence) { cost += 220; kit.electric_fence = true; }
  if (problemId === 'codling' || problemId === 'plum_moth' || problemId === 'tuta') { if (!kit.traps) { cost += 35; kit.traps = true; } }
  if (problemId === 'whitefly' && !kit.sticky_traps) { cost += 15; kit.sticky_traps = true; }
  if (state.money < cost) return fail(state, `That needs $${cost} of kit.`);
  const covers = (pl: Planting): Planting => {
    const c = { ...pl.cover };
    if (problemId === 'pigeons' || problemId === 'whites' || problemId === 'pea_moth' || problemId === 'birds_fruit') { if (f.kit.netting) c.net = true; }
    if (problemId === 'flea' && f.kit.fleece) c.fleece = true;
    return { ...pl, cover: c };
  };
  const plots = f.plots.map(p => p.planting && grp.plots.includes(p.id)
    ? { ...p, planting: covers({ ...p.planting, problems: p.planting.problems.filter(x => x.id !== problemId) }) }
    : p);
  const trees = f.trees.map(t => grp.trees.includes(t.id) ? { ...t, problems: t.problems.filter(x => x.id !== problemId) } : t);
  let next = withFacility(state, fid, { ...f, plots, trees, kit });
  if (problemId === 'wasps' || problemId === 'brown_rot') next = addWaste(next, ['windfalls', grp.trees.length * 3]);
  return { state: { ...next, money: next.money - cost }, minutes, message: `${spec.fix} — ${n} ${n > 1 ? 'places' : 'place'}.`, ok: true };
};

export const waterPlots = (state: GameState, fid: FacilityId, plotIds: string[]): ActionResult => {
  const f = state.estate.facilities[fid];
  if (!f) return fail(state, 'Not yours.');
  if (fid === 'top_field') return fail(state, 'The field is rain-fed. There is no watering 600 m² with a can.');
  const spec = FACILITIES[fid];
  const rate = (spec.canMinPerM2 ?? 3) * (f.kit.hose ? 0.28 : 1);
  let minutes = 0;
  const plots = f.plots.map(p => {
    if (!plotIds.includes(p.id)) return p;
    minutes += p.areaM2 * rate * clamp((90 - p.water) / 60, 0.3, 1.2);
    return { ...p, water: Math.max(p.water, 88) };
  });
  return { state: withFacility(state, fid, { ...f, plots }), minutes: Math.max(5, Math.round(minutes)), message: `Watered ${plotIds.length} bed${plotIds.length > 1 ? 's' : ''}.`, ok: true };
};

export const plantPlots = (state: GameState, fid: FacilityId, plotIds: string[], cropId: string, day: number, month: number): ActionResult => {
  const f = state.estate.facilities[fid];
  const spec = CROPS[cropId];
  if (!f || !spec) return fail(state, 'Nothing to plant.');
  if (!spec.where.includes(fid)) return fail(state, `${BASE(cropId)?.name} does not go in here.`);
  if (!spec.plant.includes(month)) return fail(state, `Not the month for ${BASE(cropId)?.name}.`);
  const targets = f.plots.filter(p => plotIds.includes(p.id) && (!p.planting || p.planting.stage === 'spent' || p.planting.stage === 'dead') && (p.id === 'roses') === (cropId === 'rose_petals'));
  if (targets.length === 0) return fail(state, 'Clear the bed first.');
  const cost = Math.round(targets.reduce((a, p) => a + p.areaM2 * spec.costM2, 0));
  if (state.money < cost) return fail(state, `Seed for that runs $${cost}.`);
  const line = state.estate.seedLines[cropId] ?? 0;
  const drill = fid === 'top_field' && f.kit.seed_drill;
  let minutes = 0;
  const plots = f.plots.map(p => {
    if (!targets.includes(p)) return p;
    minutes += p.areaM2 > 100 ? (drill ? 20 : 60) + 20 : Math.max(10, p.areaM2 * (spec.how === 'seed' ? 1.5 : spec.how === 'clove' ? 4 : 2.5));
    const hist = p.planting ? [FAMILIES[CROPS[p.planting.cropId].family].id, ...p.history].slice(0, 4) : p.history;
    return { ...p, history: hist, greenManure: undefined, planting: newPlanting(p, cropId, day, `${cropId}_${p.id}_${day}`, line) };
  });
  return { state: { ...withFacility(state, fid, { ...f, plots }), money: state.money - cost }, minutes: Math.round(minutes), message: `Planted ${BASE(cropId)?.name} in ${targets.length} bed${targets.length > 1 ? 's' : ''} ($${cost}).`, ok: true };
};

/** Clear a finished or failed bed. A legume leaves nitrogen; everything leaves something for the compost. */
export const clearPlots = (state: GameState, fid: FacilityId, plotIds: string[]): ActionResult => {
  const f = state.estate.facilities[fid];
  if (!f) return fail(state, 'Not yours.');
  let minutes = 0;
  let residue = 0, straw = 0;
  const plots = f.plots.map(p => {
    if (!plotIds.includes(p.id) || !p.planting) return p;
    const fam = FAMILIES[CROPS[p.planting.cropId].family];
    if (fam.perennial && p.planting.stage !== 'dead') return p;
    minutes += p.areaM2 > 100 ? 45 : 10;
    // A grain strip leaves straw, which is the mulch you would otherwise buy.
    if (fam.id === 'wintergrain' || fam.id === 'springgrain') straw += p.areaM2 * 0.45;
    else residue += p.areaM2 * (p.areaM2 > 100 ? 0.3 : 0.8);
    return { ...p, fertility: clamp(p.fertility + (fam.fixes ?? 0), 0, 100), history: [fam.id, ...p.history].slice(0, 4), planting: undefined };
  });
  const next = withFacility(state, fid, { ...f, plots });
  return { state: addWaste(next, ['green_waste', residue], ['straw', straw]), minutes, message: straw > 0 ? `Cleared. ${Math.round(straw)} kg of straw baled for mulch.` : 'Cleared, and the haulm is on the heap.', ok: true };
};

export const coverPlots = (state: GameState, fid: FacilityId, plotIds: string[], cover: 'net' | 'fleece' | 'mulch'): ActionResult => {
  const f = state.estate.facilities[fid];
  if (!f) return fail(state, 'Not yours.');
  if (cover === 'net' && !f.kit.netting) return fail(state, 'You need netting and hoops.');
  if (cover === 'fleece' && !f.kit.fleece) return fail(state, 'You need a roll of fleece.');
  let minutes = 0, cost = 0;
  const pan = pantryOf(state);
  const plots = f.plots.map(p => {
    if (!plotIds.includes(p.id) || !p.planting) return p;
    const on = !p.planting.cover[cover];
    minutes += on ? (cover === 'mulch' ? 20 : 10) : 5;
    if (on && cover === 'mulch') {
      const need = p.areaM2 * 1.5;
      if (pantryKg(pan, 'straw') >= need) pantryPut(pan, 'straw', -need);
      else cost += Math.ceil(p.areaM2 / 6) * 6;
    }
    return { ...p, planting: { ...p.planting, cover: { ...p.planting.cover, [cover]: on }, problems: cover === 'mulch' && on ? p.planting.problems.filter(x => x.id !== 'weeds') : p.planting.problems } };
  });
  if (state.money < cost) return fail(state, `Straw for that runs $${cost}.`);
  const next = withFacility(state, fid, { ...f, plots });
  return { state: { ...withPantry(next, pan), money: state.money - cost }, minutes, message: `${cover === 'mulch' ? 'Mulched' : cover === 'net' ? 'Netted' : 'Fleeced'}.`, ok: true };
};

export const trainPlots = (state: GameState, fid: FacilityId, plotIds: string[], day: number): ActionResult => {
  const f = state.estate.facilities[fid];
  if (!f) return fail(state, 'Not yours.');
  let minutes = 0, tips = 0;
  const plots = f.plots.map(p => {
    const pl = p.planting;
    if (!plotIds.includes(p.id) || !pl || CROPS[pl.cropId].family !== 'tomato') return p;
    minutes += 4 + pl.plants * 1.2;
    tips += pl.plants * 0.05;
    return { ...p, planting: { ...pl, trainedUntil: day + 7 } };
  });
  const next = withFacility(state, fid, { ...f, plots });
  return { state: addWaste(next, ['green_tips', tips]), minutes: Math.round(minutes), message: 'Side-shoots pinched out and trusses tied in. The tips are in a bucket for the plant juice.', ok: true };
};

/** Put a soil product on beds or trees. `itemId` is what is on the shelf (`compost__q86`); its grade sets the dose. */
export const applyToPlots = (state: GameState, fid: FacilityId, plotIds: string[], itemId: string, day: number): ActionResult => {
  const f = state.estate.facilities[fid];
  const base = baseOfProduce(itemId);
  const e = SOIL_EFFECTS[base];
  const name = findName(base);
  if (!f || !e) return fail(state, 'Nothing to apply.');
  const pan = pantryOf(state);
  const lot = soilLots(pan).find(l => l.id === itemId) ?? { id: itemId, base, grade: 80, kg: pantryKg(pan, itemId) };
  let minutes = 0, done = 0;
  const liquid = !!e.lasts || base === 'faa';
  const plots = f.plots.map(p => {
    if (!plotIds.includes(p.id)) return p;
    const need = doseKg(lot, p.areaM2);
    if (pantryKg(pan, itemId) < need - 1e-6) return p;
    pantryPut(pan, itemId, -need); done++;
    const r = applyLot(p, p.planting, lot, day);
    minutes += liquid ? (f.kit.sprayer ? 3 : 10) * (p.areaM2 > 100 ? 5 : 1) : (p.areaM2 > 100 ? 90 : 12);
    return { ...r.plot, planting: r.planting };
  });
  const trees = f.trees.map(t => {
    if (!plotIds.includes(t.id) || !e.lasts) return t;
    const need = doseKg(lot, 10);
    if (pantryKg(pan, itemId) < need - 1e-6) return t;
    pantryPut(pan, itemId, -need); done++;
    minutes += f.kit.sprayer ? 5 : 15;
    return { ...t, treated: { ...t.treated, [e.key ?? e.id]: day + e.lasts } };
  });
  if (done === 0) return fail(state, `Not enough ${name} on the shelf.`);
  return { state: withPantry(withFacility(state, fid, { ...f, plots, trees }), pan), minutes: Math.round(minutes), message: `${name} on ${done} ${done > 1 ? 'places' : 'place'}.`, ok: true };
};

const findName = (id: string): string => SOIL_PRODUCT_INGREDIENTS.find(i => i.id === id)?.name ?? BASE(id)?.name ?? id;

export const sprayCost = (areaM2: number) => Math.max(3, Math.round(areaM2 * SPRAY_COST_M2));

/**
 * The conventional fix: a synthetic spray over the selected beds and trees.
 * It clears every pest, fungus and weed at once and keeps them off for a
 * fortnight, for a few dollars and a few minutes — and it costs the label:
 * that bed or tree starts its year of conversion again.
 */
export const sprayPlots = (state: GameState, fid: FacilityId, ids: string[], day: number): ActionResult => {
  const f = state.estate.facilities[fid];
  if (!f) return fail(state, 'Not yours.');
  let cost = 0, minutes = 0, n = 0;
  const plots = f.plots.map(p => {
    if (!ids.includes(p.id) || !p.planting) return p;
    n++; cost += sprayCost(p.areaM2); minutes += p.areaM2 > 100 ? 45 : 8;
    return { ...p, sprayedDay: day, planting: { ...p.planting, problems: p.planting.problems.filter(x => !SPRAYABLE.has(x.id)), treated: { ...p.planting.treated, chem: day + SPRAY_DAYS } } };
  });
  const trees = f.trees.map(t => {
    if (!ids.includes(t.id)) return t;
    n++; cost += sprayCost(10); minutes += 10;
    return { ...t, sprayedDay: day, problems: t.problems.filter(x => !SPRAYABLE.has(x.id)), treated: { ...t.treated, chem: day + SPRAY_DAYS } };
  });
  if (n === 0) return fail(state, 'Nothing there to spray.');
  if (state.money < cost) return fail(state, `The spray for that is $${cost}.`);
  return { state: { ...withFacility(state, fid, { ...f, plots, trees }), money: state.money - cost }, minutes, message: `Sprayed ${n} ${n > 1 ? 'places' : 'place'} ($${cost}). Clean for a fortnight; the biodynamic year starts again.`, ok: true };
};

/** Pick what is ripe on the given plots and trees. Minutes follow the kilos. */
export const pickHere = (state: GameState, fid: FacilityId, ids: string[]): ActionResult => {
  const f = state.estate.facilities[fid];
  if (!f) return fail(state, 'Not yours.');
  let minutes = 0;
  const today = absoluteDay(state as unknown as CalendarDate);
  const got: { id: string; kg: number; q: number; bio: boolean }[] = [];
  // A practised gardener takes more of what is there and takes it better (services/skills.ts).
  const GL = gardenerLevel(state), gq = gardenQualityBonus(GL), gk = gardenKgMult(GL);
  const plots = f.plots.map(p => {
    const pl = p.planting;
    if (!ids.includes(p.id) || !pl || pl.ripeKg <= 0.05) return p;
    const fam = FAMILIES[CROPS[pl.cropId].family];
    const r = pickPlanting(pl, BASE(pl.cropId)?.quality ?? 70);
    if (r.kg <= 0) return p;
    got.push({ id: pl.cropId, kg: r.kg * gk, q: Math.min(100, r.quality + gq), bio: bedIsBiodynamic(p, today, f.boughtDay) });
    if (fam.pickKgH > 0) minutes += (r.kg / fam.pickKgH) * 60;
    else minutes += f.kit.scythe ? 360 : 540;   // a strip of grain by hand: cut, stook, thresh
    return { ...p, planting: r.planting };
  });
  const trees = f.trees.map(t => {
    if (!ids.includes(t.id) || t.ripeKg <= 0.05) return t;
    const r = pickTree(t, BASE(t.cropId)?.quality ?? 70);
    got.push({ id: t.cropId, kg: r.kg * gk, q: Math.min(100, r.quality + gq), bio: treeIsBiodynamic(t, today, f.boughtDay) });
    minutes += (r.kg / (TREE_SPECS[t.cropId].pickKgH * (f.kit.ladder ? 2 : 1))) * 60;
    return r.tree;
  });
  if (got.length === 0) return fail(state, 'Nothing ripe there.');
  let next = withFacility(state, fid, { ...f, plots, trees });
  for (const g of got) next = storeProduce(next, g.id, g.kg, g.q, g.bio);
  const kg = got.reduce((a, g) => a + g.kg, 0);
  const q = got.reduce((a, g) => a + g.kg * g.q, 0) / Math.max(0.001, kg);
  const bioKg = got.filter(g => g.bio).reduce((a, g) => a + g.kg, 0);
  return { state: next, minutes: Math.max(5, Math.round(minutes)), message: `Picked ${kg.toFixed(1)} kg, graded ${Math.round(q)}${bioKg > 0 ? bioKg >= kg - 0.01 ? ', biodynamic' : `, ${bioKg.toFixed(1)} kg of it biodynamic` : ''}.`, ok: true };
};

/** Pay a contractor to cut and thresh a strip: half an hour and money, instead of a day. */
export const contractHarvest = (state: GameState, plotId: string): ActionResult => {
  const cost = 60;
  if (state.money < cost) return fail(state, `The contractor wants $${cost}.`);
  const r = pickHere(state, 'top_field', [plotId]);
  if (!r.ok) return r;
  return { ...r, state: { ...r.state, money: r.state.money - cost }, minutes: 30, message: `${r.message} The contractor took $${cost}.` };
};

export const pruneTrees = (state: GameState, fid: FacilityId, treeIds: string[], date: CalendarDate, summer = false): ActionResult => {
  const f = state.estate.facilities[fid];
  if (!f) return fail(state, 'Not yours.');
  const winter = date.month === 11 || date.month <= 1;
  if (!summer && !winter) return fail(state, 'Winter pruning is for December to February, while the sap is down.');
  let minutes = 0, n = 0;
  const trees = f.trees.map(t => {
    if (!treeIds.includes(t.id)) return t;
    n++;
    const big = t.age > 20 ? 1.4 : t.potted ? 0.4 : 0.8;
    minutes += (summer ? 30 : 60) * big * (f.kit.long_pruner ? 0.5 : 1);
    return summer ? { ...t, summerPrunedYear: date.year, health: clamp(t.health + 3, 0, 100) } : { ...t, prunedYear: date.year + (date.month === 11 ? 1 : 0), health: clamp(t.health + 5, 0, 100) };
  });
  const next = withFacility(state, fid, { ...f, trees });
  return { state: addWaste(next, ['prunings', n * 5]), minutes: Math.round(minutes), message: `${summer ? 'Summer-pruned' : 'Pruned'} ${n} tree${n > 1 ? 's' : ''}.`, ok: true };
};

export const thinTrees = (state: GameState, fid: FacilityId, treeIds: string[], date: CalendarDate): ActionResult => {
  const f = state.estate.facilities[fid];
  if (!f) return fail(state, 'Not yours.');
  let minutes = 0, n = 0;
  const trees = f.trees.map(t => {
    if (!treeIds.includes(t.id) || t.fruitKg <= 0) return t;
    n++;
    minutes += 40 * (t.age > 20 ? 1.3 : 0.7) * (f.kit.ladder ? 0.7 : 1);
    return { ...t, thinnedYear: date.year, fruitKg: t.fruitKg * 0.75 };
  });
  if (n === 0) return fail(state, 'No fruit set yet to thin.');
  const next = withFacility(state, fid, { ...f, trees });
  return { state: addWaste(next, ['windfalls', n * 4]), minutes: Math.round(minutes), message: `Thinned ${n} tree${n > 1 ? 's' : ''} to one fruit a cluster. Bigger fruit, and no rest year next year.`, ok: true };
};

/* --- The apiary --- */
export const hiveAction = (state: GameState, kind: 'inspect' | 'feed' | 'varroa' | 'honey', date: CalendarDate, day: number): ActionResult => {
  const f = state.estate.facilities.hives;
  if (!f?.hives) return fail(state, 'No hives.');
  let minutes = 0, cost = 0, taken = 0;
  const hives = f.hives.map(h0 => {
    const h = h0 as Hive & { inspectedDay?: number };
    if (!h.alive) return h;
    if (kind === 'inspect') { minutes += 20; return { ...h, inspectedDay: day, varroa: h.varroa } as any; }
    if (kind === 'feed') {
      const winter = date.month >= 10 || date.month <= 2;
      if (h.stores >= (date.month >= 7 || date.month <= 2 ? 18 : 6)) return h;
      minutes += 10; cost += winter ? 8 : 10;
      return { ...h, stores: h.stores + (winter ? 2.5 : 6), fed: day };
    }
    if (kind === 'varroa') { minutes += 15; cost += 15; return { ...h, varroa: h.varroa * 0.15 }; }
    // honey
    if (h.surplus < 1 || day - h.lastTake < 3) return h;
    const take = h.surplus - 0.5;
    taken += take;
    minutes += f.kit.extractor ? 25 : 60;
    return { ...h, surplus: 0.5, lastTake: day, takenKg: h.takenKg + take };
  });
  if (state.money < cost) return fail(state, `That needs $${cost}.`);
  let next = withFacility(state, 'hives', { ...f, hives });
  if (kind === 'honey') {
    if (taken <= 0) return fail(state, 'No capped honey to take.');
    next = storeProduce(next, 'honey', taken, honeyQuality(date.month, !!f.kit.extractor));
  }
  const words = { inspect: 'Inspected every hive and broke down the queen cells.', feed: 'Fed the light colonies.', varroa: 'Treated for varroa.', honey: `Took ${taken.toFixed(1)} kg of capped honey.` };
  return { state: { ...next, money: next.money - cost }, minutes, message: words[kind], ok: minutes > 0 };
};

/* --- The hens --- */
/** Point-of-lay pullets, bought in pairs: hens are flock birds and one alone pines. */
export const PULLET_COST = 22; export const RUN_CAPACITY = 12;
export const henAction = (state: GameState, kind: 'eggs' | 'shut' | 'clean' | 'feed' | 'larvae' | 'pullets' | 'worms' | HenFeed): ActionResult => {
  const f = state.estate.facilities.hen_run;
  if (!f?.hens) return fail(state, 'No hens.');
  let run = { ...f.hens };
  let next = state, minutes = 0, message = '';
  if (kind === 'eggs') {
    if (run.eggs <= 0) return fail(state, 'No eggs yet.');
    const kg = run.eggs / YOLKS_PER_UNIT * 0.5;
    const q = Math.round(run.eggQ ?? 80);
    message = `Collected ${run.eggs} eggs.`;
    next = storeProduce(next, 'egg_yolks', kg, q);
    next = addWaste(next, ['eggshells', run.eggs * 0.006]);
    run = { ...run, eggs: 0 }; minutes = 5;
  } else if (kind === 'shut') { run = { ...run, doorShut: true }; minutes = 3; message = 'Shut them in for the night.'; }
  else if (kind === 'clean') { run = { ...run, mites: 5 }; minutes = 40; message = 'Mucked out and dusted the perches.'; }
  else if (kind === 'worms') {
    const shed = state.estate.facilities.worm_shed?.shed;
    const spare = shed ? shed.wormsKg - WORM_COLONY_KG : 0;
    if (!shed || spare < 0.2) return fail(state, `The towers keep ${WORM_COLONY_KG} kg of worms to breed from; there are none spare.`);
    run = { ...run, bin: { ...run.bin, worms: (run.bin?.worms ?? 0) + spare } }; minutes = 15;
    message = `${spare.toFixed(1)} kg of worms forked out of the towers for the hens.`;
    next = withFacility(next, 'worm_shed', { ...state.estate.facilities.worm_shed!, shed: { ...shed, wormsKg: WORM_COLONY_KG } });
  }
  else if (kind === 'grain' || kind === 'corn' || kind === 'pulses' || kind === 'greens' || kind === 'mash' || kind === 'shells') {
    const pan = pantryOf(state);
    const stock = henFeedStock(pan)[kind];
    if (!stock || stock.kg < 0.05) return fail(state, `No ${HEN_FEED[kind].label.toLowerCase()} in the pantry.`);
    let want = Math.min(HEN_SACK_KG[kind], stock.kg), took = 0;
    for (const lot of stock.lots) {
      if (want <= 1e-6) break;
      const kg = Math.min(want, lot.kg);
      pantryPut(pan, lot.id, -kg / lot.unitKg); want -= kg; took += kg;
    }
    next = withPantry(next, pan);
    run = { ...run, bin: { ...run.bin, [kind]: (run.bin?.[kind] ?? 0) + took } };
    // Dried beans are cooked first: raw, their lectins make a hen ill.
    minutes = kind === 'pulses' ? 40 : 5;
    message = kind === 'pulses' ? `${took.toFixed(1)} kg of pulses soaked, boiled and into the bin.` : `${took.toFixed(1)} kg of ${HEN_FEED[kind].label.toLowerCase()} into the bin.`;
  }
  else if (kind === 'pullets') {
    const n = Math.min(2, RUN_CAPACITY - run.hens);
    if (n <= 0) return fail(state, `The coop holds ${RUN_CAPACITY}.`);
    if (state.money < n * PULLET_COST) return fail(state, `A pullet is $${PULLET_COST}.`);
    run = { ...run, hens: run.hens + n }; minutes = 30; message = `${n} point-of-lay pullets into the run. They will settle in a few days.`;
    next = { ...next, money: next.money - n * PULLET_COST };
  }
  else if (kind === 'feed') {
    if (state.money < 18) return fail(state, 'A sack of layers is $18.');
    run = { ...run, feedKg: run.feedKg + 25 }; minutes = 5; message = 'A new sack in the bin.';
    next = { ...next, money: next.money - 18 };
  } else {
    const shed = state.estate.facilities.worm_shed?.shed;
    if (!shed || shed.prepupaeKg < 0.5) return fail(state, 'No larvae in the shed.');
    const moved = shed.prepupaeKg;
    run = { ...run, larvaeKg: run.larvaeKg + moved }; minutes = 5; message = `${moved.toFixed(1)} kg of fly larvae to the hens. They are beside themselves.`;
    next = withFacility(next, 'worm_shed', { ...state.estate.facilities.worm_shed!, shed: { ...shed, prepupaeKg: 0 } });
  }
  next = withFacility(next, 'hen_run', { ...next.estate.facilities.hen_run!, hens: run });
  return { state: next, minutes, message, ok: true };
};

/* --- The pans --- */
export const panAction = (state: GameState, kind: 'fill' | 'cover' | 'rake' | 'flor'): ActionResult => {
  const f = state.estate.facilities.salt_pans;
  if (!f?.pans) return fail(state, 'No pans.');
  let next = state, minutes = 0, message = '';
  let pans = f.pans.map(p => ({ ...p }));
  if (kind === 'fill') {
    pans = pans.map(p => p.brineMm < 10 && p.crustKg + p.florKg < 0.5 ? { ...p, brineMm: PAN_FILL_MM, gPerL: p.brineMm > 0 ? (p.brineMm * p.gPerL + (PAN_FILL_MM - p.brineMm) * 35) / PAN_FILL_MM : 35 } : p);
    minutes = 20; message = 'Opened the sluice and let the sea in.';
  } else if (kind === 'cover') {
    const on = !pans.every(p => p.covered);
    pans = pans.map(p => ({ ...p, covered: on })); minutes = 15; message = on ? 'Covered the pans against the rain.' : 'Uncovered the pans.';
  } else if (kind === 'rake') {
    const kg = pans.reduce((a, p) => a + p.crustKg, 0);
    if (kg < 0.5) return fail(state, 'Nothing crystallised yet.');
    pans = pans.map(p => ({ ...p, crustKg: 0 })); minutes = 30 + kg * 1.5; message = `Raked ${kg.toFixed(1)} kg of salt.`;
    next = storeProduce(next, 'salt', kg, 78);
  } else {
    const kg = pans.reduce((a, p) => a + p.florKg, 0);
    if (kg < 0.1) return fail(state, 'No flower on the pans.');
    pans = pans.map(p => ({ ...p, florKg: 0 })); minutes = 20 + kg * 6; message = `Skimmed ${kg.toFixed(2)} kg of flor de sal.`;
    next = storeProduce(next, 'noma_salt', kg, 98);
  }
  next = withFacility(next, 'salt_pans', { ...f, pans });
  return { state: next, minutes: Math.round(minutes), message, ok: true };
};

/* --- The shed --- */
export const STRAW_BALE = { kg: 15, cost: 8 };
export const shedAction = (state: GameState, kind: 'worms' | 'flies' | 'harvest' | 'restock' | 'straw'): ActionResult => {
  const f = state.estate.facilities.worm_shed;
  if (!f?.shed) return fail(state, 'No shed.');
  let shed = { ...f.shed };
  let next = state;
  let minutes = 0, message = '', cost = 0;
  if (kind === 'worms') {
    const pan = pantryOf(state);
    const r = feedWorms(pan, shed, shed.bsfLarvaeKg >= 0.05 ? Object.keys(WORM_FOOD).filter(k => !FLY_FIRST.includes(k)) : undefined);
    if (r.kg < 0.2) return fail(state, 'Nothing the worms can eat: they want greens, peelings and windfalls.');
    shed = r.shed; next = withPantry(next, pan);
    minutes = 10 + r.kg * 0.5;
    message = `${r.kg.toFixed(1)} kg into the worm towers${r.q >= 0.8 ? ', well bedded with straw' : r.q < 0.5 ? ' — wet and short of bedding: they will go slowly and the castings will be poor' : ''}.`;
  } else if (kind === 'flies') {
    if (shed.bsfLarvaeKg < 0.05) return fail(state, 'There is no fly colony to feed.');
    const pan = pantryOf(state);
    // Their own first; the greens only when there is nothing else, since the worms use those better.
    let r = feedFlies(pan, shed, FLY_FIRST);
    if (r.kg < 0.2) r = feedFlies(pan, shed);
    if (r.kg < 0.2) return fail(state, 'Nothing for the flies: they want wet, rich waste.');
    shed = r.shed; next = withPantry(next, pan);
    minutes = 10 + r.kg * 0.4; message = `${r.kg.toFixed(1)} kg into the fly bins.`;
  } else if (kind === 'straw') {
    if (state.money < STRAW_BALE.cost) return fail(state, `A bale of straw is $${STRAW_BALE.cost}.`);
    next = addToPantry({ ...next, money: next.money - STRAW_BALE.cost }, 'straw', STRAW_BALE.kg);
    minutes = 5; message = `A ${STRAW_BALE.kg} kg bale of straw for bedding.`;
  } else if (kind === 'harvest') {
    if (shed.castingsKg + shed.frassKg < 0.2) return fail(state, 'Nothing ready in the bins.');
    for (const [base, kg, grade] of [['worm_castings', shed.castingsKg, Math.round(shed.castingsGrade ?? CASTINGS_GRADE)], ['fly_frass', shed.frassKg, FRASS_GRADE]] as [string, number, number][]) {
      if (kg <= 0) continue;
      const m = mintSoilProduct(next, base, grade);
      next = addToPantry(m.state, m.id, kg);
    }
    message = `${shed.castingsKg.toFixed(1)} kg of castings and ${shed.frassKg.toFixed(1)} kg of frass to the pantry.`;
    minutes = 15 + (shed.castingsKg + shed.frassKg) * 0.8;
    shed = { ...shed, castingsKg: 0, frassKg: 0 };
  } else {
    cost = 30;
    if (state.money < cost) return fail(state, 'A tub of larvae is $30.');
    shed = { ...shed, bsfLarvaeKg: shed.bsfLarvaeKg + 1 }; minutes = 10; message = 'A new colony of black soldier fly larvae in the bin.';
  }
  next = { ...withFacility(next, 'worm_shed', { ...f, shed }), money: next.money - cost };
  return { state: next, minutes: Math.round(minutes), message, ok: true };
};

/** Light the lemon house stove, or let it go out. */
export const stoveAction = (state: GameState, on: boolean): ActionResult => {
  const f = state.estate.facilities.orangery;
  if (!f) return fail(state, 'No lemon house.');
  let fuel = f.fuelKg ?? 0, cost = 0;
  if (on && fuel < 30) { fuel += 100; cost = 22; }
  if (state.money < cost) return fail(state, 'A load of wood is $22.');
  return { state: { ...withFacility(state, 'orangery', { ...f, stoveLit: on, fuelKg: fuel }), money: state.money - cost }, minutes: 10, message: on ? 'The stove is in.' : 'Let the stove go out.', ok: true };
};

/** Save seed from a crop that has gone over: next year's line is a little better suited to this soil. */
export const saveSeed = (state: GameState, fid: FacilityId, plotId: string): ActionResult => {
  const f = state.estate.facilities[fid];
  const p = f?.plots.find(x => x.id === plotId);
  const pl = p?.planting;
  if (!f || !pl) return fail(state, 'Nothing to save seed from.');
  if (pl.stage !== 'over' && pl.stage !== 'spent' && pl.stage !== 'ripe') return fail(state, 'Seed is saved from a ripe crop left to finish.');
  if (pl.seedKept) return fail(state, 'Seed already saved from this bed.');
  const line = Math.min(6, (state.estate.seedLines[pl.cropId] ?? 0) + (pl.health > 70 ? 1 : 0));
  const plots = f.plots.map(x => x.id === plotId ? { ...x, planting: { ...pl, seedKept: true, ripeKg: pl.ripeKg * 0.85 } } : x);
  const next = withFacility(state, fid, { ...f, plots });
  return {
    state: { ...next, estate: { ...next.estate, seedLines: { ...next.estate.seedLines, [pl.cropId]: line } } },
    minutes: 25, ok: true,
    message: line > (state.estate.seedLines[pl.cropId] ?? 0) ? `Saved seed from the best plants. Your ${BASE(pl.cropId)?.name} line is generation ${line} now.` : 'Saved seed, but these plants were not good enough to improve the line.',
  };
};

/* -----------------------------------------------------------------------------
   READING THE PLACE
   --------------------------------------------------------------------------- */
export const ripeHere = (f: FacilityState): number =>
  f.plots.reduce((a, p) => a + (p.planting?.ripeKg ?? 0), 0) + f.trees.reduce((a, t) => a + t.ripeKg, 0);

export const plotQualityNow = (pl: Planting): number => pickQuality(BASE(pl.cropId)?.quality ?? 70, pl);
export const treeQualityNow = (t: Tree): number => treePickQuality(BASE(t.cropId)?.quality ?? 70, t);

export const baseIngredient = BASE;

/** What the estate needs doing today, most urgent first, for the "walk the rows" list. */
export const needsHere = (f: FacilityState, month: number): string[] => {
  const out: string[] = [];
  for (const p of f.plots) {
    if (!p.planting) continue;
    if (p.water < 30 && f.id !== 'top_field' && !f.kit.drip) out.push(`${p.label}: dry`);
    if (p.planting.ripeKg > 0.5) out.push(`${p.label}: ripe`);
  }
  for (const t of f.trees) if (t.ripeKg > 0.5) out.push(`${t.label}: ripe`);
  if (f.hives) f.hives.forEach(h => hiveNeeds(h, month).forEach(n => out.push(`Hive ${h.id.slice(-1)}: ${n}`)));
  if (f.hens && f.hens.eggs > 0) out.push(`${f.hens.eggs} eggs`);
  return out;
};

export { HIVE_BROOD_STORES };

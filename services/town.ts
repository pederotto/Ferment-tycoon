import { GameState, FermentType } from '../types';
import { BOOKS, BUYERS, CELLAR_CAPACITY, RECIPES, SUPPLIERS } from '../constants';
import { produceClassOf } from '../constants.farm';
import { TOWNSFOLK, TOWN_CHAPTER_AT, Townsperson, TownNeed, TownReward, TownStep } from '../constants.town';
import { baseOfProduce, isEstateProduce, pantryOf, pantryKg, pantryPut, withPantry } from './estate';
import { SOIL_PRODUCT_IDS } from '../constants.soil';
import { INGREDIENTS } from '../constants';

/* =============================================================================
   THE TOWN'S ERRANDS

   Pure functions over the game state. Nothing here is tracked as it happens:
   an errand's need is read off what the game already records (the logbook,
   standing, the pantry, what you own), so a save made before the town existed
   can finish errands it had in effect already done.

   `completeTownStep` is what runs when the player goes back and reports. It
   re-checks the need, takes what a delivery or a payment costs, and pays the
   reward, all inside one state update with no clock and no dice, so StrictMode's
   double call gives one answer.
   ============================================================================= */

export const townDone = (g: GameState, id: string): number => g.town?.[id] ?? 0;
export const errandsDone = (g: GameState): number =>
  Object.values(g.town ?? {}).reduce((a, n) => a + n, 0);

export const townChapter = (g: GameState): 1 | 2 | 3 => {
  const n = errandsDone(g);
  return n >= TOWN_CHAPTER_AT[3] ? 3 : n >= TOWN_CHAPTER_AT[2] ? 2 : 1;
};

/** People you have met: everyone in a chapter you have reached. */
export const townsfolkMet = (g: GameState): Townsperson[] =>
  TOWNSFOLK.filter(p => p.chapter <= townChapter(g));

export const currentStep = (g: GameState, p: Townsperson): TownStep | null =>
  p.steps[townDone(g, p.id)] ?? null;

/** The cellar, with the bays the mason opened. */
export const cellarCapacity = (g: GameState): number => {
  let extra = 0;
  for (const p of TOWNSFOLK) p.steps.slice(0, townDone(g, p.id)).forEach(s => { extra += s.reward.cellar ?? 0; });
  return CELLAR_CAPACITY + extra;
};

/* ---------------------------------------------------------------------------
   READING A NEED
   --------------------------------------------------------------------------- */

const recipeType = (id?: string): FermentType | undefined => RECIPES.find(r => r.id === id)?.type;
const scoreOf = (l: GameState['logbook'][number]): number => l.record?.score ?? l.rating * 20;
const buyerName = (id: string) => BUYERS.find(b => b.id === id)?.name ?? id;

/** Kilos per pantry unit: estate produce is counted in the ingredient's own unit. */
const unitKg = (id: string): number =>
  isEstateProduce(id) ? (INGREDIENTS.find(i => i.id === baseOfProduce(id))?.mass ?? 1000) / 1000 : 1;

const matchesDelivery = (need: Extract<TownNeed, { kind: 'deliver' }>, id: string): boolean => {
  const base = baseOfProduce(id);
  const isSoil = SOIL_PRODUCT_IDS.includes(base) && id.includes('__q');
  if (!isEstateProduce(id) && !isSoil) return false;
  if (need.bases?.includes(base)) return true;
  return !!need.classes && !isSoil && need.classes.includes(produceClassOf(base));
};

/** The lots a delivery can draw on, poorest first so the best stays for the bench. */
const deliveryLots = (g: GameState, need: Extract<TownNeed, { kind: 'deliver' }>) => {
  const p = pantryOf(g);
  const ids = new Set([...Object.keys(p.inventory), ...Object.keys(p.carry)]);
  const grade = (id: string) => +(id.match(/__q(\d+)/)?.[1] ?? 0);
  return [...ids].filter(id => matchesDelivery(need, id))
    .map(id => ({ id, kg: pantryKg(p, id) * unitKg(id), unitKg: unitKg(id) }))
    .filter(l => l.kg > 0.01)
    .sort((a, b) => grade(a.id) - grade(b.id));
};

/** How far along a need is: have / want, for the card's small print. */
export const needProgress = (g: GameState, need: TownNeed): { have: number; want: number } => {
  const log = g.logbook ?? [];
  switch (need.kind) {
    case 'sold': {
      const name = need.buyerId ? buyerName(need.buyerId) : null;
      const n = log.filter(l => l.value > 0 && (!name || l.record?.buyer === name || l.notes === `Sold to ${name}`)).length;
      return { have: n, want: need.count ?? 1 };
    }
    case 'cooked': {
      const hits = log.filter(l => l.record?.buyer !== 'Sporulated' && !l.record?.spoiled
        && scoreOf(l) >= need.minScore
        && (!need.type || recipeType(l.config?.recipeId) === need.type)
        && (!need.vesselId || l.config?.vesselId === need.vesselId));
      const n = need.distinct ? new Set(hits.map(l => l.config?.recipeId)).size : hits.length;
      return { have: n, want: need.distinct ?? 1 };
    }
    case 'deliver':
      return { have: Math.floor(deliveryLots(g, need).reduce((a, l) => a + l.kg, 0) * 10) / 10, want: need.kg };
    case 'pay': return { have: Math.max(0, Math.floor(g.money)), want: need.amount };
    case 'standing': return { have: Math.floor(g.vendorStanding?.[need.buyerId] ?? 0), want: need.value };
    case 'renown': return { have: Math.floor(g.renown), want: need.value };
    case 'vessels': {
      const owned = g.ownedVessels ?? {};
      const n = need.vesselId ? owned[need.vesselId] ?? 0 : Object.values(owned).reduce((a, v) => a + v, 0);
      return { have: n, want: need.count };
    }
    case 'places': return { have: Object.keys(g.estate?.facilities ?? {}).length, want: need.count };
    case 'found': return { have: Object.values(g.estate?.guide ?? {}).filter(e => e.found).length, want: need.count };
    case 'tells': return { have: Object.values(g.estate?.guide ?? {}).reduce((a, e) => a + (e.tells?.length ?? 0), 0), want: need.count };
    case 'errands': return { have: errandsDone(g), want: need.count };
  }
};

export const needMet = (g: GameState, need: TownNeed): boolean => {
  const { have, want } = needProgress(g, need);
  return have >= want;
};

/** People with something to report, for the pip on the nav tile. */
export const townReady = (g: GameState): Townsperson[] =>
  townsfolkMet(g).filter(p => { const s = currentStep(g, p); return !!s && needMet(g, s.need); });

/** Someone you have met who can introduce a vendor, while that introduction is still to come. */
export const townRouteTo = (g: GameState, buyerId: string): Townsperson | null => {
  for (const p of townsfolkMet(g)) {
    const i = p.steps.findIndex(s => s.reward.introduce === buyerId);
    if (i >= 0 && townDone(g, p.id) <= i) return p;
  }
  return null;
};

/* ---------------------------------------------------------------------------
   PAYING OUT
   --------------------------------------------------------------------------- */

export const describeReward = (r: TownReward): string[] => {
  const out: string[] = [];
  if (r.introduce) out.push(`An introduction to ${buyerName(r.introduce)}`);
  if (r.supplier) out.push(`${SUPPLIERS.find(s => s.id === r.supplier)?.name ?? r.supplier}: one level up`);
  if (r.book) out.push(BOOKS.find(b => b.id === r.book)?.title ?? r.book);
  if (r.cellar) out.push(`${r.cellar} more places in the cellar`);
  for (const [id, v] of Object.entries(r.standing ?? {})) out.push(`+${v} standing with ${buyerName(id)}`);
  if (r.money) out.push(`$${r.money}`);
  if (r.renown) out.push(`+${r.renown} renown`);
  if (r.reputation) out.push(`+${r.reputation} reputation`);
  if (r.heat) out.push(`${r.heat} inspector heat`);
  return out;
};

export interface TownResult { state: GameState; ok: boolean; message: string }

export const completeTownStep = (g: GameState, personId: string): TownResult => {
  const p = TOWNSFOLK.find(x => x.id === personId);
  if (!p || p.chapter > townChapter(g)) return { state: g, ok: false, message: 'Nobody by that name about.' };
  const step = currentStep(g, p);
  if (!step) return { state: g, ok: false, message: `${p.name} has nothing more to ask.` };
  if (!needMet(g, step.need)) return { state: g, ok: false, message: `${p.name} is still waiting.` };

  let s: GameState = { ...g };

  // What the errand costs.
  if (step.need.kind === 'deliver') {
    const pan = pantryOf(s);
    let left = step.need.kg;
    for (const lot of deliveryLots(s, step.need)) {
      if (left <= 1e-6) break;
      const take = Math.min(left, lot.kg);
      pantryPut(pan, lot.id, -take / lot.unitKg);
      left -= take;
    }
    s = withPantry(s, pan);
  }
  if (step.need.kind === 'pay') s = { ...s, money: s.money - step.need.amount };

  // What it pays.
  const r = step.reward;
  s = {
    ...s,
    money: s.money + (r.money ?? 0),
    renown: s.renown + (r.renown ?? 0),
    reputation: s.reputation + (r.reputation ?? 0),
    heat: Math.max(0, Math.min(100, s.heat + (r.heat ?? 0))),
  };
  if (r.standing) {
    const vs = { ...s.vendorStanding };
    for (const [id, v] of Object.entries(r.standing)) vs[id] = Math.min(100, (vs[id] ?? 0) + v);
    s = { ...s, vendorStanding: vs };
  }
  if (r.introduce && !s.unlockedVendorIds.includes(r.introduce)) {
    s = { ...s, unlockedVendorIds: [...s.unlockedVendorIds, r.introduce] };
  }
  if (r.supplier) {
    const rel = s.supplierRelationships[r.supplier] ?? { level: 1, xp: 0 };
    s = { ...s, supplierRelationships: { ...s.supplierRelationships, [r.supplier]: { ...rel, level: rel.level + 1 } } };
  }
  if (r.book) {
    const book = BOOKS.find(b => b.id === r.book);
    if (book && !s.ownedBookIds.includes(book.id)) {
      s = { ...s, ownedBookIds: [...s.ownedBookIds, book.id],
        unlockedRecipes: Array.from(new Set([...s.unlockedRecipes, ...book.teaches])) };
    } else if (book) {
      s = { ...s, money: s.money + Math.round(book.price / 2) };
    }
  }

  s = { ...s, town: { ...(s.town ?? {}), [p.id]: townDone(g, p.id) + 1 } };
  return { state: s, ok: true, message: `${p.name}: “${step.thanks}”` };
};

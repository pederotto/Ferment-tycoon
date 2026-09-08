import {
  Buyer, Contract, FermentType, GameState, Recipe, StandingTier, VendorUnlock, Batch,
} from '../types';
import { BUYERS, RECIPES } from '../constants';

/* =============================================================================
   VENDORS WHO REMEMBER YOU

   The buyer list was a price comparison. You read six numbers, took the biggest,
   and nothing about the transaction survived it — sell to the same restaurant
   thirty weeks running and it greeted you exactly as it had the first time.

   Three things change that here.

   STANDING accumulates. Selling a vendor good stock raises it, neglect erodes
   it, and breaking a promise costs more than neglect ever does. It buys a real
   price bonus, so a relationship is worth money, not just flavour text.

   CONTRACTS are what standing unlocks. A vendor commits to taking a quantity by
   a given week at an agreed price; you commit to producing it. That fixes the
   two things spot selling could not: income becomes predictable, and contracted
   goods bypass market saturation entirely, because they are already sold.

   UNLOCKS mean the roster is earned. Some vendors appear when your reputation
   reaches them, but others want to see you buy a particular ingredient, master a
   particular recipe, or be introduced by someone who already trusts you.
   ============================================================================= */

export const STANDING_TIERS: StandingTier[] = [
  { min: 0,  label: 'Unknown',   priceBonus: 0,    blurb: 'They have no idea who you are.' },
  { min: 15, label: 'Noted',     priceBonus: 0.05, blurb: 'They recognise the name on the crate.' },
  { min: 35, label: 'Regular',   priceBonus: 0.12, blurb: 'You are on the list of people they call.' },
  { min: 60, label: 'Trusted',   priceBonus: 0.22, blurb: 'They will take your word on a batch they have not seen.' },
  { min: 85, label: 'Kitchen family', priceBonus: 0.35, blurb: 'They plan menus around what you are making.' },
];

export const standingTier = (standing: number): StandingTier => {
  let tier = STANDING_TIERS[0];
  for (const t of STANDING_TIERS) if (standing >= t.min) tier = t;
  return tier;
};

export const getStanding = (g: Pick<GameState, 'vendorStanding'>, buyerId: string): number =>
  g.vendorStanding?.[buyerId] ?? 0;

/**
 * What one sale does to a relationship.
 *
 * Deliberately asymmetric. A merely acceptable batch barely registers; an
 * excellent one is remembered. Selling a vendor something poor actively costs
 * you, because a restaurant that serves your bad miso wears it in front of its
 * own customers.
 */
export const standingFromSale = (score: number, currentStanding: number): number => {
  const base =
    score >= 88 ? 7 :
    score >= 75 ? 4.5 :
    score >= 62 ? 2 :
    score >= 45 ? 0 : -6;
  // Getting from Trusted to Kitchen Family should take real, repeated work.
  const resistance = 1 - (currentStanding / 130);
  return base > 0 ? base * Math.max(0.25, resistance) : base;
};

/** Standing fades if you stop showing up. Applied weekly. */
export const decayStanding = (
  standings: Record<string, number>,
  soldToThisWeek: string[]
): Record<string, number> => {
  const next: Record<string, number> = {};
  for (const [id, v] of Object.entries(standings)) {
    if (soldToThisWeek.includes(id)) { next[id] = v; continue; }
    // A relationship you never feed cools slowly, and never quite to nothing
    // once it has been real — people remember good work.
    const floor = v >= 60 ? 25 : 0;
    next[id] = Math.max(floor, v - 0.8);
  }
  return next;
};

/* --------------------------------------------------------------------------
   UNLOCKS
   -------------------------------------------------------------------------- */

export const describeUnlock = (u: VendorUnlock): string => {
  switch (u.kind) {
    case 'open': return 'Open to anyone.';
    case 'reputation': return u.label ?? `Reputation ${u.value}.`;
    case 'renown': return u.label ?? `Renown ${u.value}.`;
    case 'ingredient': return u.label;
    case 'mastery': return u.label;
    case 'recipeCount': return u.label;
    case 'introduction': return u.label;
  }
};

/**
 * Is this vendor available at all yet?
 *
 * `unlockedVendorIds` is a latch: once a condition has been met it stays met,
 * so a vendor introduced to you does not vanish because your reputation dipped.
 */
export const isVendorUnlocked = (buyer: Buyer, g: GameState): boolean => {
  if (g.unlockedVendorIds?.includes(buyer.id)) return true;
  const u = buyer.unlock;
  if (!u) return g.reputation >= buyer.minReputation;

  switch (u.kind) {
    case 'open': return true;
    case 'reputation': return g.reputation >= u.value;
    case 'renown': return g.renown >= u.value;
    case 'ingredient':
      return (g.inventory?.[u.ingredientId] ?? 0) > 0
        || g.logbook.some(l => l.config?.inputIngredientIds?.includes(u.ingredientId));
    case 'mastery':
      return (g.recipeMastery?.[u.recipeId]?.level ?? 0) >= u.level;
    case 'recipeCount':
      return Object.values(g.recipeMastery ?? {}).filter(m => m.bestScore >= u.minScore).length >= u.count;
    case 'introduction':
      return getStanding(g, u.byBuyerId) >= u.standing;
  }
};

/** Newly satisfied unlocks, so the game can announce them once and latch them. */
export const newlyUnlockedVendors = (g: GameState): Buyer[] =>
  BUYERS.filter(b => !g.unlockedVendorIds?.includes(b.id) && b.unlock && isVendorUnlocked(b, g));

/* --------------------------------------------------------------------------
   CONTRACTS
   -------------------------------------------------------------------------- */

/** Deterministic-enough pick so contract generation does not need Math.random. */
const pick = <T,>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length];

/**
 * Whether a vendor is minded to offer you work this week.
 *
 * They have to know you (standing), you must not already owe them something,
 * and there is a cap on how much work is in flight at once — a lab juggling six
 * contracts is not making decisions, it is doing data entry.
 */
export const MAX_ACTIVE_CONTRACTS = 3;

export const canOfferContract = (buyer: Buyer, g: GameState): boolean => {
  if (getStanding(g, buyer.id) < 15) return false;
  if (buyer.paysIn === 'renown') return false;      // prestige buyers do not do volume
  if (buyer.type === 'Underground') return false;   // fences do not sign anything
  const live = g.contracts.filter(c => c.status === 'offered' || c.status === 'active');
  if (live.length >= MAX_ACTIVE_CONTRACTS) return false;
  return !live.some(c => c.buyerId === buyer.id);
};

/**
 * Build an offer. Terms improve with standing: a vendor who trusts you pays
 * over the odds and gives you longer, because they would rather have your
 * batch than a stranger's.
 */
export const makeContractOffer = (
  buyer: Buyer,
  g: GameState,
  seed: number
): Contract | null => {
  if (!canOfferContract(buyer, g)) return null;

  const standing = getStanding(g, buyer.id);
  const tier = standingTier(standing);

  const types = buyer.desiredTypes.filter(t => t !== FermentType.FAIL);
  if (types.length === 0) return null;
  const fermentType = pick(types, seed);

  // A named recipe is a harder ask and pays for it — but only offered by
  // someone who already trusts you, because it is a request, not an order.
  const namedCandidates = RECIPES.filter(
    r => r.type === fermentType && r.id !== 'bio_sludge' && (g.recipeMastery?.[r.id]?.cooks ?? 0) > 0
  );
  const wantsNamed = standing >= 60 && namedCandidates.length > 0 && seed % 3 === 0;
  const recipe = wantsNamed ? pick(namedCandidates, seed >> 2) : undefined;

  const appetite = buyer.appetite ?? 3;
  const unitsRequired = Math.max(1, Math.round(appetite * (0.6 + standing / 160)));
  const weeks = Math.max(3, Math.round(4 + unitsRequired * 0.9 - standing / 40));

  // The premium is the whole point: contracted goods are worth more than the
  // same goods sold loose, because you carried the risk of promising them.
  const basePrice = 50 * (recipe?.difficulty ?? 2) * 1.5;
  const pricePerUnit = Math.round(
    basePrice * buyer.priceMultiplier * (1 + tier.priceBonus) * 1.18
  );

  const minScore = Math.min(92, Math.max(50, buyer.minScore + (wantsNamed ? 6 : 0)));

  const pitch = wantsNamed
    ? `We have a menu built around ${recipe!.name} and I would rather it was yours than anyone's. ${unitsRequired} units, scoring ${minScore} or better.`
    : `I can move ${unitsRequired} units of decent ${fermentType.toLowerCase()} if you can hold ${minScore} on it. Fixed price, whatever the market does.`;

  return {
    id: `ct_${buyer.id}_${seed}`,
    buyerId: buyer.id,
    buyerName: buyer.name,
    fermentType: recipe ? undefined : fermentType,
    recipeId: recipe?.id,
    minScore,
    unitsRequired,
    unitsDelivered: 0,
    pricePerUnit,
    offeredWeek: g.week,
    dueWeek: g.week + weeks,
    status: 'offered',
    standingReward: wantsNamed ? 14 : 9,
    standingPenalty: wantsNamed ? 18 : 12,
    // Failing costs you a third of the contract's value. Enough to make signing
    // a decision rather than a free option.
    cashPenalty: Math.round(pricePerUnit * unitsRequired * 0.33),
    pitch,
  };
};

/** Does this batch satisfy this contract? */
export const batchFitsContract = (
  c: Contract, recipe: Recipe, score: number
): boolean => {
  if (c.status !== 'active') return false;
  if (score < c.minScore) return false;
  if (c.recipeId) return recipe.id === c.recipeId;
  if (c.fermentType) return recipe.type === c.fermentType;
  return false;
};

/** Every active contract this batch could be delivered against. */
export const eligibleContracts = (
  contracts: Contract[], recipe: Recipe, score: number
): Contract[] => contracts.filter(c => batchFitsContract(c, recipe, score));

/**
 * How many units a batch delivers. Mass matters, but sublinearly and with a
 * cap — a single enormous cask should not clear a whole contract at once, or
 * the deadline stops meaning anything.
 */
export const unitsFromBatch = (batch: Batch): number =>
  Math.max(1, Math.min(4, Math.round(Math.pow(Math.max(0.1, (batch.totalMass || 1000) / 1000), 0.5))));

export const contractProgressLabel = (c: Contract): string =>
  `${c.unitsDelivered}/${c.unitsRequired} delivered`;

/** Contracts that have run out of time. Called at the week boundary. */
export const overdueContracts = (contracts: Contract[], week: number): Contract[] =>
  contracts.filter(c => c.status === 'active' && week > c.dueWeek);

export const describeContractWant = (c: Contract): string => {
  if (c.recipeId) {
    const r = RECIPES.find(x => x.id === c.recipeId);
    return r ? r.name : c.recipeId;
  }
  return `any ${c.fermentType}`;
};

import { Batch, Ingredient, Recipe, EnzymeProfile, IngredientType, FermentType } from '../types';

/**
 * KOJI ENZYMOLOGY
 *
 * Aspergillus is not a timer. It is an enzyme factory, and which enzymes it
 * makes is something you steer.
 *
 * Two families matter. AMYLASES cut starch into fermentable sugar — they are
 * what makes amazake sweet and what feeds an alcoholic brew. PROTEASES cut
 * protein into free amino acids, glutamate above all, which is umami — they are
 * what makes a garum or a shoyu taste of anything.
 *
 * Four things decide the ratio, and all four are real practice:
 *
 *   STRAIN      A sake koji is bred for amylase, a shoyu koji for protease.
 *   SUBSTRATE   Enzyme secretion is substrate-induced. Grown on rice the mould
 *               makes amylase because that is what there is to eat; grown on
 *               soy or barley it makes more protease.
 *   TEMPERATURE Warm and fast (35-38 C) pushes amylase. Cool and slow (28-30 C)
 *               pushes protease. This is why sake koji is run hot and short and
 *               shoyu koji cool and long.
 *   MOISTURE    A wetter bed favours amylase; a drier one drives the mycelium
 *               deeper and favours protease.
 *
 * The result is carried on the finished koji and consumed by whatever you make
 * next, so "which koji did I grow, and how" becomes the decision the rest of
 * the game hangs off.
 */

/** Enzyme activity a well-run batch develops in total, before it is split. */
const PEAK_ACTIVITY = 100;

/** Ambient koji activity assumed when a recipe needs koji but none is present. */
export const NO_ENZYMES: EnzymeProfile = { amylase: 0, protease: 0 };

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Warm pushes amylase, cool pushes protease. The band tops out at 36 C rather
 * than 38 deliberately: the bed starts accumulating heat stress in the high
 * thirties, so a window that only paid out at 38 would have asked the player to
 * cook their own koji to reach it.
 */
export const tempAmylaseBias = (temp: number): number => clamp01((temp - 28) / 8);

/** A wet bed favours amylase; a dry one drives the mycelium deeper for protease. */
export const moistureAmylaseBias = (humidity: number): number => clamp01((humidity - 45) / 45);

/** Secretion is substrate-induced: it makes the enzyme that unlocks its food. */
export const substrateAmylaseBias = (ing: Ingredient | undefined): number => {
  if (!ing) return 0.5;
  const starch = ing.hiddenStats.starchContent;
  const protein = ing.hiddenStats.proteinContent;
  if (starch + protein <= 0) return 0.5;
  return clamp01(starch / (starch + protein));
};

/** Where the spore itself is bred to sit. */
export const strainAmylaseBias = (starter: Ingredient | undefined): number =>
  starter?.strainBias ?? 0.5;

/**
 * How the bed is developing right now. Returns the amylase share (0-1) and how
 * much total activity the conditions are worth per tick.
 */
export const kojiDevelopment = (
  substrate: Ingredient | undefined,
  starter: Ingredient | undefined,
  temp: number,
  humidity: number,
  stress: number
) => {
  // Strain and substrate are fixed at inoculation; heat and moisture are the two
  // dials the player actually holds, so they carry the most weight between them.
  // The strain carries the most weight — it is the thing you deliberately bought,
  // and a shoyu koji should still come out savoury even if you run it warm.
  // Heat is the strongest lever you hold in the moment; substrate induction and
  // moisture trim the result.
  const share = clamp01(
    strainAmylaseBias(starter) * 0.42 +
    tempAmylaseBias(temp) * 0.28 +
    substrateAmylaseBias(substrate) * 0.20 +
    moistureAmylaseBias(humidity) * 0.10
  );

  // Enzymes are proteins. The mould has to be alive and comfortable to secrete
  // them, so a stressed or scorched bed makes less of everything — but mild
  // stress is normal in a working bed and should not gut the yield.
  const vigour = Math.max(0.15, 1 - stress / 140);

  // Growth stalls outside the mould's range whatever the ratio says.
  const inRange = temp > 22 && temp < 42 && humidity > 35;
  const rate = inRange ? vigour : vigour * 0.15;

  return { amylaseShare: share, rate };
};

/** One tick of enzyme accumulation on a koji bed. */
export const advanceEnzymes = (
  current: EnzymeProfile | undefined,
  substrate: Ingredient | undefined,
  starter: Ingredient | undefined,
  temp: number,
  humidity: number,
  stress: number,
  progressFraction: number
): EnzymeProfile => {
  const e = current ?? { amylase: 0, protease: 0 };
  const { amylaseShare, rate } = kojiDevelopment(substrate, starter, temp, humidity, stress);

  // Secretion follows the growth curve: almost nothing during the lag phase,
  // most of it through the log phase, tailing off as the bed sporulates.
  const phase = progressFraction < 0.2
    ? 0.25
    : progressFraction < 0.85 ? 1 : 0.4;

  // Calibrated so a well-run bed develops roughly 110 units of total activity
  // over a full run. A strongly-biased strain therefore lands near 90/20 and a
  // balanced one near 55/55 — both meaningful, neither pinned to the cap.
  const step = PEAK_ACTIVITY * 0.027 * rate * phase;

  return {
    amylase: Math.min(100, e.amylase + step * amylaseShare),
    protease: Math.min(100, e.protease + step * (1 - amylaseShare)),
  };
};

/** Plain-language read of a profile, used everywhere it is displayed. */
export const describeEnzymes = (e: EnzymeProfile): { label: string; detail: string } => {
  const total = e.amylase + e.protease;
  if (total < 12) return { label: 'Barely working', detail: 'Too little activity to convert much of anything.' };
  const share = e.amylase / total;
  if (share > 0.66) return { label: 'Sweet / amylase', detail: 'Converts starch to sugar. For amazake, sweet miso and brewing.' };
  if (share < 0.34) return { label: 'Savoury / protease', detail: 'Frees amino acids from protein. For garum, shoyu and dark miso.' };
  return { label: 'Balanced', detail: 'Works on starch and protein alike. A general-purpose koji.' };
};

/**
 * The enzyme activity a batch's inputs bring to the table, weighted by how much
 * koji is in the mix. A pinch of koji in a barrel does very little; a third of
 * the mass by weight does a great deal.
 */
export const getBatchEnzymes = (
  ingredients: Ingredient[],
  quantities?: Record<string, number>
): EnzymeProfile => {
  const massOf = (i: Ingredient) =>
    quantities && quantities[i.id] !== undefined ? quantities[i.id] : i.mass;

  const totalMass = ingredients.reduce((a, i) => a + massOf(i), 0);
  if (totalMass <= 0) return { ...NO_ENZYMES };

  let amylase = 0;
  let protease = 0;
  for (const i of ingredients) {
    if (!i.enzymes) continue;
    // A koji at 20% of the mass is roughly the classic miso ratio and should
    // count as full strength; past that there are diminishing returns.
    const share = Math.min(1, (massOf(i) / totalMass) / 0.2);
    amylase += i.enzymes.amylase * share;
    protease += i.enzymes.protease * share;
  }
  return { amylase: Math.min(120, amylase), protease: Math.min(120, protease) };
};

/** Citric-acid protection carried by black koji, which shields a warm ferment. */
export const getAcidProtection = (ingredients: Ingredient[]): number =>
  ingredients.reduce((a, i) => a + (i.acidProtection ?? 0), 0);

/**
 * Mint the ingredient a finished koji cultivation becomes, carrying the enzyme
 * profile it actually developed. This is the hand-off that makes the koji loop
 * matter: what you grew decides what you can make next.
 */
export const mintKojiProduct = (
  batch: Batch,
  recipe: Recipe,
  substrate: Ingredient | undefined
): Ingredient => {
  const e = batch.enzymes ?? { amylase: 0, protease: 0 };
  const desc = describeEnzymes(e);
  const base = substrate?.name.split(' ').pop() ?? 'Grain';
  const stamp = `${Math.round(e.amylase)}/${Math.round(e.protease)}`;

  return {
    id: `koji_${substrate?.id ?? 'grain'}_a${Math.round(e.amylase / 10)}_p${Math.round(e.protease / 10)}`,
    name: `${base} Koji · ${desc.label}`,
    type: IngredientType.SUBSTRATE,
    baseCost: Math.round(20 + (e.amylase + e.protease) * 0.5),
    currency: 'money',
    quality: Math.round(Math.min(100, 55 + (e.amylase + e.protease) * 0.3)),
    description: `Your own bed, ${stamp} amylase/protease. ${desc.detail}`,
    idealFor: ['miso', 'garum', 'shoyu'],
    supplierId: 'in_house',
    tierRequired: 0,
    hiddenStats: {
      starchContent: Math.max(0, (substrate?.hiddenStats.starchContent ?? 6) - 3),
      sugarContent: (substrate?.hiddenStats.sugarContent ?? 4) + 2,
      nativeSalinity: 0,
      microbialDiversity: 8,
      fatContent: substrate?.hiddenStats.fatContent ?? 0,
      proteinContent: substrate?.hiddenStats.proteinContent ?? 3,
    },
    mass: 1000,
    unitDisplay: 'g',
    enzymes: { amylase: Math.round(e.amylase), protease: Math.round(e.protease) },
  };
};

export const isKojiRecipe = (recipe: Recipe): boolean => recipe.type === FermentType.KOJI;

import { Ingredient, IngredientType, Recipe, FermentType, Supplier, MatrixEntry, MatrixSubstrate } from './types';

/* =============================================================================
   HEDGE & UNDERSTORY — the forager

   Every other supplier sells you a commodity: a sack of barley is a sack of
   barley in March and in October. Foraged goods are not like that, and pretending
   they are is what made the pantry feel like a shop rather than a place in a
   landscape. This vendor's shelf CHANGES WITH THE MONTH.

   That is the whole point of the seasonality: it turns buying into planning. A
   maitake bought in October and cellared is a maitake you have in February, when
   nobody is selling one.
   ============================================================================= */

export const FORAGE_SUPPLIER: Supplier = {
  id: 'hedge_understory',
  name: 'Hedge & Understory',
  description: 'Two of them, a van, and a licence for the beech woods. What they have depends on what is up.',
  color: 'moss',
};

/** Months, 0-11 (Jan-Dec), as used by GameState.month. */
export const ALL_YEAR = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * Is this ingredient on the shelf this month?
 *
 * Absent `season` means always — every existing ingredient keeps working
 * untouched, which is why this is a helper rather than a required field.
 */
export const inSeason = (i: Ingredient, month: number): boolean =>
  !i.season || i.season.includes(month);

/** The next month it comes back, for the "back in October" line. */
export const nextInSeason = (i: Ingredient, month: number): number | null => {
  if (!i.season || i.season.length === 0 || i.season.length === 12) return null;
  for (let n = 1; n <= 12; n++) {
    const m = (month + n) % 12;
    if (i.season.includes(m)) return m;
  }
  return null;
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MON = MONTH_NAMES.map(m => m.slice(0, 3));

/**
 * "Sep–Nov", or "Mar–May, Sep–Nov" for a species that fruits twice. A run that
 * crosses the new year stays one run ("Nov–Mar") — each run starts at a month
 * whose predecessor is off, so December into January is never a break.
 */
export const seasonLabel = (season: number[]): string => {
  const on = new Set(season);
  if (on.size >= 12) return 'All year';
  const runs: string[] = [];
  for (let m = 0; m < 12; m++) {
    if (!on.has(m) || on.has((m + 11) % 12)) continue;
    let end = m;
    while (on.has((end + 1) % 12)) end = (end + 1) % 12;
    runs.push(end === m ? MON[m] : `${MON[m]}–${MON[end]}`);
  }
  return runs.join(', ');
};

/* -----------------------------------------------------------------------------
   THE MUSHROOMS

   Ten species, and the numbers are the species rather than a difficulty curve.
   Mushrooms are 20-30% protein on dry matter, almost no starch, a little sugar
   (mannitol and trehalose, which is why they brown), and effectively no fat — so
   they are a PROTEASE substrate. Run one under an amylase koji and you have
   wasted the koji, which is exactly the lesson the enzyme model already teaches
   with fish.

   What separates them is where they sit inside that shape:

     protein     how much umami a protease can free. Maitake is the extreme.
     starch      the little that a sweet koji can reach. Wine caps are potato-ish.
     sugar       free sugar, already sweet — lion's mane and nameko carry it.
     diversity   how much wild life comes in on the skin. Foraged is funky and
                 unpredictable; a lab-grown cordyceps is nearly sterile.

   SEASON is the real one. Enoki is literally the winter fungus and fruits in the
   cold; pink oyster is a warm-weather species that will not fruit below 18 C;
   maitake is a six-week window at the foot of an oak in autumn. Cordyceps is
   cultivated on grain in a jar, so it has no season and costs accordingly.
   --------------------------------------------------------------------------- */

const forage = (
  id: string,
  name: string,
  baseCost: number,
  quality: number,
  season: number[],
  hidden: Ingredient['hiddenStats'],
  description: string,
  idealFor: string[],
  tierRequired = 1,
): Ingredient => ({
  id,
  name,
  type: IngredientType.SUBSTRATE,
  baseCost,
  currency: 'money',
  quality,
  description,
  idealFor,
  supplierId: FORAGE_SUPPLIER.id,
  tierRequired,
  tags: ['FORAGED', 'FUNGI'],
  season,
  hiddenStats: hidden,
  mass: 500,
  unitDisplay: 'g',
});

export const FORAGED_MUSHROOMS: Ingredient[] = [
  // --- CULTIVATED, CHEAP, AVAILABLE WHEN NOTHING ELSE IS --------------------
  forage(
    'enoki', 'Enoki', 9, 62,
    [10, 11, 0, 1, 2],                                  // Nov-Mar
    { sugarContent: 2, starchContent: 1, nativeSalinity: 0, microbialDiversity: 3, fatContent: 0, proteinContent: 4 },
    'The winter fungus. Fruits in the cold and tastes of very little — which is the point: it carries whatever you ferment it with.',
    ['lacto_mushroom', 'mushroom_vinegar'],
  ),
  forage(
    'pink_oyster', 'Pink Oyster', 12, 66,
    [5, 6, 7, 8],                                       // Jun-Sep
    { sugarContent: 2, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 1, proteinContent: 6 },
    'A hot-weather species that will not fruit below eighteen degrees. Meaty, faintly of bacon, and it goes over in three days.',
    ['mushroom_miso', 'lacto_mushroom'],
  ),
  forage(
    'blue_oyster', 'Blue Oyster', 14, 70,
    [9, 10, 11, 0, 1, 2],                               // Oct-Mar
    { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 6 },
    'The cold-weather oyster. Denser than the pink and faintly of aniseed; the cool months are when it is worth having.',
    ['mushroom_miso', 'mushroom_shoyu'],
  ),

  // --- THE WORKING MIDDLE ---------------------------------------------------
  forage(
    'king_stropharia', 'King Stropharia', 18, 72,
    [4, 5, 6, 7, 8, 9],                                 // May-Oct
    { sugarContent: 2, starchContent: 3, nativeSalinity: 0, microbialDiversity: 7, fatContent: 0, proteinContent: 5 },
    'Wine cap. Grows in wood chip, eats like a potato and carries more starch than any other mushroom here — the one that rewards a sweet koji.',
    ['mushroom_miso', 'mushroom_shoyu'],
  ),
  forage(
    'shimeji', 'Shimeji', 20, 74,
    [8, 9, 10, 11],                                     // Sep-Dec
    { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 6 },
    'Beech mushroom. Unpleasantly bitter raw and nutty once it is cooked or cured — the bitterness is the thing fermentation takes away.',
    ['mushroom_miso', 'mushroom_garum'],
  ),
  forage(
    'nameko', 'Nameko', 24, 78,
    [9, 10, 11, 0, 1],                                  // Oct-Feb
    { sugarContent: 3, starchContent: 2, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 5 },
    'Comes up under a gelatinous coat that never quite washes off. Glutamate-rich, and the slime holds the brine against the cap.',
    ['mushroom_miso', 'lacto_mushroom'],
  ),
  forage(
    'black_poplar', 'Black Poplar', 28, 80,
    [2, 3, 4, 8, 9, 10],                                // Mar-May and Sep-Nov
    { sugarContent: 1, starchContent: 2, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 7 },
    'Pioppino. Twice a year on poplar and willow stumps, spring and autumn. Firm enough to hold its shape through a long ferment.',
    ['mushroom_shoyu', 'mushroom_garum'],
  ),

  // --- THE PRIZES -----------------------------------------------------------
  forage(
    'lions_mane', "Lion's Mane", 32, 84,
    [8, 9, 10],                                         // Sep-Nov
    { sugarContent: 3, starchContent: 2, nativeSalinity: 0, microbialDiversity: 4, fatContent: 1, proteinContent: 5 },
    'A white beard on a wounded beech. Sweeter than any other mushroom here and startlingly like crab — a substrate that wants a light hand.',
    ['mushroom_miso', 'mushroom_vinegar'],
    2,
  ),
  forage(
    'maitake', 'Maitake', 46, 88,
    [8, 9, 10],                                         // Sep-Nov
    { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 7, fatContent: 0, proteinContent: 8 },
    'Hen of the woods, at the foot of the same oak every autumn for thirty years. The most protein of any mushroom on this shelf, and it shows.',
    ['mushroom_garum', 'mushroom_shoyu'],
    2,
  ),
  forage(
    'cordyceps', 'Cordyceps', 95, 90,
    ALL_YEAR,                                           // grown in a jar; no season
    { sugarContent: 2, starchContent: 1, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 7 },
    'Grown on grain in a sealed jar rather than found, so it comes in clean and comes in all year. You pay for both.',
    ['mushroom_garum'],
    3,
  ),
];

/** Every id the matrix should treat as "a mushroom", including the two that already existed. */
export const MUSHROOM_IDS = [
  ...FORAGED_MUSHROOMS.map(m => m.id),
  'ceps',            // Wild Ceps (Porcini) — already in the game
  'winter_ceps',     // Winter Black Trumpet — already in the game
];

/* -----------------------------------------------------------------------------
   THE FERMENTS

   One entry per PROCESS, not per species. Ten mushroom misos would be ten matrix
   entries competing to match the same shape, and the matrix is first-match-wins —
   that is how black garlic got swallowed by black_apple. The substrate family
   does the work instead, and the difference between a maitake miso and an enoki
   miso comes out of the physics, because their stats are genuinely different.
   --------------------------------------------------------------------------- */

export const FORAGE_RECIPES: Recipe[] = [
  {
    id: 'mushroom_miso',
    name: 'Mushroom Miso',
    type: FermentType.MISO,
    description: 'Fungi are a protein substrate with almost no starch, so a protease koji does nearly all of the work and an amylase one is wasted. What comes out tastes of the species you put in.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
    outputIngredientId: 'mushroom_miso_jar',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 180,
    peakWindowStart: 86, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 22, humidity: 60, salinity: 7 },
    idealFlavorProfile: { umami: 80, acidity: 20, funk: 50, sweetness: 24, safety: 100 },
    difficulty: 3,
  },
  {
    id: 'mushroom_shoyu',
    name: 'Mushroom Shoyu',
    type: FermentType.SHOYU,
    description: 'A moromi with fungi in place of the soy. It is stirred rather than left — kai-ire, the same as any shoyu — and the mash stratifies just as readily.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
    outputIngredientId: 'mushroom_shoyu_bottle',
    requiredVesselId: 'oak_cask',
    baseDurationSeconds: 225,
    peakWindowStart: 88, peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 24, humidity: 65, salinity: 13 },
    idealFlavorProfile: { umami: 86, acidity: 28, funk: 54, sweetness: 18, safety: 100 },
    difficulty: 4,
  },
  {
    id: 'mushroom_garum',
    name: 'Mushroom Garum',
    type: FermentType.GARUM,
    description: 'The modern route: hold it near sixty and let koji proteases run flat out. Nothing establishes at that temperature, so the salt is there for flavour rather than for safety.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
    outputIngredientId: 'mushroom_garum_bottle',
    requiredVesselId: 'incubator',
    baseDurationSeconds: 150,
    peakWindowStart: 84, peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 60, humidity: 70, salinity: 4 },
    idealFlavorProfile: { umami: 88, acidity: 22, funk: 38, sweetness: 24, safety: 98 },
    difficulty: 4,
  },
  {
    id: 'lacto_mushroom',
    name: 'Lacto-Fermented Mushrooms',
    type: FermentType.LACTO,
    description: 'Two percent salt, under the brine, shut. The wild life already on the cap does it — which is why a foraged mushroom sours differently from a cultivated one.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'lacto_mushroom_jar',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 95,
    peakWindowStart: 78, peakWindowEnd: 94,
    activeIntervention: 'Clean',
    idealParams: { temp: 20, humidity: 60, salinity: 2 },
    idealFlavorProfile: { umami: 52, acidity: 74, funk: 42, sweetness: 12, safety: 98 },
    difficulty: 2,
  },
  {
    id: 'mushroom_vinegar',
    name: 'Mushroom Vinegar',
    type: FermentType.VINEGAR,
    description: 'Sugar to alcohol, alcohol to acid, and the second stage needs air the whole way. Seal it and it simply stops, which is the mistake everyone makes once.',
    requiredIngredients: { substrate: true, starter: null, additive: 'water' },
    outputIngredientId: 'mushroom_vinegar_bottle',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 190,
    peakWindowStart: 84, peakWindowEnd: 100,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 24, humidity: 65, salinity: 0 },
    idealFlavorProfile: { umami: 46, acidity: 88, funk: 44, sweetness: 12, safety: 100 },
    difficulty: 3,
  },
];

/* -----------------------------------------------------------------------------
   MATRIX ENTRIES

   ORDER IS LOAD-BEARING and these are the broad end of it, so constants.ts puts
   them after every existing specific entry — and above the barley_koji
   catch-all, which stays last. Checked against the existing table rather than
   assumed:

   - `lacto_ceps` (ceps + salt, MASON JAR) keeps winning for a jar of ceps, and
     `lacto_mushroom` is an ONGGI, so the two coexist rather than collide — a cep
     can be soured either way, which is true of a cep.
   - The three `{kind:'any'}` entries all require a token these substrates do not
     carry: tears_garum needs tears, doenjang needs a meju block, chili_mash
     needs chili. None of them reach a mushroom.
   - The `{kind:'present'}` entries likewise: makgeolli needs nuruk, nukazuke
     needs rice bran.
   - No existing entry claims cedar_barrel + koji + salt, oak_cask + koji + salt
     or incubator + koji + salt without a soybean or a named fish.
   - Tokens are SUBSTRING tests — the resolver's `hasId` is `id.includes(token)`
     — so a new id must not contain an existing token by accident. None of
     these do.
   --------------------------------------------------------------------------- */

const MUSHROOM: MatrixSubstrate = { kind: 'oneOf', ids: MUSHROOM_IDS, label: 'Any mushroom' };

export const FORAGE_MATRIX: MatrixEntry[] = [
  { recipeId: 'mushroom_garum',   substrate: MUSHROOM, requires: ['koji', 'salt'], vesselId: 'incubator' },
  // A shoyu is a wet brine mash and a miso is dry-packed — the same distinction
  // tamari and moromi draw with water. Without it this ran undiluted and outscored
  // every soy shoyu in the game by fifteen to twenty-five points.
  { recipeId: 'mushroom_shoyu',   substrate: MUSHROOM, requires: ['koji', 'salt', 'water'], vesselId: 'oak_cask' },
  { recipeId: 'mushroom_miso',    substrate: MUSHROOM, requires: ['koji', 'salt'], vesselId: 'cedar_barrel' },
  // Acetobacter will not work in a brine, and a koji mash is a miso's shape, not
  // a vinegar's. Without these forbids a salted koji mash with water in it
  // resolved as vinegar — measured, 340 combinations, before this line.
  { recipeId: 'mushroom_vinegar', substrate: MUSHROOM, requires: ['water'],        forbids: ['salt', 'koji'], vesselId: 'cedar_barrel' },
  { recipeId: 'lacto_mushroom',   substrate: MUSHROOM, requires: ['salt'],         forbids: ['koji', 'spores'], vesselId: 'onggi' },
];

import { Ingredient, IngredientType, Recipe, FermentType, MatrixEntry, MatrixSubstrate, Vessel } from './types';

/* =============================================================================
   THE SOIL LAB — FERMENTING FERTILITY

   The lab has always thrown things away: press cake, lees, a spoiled batch,
   the trimmings from a crate of fish. The estate throws things away too: the
   haulm of a finished bed, windfalls, prunings, eggshells, the tips pinched off
   a tomato. Here they are ingredients. A corner of the bench turns them into
   the things a farm is fed with — hot compost, bokashi, the Korean Natural
   Farming preparations (plant and fruit juices, fish amino acid, water-soluble
   calcium, lactic serum, indigenous microorganisms), activated EM and aerated
   compost tea — and those go back out onto the land, which grows the next
   crate of tomatoes. The whole loop: grow, ferment, waste, soil, better crops,
   better ferments.

   Everything here is a batch on the bench like any other, in a vessel, with a
   clock and controls — but its physics is its own (services/soil.ts): heat,
   air and acid rather than umami and funk. Only the black soldier fly bins and
   the worm towers live outside, in the shed on the estate.

   THE MATRIX RULE THAT KEEPS THIS SAFE. Every soil entry needs an ingredient
   that exists only for the soil lab (a waste stream, a soil product, leaf
   mould, rice rinse, EM starter, molasses or wine vinegar), so no combination
   the game already knew can resolve differently. They sit at the TOP of the
   matrix because they are the most specific entries in it.

   Ids are chosen against the substring-token trap: none contains salt, sugar,
   koji, water, honey, chili, wheat, spores or any other matrix token.
   ============================================================================= */

export const SOIL_TYPE = FermentType.SOIL;

const waste = (id: string, name: string, description: string, hs: Partial<Ingredient['hiddenStats']> = {}, type = IngredientType.SUBSTRATE): Ingredient => ({
  id, name, type, baseCost: 0, currency: 'money', quality: 60, description, idealFor: [],
  supplierId: 'estate', tierRequired: 0, tags: ['WASTE'],
  hiddenStats: { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, ...hs },
  mass: 1000, unitDisplay: 'kg',
});

/** What the lab and the estate throw off. Never bought: made by working. */
export const WASTE_INGREDIENTS: Ingredient[] = [
  waste('green_waste', 'Green Waste', 'Haulm, leaves and trimmings from the beds. Nitrogen and water.', { sugarContent: 2, proteinContent: 2 }),
  waste('straw', 'Straw', 'Baled off the grain strips. Carbon, and the mulch you would otherwise buy.', { sugarContent: 0, starchContent: 1, proteinContent: 0 }),
  waste('green_tips', 'Green Tips', 'Side-shoots pinched off the tomatoes, nettle tops, the growing points of things. The raw stuff of plant juice.', { sugarContent: 2, proteinContent: 3 }),
  waste('prunings', 'Prunings', 'Winter wood off the fruit trees. Slow carbon.', { sugarContent: 0, starchContent: 2, proteinContent: 0 }),
  waste('eggshells', 'Eggshells', 'Saved from the hen run, roasted until they crumble. Nearly pure calcium carbonate.', { sugarContent: 0, starchContent: 0, proteinContent: 1 }),
  waste('windfalls', 'Windfalls', 'Bruised fruit off the orchard floor and the tail of a picking. Sugar and wild yeast.', { sugarContent: 7, innateAcidity: 3, microbialDiversity: 8 }),
  waste('fish_waste', 'Fish Waste', 'Heads, frames and guts from the fish counter and the harbour.', { sugarContent: 0, proteinContent: 8, fatContent: 5 }),
  waste('veg_waste', 'Vegetable Waste', 'What a spoiled or discarded batch leaves behind, and the peelings.', { sugarContent: 3, proteinContent: 2 }),
  waste('press_cake', 'Press Cake', 'The solids left in the press: fibre, protein and the salt that went in with them.', { sugarContent: 1, proteinContent: 5, nativeSalinity: 3 }),
  waste('spent_grain', 'Spent Grain', 'Grain a mash has finished with. Protein and fibre.', { sugarContent: 1, starchContent: 3, proteinContent: 4 }),
  waste('rice_rinse', 'Rice Rinse', 'The cloudy water from washing rice for the koji and the mash, kept in a jar to sour. The start of a lactic serum.', { sugarContent: 1, starchContent: 2, microbialDiversity: 7 }, IngredientType.ADDITIVE),
];

const bought = (id: string, name: string, supplierId: string, baseCost: number, quality: number, type: IngredientType, description: string, hs: Partial<Ingredient['hiddenStats']> = {}): Ingredient => ({
  id, name, type, baseCost, currency: 'money', quality, description, idealFor: [],
  supplierId, tierRequired: 1, tags: ['SOIL'],
  hiddenStats: { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 0, ...hs },
  mass: 1000, unitDisplay: 'kg',
});

/** The few things the soil lab buys in. */
export const SOIL_SUPPLIES: Ingredient[] = [
  bought('molasses', 'Blackstrap Molasses', 'nordic', 8, 70, IngredientType.ADDITIVE, 'The last of the sugar cane, black and mineral. Food for a microbial brew.', { sugarContent: 8 }),
  bought('em_starter', 'EM-1 Starter', 'biolab', 22, 80, IngredientType.STARTER, 'Effective microorganisms: lactic bacteria, yeast and phototrophs in a bottle. Woken with molasses before use.', { microbialDiversity: 7 }),
  bought('wine_vinegar', 'Wine Vinegar', 'prime', 6, 60, IngredientType.ADDITIVE, 'Plain vinegar for dissolving eggshell. Your own vinegar does the same job.', { innateAcidity: 9 }),
  { ...bought('leaf_mould', 'Leaf Mould', 'hedge_understory', 4, 75, IngredientType.STARTER, 'A bag of the white-threaded litter from under the beeches: the wood’s own microbes, for an IMO box.', { microbialDiversity: 10 }), tags: ['SOIL', 'FORAGED'] },
];

const product = (id: string, name: string, description: string, type = IngredientType.ADDITIVE): Ingredient => ({
  id, name, type, baseCost: 0, currency: 'money', quality: 80, description, idealFor: [],
  supplierId: 'estate', tierRequired: 0, tags: ['SOIL'],
  hiddenStats: { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 1 },
  mass: 1000, unitDisplay: 'kg',
});

/** What the soil lab and the shed make, for the land. Graded like produce: the id carries the strength. */
export const SOIL_PRODUCT_INGREDIENTS: Ingredient[] = [
  product('compost', 'Hot Compost', 'Waste that reached sixty degrees and cured: slow food for the soil and a home for its life.'),
  product('bokashi', 'Bokashi', 'Waste pickled with bran and EM in a sealed bucket. Dug into a bed, it is fast food for the soil.'),
  product('worm_castings', 'Worm Castings', 'The richest thing you can put on a bed. From the worm towers in the shed.'),
  product('fly_frass', 'Fly Frass', 'What the soldier fly larvae leave: nitrogen, and chitin that wakes a plant’s defences.'),
  product('fpj', 'Fermented Plant Juice', 'Growing tips in brown sugar, drawn for a week. A spoonful in a can of water pushes a young crop along.'),
  product('ffj', 'Fermented Fruit Juice', 'Fruit in sugar, drawn for a week. Fed as a crop ripens, it sweetens what it makes.'),
  product('faa', 'Fish Amino Acid', 'Fish waste and sugar, a month in a crock. Nitrogen a plant can use today.'),
  product('wca', 'Water-Soluble Calcium', 'Roasted eggshell dissolved in vinegar. Stops blossom-end rot and firms fruit.'),
  product('lab_serum', 'LAB Serum', 'Lactic bacteria grown in rice rinse and milk. Aphids, rust and bad smells do not like it.'),
  product('imo', 'IMO', 'Indigenous microorganisms: the wood’s own culture, caught on rice and multiplied. Life for a tired soil.'),
  product('em_active', 'Activated EM', 'EM woken with molasses until it smells sweet-sour. Inoculates soil and bokashi.'),
  product('compost_tea', 'Compost Tea', 'Compost brewed with air for a day and a half: a living coat for leaves against blight and mildew. Use it within two days.'),
];

export const SOIL_INGREDIENTS: Ingredient[] = [...WASTE_INGREDIENTS, ...SOIL_SUPPLIES, ...SOIL_PRODUCT_INGREDIENTS];
export const WASTE_IDS = WASTE_INGREDIENTS.map(i => i.id);
export const SOIL_PRODUCT_IDS = SOIL_PRODUCT_INGREDIENTS.map(i => i.id);

/* -----------------------------------------------------------------------------
   THE VESSELS
   --------------------------------------------------------------------------- */
export const SOIL_VESSELS: Vessel[] = [
  { id: 'bokashi_bucket', name: 'Bokashi Bucket', slotsRequired: 1, powerDraw: 0, cost: 45, capacityL: 20, insulationFactor: 0.3,
    description: 'A twenty-litre bucket with a tight lid and a tap at the foot for the leachate. It must stay shut.', idealFor: [FermentType.SOIL] },
  { id: 'compost_bin', name: 'Hot Compost Bin', slotsRequired: 4, powerDraw: 0, cost: 180, capacityL: 200, insulationFactor: 0.75,
    description: 'An insulated two-hundred-litre bin on the floor. Filled right, it runs at sixty degrees for days on its own heat.', idealFor: [FermentType.SOIL] },
  { id: 'em_drum', name: 'EM Drum', slotsRequired: 2, powerDraw: 0, cost: 40, capacityL: 25, insulationFactor: 0.4,
    description: 'A dark jerrycan with an airlock. EM wants warmth, no light and no air.', idealFor: [FermentType.SOIL] },
  { id: 'tea_brewer', name: 'Compost Tea Brewer', slotsRequired: 1, powerDraw: 15, cost: 95, capacityL: 20, insulationFactor: 0.2,
    description: 'A bucket, a mesh bag and an aquarium pump. Air all the way through, or it turns.', idealFor: [FermentType.SOIL] },
];

/* -----------------------------------------------------------------------------
   THE RECIPES
   Durations are bench ticks (three hours each). The profile fields a recipe has
   to carry are unused here — soil batches are judged by their own physics.
   --------------------------------------------------------------------------- */
const blank = { umami: 0, acidity: 0, funk: 0, sweetness: 0, safety: 100 };
const soil = (id: string, name: string, description: string, output: string, ticks: number, peak: [number, number], temp: number, difficulty = 1): Recipe => ({
  id, name, type: FermentType.SOIL, description,
  requiredIngredients: { substrate: true, starter: null, additive: null },
  outputIngredientId: output,
  baseDurationSeconds: ticks,
  peakWindowStart: peak[0], peakWindowEnd: peak[1],
  idealParams: { temp, humidity: 60, salinity: 0 },
  idealFlavorProfile: blank,
  difficulty,
});

export const SOIL_RECIPES: Recipe[] = [
  soil('hot_compost', 'Hot Compost', 'Greens and browns in an insulated bin, turned when it cools. It must reach fifty-five degrees for three days to kill the weed seed and the pathogens, then cure.', 'compost', 224, [85, 400], 60, 2),
  soil('cold_heap', 'Cold Heap', 'Waste left in a vessel to rot on its own. It gets there in the end — slowly, cold, and with every weed seed alive.', 'compost', 400, [95, 600], 20, 1),
  soil('bokashi', 'Bokashi', 'Waste packed down with bran and EM in a sealed bucket. Pickled, not rotted: it should smell of cider, never of a bin.', 'bokashi', 112, [90, 400], 25, 1),
  soil('fpj', 'Fermented Plant Juice', 'Growing tips layered with an equal weight of sugar under a cloth. A week draws the juice out; longer and it turns to wine.', 'fpj', 56, [80, 125], 22, 1),
  soil('ffj', 'Fermented Fruit Juice', 'Windfalls with an equal weight of sugar under a cloth, drawn for a week.', 'ffj', 64, [80, 125], 22, 1),
  soil('faa', 'Fish Amino Acid', 'Fish waste with its weight in brown sugar in a crock, a month in the warm. The oil rises; the amber below is the feed.', 'faa', 240, [80, 400], 25, 2),
  soil('wca', 'Water-Soluble Calcium', 'Roasted eggshell under ten times its weight of vinegar. It fizzes; when the fizzing stops it is done.', 'wca', 64, [90, 400], 22, 1),
  soil('lab_serum', 'LAB Serum', 'Soured rice rinse into ten parts milk. The curd floats; the yellow serum below is lactic bacteria by the billion.', 'lab_serum', 40, [85, 130], 25, 1),
  soil('imo', 'Indigenous Microorganisms', 'Cooked rice in a cedar box with a handful of the wood’s leaf mould under a paper lid. White threads are the good ones.', 'imo', 32, [80, 115], 30, 2),
  soil('em_active', 'Activated EM', 'EM starter woken with molasses in warm water, sealed under an airlock until it smells sweet and sour.', 'em_active', 64, [90, 260], 32, 1),
  soil('compost_tea', 'Aerated Compost Tea', 'Compost in a mesh bag in water with molasses, bubbled hard for a day and a half. Stop the air and it goes anaerobic within hours.', 'compost_tea', 10, [80, 140], 22, 1),
];

/* -----------------------------------------------------------------------------
   THE MATRIX ENTRIES: at the top of RECIPE_MATRIX, most specific first
   --------------------------------------------------------------------------- */
const oneOf = (ids: string[], label: string): MatrixSubstrate => ({ kind: 'oneOf', ids, label });
// Eggshells are here as well as in the calcium: without them, eggshells on a
// koji tray fell through to the barley-koji catch-all.
const COMPOSTABLE = oneOf(['green_waste', 'straw', 'prunings', 'windfalls', 'veg_waste', 'press_cake', 'spent_grain', 'green_tips', 'fish_waste', 'eggshells'], 'Any waste from the lab or the land');

export const SOIL_MATRIX: MatrixEntry[] = [
  { recipeId: 'compost_tea', substrate: { kind: 'any' }, requires: ['compost', 'molasses', 'water'], forbids: ['compost_tea'], vesselId: 'tea_brewer' },
  { recipeId: 'em_active',   substrate: { kind: 'any' }, requires: ['em_starter', 'molasses', 'water'], forbids: ['rice_bran'], vesselId: 'em_drum' },
  { recipeId: 'bokashi',     substrate: COMPOSTABLE, requires: ['rice_bran', 'em_starter'], vesselId: 'bokashi_bucket' },
  { recipeId: 'hot_compost', substrate: COMPOSTABLE, requires: [], vesselId: 'compost_bin' },
  { recipeId: 'faa',         substrate: { kind: 'is', id: 'fish_waste' }, requires: ['sugar'], forbids: ['rice_bran'], vesselId: null },
  { recipeId: 'fpj',         substrate: { kind: 'is', id: 'green_tips' }, requires: ['sugar'], vesselId: null },
  { recipeId: 'ffj',         substrate: { kind: 'is', id: 'windfalls' }, requires: ['sugar'], vesselId: null },
  { recipeId: 'wca',         substrate: { kind: 'is', id: 'eggshells' }, requires: ['vinegar'], vesselId: null },
  { recipeId: 'lab_serum',   substrate: { kind: 'is', id: 'raw_milk' }, requires: ['rice_rinse'], vesselId: null },
  { recipeId: 'imo',         substrate: { kind: 'is', id: 'glutinous_rice' }, requires: ['leaf_mould'], vesselId: 'koji_tray' },
  // Anything else that is waste, anywhere else, rots on its own: a cold heap.
  { recipeId: 'cold_heap',   substrate: COMPOSTABLE, requires: [], vesselId: null },
];

/* -----------------------------------------------------------------------------
   WHAT EACH PRODUCT DOES ON THE LAND
   `perM2` is the dose at standard strength (grade 80); a stronger batch goes
   further. `lasts` marks a treatment that works for a while on the leaves;
   `key` is the name the growth model reads it by.
   --------------------------------------------------------------------------- */
export interface SoilEffect {
  id: string;
  perM2: number;
  fertility?: number;
  life?: number;
  lasts?: number;
  key?: string;
  about: string;
}

export const SOIL_EFFECTS: Record<string, SoilEffect> = {
  compost: { id: 'compost', perM2: 2, fertility: 18, life: 10, about: 'Slow food for the soil and a home for its life.' },
  bokashi: { id: 'bokashi', perM2: 1, fertility: 25, life: 8, about: 'Pickled waste, dug in: fast food for the soil.' },
  worm_castings: { id: 'worm_castings', perM2: 0.6, fertility: 12, life: 16, about: 'The richest thing you can put on a bed.' },
  fly_frass: { id: 'fly_frass', perM2: 0.4, fertility: 15, life: 6, about: 'Nitrogen, and chitin that wakes a plant’s defences.' },
  imo: { id: 'imo', perM2: 0.2, life: 22, about: 'The wood’s own microbes, multiplied.' },
  em_active: { id: 'em_active', perM2: 0.05, life: 10, about: 'A ready-made soil culture.' },
  faa: { id: 'faa', perM2: 0.02, fertility: 12, about: 'Nitrogen a plant can use today.' },
  fpj: { id: 'fpj', perM2: 0.01, lasts: 14, key: 'fpj', about: 'Pushes a young crop along.' },
  ffj: { id: 'ffj', perM2: 0.01, lasts: 14, key: 'ffj', about: 'Sweetens what is ripening.' },
  wca: { id: 'wca', perM2: 0.01, lasts: 21, key: 'wca', about: 'Stops blossom-end rot.' },
  lab_serum: { id: 'lab_serum', perM2: 0.01, lasts: 14, life: 3, key: 'lab', about: 'Aphids and rust do not like it.' },
  compost_tea: { id: 'compost_tea', perM2: 0.1, lasts: 14, life: 4, key: 'act', about: 'A living coat on the leaves against blight and mildew.' },
};

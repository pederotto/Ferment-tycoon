import { Ingredient, IngredientType, Recipe, FermentType, MatrixEntry, MatrixSubstrate } from './types';
import { FORAGE_SUPPLIER } from './constants.forage';

/* =============================================================================
   THE MARKET — fruit, honey and the fish counter

   Fruit is picked, so all of it is seasonal; what differs is WHO picks it. The
   hedge fruit — cloudberry, sea buckthorn, haskap, the woodland white
   strawberry — comes off the forager's van. The rest is grown or shipped:
   Prime's produce side has the pineberries, finger limes and black sapote, and
   Silk Road the Asian citrus and the akebi. An import still has a season. It is
   simply someone else's.

   The fish counter is cured and dried stock, which keeps, so it has none.
   ============================================================================= */

const NORDIC = 'nordic';
const PRIME = 'prime';
const SILK = 'asia_import';

const fruit = (
  id: string, name: string, supplierId: string, baseCost: number, quality: number, season: number[],
  hiddenStats: Ingredient['hiddenStats'], description: string, idealFor: string[], tier = 1,
): Ingredient => ({
  id,
  name,
  type: IngredientType.SUBSTRATE,
  baseCost,
  currency: 'money',
  quality,
  description,
  idealFor,
  supplierId,
  tierRequired: tier,
  tags: supplierId === FORAGE_SUPPLIER.id ? ['FORAGED', 'FRUIT'] : ['FRUIT'],
  season,
  hiddenStats,
  mass: 500,
  unitDisplay: 'g',
});

/* -----------------------------------------------------------------------------
   FRUIT

   Sugar-dominant, effectively no protein, and the number that actually matters
   is microbialDiversity: the yeast is already on the skin. That is why a wild
   berry ferments without a starter and a supermarket strawberry sulks.

   Seasons are the real ones. Haskap is the first fruit of the year, weeks ahead
   of the strawberries; cloudberry is three weeks on a bog in July; sea
   buckthorn is stripped after the first frost and is the only fruit here with
   real oil in it, which is why it is the one that can go rancid. The imports
   follow their own hemispheres — a finger lime arrives in our winter.
   --------------------------------------------------------------------------- */

export const FRUIT: Ingredient[] = [
  // --- off the forager's van ---
  fruit('haskap', 'Haskap Berries', FORAGE_SUPPLIER.id, 22, 78, [5, 6],             // Jun-Jul
    { sugarContent: 7, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1 },
    'Honeyberry, off a boreal honeysuckle. The first fruit of the year, weeks ahead of the strawberries, and tart enough to carry a ferment on its own.',
    ['fruit_mead', 'fruit_kombucha', 'brined_fruit']),

  fruit('cloudberries', 'Cloudberries', FORAGE_SUPPLIER.id, 58, 90, [6, 7],         // Jul-Aug
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 7, fatContent: 0, proteinContent: 1 },
    'Three weeks on a bog, and the pickers do not say where. Amber, musky, and priced like it.',
    ['fruit_mead', 'brined_fruit'], 2),

  fruit('sea_buckthorn', 'Sea Buckthorn', FORAGE_SUPPLIER.id, 26, 84, [8, 9, 10],   // Sep-Nov
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 2, proteinContent: 1 },
    'Stripped off the thorns after the first frost. The only fruit on the van with oil in it — which means it is the only one that can turn rancid.',
    ['fruit_vinegar', 'fruit_kombucha']),

  fruit('white_strawberry', 'Alpine White Strawberry', FORAGE_SUPPLIER.id, 30, 82, [5, 6, 7], // Jun-Aug
    { sugarContent: 8, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 0 },
    'Fraises des bois, the pale kind, from the woodland edge. More sugar than anything else here, so it makes the strongest ferment and the shortest window.',
    ['fruit_mead', 'fruit_kombucha', 'country_wine'], 2),

  // --- grown, from Prime's produce side ---
  fruit('pineberry', 'Pineberries', PRIME, 24, 76, [5, 6],                          // Jun-Jul
    { sugarContent: 7, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0 },
    'A cultivated white strawberry with red seeds, named for the faint pineapple in it. Fragile — it ferments before you have decided to.',
    ['brined_fruit', 'fruit_kombucha']),

  fruit('black_sapote', 'Black Sapote', PRIME, 20, 72, [11, 0, 1, 2],               // Dec-Mar
    { sugarContent: 6, starchContent: 1, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1 },
    'Green outside, black inside. It tastes of very little until it is so ripe it looks spoiled — and then of chocolate pudding.',
    ['country_wine', 'fruit_kombucha']),

  fruit('finger_limes', 'Finger Limes', PRIME, 60, 88, [11, 0, 1, 2, 3, 4],         // Dec-May
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1 },
    'Citrus caviar: cut one and the juice spills out as beads. From the Australian rainforest, so its season is our winter.',
    ['ponzu', 'brined_fruit'], 2),

  // --- shipped, from Silk Road ---
  fruit('yuzu', 'Yuzu', SILK, 34, 86, [10, 11, 0],                                  // Nov-Jan
    { sugarContent: 3, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1 },
    'Seedy, knobbly and sour, picked in the cold months. The aroma is worth more than the juice, and the aroma is in the peel.',
    ['ponzu', 'fruit_vinegar'], 2),

  fruit('calamansi', 'Calamansi Limes', SILK, 18, 74, [7, 8, 9, 10],                // Aug-Nov
    { sugarContent: 3, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1 },
    'The Philippine lime — orange inside a green skin, and sourer than either. Cheap, and the workhorse of the citrus shelf.',
    ['ponzu', 'brined_fruit']),

  fruit('buddhas_hand', "Buddha's Hand", SILK, 26, 80, [10, 11, 0],                 // Nov-Jan
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 3, fatContent: 0, proteinContent: 1 },
    'A citron with no flesh and no juice — fingers of pith and zest. It is the scent you ferment, never the fruit.',
    ['ponzu']),

  fruit('akebi', 'Akebi', SILK, 32, 78, [8, 9],                                     // Sep-Oct
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1 },
    'A purple pod off a Japanese mountain vine that splits itself open when it is ripe. The pulp is sweet and bland; the skin is bitter, and is the part worth keeping.',
    ['brined_fruit', 'country_wine'], 2),
];

/* Honey is not foraged and not seasonal — it is the one substrate that keeps
   indefinitely, because it is too dry and too acidic for anything to live in.
   That is also why a mead needs water: undiluted, nothing ferments at all. */
export const APIARY: Ingredient[] = [
  {
    id: 'honey', name: 'Raw Wildflower Honey', type: IngredientType.ADDITIVE,
    baseCost: 28, currency: 'money', quality: 85,
    description: 'Too dry and too acidic for anything to live in, which is why it never spoils — and why a mead will not start until you have watered it down.',
    idealFor: ['fruit_mead'], supplierId: NORDIC, tierRequired: 1,
    hiddenStats: { sugarContent: 10, starchContent: 0, nativeSalinity: 0, microbialDiversity: 1, fatContent: 0, proteinContent: 0 },
    mass: 1000, unitDisplay: 'kg',
  },
];

/* -----------------------------------------------------------------------------
   THE FISH COUNTER

   Cured, dried and smoked stock — protein already concentrated, and in the eel
   and the anchovy a great deal of fat, which is what the rancidity model is
   about. None of these has a named recipe of its own: fish, koji and salt in an
   incubator is the modern garum route, and the generated recipe already names
   the result after the fish, so an Eel Garum needs no entry in the matrix.

   Shiokara and yu-jang are finished condiments, sold as additives: a spoonful
   carries salt, protein and a live culture into a kimchi or a mash the way
   jeotgal always has.
   --------------------------------------------------------------------------- */

const fish = (
  id: string, name: string, supplierId: string, baseCost: number, quality: number,
  hiddenStats: Ingredient['hiddenStats'], description: string, idealFor: string[],
  extra: Partial<Ingredient> = {},
): Ingredient => ({
  id,
  name,
  type: IngredientType.SUBSTRATE,
  baseCost,
  currency: 'money',
  quality,
  description,
  idealFor,
  supplierId,
  tierRequired: 1,
  tags: ['SEAFOOD'],
  hiddenStats,
  mass: 500,
  unitDisplay: 'g',
  ...extra,
});

export const FISH_COUNTER: Ingredient[] = [
  fish('niboshi', 'Niboshi', SILK, 16, 74,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 2, microbialDiversity: 2, fatContent: 2, proteinContent: 8 },
    "Dried baby sardines, the base of a fisherman's dashi. Already concentrated, so there is more protein per gram here than in anything fresh.",
    ['garum']),

  fish('smoked_eel', 'Smoked Eel', PRIME, 48, 84,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 2, microbialDiversity: 2, fatContent: 6, proteinContent: 6 },
    'Hot-smoked, so it comes in cooked and clean. Eel is among the fattiest fish there is — the one most likely to turn rancid under a skin, and the richest if it does not.',
    ['garum'], { tierRequired: 2 }),

  fish('anchovy_fillets', 'Salt-Cured Anchovy', PRIME, 30, 82,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 6, microbialDiversity: 2, fatContent: 4, proteinContent: 7 },
    'Fillets salted for months and packed under oil, so half the work of a colatura is done before you open the tin. The oil floats, and oil at the surface is what turns.',
    ['garum']),

  fish('surimi', 'White Fish Surimi', SILK, 14, 66,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 1, microbialDiversity: 1, fatContent: 1, proteinContent: 7 },
    'Washed and pressed white fish — the soluble proteins rinsed out and sugar folded in to see it through the freezer. Clean, lean and characterless, which is the point.',
    ['garum']),

  fish('shiokara', 'Shiokara', SILK, 22, 70,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 8, microbialDiversity: 6, fatContent: 2, proteinContent: 6 },
    'Squid in its own salted viscera, already fermenting when it arrives. A spoonful seasons a pot the way a fish sauce does, and brings its microbes with it.',
    ['kimchi', 'garum'], { type: IngredientType.ADDITIVE, mass: 250 }),

  fish('yu_jang', 'Yu-jang', SILK, 20, 68,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 7, microbialDiversity: 5, fatContent: 1, proteinContent: 5 },
    'A fermented paste of salted fish and soy, pounded smooth. It carries salt, protein and a live culture into whatever it is stirred through.',
    ['kimchi', 'miso'], { type: IngredientType.ADDITIVE, mass: 250 }),
];

export const MARKET_INGREDIENTS: Ingredient[] = [...FRUIT, ...APIARY, ...FISH_COUNTER];

/* Families, as explicit lists so a matcher cannot widen by accident. */
export const FRUIT_IDS = FRUIT.map(i => i.id);
export const CITRUS_IDS = ['yuzu', 'calamansi', 'finger_limes', 'buddhas_hand'];

export const MARKET_RECIPES: Recipe[] = [
  {
    id: 'fruit_mead',
    name: 'Fruit Mead',
    type: FermentType.ALCOHOL,
    description: 'Honey will not ferment until it is watered — undiluted it is too dry for yeast to live in. The fruit brings the yeast and the acid; the honey brings everything else.',
    requiredIngredients: { substrate: true, starter: null, additive: 'honey' },
    outputIngredientId: 'mead_bottle',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 200,
    peakWindowStart: 82, peakWindowEnd: 100,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 18, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 2, acidity: 64, funk: 30, sweetness: 62, safety: 98 },
    difficulty: 3,
  },
  {
    id: 'country_wine',
    name: 'Country Wine',
    type: FermentType.ALCOHOL,
    description: 'Fruit, sugar and water, and the yeast off the skins does the rest. The cottage way with whatever the hedge or the orchard gave you — the fruit sets the character, the sugar sets the strength.',
    requiredIngredients: { substrate: true, starter: null, additive: 'sugar' },
    outputIngredientId: 'country_wine_bottle',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 170,
    peakWindowStart: 80, peakWindowEnd: 96,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 18, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 2, acidity: 58, funk: 34, sweetness: 38, safety: 98 },
    difficulty: 2,
  },
  {
    id: 'fruit_vinegar',
    name: 'Wild Fruit Vinegar',
    type: FermentType.VINEGAR,
    description: 'Two organisms in sequence in one barrel, and the second needs air the entire time. On sea buckthorn there is a third problem: the oil oxidises at the surface if you leave the skin on it.',
    requiredIngredients: { substrate: true, starter: null, additive: 'water' },
    outputIngredientId: 'fruit_vinegar_bottle',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 185,
    peakWindowStart: 84, peakWindowEnd: 100,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 24, humidity: 65, salinity: 0 },
    idealFlavorProfile: { umami: 4, acidity: 92, funk: 38, sweetness: 16, safety: 100 },
    difficulty: 3,
  },
  {
    id: 'fruit_kombucha',
    name: 'Fruit Kombucha',
    type: FermentType.KOMBUCHA,
    description: 'The same raft as a tea kombucha with the fruit doing the feeding. Wild yeast off the skin competes with the culture, so a foraged berry gives a rougher and more interesting result.',
    requiredIngredients: { substrate: true, starter: 'scoby', additive: 'sugar' },
    outputIngredientId: 'fruit_kombucha_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 115,
    peakWindowStart: 78, peakWindowEnd: 92,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 24, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 4, acidity: 84, funk: 44, sweetness: 36, safety: 98 },
    difficulty: 2,
  },
  {
    id: 'ponzu',
    name: 'Citrus Ponzu',
    type: FermentType.SHOYU,
    description: 'Citrus steeped in a finished shoyu and left to marry. Not a ferment from nothing — the sauce has done its work already, and what the jar adds is time for the peel to give up its oil.',
    requiredIngredients: { substrate: true, starter: null, additive: 'amino' },
    outputIngredientId: 'ponzu_bottle',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 90,
    peakWindowStart: 80, peakWindowEnd: 96,
    activeIntervention: 'Clean',
    // The salt comes in with the shoyu, which the salinity dial cannot see — so
    // a target of 8% here meant every ponzu read as under-salted and spoiled,
    // four for four. At 0 it was run 432 times across every month and weather,
    // heatwaves included, and none spoiled.
    idealParams: { temp: 18, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 56, acidity: 76, funk: 22, sweetness: 28, safety: 100 },
    difficulty: 2,
  },
  {
    id: 'brined_fruit',
    name: 'Brined Wild Fruit',
    type: FermentType.LACTO,
    description: 'Whole fruit under a light brine, anaerobic and shut. Opening it to look is the fault — the surface is the only place anything can go wrong.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'brined_fruit_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 100,
    peakWindowStart: 78, peakWindowEnd: 94,
    activeIntervention: 'Clean',
    idealParams: { temp: 19, humidity: 60, salinity: 3 },
    idealFlavorProfile: { umami: 6, acidity: 80, funk: 34, sweetness: 30, safety: 98 },
    difficulty: 2,
  },
  {
    id: 'brined_plums',
    name: 'Brined Green Plums',
    type: FermentType.LACTO,
    description: 'Unripe plums under a light brine. Hard, sour and almond-bitter going in; the brine draws the bitterness and gives back a clean lactic sour. Not umeboshi — that is a fifth of the weight in salt and keeps for decades. This is a pickle, and it peaks.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'brined_plum_jar',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 90,
    peakWindowStart: 78, peakWindowEnd: 94,
    activeIntervention: 'Clean',
    idealParams: { temp: 19, humidity: 60, salinity: 5 },
    idealFlavorProfile: { umami: 6, acidity: 86, funk: 26, sweetness: 14, safety: 98 },
    difficulty: 2,
  },
  {
    id: 'berry_kvass',
    name: 'Pine and Berry Kvass',
    type: FermentType.ALCOHOL,
    description: 'Young pine needles or wild fruit — or both — in sweetened water for four days. Barely alcoholic, faintly resinous, and the fastest thing on the bench.',
    requiredIngredients: { substrate: true, starter: null, additive: 'sugar' },
    outputIngredientId: 'kvass_bottle',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 65,
    peakWindowStart: 74, peakWindowEnd: 90,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 22, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 2, acidity: 68, funk: 26, sweetness: 48, safety: 98 },
    difficulty: 1,
  },
];

/* -----------------------------------------------------------------------------
   MATRIX — checked against the existing table, not assumed

   - Tokens are SUBSTRING tests (`hasId` is `id.includes(token)`). `includes:
     'pine'` was the first draft of the kvass and it was wrong twice over: it
     matches `pineapple` (tepache) and `pineberry` (in this file). Families are
     exact id lists for that reason.
   - `honey` and `amino` are new tokens. `amino` reaches amino_sauce and any
     house product whose id carries it (a pulse amino, a tomato amino paste),
     which is the right family for a ponzu.
   - Order inside this array matters twice: ponzu precedes brined_fruit, so
     citrus with shoyu AND salt is still a ponzu; fruit_vinegar forbids sugar,
     so fruit + sugar + water is a country wine and never a vinegar.
   - Every vinegar forbids salt and koji. Acetobacter will not work in a brine,
     and without the forbids a salted koji mash with water in it resolved as a
     vinegar — the differential run caught that, it was not reasoned out.
   - The brines forbid spores, as the generated lacto rule always has: mould on
     a brine is a fault, not a ferment.
   - The only old ids reached are plums (vinegar in a cedar barrel, brine in an
     onggi) and pine needles (kvass in an onggi). Maesil cheong, black apple and
     pine cheong are all higher up the table and keep their shapes.
   --------------------------------------------------------------------------- */

const ANY_FRUIT: MatrixSubstrate = { kind: 'oneOf', ids: FRUIT_IDS, label: 'Any fruit' };
const CITRUS: MatrixSubstrate = { kind: 'oneOf', ids: CITRUS_IDS, label: 'Any citrus' };

export const MARKET_MATRIX: MatrixEntry[] = [
  { recipeId: 'fruit_mead',     substrate: ANY_FRUIT, requires: ['honey'],          vesselId: 'cedar_barrel' },
  { recipeId: 'country_wine',   substrate: ANY_FRUIT, requires: ['sugar', 'water'], forbids: ['scoby', 'honey'], vesselId: 'cedar_barrel' },
  { recipeId: 'fruit_vinegar',  substrate: { kind: 'oneOf', ids: [...FRUIT_IDS, 'plums'], label: 'Any fruit, or green plums' },
                                                      requires: ['water'],          forbids: ['scoby', 'honey', 'sugar', 'salt', 'koji'], vesselId: 'cedar_barrel' },
  { recipeId: 'fruit_kombucha', substrate: ANY_FRUIT, requires: ['scoby', 'sugar'], vesselId: 'mason_jar' },
  { recipeId: 'ponzu',          substrate: CITRUS,    requires: ['amino'],          vesselId: 'mason_jar' },
  { recipeId: 'brined_fruit',   substrate: ANY_FRUIT, requires: ['salt'],           forbids: ['koji', 'spores'], vesselId: 'mason_jar' },
  { recipeId: 'brined_plums',   substrate: { kind: 'is', id: 'plums' },
                                                      requires: ['salt'],           forbids: ['sugar', 'koji', 'spores'], vesselId: 'onggi' },
  { recipeId: 'berry_kvass',    substrate: { kind: 'oneOf', ids: ['pine_needles', ...FRUIT_IDS], label: 'Pine needles or any fruit' },
                                                      requires: ['sugar', 'water'], forbids: ['scoby', 'salt'], vesselId: 'onggi' },
];

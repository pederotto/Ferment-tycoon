import { Ingredient, IngredientType, Recipe, FermentType, MatrixEntry, MatrixSubstrate } from './types';

/* =============================================================================
   HERITAGE GRAINS, LANDRACE CORN, HEIRLOOM BEANS AND TOMATOES

   The staples half of the expansion. The rule that decides where each of these
   goes is the one the forager module sets out: SEASON IS FOR THINGS THAT ARE
   PICKED, not for things that are stored.

   A sack of einkorn is a sack of einkorn in March — grain is threshed, dried and
   kept, and so are dried corn and dried beans. They have no season and come from
   the staples merchant. A tomato is picked, so it has one: the heirlooms come
   off Prime's produce side between July and October and not otherwise.

   Fruit and fish live in constants.market.ts, mushrooms in constants.forage.ts.
   ============================================================================= */

const NORDIC = 'nordic';   // Nordic Staples Co. — grains, salts, legumes
const PRIME = 'prime';     // Prime Sourcing — meats and seasonal produce

const mk = (
  id: string,
  name: string,
  supplierId: string,
  baseCost: number,
  quality: number,
  hiddenStats: Ingredient['hiddenStats'],
  description: string,
  idealFor: string[],
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
  hiddenStats,
  mass: 1000,
  unitDisplay: 'kg',
  ...extra,
});

/* -----------------------------------------------------------------------------
   HERITAGE GRAINS — a koji substrate argument, not a flavour one

   All five are wheats and all five are starch-dominant, so they are AMYLASE
   substrates: the mirror of the mushrooms, and the reason both belong in the
   same expansion. What separates them is protein, which is the part a protease
   can also reach — einkorn and kamut carry far more of it than modern bread
   wheat, so a koji grown on them has more umami potential than one on rice.

   Freekeh is the odd one: green wheat, fire-roasted in the field. The roasting
   sterilises it, so it comes in with almost no wild life of its own — a clean
   bed, and a dull one if you were relying on the substrate for character.
   --------------------------------------------------------------------------- */

export const HERITAGE_GRAINS: Ingredient[] = [
  mk('einkorn', 'Einkorn', NORDIC, 14, 78,
    { sugarContent: 1, starchContent: 7, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 5 },
    'The oldest domesticated wheat, and still diploid. Higher in protein than anything bred since, which a protease koji can reach and an amylase one cannot.',
    ['heritage_koji', 'grain_sake']),

  mk('emmer', 'Emmer', NORDIC, 12, 75,
    { sugarContent: 1, starchContent: 7, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 4 },
    'Farro. The wheat of the Roman legions, and it takes a koji bed the way barley does — evenly, and without arguing.',
    ['heritage_koji', 'grain_sake']),

  mk('kamut', 'Kamut', NORDIC, 15, 77,
    { sugarContent: 1, starchContent: 7, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 5 },
    'Khorasan wheat, twice the size of a bread-wheat grain and buttery with it. Enough protein that a protease koji has something real to work on.',
    ['heritage_koji', 'grain_sake']),

  mk('spelt', 'Spelt', NORDIC, 11, 72,
    { sugarContent: 1, starchContent: 8, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 4 },
    'Hulled wheat, sweeter and softer than bread wheat. The most starch of the five, so the most sugar a sake koji can make of it.',
    ['heritage_koji', 'grain_sake']),

  mk('freekeh', 'Freekeh', NORDIC, 16, 76,
    { sugarContent: 2, starchContent: 6, nativeSalinity: 0, microbialDiversity: 1, fatContent: 1, proteinContent: 4 },
    'Green wheat burned in the field and rubbed out of its own ash. The fire sterilises it, so the bed starts clean — and stays dull unless you bring the character yourself.',
    ['heritage_koji']),
];

/* -----------------------------------------------------------------------------
   LANDRACE CORN — the same starch, ten different histories

   Dried corn is a commodity like any grain. What separates these is the kernel:
   a flour corn is soft all through and gives its starch up at once, a flint or a
   popcorn is packed hard and glassy and gives it up slowly, and a dent sits
   between. The wild yeast on a hand-shelled landrace cob is part of the price.
   --------------------------------------------------------------------------- */

export const LANDRACE_CORN: Ingredient[] = [
  mk('painted_corn', 'Painted Mountain Corn', NORDIC, 13, 74,
    { sugarContent: 2, starchContent: 8, nativeSalinity: 0, microbialDiversity: 4, fatContent: 1, proteinContent: 3 },
    'Bred in Montana for ninety frost-free days and nothing else. Every colour on one cob, and whatever was living on the cob comes in with it.',
    ['corn_chicha', 'corn_miso']),

  mk('glass_gem_corn', 'Glass Gem Corn', NORDIC, 19, 80,
    { sugarContent: 2, starchContent: 8, nativeSalinity: 0, microbialDiversity: 4, fatContent: 1, proteinContent: 3 },
    'Translucent and every colour at once. A flint corn, so it is hard, slow and worth the wait in a chicha pot.',
    ['corn_chicha', 'corn_miso']),

  mk('hopi_blue_corn', 'Hopi Blue Corn', NORDIC, 17, 82,
    { sugarContent: 1, starchContent: 8, nativeSalinity: 0, microbialDiversity: 4, fatContent: 1, proteinContent: 3 },
    'The blue sits in a thin layer just under the skin, and it ferments to a grey-violet that looks wrong and tastes like nothing else.',
    ['corn_chicha']),

  mk('oaxacan_green_corn', 'Oaxacan Green Dent', NORDIC, 16, 78,
    { sugarContent: 3, starchContent: 7, nativeSalinity: 0, microbialDiversity: 4, fatContent: 1, proteinContent: 3 },
    'Ground in Oaxaca for green tamales. Grassy, a little sweeter than the others, and a dent — soft enough in the crown to start quickly.',
    ['corn_chicha', 'grain_sake']),

  mk('bloody_butcher_corn', 'Bloody Butcher Corn', NORDIC, 14, 74,
    { sugarContent: 2, starchContent: 8, nativeSalinity: 0, microbialDiversity: 4, fatContent: 2, proteinContent: 3 },
    'A Virginia dent from the 1840s with blood-red kernels. Dent corn is soft-starched, so it breaks down early and ferments early.',
    ['corn_miso', 'corn_chicha']),

  mk('mandan_bride_corn', 'Mandan Bride Corn', NORDIC, 15, 76,
    { sugarContent: 2, starchContent: 8, nativeSalinity: 0, microbialDiversity: 5, fatContent: 1, proteinContent: 2 },
    'A flour corn kept by the Mandan on the upper Missouri. Soft all the way through, so the starch comes out to meet the ferment instead of waiting to be cracked.',
    ['corn_chicha', 'heritage_koji']),

  mk('strawberry_popcorn', 'Strawberry Popcorn', NORDIC, 12, 70,
    { sugarContent: 1, starchContent: 8, nativeSalinity: 0, microbialDiversity: 3, fatContent: 1, proteinContent: 3 },
    'Small red ears the shape of a strawberry. A popcorn, so its starch is packed hard and glassy — the slowest thing on this shelf to give anything up.',
    ['corn_miso']),

  mk('navajo_wedding_corn', 'Navajo Wedding Corn', NORDIC, 17, 78,
    { sugarContent: 2, starchContent: 8, nativeSalinity: 0, microbialDiversity: 5, fatContent: 1, proteinContent: 2 },
    'Red, white and blue kernels speckled on the same cob. A flour corn, soft, and quick in a pot.',
    ['corn_chicha']),

  mk('cherokee_long_ear_corn', 'Cherokee Long Ear', NORDIC, 15, 74,
    { sugarContent: 1, starchContent: 8, nativeSalinity: 0, microbialDiversity: 3, fatContent: 1, proteinContent: 3 },
    'A slender popcorn kept by the Cherokee. Hard-starched and slow, like all of them, and it wants cracking before a koji will take.',
    ['corn_miso', 'heritage_koji']),

  mk('fire_chief_corn', 'Fire Chief Corn', NORDIC, 14, 72,
    { sugarContent: 2, starchContent: 8, nativeSalinity: 0, microbialDiversity: 4, fatContent: 1, proteinContent: 3 },
    'A deep red flint. Hard, glassy and slow — it wants a long soak before anything will live on it.',
    ['corn_miso']),
];

/* -----------------------------------------------------------------------------
   HEIRLOOM BEANS — protein and starch together

   Every pulse here carries both, which is the thing a koji can work at both
   ends of. None has the protein of a soybean, so a bean miso comes out sweeter
   and gentler than a soy one, and it always will.
   --------------------------------------------------------------------------- */

export const PULSES: Ingredient[] = [
  mk('chickpeas', 'Chickpeas', NORDIC, 10, 70,
    { sugarContent: 1, starchContent: 6, nativeSalinity: 0, microbialDiversity: 2, fatContent: 2, proteinContent: 6 },
    'More protein than a grain and more starch than a soybean, so a koji has work at both ends of it.',
    ['pulse_amino', 'bean_miso']),

  mk('black_beluga_lentils', 'Black Beluga Lentils', NORDIC, 12, 74,
    { sugarContent: 1, starchContent: 5, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 7 },
    'Small, black and glossy, and they keep their shape through anything — so a lentil miso stays a mash of lentils rather than a paste.',
    ['bean_miso', 'pulse_amino']),

  mk('sea_island_red_peas', 'Sea Island Red Peas', NORDIC, 18, 82,
    { sugarContent: 2, starchContent: 6, nativeSalinity: 0, microbialDiversity: 3, fatContent: 1, proteinContent: 6 },
    'A cowpea the Gullah Geechee grew on the Sea Islands for two centuries and very nearly lost. Earthy and sweet, and scarce enough to be priced like it.',
    ['bean_miso']),

  mk('calypso_beans', 'Calypso Beans', NORDIC, 14, 76,
    { sugarContent: 1, starchContent: 6, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 6 },
    'Black and white, split down the middle like a killer whale — hence Orca. Creamy, and the colour does not survive the pot.',
    ['bean_miso', 'pulse_amino']),

  mk('applegrower_beans', 'Applegrower Drying Beans', NORDIC, 13, 72,
    { sugarContent: 1, starchContent: 6, nativeSalinity: 0, microbialDiversity: 3, fatContent: 1, proteinContent: 6 },
    'A speckled heirloom drying bean. Creamy when cooked, and it holds together through a long mash.',
    ['bean_miso']),

  mk('tepary_beans', 'Tepary Beans', NORDIC, 16, 80,
    { sugarContent: 1, starchContent: 5, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 7 },
    'The desert bean of the Sonoran, grown on the rain from a summer storm. Small, dense, and as much protein as anything on this shelf.',
    ['pulse_amino', 'bean_miso']),
];

/* -----------------------------------------------------------------------------
   HEIRLOOM TOMATOES — picked, so seasonal, so Prime's produce side

   Sugar and acid, almost no starch, and more free glutamate than any other
   fruit — which is why a tomato tastes savoury before anything has touched it.
   What separates these ten is where they sit between sweet and sharp, and how
   much solid there is per kilo: a San Marzano is mostly flesh, a beefsteak is
   mostly water.
   --------------------------------------------------------------------------- */

const tomato = (
  id: string, name: string, baseCost: number, quality: number, season: number[],
  hiddenStats: Ingredient['hiddenStats'], description: string, idealFor: string[], tier = 1,
): Ingredient => ({
  ...mk(id, name, PRIME, baseCost, quality, hiddenStats, description, idealFor),
  tags: ['PRODUCE'],
  season,
  tierRequired: tier,
});

export const TOMATOES: Ingredient[] = [
  tomato('cuore_di_bue', 'Cuore di Bue', 9, 74, [6, 7, 8],                    // Jul-Sep
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 2, innateUmami: 6, innateAcidity: 5 },
    'Oxheart. Heart-shaped, meaty and nearly seedless — more flesh per kilo than anything else in the crate.',
    ['lacto_tomato', 'tomato_amino']),

  tomato('brandywine', 'Brandywine', 12, 82, [7, 8],                          // Aug-Sep
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 2, innateUmami: 6, innateAcidity: 5 },
    'A pink beefsteak from the 1880s, late to ripen and worth it. The one people mean when they say tomatoes used to taste of something.',
    ['lacto_tomato', 'tomato_kombucha']),

  tomato('black_krim', 'Black Krim', 13, 80, [6, 7, 8],                       // Jul-Sep
    { sugarContent: 5, starchContent: 0, nativeSalinity: 1, microbialDiversity: 5, fatContent: 0, proteinContent: 2, innateUmami: 7, innateAcidity: 4 },
    'From the Crimea, dark as a bruise, with a salty edge — the story is the seaside soil, and whatever the reason, it shows in a ferment.',
    ['tomato_garum', 'lacto_tomato']),

  tomato('green_zebra', 'Green Zebra', 11, 76, [6, 7, 8, 9],                  // Jul-Oct
    { sugarContent: 3, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 2, innateUmami: 5, innateAcidity: 7 },
    'Bred in the 1980s rather than handed down, so strictly it is no heirloom. Green-striped and sharp, and the sharpness survives a ferment.',
    ['tomato_vinegar', 'lacto_tomato']),

  tomato('cherokee_purple', 'Cherokee Purple', 14, 82, [7, 8],                // Aug-Sep
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 2, innateUmami: 6, innateAcidity: 4 },
    'A dusky purple beefsteak said to come from the Cherokee. Sweet, a little smoky, and soft enough to bruise if you look at it.',
    ['tomato_amino', 'tomato_garum']),

  tomato('san_marzano', 'San Marzano Nano', 10, 80, [7, 8],                   // Aug-Sep
    { sugarContent: 4, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 3, innateUmami: 6, innateAcidity: 5 },
    'The sauce tomato — thick walls, few seeds, little water — in its dwarf form. More solids per kilo than any other here, and the solids are where the savour is.',
    ['tomato_garum', 'tomato_amino']),

  tomato('costoluto_genovese', 'Costoluto Genovese', 11, 76, [6, 7, 8],       // Jul-Sep
    { sugarContent: 4, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 2, innateUmami: 6, innateAcidity: 5 },
    'Deeply ribbed and Ligurian, grown for the pot rather than the plate. Sharp, and it holds its acid through a long ferment.',
    ['tomato_vinegar', 'lacto_tomato']),

  tomato('white_beauty', 'White Beauty', 14, 72, [7, 8],                      // Aug-Sep
    { sugarContent: 7, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateUmami: 5, innateAcidity: 3 },
    'Ivory all the way through and hardly acid at all. Sweet and mild — and a low-acid substrate is exactly the one that needs its salt measured.',
    ['tomato_kombucha']),

  tomato('striped_german', 'Striped German', 13, 78, [7, 8, 9],               // Aug-Oct
    { sugarContent: 7, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateUmami: 5, innateAcidity: 3 },
    'Red and yellow marbled right through, enormous and fruity. Like most bicolours, all sugar and not much acid.',
    ['tomato_kombucha', 'tomato_vinegar']),

  tomato('paul_robeson', 'Paul Robeson', 16, 86, [7, 8],                      // Aug-Sep
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 2, innateUmami: 6, innateAcidity: 4 },
    'A Russian black tomato named for the singer. Earthy and dark, and sweeter than it looks.',
    ['tomato_amino', 'lacto_tomato'], 2),
];

export const HERITAGE_INGREDIENTS: Ingredient[] = [
  ...HERITAGE_GRAINS,
  ...LANDRACE_CORN,
  ...PULSES,
  ...TOMATOES,
];

/* Substrate families, as explicit id lists so the matcher can never widen by
   accident. Soybeans are deliberately NOT in the pulse family: they already
   resolve to tamari, moromi and two misos, and adding them here would put two
   entries in the matrix competing for the same shape. */
export const GRAIN_IDS = HERITAGE_GRAINS.map(i => i.id);
export const CORN_IDS = LANDRACE_CORN.map(i => i.id);
export const PULSE_IDS = [...PULSES.map(i => i.id), 'yellow_peas', 'broad_beans'];
export const TOMATO_IDS = TOMATOES.map(i => i.id);

export const HERITAGE_RECIPES: Recipe[] = [
  {
    id: 'heritage_koji',
    name: 'Heritage Grain Koji',
    type: FermentType.KOJI,
    description: 'The same bed as a barley koji, on an older wheat or a landrace corn. More protein than rice means more for a protease to free later — you are growing a koji for what it will do next, not for what it tastes of now.',
    requiredIngredients: { substrate: true, starter: 'spores', additive: null },
    outputIngredientId: 'heritage_koji_tray',
    requiredVesselId: 'koji_tray',
    baseDurationSeconds: 48,
    peakWindowStart: 82, peakWindowEnd: 100,
    activeIntervention: 'Mix',
    idealParams: { temp: 30, humidity: 80, salinity: 0 },
    idealFlavorProfile: { umami: 25, acidity: 10, funk: 24, sweetness: 50, safety: 100 },
    difficulty: 3,
  },
  {
    id: 'grain_sake',
    name: 'Grain Sake',
    type: FermentType.ALCOHOL,
    description: 'Multiple parallel fermentation: the koji is still cutting starch into sugar while the yeast is already eating it. Both at once, in one vessel, which is why it reaches the strength it does — on corn as well as wheat.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'water' },
    outputIngredientId: 'grain_sake_bottle',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 160,
    peakWindowStart: 80, peakWindowEnd: 96,
    activeIntervention: 'Stir',
    idealParams: { temp: 14, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 42, acidity: 40, funk: 36, sweetness: 32, safety: 98 },
    targetAbv: 16,
    difficulty: 4,
  },
  {
    id: 'corn_chicha',
    name: 'Corn Chicha',
    type: FermentType.ALCOHOL,
    description: 'Landrace corn, water, an open pot and whatever is already on the kernels. No starter at all — the oldest way there is, and the least predictable.',
    requiredIngredients: { substrate: true, starter: null, additive: 'water' },
    outputIngredientId: 'chicha_pot',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 105,
    peakWindowStart: 76, peakWindowEnd: 92,
    activeIntervention: 'Stir',
    idealParams: { temp: 26, humidity: 65, salinity: 0 },
    idealFlavorProfile: { umami: 20, acidity: 64, funk: 58, sweetness: 24, safety: 94 },
    targetAbv: 4,
    difficulty: 2,
  },
  {
    id: 'corn_miso',
    name: 'Corn Miso',
    type: FermentType.MISO,
    description: 'Almost no protein to work with, so this is an amylase miso: sweet rather than savoury, and it will never reach the umami a soy miso does however long you leave it.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
    outputIngredientId: 'corn_miso_jar',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 175,
    peakWindowStart: 86, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 24, humidity: 60, salinity: 6 },
    idealFlavorProfile: { umami: 42, acidity: 18, funk: 32, sweetness: 72, safety: 100 },
    difficulty: 3,
  },
  {
    id: 'pulse_amino',
    name: 'Pulse Amino Sauce',
    type: FermentType.SHOYU,
    description: 'A moromi built on chickpeas, lentils or field beans instead of soy. Less protein than a soybean carries, so it needs longer and a harder koji to reach the same place.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
    outputIngredientId: 'pulse_amino_bottle',
    requiredVesselId: 'oak_cask',
    baseDurationSeconds: 235,
    peakWindowStart: 88, peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 25, humidity: 65, salinity: 14 },
    idealFlavorProfile: { umami: 76, acidity: 30, funk: 46, sweetness: 32, safety: 100 },
    difficulty: 4,
  },
  {
    id: 'bean_miso',
    name: 'Heirloom Bean Miso',
    type: FermentType.MISO,
    description: 'Heirloom beans where the soy would be. Less protein and more starch than a soybean, so it comes out sweeter and gentler — and it keeps the colour of whatever bean went in.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
    outputIngredientId: 'bean_miso_jar',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 185,
    peakWindowStart: 86, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 23, humidity: 60, salinity: 9 },
    idealFlavorProfile: { umami: 70, acidity: 20, funk: 44, sweetness: 36, safety: 100 },
    difficulty: 3,
  },
  {
    id: 'tomato_garum',
    name: 'Tomato Garum',
    type: FermentType.GARUM,
    description: 'The koji-and-heat route, on fruit instead of fish. A tomato is savoury before anything touches it; the koji takes that further and the acid keeps it bright. Held near sixty, so the salt is there for flavour.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
    outputIngredientId: 'tomato_garum_bottle',
    requiredVesselId: 'incubator',
    baseDurationSeconds: 140,
    peakWindowStart: 84, peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 60, humidity: 70, salinity: 5 },
    idealFlavorProfile: { umami: 74, acidity: 52, funk: 32, sweetness: 34, safety: 98 },
    difficulty: 3,
  },
  {
    id: 'tomato_amino',
    name: 'Tomato Amino Paste',
    type: FermentType.MISO,
    description: 'A miso built on tomato. Too wet to pack properly, so it stays a loose paste — sweet-sour rather than deep, and it will never reach the umami of a bean miso.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
    outputIngredientId: 'tomato_amino_jar',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 170,
    peakWindowStart: 86, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 22, humidity: 60, salinity: 8 },
    idealFlavorProfile: { umami: 64, acidity: 48, funk: 34, sweetness: 40, safety: 100 },
    difficulty: 3,
  },
  {
    id: 'lacto_tomato',
    name: 'Whole Lacto-Tomatoes',
    type: FermentType.LACTO,
    description: 'Whole tomatoes under brine, shut. The skins hold, the flesh sours around its own glutamate, and the jar goes fizzy if you leave it warm.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'lacto_tomato_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 70,
    peakWindowStart: 78, peakWindowEnd: 94,
    activeIntervention: 'Clean',
    idealParams: { temp: 20, humidity: 60, salinity: 3 },
    idealFlavorProfile: { umami: 65, acidity: 74, funk: 30, sweetness: 24, safety: 98 },
    difficulty: 1,
  },
  {
    id: 'tomato_kombucha',
    name: 'Tomato Kombucha',
    type: FermentType.KOMBUCHA,
    description: 'The raft fed on tomato water instead of sweet tea. Strange, savoury and sharp — and on a sweet bicolour the sugar is half done before you add any.',
    requiredIngredients: { substrate: true, starter: 'scoby', additive: 'sugar' },
    outputIngredientId: 'tomato_kombucha_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 110,
    peakWindowStart: 78, peakWindowEnd: 92,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 24, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 62, acidity: 78, funk: 44, sweetness: 28, safety: 98 },
    targetAbv: 1,
    difficulty: 2,
  },
  {
    id: 'tomato_vinegar',
    name: 'Tomato Vinegar',
    type: FermentType.VINEGAR,
    description: 'Sugar to alcohol, alcohol to acid, in one open barrel. A sharp tomato makes a sharper vinegar; the sweet ones make a rounder one that takes longer.',
    requiredIngredients: { substrate: true, starter: null, additive: 'water' },
    outputIngredientId: 'tomato_vinegar_bottle',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 180,
    peakWindowStart: 84, peakWindowEnd: 100,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 24, humidity: 65, salinity: 0 },
    idealFlavorProfile: { umami: 48, acidity: 88, funk: 36, sweetness: 18, safety: 100 },
    targetAbv: 0.3,
    difficulty: 3,
  },
];

/* -----------------------------------------------------------------------------
   MATRIX

   Everything here is a family (`oneOf`), so constants.ts puts it after every
   specific entry — and above the barley_koji catch-all, which is the one that
   matters: that line matches ANY substrate sporulated on a tray, so a
   heritage_koji placed after it would be unreachable and einkorn would silently
   become barley koji.

   Checked against the rest of the table by hand. Yellow peas and broad beans
   are the only old ids in these families, and both keep their named recipes —
   yellow_peaso (barley koji, mason jar) and doubanjiang (chili, onggi) sit
   higher up and match first. What they gain is a bean miso in a cedar barrel
   and an amino sauce in a cask, where they used to fall through to a generated
   recipe.
   --------------------------------------------------------------------------- */

const GRAIN: MatrixSubstrate = { kind: 'oneOf', ids: [...GRAIN_IDS, ...CORN_IDS], label: 'Heritage grain or landrace corn' };
const CORN: MatrixSubstrate = { kind: 'oneOf', ids: CORN_IDS, label: 'Landrace corn' };
const PULSE: MatrixSubstrate = { kind: 'oneOf', ids: PULSE_IDS, label: 'Heirloom beans or peas' };
const TOMATO: MatrixSubstrate = { kind: 'oneOf', ids: TOMATO_IDS, label: 'Heirloom tomato' };

export const HERITAGE_MATRIX: MatrixEntry[] = [
  { recipeId: 'heritage_koji',   substrate: GRAIN,  requires: ['spores'],         forbids: ['salt'], vesselId: 'koji_tray' },
  { recipeId: 'grain_sake',      substrate: GRAIN,  requires: ['koji', 'water'],  forbids: ['salt'], vesselId: 'cedar_barrel' },
  { recipeId: 'corn_miso',       substrate: CORN,   requires: ['koji', 'salt'],   vesselId: 'cedar_barrel' },
  { recipeId: 'corn_chicha',     substrate: CORN,   requires: ['water'],          forbids: ['koji', 'salt'], vesselId: 'onggi' },
  { recipeId: 'pulse_amino',     substrate: PULSE,  requires: ['koji', 'salt', 'water'], vesselId: 'oak_cask' },   // wet mash, like tamari
  { recipeId: 'bean_miso',       substrate: PULSE,  requires: ['koji', 'salt'],   vesselId: 'cedar_barrel' },
  { recipeId: 'tomato_garum',    substrate: TOMATO, requires: ['koji', 'salt'],   vesselId: 'incubator' },
  { recipeId: 'tomato_amino',    substrate: TOMATO, requires: ['koji', 'salt'],   vesselId: 'cedar_barrel' },
  { recipeId: 'lacto_tomato',    substrate: TOMATO, requires: ['salt'],           forbids: ['koji', 'spores'], vesselId: 'mason_jar' },
  { recipeId: 'tomato_kombucha', substrate: TOMATO, requires: ['scoby', 'sugar'], vesselId: 'mason_jar' },
  { recipeId: 'tomato_vinegar',  substrate: TOMATO, requires: ['water'],          forbids: ['scoby', 'salt', 'koji'], vesselId: 'cedar_barrel' },
];

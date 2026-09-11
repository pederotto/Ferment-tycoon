
import { Ingredient, IngredientType, Recipe, FermentType, Supplier, Vessel, Buyer, StaffRole, MatrixEntry, Book, HiddenStats } from './types';
import { FORAGE_SUPPLIER, FORAGED_MUSHROOMS, FORAGE_RECIPES, FORAGE_MATRIX } from './constants.forage';
import { HERITAGE_INGREDIENTS, HERITAGE_RECIPES, HERITAGE_MATRIX } from './constants.heritage';
import { MARKET_INGREDIENTS, MARKET_RECIPES, MARKET_MATRIX } from './constants.market';

// --- CONFIGURATION ---
// REBALANCE: was 3000 — enough to buy nearly every early vessel and ingredient
// on day one, leaving no real early-game tension. 1800 still covers a solid
// opening (a jar, a tray, starter spores, salt) without trivializing choices.
export const INITIAL_MONEY = 1800;
export const MAX_EQUIPMENT_SLOTS = 8;
export const INITIAL_MAX_POWER = 100;
// OPTIMIZATION: 8 seconds per day is very fast for a physics sim. 
// If performance lags, increase this to 10000 or 12000 to lower tick rate requirements.
export const DAY_DURATION_MS = 8000; 

// --- THE UNDERGROUND ---
// The black market used to be a closed renown-to-renown loop: every item was
// priced in renown, the only fence paid in renown, and money never entered. On
// top of that the renown purchase path awarded no supplier XP while the shelf
// gated on supplier level, so two of its three items were permanently unbuyable.
//
// It now runs on three separated currencies:
//   MONEY  — what the fence charges and what every fence pays.
//   HEAT   — the risk budget you spend for the edge. Raids scale with it.
//   RENOWN — buys nothing; it only makes heat and inspectors go away.
// Access is gated on bench XP (your standing), not on a loyalty ladder the fence
// never had.
export const UNDERGROUND_TIER_XP = [0, 250, 700, 1500];

export const getUndergroundTierFromXp = (xp: number): number => {
  let tier = 1;
  for (let i = 1; i < UNDERGROUND_TIER_XP.length; i++) {
    if (xp >= UNDERGROUND_TIER_XP[i]) tier = i + 1;
  }
  return tier;
};

// Heat
export const HEAT_DECAY_PER_TICK = 0.05;
export const HEAT_PER_ILLEGAL_BATCH = 0.2;
export const HEAT_FROM_FILTH = 0.1;
// Hygiene decays with bench load and had no floor without a cleaner, so any busy
// bench parked at zero. Filth then added more heat per tick than heat shed, and
// the inspector became a permanent fixture rather than a consequence. A neglected
// bench sits here: bad for your batches, but not an automatic raid. Smuggling
// still is one, which is the risk that ought to summon him.
export const HYGIENE_NEGLECT_FLOOR = 25;
// An empty bench airs out. Without this, hygiene only ever fell — so a room with
// nothing in it still slid to the neglect floor, and because that floor sits
// below the 40 where filth starts, an idle room generated heat forever.
export const HYGIENE_IDLE_RECOVERY = 0.10;
export const RAID_HEAT_THRESHOLD = 55;      // below this the inspector never calls
// Rolled once per game DAY, not per tick. Per tick meant the odds scaled with
// the speed control — at 8x and full heat the inspector called every four real
// seconds — and made the number impossible to reason about. Per day at full
// heat is roughly one visit a fortnight, and it falls away quickly as heat does.
export const RAID_CHANCE_PER_DAY = 0.10;
// Being on a list makes heat harder to shed, not impossible. It used to set
// decay to exactly zero forever after a single bust, so heat only ever
// ratcheted up and the inspector kept calling however clean you then were.
export const HEAT_DECAY_AFTER_BUST = 0.35;
// A spotless bench actively cools the inspector's interest rather than merely
// not attracting it. Good hygiene should be worth something.
export const HEAT_DECAY_FROM_CLEANLINESS = 0.04;
export const GREASE_RENOWN_COST = 20;       // renown -> minus heat, the only thing renown buys
export const GREASE_HEAT_RELIEF = 25;

// --- RECIPE BOOKS ---
// Priced at roughly $90 per point of combined difficulty taught. The Primer is
// deliberately under that rule because it is the on-ramp. The xp gates matter as
// much as the prices: on the $1800 opening float only the Primer is buyable, so
// you cannot spend the float on books and then miss the first rent.
export const BOOKS: Book[] = [
  {
    id: 'primer_bench',
    title: 'The Bench Primer',
    author: 'Anon., trade printing',
    blurb: 'The three things every culture house starts with, and the rules of thumb behind the generated ferments.',
    teaches: ['barley_koji', 'shio_koji', 'amazake'],
    revealsProcedural: true,
    price: 150,
    xpRequired: 0,
    shelf: 'bindery',
  },
  {
    id: 'tome_salt_sun',
    title: 'Salt & Sun',
    author: 'M. Ferreira',
    blurb: 'Curing in dry air: roe, mushroom, and the patience they ask for.',
    teaches: ['bottarga', 'lacto_ceps', 'cheong'],
    price: 450,
    xpRequired: 150,
    shelf: 'bindery',
  },
  {
    id: 'tome_jang',
    title: 'Jang: The Red Pastes',
    author: 'Seo Ji-woo',
    blurb: 'Chili, grain and koji, buried in earthenware until they turn.',
    teaches: ['gochujang', 'doubanjiang', 'coconut_vin'],
    price: 540,
    xpRequired: 300,
    gatedBy: { supplierId: 'asia_import', level: 2 },
    shelf: 'bindery',
  },
  {
    id: 'tome_soy',
    title: 'The Soybean Papers',
    author: 'K. Tanaka',
    blurb: 'Two misos and a black bean, and why the vessel decides which one you get.',
    teaches: ['hatcho_miso', 'shiro_miso', 'douchi'],
    price: 630,
    xpRequired: 300,
    gatedBy: { supplierId: 'asia_import', level: 2 },
    shelf: 'bindery',
  },
  {
    id: 'tome_mezzogiorno',
    title: 'Il Quaderno del Mezzogiorno',
    author: 'G. Riina',
    blurb: 'Anchovy, milk and mackerel worked the southern way. Needs a cask and a warm room.',
    teaches: ['colatura', 'ricotta_forte', 'garum_sociorum', 'nuoc_mam'],
    price: 980,
    xpRequired: 600,
    gatedBy: { supplierId: 'prime', level: 2 },
    shelf: 'bindery',
  },
  {
    id: 'tome_new_nordic',
    title: 'Notes from the Cold Kitchen',
    author: 'H. Lindqvist',
    blurb: 'The modern canon: blackening, rose, scallop, shrimp, pea.',
    teaches: ['black_apple', 'rose_garum', 'scallop_fudge', 'bagoong', 'yellow_peaso'],
    price: 1150,
    xpRequired: 900,
    gatedBy: { supplierId: 'biolab', level: 3 },
    shelf: 'bindery',
  },
  {
    id: 'codex_lacrimarum',
    title: 'Codex Lacrimarum',
    author: 'unattributed',
    blurb: 'Photocopied, twice removed, and missing its first eleven pages. You do not ask where it came from.',
    teaches: ['tears_garum', 'ancient_garum', 'casu_marzu'],
    price: 1400,
    xpRequired: 1200,
    heatOnPurchase: 25,
    shelf: 'underground',
  },
];

// --- RECIPE MATRIX ---
// ORDER IS LOAD-BEARING. The resolver returns the first match, so the specific
// entries must precede the barley_koji catch-all at the bottom. This table was
// extracted verbatim from the if-chain that used to live in
// resolveRecipeFromMatrix and is differential-tested against it.
export const RECIPE_MATRIX: MatrixEntry[] = [
  // Direct koji substrates — these ran before everything else and ignore the vessel.
  { recipeId: 'shio_koji', substrate: { kind: 'kojiBase' }, requires: ['koji', 'salt', 'water'], vesselId: null },
  { recipeId: 'amazake',   substrate: { kind: 'kojiBase' }, requires: ['koji', 'water'], forbids: ['salt'], vesselId: null },
  { recipeId: 'shio_koji', substrate: { kind: 'kojiBase' }, requires: ['koji', 'salt'], forbids: ['water'], vesselId: null },

  { recipeId: 'colatura',       substrate: { kind: 'is', id: 'anchovies' },      requires: ['salt'], vesselId: 'oak_cask' },
  { recipeId: 'bottarga',       substrate: { kind: 'is', id: 'mullet_roe' },     requires: ['salt'], vesselId: 'koji_tray' },
  { recipeId: 'blue_cheese',    substrate: { kind: 'is', id: 'raw_milk' },       requires: ['p_roqueforti', 'salt'], vesselId: 'onggi' },
  { recipeId: 'ricotta_forte',  substrate: { kind: 'is', id: 'raw_milk' },       requires: ['salt'], forbids: ['p_roqueforti'], vesselId: 'onggi' },
  // Roman garum used no koji at all — fish, salt, sun and time. Forbidding koji
  // here is both historically right and what makes the modern koji-driven method
  // reachable: without this, every fish-and-salt incubation resolved to the Roman
  // recipe and the low-salt/high-heat route could never be built.
  { recipeId: 'garum_sociorum', substrate: { kind: 'is', id: 'mackerel' }, requires: ['salt'], forbids: ['koji'], vesselId: 'incubator' },

  { recipeId: 'doubanjiang', substrate: { kind: 'is', id: 'broad_beans' },    requires: ['chili', 'koji', 'salt'], vesselId: 'onggi' },
  { recipeId: 'douchi',      substrate: { kind: 'is', id: 'black_soybeans' }, requires: ['spores', 'salt'],        vesselId: 'mason_jar' },
  { recipeId: 'gochujang',   substrate: { kind: 'is', id: 'glutinous_rice' }, requires: ['koji', 'chili', 'salt'], vesselId: 'onggi' },
  { recipeId: 'cheong',      substrate: { kind: 'is', id: 'pine_needles' },   requires: ['sugar'],                 vesselId: 'mason_jar' },

  // SHOYU BEFORE MISO. Both take a soybean base and the miso entries match any
  // soybean with spores and salt, so a moromi placed after them would resolve as
  // a miso and the whole family would stay unreachable — which is exactly how
  // Shio Koji and Amazake were lost for the game's entire history.
  //
  // What separates them is real: shoyu has roasted wheat in it and is a wet
  // brine mash; a miso is dry-packed and has neither.
  { recipeId: 'moromi', substrate: { kind: 'includes', token: 'soybean' }, requires: ['wheat', 'spores', 'salt', 'water'], vesselId: 'cedar_barrel' },
  // Tamari is the wheat-free one — it began as the liquid pooling on a miso.
  { recipeId: 'tamari', substrate: { kind: 'includes', token: 'soybean' }, requires: ['koji', 'salt', 'water'], forbids: ['wheat'], vesselId: 'onggi' },

  { recipeId: 'hatcho_miso', substrate: { kind: 'includes', token: 'soybean' }, requires: ['spores', 'salt'], vesselId: 'cedar_barrel' },
  { recipeId: 'shiro_miso',  substrate: { kind: 'includes', token: 'soybean' }, requires: ['koji', 'salt'],   vesselId: 'mason_jar' },

  { recipeId: 'nuoc_mam',    substrate: { kind: 'is', id: 'anchovies' },   requires: ['salt'], vesselId: 'cedar_barrel' },
  { recipeId: 'bagoong',     substrate: { kind: 'is', id: 'shrimp_fry' },  requires: ['salt'], vesselId: 'mason_jar' },
  { recipeId: 'coconut_vin', substrate: { kind: 'is', id: 'coconut_sap' }, requires: [],       vesselId: 'mason_jar' },

  { recipeId: 'scallop_fudge', substrate: { kind: 'is', id: 'scallops' },    requires: ['koji'],          vesselId: 'incubator' },
  { recipeId: 'lacto_ceps',    substrate: { kind: 'is', id: 'ceps' },        requires: ['salt'],          vesselId: 'mason_jar' },
  { recipeId: 'rose_garum',    substrate: { kind: 'is', id: 'rose_petals' }, requires: ['koji', 'water'], vesselId: 'incubator' },
  { recipeId: 'black_garlic',  substrate: { kind: 'is', id: 'garlic_bulbs' },   requires: [], forbids: ['salt'], vesselId: 'incubator' },
  { recipeId: 'black_apple',   substrate: { kind: 'is', id: 'plums' },          requires: [], forbids: ['salt', 'sugar'], vesselId: 'incubator' },
  { recipeId: 'yellow_peaso',  substrate: { kind: 'is', id: 'yellow_peas' }, requires: ['barley_koji', 'salt'], vesselId: 'mason_jar' },

  { recipeId: 'tears_garum',   substrate: { kind: 'any' },               requires: ['tears', 'koji', 'salt'], vesselId: 'incubator' },
  { recipeId: 'casu_marzu',    substrate: { kind: 'is', id: 'raw_milk' }, requires: ['larvae'],               vesselId: 'koji_tray' },
  { recipeId: 'ancient_garum', substrate: { kind: 'is', id: 'mackerel' }, requires: ['ancient_spores'],       vesselId: 'onggi' },

  // --- Era II, continued ---
  { recipeId: 'tempeh',       substrate: { kind: 'includes', token: 'soybean' }, requires: ['rhizopus'],        vesselId: 'koji_tray' },
  { recipeId: 'natto',        substrate: { kind: 'includes', token: 'soybean' }, requires: ['bacillus_natto'],  vesselId: 'incubator' },
  { recipeId: 'katsuobushi',  substrate: { kind: 'is', id: 'bonito' },           requires: ['a_glaucus'],       vesselId: 'koji_tray' },
  { recipeId: 'meju',         substrate: { kind: 'includes', token: 'soybean' }, requires: [], forbids: ['spores', 'koji', 'salt', 'rhizopus', 'bacillus_natto'], vesselId: 'koji_tray' },
  { recipeId: 'doenjang',     substrate: { kind: 'any' },                        requires: ['meju_block', 'salt'], vesselId: 'onggi' },
  { recipeId: 'makgeolli',    substrate: { kind: 'present' },                    requires: ['nuruk', 'water'],  vesselId: 'onggi' },
  { recipeId: 'nukazuke',     substrate: { kind: 'present' },                    requires: ['rice_bran', 'salt'], vesselId: 'onggi' },

  // --- Era III ---
  { recipeId: 'kimchi',       substrate: { kind: 'is', id: 'napa_cabbage' },  requires: ['chili', 'salt'], vesselId: 'onggi' },
  { recipeId: 'sauerkraut',   substrate: { kind: 'is', id: 'white_cabbage' }, requires: ['salt'],          vesselId: 'onggi' },
  { recipeId: 'salumi',       substrate: { kind: 'is', id: 'pork_belly' },    requires: ['salt'],          vesselId: 'cedar_barrel' },
  { recipeId: 'surstromming', substrate: { kind: 'is', id: 'herring' },       requires: ['salt'],          vesselId: 'mason_jar' },

  { recipeId: 'kombucha',        substrate: { kind: 'is', id: 'black_tea' },  requires: ['scoby', 'sugar'],   vesselId: 'mason_jar' },
  { recipeId: 'cultured_butter', substrate: { kind: 'is', id: 'heavy_cream' }, requires: [], forbids: ['salt'], vesselId: 'mason_jar' },
  { recipeId: 'nut_miso',        substrate: { kind: 'is', id: 'hazelnuts' },   requires: ['koji', 'salt'],     vesselId: 'mason_jar' },
  { recipeId: 'shio_tamago',     substrate: { kind: 'is', id: 'egg_yolks' },   requires: ['koji', 'salt'],     vesselId: 'mason_jar' },
  { recipeId: 'maesil_cheong',   substrate: { kind: 'is', id: 'plums' },       requires: ['sugar'],            vesselId: 'mason_jar' },
  { recipeId: 'tepache',         substrate: { kind: 'is', id: 'pineapple' },   requires: ['sugar'],            vesselId: 'mason_jar' },
  { recipeId: 'cider_vinegar',   substrate: { kind: 'is', id: 'apples' },      requires: ['water'],            vesselId: 'cedar_barrel' },
  // Dried chilies are an ADDITIVE, so there is no substrate to match on here.
  { recipeId: 'chili_mash',      substrate: { kind: 'any' },                   requires: ['chili', 'salt'],    vesselId: 'oak_cask' },

  // --- The forager, the heritage staples and the market ---
  // Families, not species: one entry per PROCESS, so twelve mushrooms never
  // compete for one shape. Every one of these is broader than anything above it,
  // so they go after the specific entries — and heritage_koji is spores on a
  // tray, so it must come before the catch-all. Each module carries its own
  // collision notes.
  ...FORAGE_MATRIX,
  ...HERITAGE_MATRIX,
  ...MARKET_MATRIX,

  // Catch-all: anything sporulated on a tray becomes koji. Must stay last.
  { recipeId: 'barley_koji', substrate: { kind: 'present' }, requires: ['spores'], vesselId: 'koji_tray' },
];

// Human labels for the tokens above, used by the recipe-book formula card.
export const MATRIX_TOKEN_LABELS: Record<string, string> = {
  salt: 'Salt',
  koji: 'Live koji',
  spores: 'Spores',
  chili: 'Chili or pepper',
  sugar: 'Sugar',
  water: 'Water',
  wheat: 'Roasted wheat',
  tears: 'Vial of Tears',
  larvae: 'Cheese fly larvae',
  barley_koji: 'Barley koji',
  ancient_spores: 'Ancient spores',
  rhizopus: 'R. oligosporus',
  bacillus_natto: 'B. subtilis (nattō)',
  nuruk: 'Nuruk cake',
  p_roqueforti: 'P. roqueforti',
  a_glaucus: 'A. glaucus',
  meju_block: 'Meju block',
  rice_bran: 'Rice bran',
  scoby: 'SCOBY mother',
  honey: 'Honey',
  amino: 'Amino sauce (shoyu)',
};

// The one piece of theory the whole garum family turns on. Written as a book
// note because it is the sort of thing a text teaches and experience confirms.
export const SALT_AND_HEAT_NOTE =
  'Two things keep a ferment safe, and you may choose between them. SALT: above ' +
  'roughly a fifth of the weight, nothing harmful can establish, and the ferment ' +
  'can sit at room temperature for a year — this is the Roman way, and why old ' +
  'garum is punishingly salty. HEAT: above about 55 °C nothing establishes either, ' +
  'so a ferment held hot needs far less salt — this is the modern way, and why a ' +
  'garum run at 60 °C tastes of fish rather than of the sea. What you must not do ' +
  'is lower both. Between 20 and 45 °C, with little salt, you are not fermenting ' +
  'anything; you are incubating whatever lands in it.';

// --- AGEING ---
// Progress past the peak window used to mean one thing for every ferment:
// decline, then spoilage at +40. That is true of a koji bed, which sporulates
// and turns bitter, and of a lacto pickle, which goes soft and sour. It is
// flatly wrong for the ferments that are *defined* by age — a hatcho miso is
// buried for two to three years, a colatura draws for a year in the cask, a
// garum deepens for months. Those should keep developing.
export type AgeingBehaviour = 'matures' | 'peaks' | 'fragile';

export const AGEING_BY_TYPE: Record<string, AgeingBehaviour> = {
  'Miso/Paste': 'matures',
  'Shoyu/Sauce': 'matures',
  'Garum': 'matures',
  'Vinegar': 'matures',
  'Blackening': 'matures',
  'Koji Cultivation': 'fragile',   // sporulates and turns bitter quickly
  'Lacto-Fermentation': 'peaks',   // softens and over-sours
  'Alcoholic Brew': 'peaks',
  'Kombucha': 'peaks',   // goes to vinegar if you leave it
  'Bio-Hazard': 'fragile',
};

// How far past 100% a maturing ferment can usefully go, and how much it gains.
// The curve is deliberately logarithmic: the first year does most of the work,
// the fourth is a refinement, and nothing improves forever.
export const AGEING_MAX_PROGRESS = 500;

/**
 * WHERE A KOJI BED GOES TO SPORE.
 *
 * Left past its peak, Aspergillus stops being a white felt and fruits: the bed
 * turns yellow-green with conidia, the enzymes stall, and it goes bitter. That
 * is a ruined ingredient and the only way to take a strain off it — which is
 * the trade. You cannot both eat the bed and keep its children.
 *
 * Ends at SPOILAGE, where the bed is past use for either.
 */
/**
 * Where a koji run starts, and why it is not a slider.
 *
 * The substrate goes into the tray straight off the steamer, so inoculation
 * temperature is a property of the process rather than a decision. Real beds go
 * in hotter than this and are allowed to fall; 30 C is the simplification, and
 * it is the temperature the bed is actually held near.
 */
export const KOJI_INOCULATION_TEMP = 30;

export const SPORULATION_START = 110;   // conidia begin to show
export const SPORULATION_FULL  = 145;   // fully sporulated, maximum yield
export const SPORULATION_SPOIL = 175;   // over-run, bitter and worthless
export const AGEING_PEAK_BONUS = 0.28;      // up to +28% score at full maturity
export const AGEING_VALUE_BONUS = 0.9;      // up to +90% price at full maturity
export const CELLAR_TICK_DIVISOR = 6;       // the cellar ages slowly and safely
export const CELLAR_CAPACITY = 6;

// --- ERAS ---
// The campaign frame. Fermentation has a history, and the game had none of it:
// colatura and rose garum sat side by side with no indication that one is a
// Roman industry and the other a 2015 Copenhagen experiment. Each era gives the
// context, names the tools it turns on, and opens when you have shown you can
// work the one before it.
export interface Era {
  id: string;
  ordinal: number;
  title: string;
  years: string;
  premise: string;      // what the era is about
  technique: string;    // the idea it teaches
  recipes: string[];
  vessels: string[];
  unlocksAtXp: number;
}

export const ERAS: Era[] = [
  {
    id: 'antiquity',
    ordinal: 1,
    title: 'The Salt Roads',
    years: 'c. 600 BCE – 400 CE',
    premise:
      'Rome ran on fish sauce. Garum was industrial — vats along the coast of Baetica, ' +
      'amphorae shipped the length of the empire, grades from the cheap muria to the ' +
      'ruinous garum sociorum. There was no refrigeration and no microbiology, only salt ' +
      'and sun and the accumulated knowledge of which is enough.',
    technique:
      'Salt as the whole method. At a fifth of the weight nothing harmful can live, so a ' +
      'vat can sit open in the Mediterranean sun for a season and come out safe. Everything ' +
      'you make in this era is preserved by salinity alone.',
    recipes: ['garum_sociorum', 'colatura', 'nuoc_mam', 'bottarga', 'sauerkraut', 'lacto_ceps'],
    vessels: ['mason_jar', 'koji_tray', 'oak_cask'],
    unlocksAtXp: 0,
  },
  {
    id: 'silkroad',
    ordinal: 2,
    title: 'The Mould Masters',
    years: 'c. 300 – 1600 CE',
    premise:
      'East Asia took a different road: instead of preserving protein with salt, cultivate a ' +
      'mould that takes it apart. Aspergillus oryzae was domesticated over centuries into ' +
      'strains bred for opposite ends of the enzyme spectrum, and around it grew miso, shoyu, ' +
      'sake and the entire jang tradition of Korea.',
    technique:
      'Enzymes as the method. Koji does with amylase and protease in weeks what salt and time ' +
      'do in years — and unlike salt, you choose what it makes. This is where the bench stops ' +
      'being a pantry and becomes a laboratory.',
    recipes: ['barley_koji', 'shio_koji', 'amazake', 'shiro_miso', 'hatcho_miso', 'douchi',
              'gochujang', 'doubanjiang', 'tempeh', 'natto', 'meju', 'doenjang', 'makgeolli',
              'nukazuke', 'katsuobushi', 'yellow_peaso'],
    vessels: ['onggi', 'cedar_barrel', 'incubator'],
    unlocksAtXp: 200,
  },
  {
    id: 'cellars',
    ordinal: 3,
    title: 'The Cellars of Europe',
    years: 'c. 800 – 1900 CE',
    premise:
      'Cold changed everything. A northern cellar holds a steady low temperature for months, ' +
      'and that patience produced the aged traditions: hung salumi, pierced blue cheese, ' +
      'crocks of kraut buried through a winter, vinegar drawn from wine that had already turned.',
    technique:
      'Time and cold as the method. Nothing here is fast. The ferments of this era improve for ' +
      'months or years rather than peaking and falling over — which is what the cellar is for.',
    recipes: ['salumi', 'blue_cheese', 'ricotta_forte', 'kimchi', 'coconut_vin', 'cheong',
              'surstromming', 'bagoong', 'casu_marzu', 'kombucha'],
    vessels: ['cedar_barrel', 'oak_cask'],
    unlocksAtXp: 700,
  },
  {
    id: 'modern',
    ordinal: 4,
    title: 'The New Nordic Bench',
    years: '2003 – present',
    premise:
      'The modern restaurant fermentation lab did something the tradition never did: it took ' +
      'the techniques apart and applied them where they did not belong. Koji on beef. Garum ' +
      'from grasshoppers. Fruit blackened for sixty days in a warming cabinet. The grammar of ' +
      'the old methods, used on anything at all.',
    technique:
      'Method as a grammar rather than a recipe. If you understand that protease frees glutamate ' +
      'and that heat can replace salt, you can build a ferment nobody has made before — which ' +
      'is exactly what the undiscovered combinations in your matrix are for.',
    recipes: ['rose_garum', 'black_apple', 'scallop_fudge', 'lacto_ceps', 'tears_garum',
              'ancient_garum', 'primordial_garum'],
    vessels: ['incubator'],
    unlocksAtXp: 1500,
  },
];

export const eraForRecipe = (recipeId: string): Era | undefined =>
  ERAS.find(e => e.recipes.includes(recipeId));

// --- WHAT THE BOOKS ACTUALLY SAY ---
// Authored guidance, keyed by recipe. This is the half of the advice a player
// BUYS: available the moment the book is on the shelf, identical for everyone,
// and about the craft rather than about them. The other half is generated from
// their own results (services/mastery.ts benchAdvice).
export const BOOK_ADVICE: Record<string, string> = {
  barley_koji: 'Spread it thin and keep it breathing. The bed will make its own heat once the mycelium takes — that is the sign it is working, and the moment it can run away from you.',
  shio_koji: 'Equal parts koji, salt and water, left somewhere it will be forgotten for a fortnight. It should smell of sweet apple, never of solvent.',
  amazake: 'Hold it at blood heat and no higher. Amylase works fastest just below the point where it dies; too hot and you get starch soup, too cool and you wait all week.',
  hatcho_miso: 'Soybean koji only, almost no water, weighted down under stone for years rather than months. Colour comes from time, not heat.',
  shiro_miso: 'Rice koji heavy, salt light, and short. It is the sweetness you are after — the moment it turns savoury you have gone past it.',
  douchi: 'Salt-cured after the mould has set, then dried until the beans rattle. Anaerobic throughout, or it turns.',
  gochujang: 'Keep it cool. Warm gochujang converts its own sugar to alcohol and you lose the sweetness that makes it worth eating.',
  doubanjiang: 'The broad beans go in whole and the chili goes in late. Sun by day, covered by night, and stirred every time you pass it.',
  colatura: 'Anchovy and salt in a cask, pressed under its own weight, and drawn off from the bottom after a year. There is no shortcut and no substitute for the wood.',
  nuoc_mam: 'The first pressing is the only one worth selling. Everything after is for the kitchen.',
  garum_sociorum: 'Heat is the whole method — the enzymes do in weeks what a cellar would take a year to do. Hold it high and salt it hard, or it will putrefy rather than ferment.',
  bagoong: 'It wants air on it. Keep the vessel open and let it oxidise; a sealed bagoong stays grey and tastes of nothing.',
  bottarga: 'Pressed, salted, and hung somewhere with moving air below forty percent. Humidity is the only thing that can kill it, and it kills it quickly.',
  ricotta_forte: 'Controlled rot, stirred daily. The stirring is not optional — it is what keeps the wrong moulds from taking the surface.',
  casu_marzu: 'Everything you have been taught about sanitation is wrong here. The larvae need the filth. Clean the room and you starve them.',
  lacto_ceps: 'Two percent salt by weight of mushroom, submerged, and left cool. If it floats it spoils.',
  cheong: 'Sugar by weight, equal to the fruit, and no water at all. The syrup draws itself out. Wild yeast will turn it alcoholic if the room is dirty.',
  coconut_vin: 'Sap to alcohol first, alcohol to acid second, and the second stage needs air. A sealed vinegar never sours.',
  black_apple: 'Sixty days of gentle, humid heat. This is not fermentation at all, it is the Maillard reaction taken to its conclusion. Let it dry out and it simply bakes.',
  scallop_fudge: 'Dry heat, and patience. You are concentrating what is already there rather than making anything new.',
  rose_garum: 'The petals go in at the end. Everything aromatic you add early is lost to the heat.',
  yellow_peaso: 'A northern miso in everything but name. Barley koji, peas, and a long cold winter.',
  tears_garum: 'Written in a hand I do not recognise. The proportions are given but not the reason.',
  ancient_garum: 'The spores are older than the recipe. Expect it to behave unlike anything you have grown.',

  // --- Era II, continued ---
  tempeh: 'Rhizopus is not koji. It makes almost no enzyme — it knits the beans into a cake with mycelium and stops. Warm, humid, and give it air or the centre goes black.',
  natto: 'A bacterium, and it wants what no mould would survive: forty degrees and saturated air. The ropiness is the polyglutamic acid, and it is the point.',
  meju: 'No starter at all. You press the beans into bricks, hang them in a cold room, and let whatever is in your air decide what you get. Every house tastes different.',
  doenjang: 'Break the meju into strong brine and leave it through a summer. The solids sink and become the paste; the liquid you draw off the top is ganjang. One process, two products.',
  makgeolli: 'Nuruk saccharifies and ferments at the same time, in the same vessel — parallel fermentation. Keep it cool or it turns to vinegar in front of you.',
  nukazuke: 'The bed is the recipe. Salt, bran, and your own hands turning it every single day; vegetables are only passing through. Neglect it for a week and it dies.',
  katsuobushi: 'Simmered, smoked, then moulded and sunned in cycles for four to six months. Each cycle draws out more water. When it rings like wood it is finished.',

  // --- Era III ---
  sauerkraut: 'Two percent salt by the weight of the cabbage, and nothing else. It must stay under its own liquid — everything that goes wrong with kraut goes wrong at the surface.',
  kimchi: 'Brine the napa first, then dress it. Cold and slow gives you the sour effervescence; warm and fast gives you soft cabbage and regret.',
  salumi: 'Salt, then a slow fall in humidity across weeks. Drop it too quickly and the outside case-hardens, sealing the wet inside in to rot.',
  blue_cheese: 'The mould needs oxygen to strike, which is why the wheel is pierced. The blue follows the needle and nowhere else.',
  cultured_butter: 'Mesophilic bacteria turn the citrate in cream into diacetyl — the compound that actually smells like butter. Sour it at room temperature, then churn.',
  nut_miso: 'Half the weight of a hazelnut is oil. Protease builds the savour, but it is lipase working on that oil that turns it praline rather than rancid — and the difference is whether you kept the salt up.',
  shio_tamago: 'Bury the yolks in salt and koji and refrigerate. Water leaves, protease firms what remains, and in a week you can grate it.',
  maesil_cheong: 'Equal weights of fruit and sugar, and no water at all. The syrup draws itself out. There is no fermentation here if you keep it clean — only osmosis.',
  tepache: 'The rind carries its own yeast. Sugar, water, four warm days, and burp it — this is the fastest thing on the bench and it turns to vinegar if you forget it.',
  cider_vinegar: 'Two organisms in sequence: yeast makes the alcohol, Acetobacter oxidises it to acid. The second stage is strictly aerobic — seal the vessel and your vinegar simply stops.',
  chili_mash: 'Salt heavy enough that only halotolerant bacteria survive, then years in wood. The heat rounds off into fruit.',
  black_garlic: 'No microbe survives sixty degrees, so nothing here is fermenting. It is the Maillard reaction run slowly: reducing sugars meeting amino acids for six weeks until the cloves are black and sweet.',
  kombucha: 'Sweet tea, a mother, and air. Two ferments run at once: yeast makes alcohol from the sugar, acetic bacteria make acid from the alcohol. Seal it and you stop the second one.',
  surstromming: 'A brine deliberately too weak to preserve. It is not spoilage — it is a fermentation held at the edge of one, and the tin swells because it is still working.',
};

// --- RECIPE MASTERY ---
// Every recipe carries its own "Hand" track, 1-5. Cooking that recipe earns XP
// weighted by the critic score, so a good run teaches disproportionately more
// than a sloppy one and a failure teaches nothing at all. Levels buy INFORMATION
// only — never a score bonus; see services/mastery.ts for why.
export const MASTERY_MAX_LEVEL = 5;
export const MASTERY_XP_SCORE_FLOOR = 25;   // below this a batch teaches nothing
export const MASTERY_XP_BASE = 100;         // xp for a flawless difficulty-1 run
export const MASTERY_XP_CURVE = 1.5;        // convex: good runs teach much more
export const MASTERY_XP_DIFFICULTY_STEP = 0.25;
export const MASTERY_L5_MIN_BEST_SCORE = 80; // the top rung must be earned, not ground
export const MASTERY_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 120,
  3: 400,
  4: 1000,
  5: 2200,
};
export const MASTERY_RUNG_TITLES: Record<number, string> = {
  1: 'First run',
  2: 'Getting a feel',
  3: 'Measured',
  4: 'Timed',
  5: 'Second nature',
};

// --- HYDRATION ---
// Water is titrated as a percentage of solids mass, exactly as salt is. Every
// ferment family wants a different mash: koji is cultivated dry on a tray and
// free water invites bacteria, a miso is a stiff paste, a moromi or a vinegar
// is essentially a liquid. These are the targets the bench suggests when a
// recipe resolves; the player is free to ignore them and pay for it.
export const HYDRATION_TARGETS: Record<string, number> = {
  'Koji Cultivation': 0,
  'Blackening': 0,
  'Miso/Paste': 25,
  'Garum': 40,
  'Lacto-Fermentation': 120,
  'Shoyu/Sauce': 130,
  'Alcoholic Brew': 130,
  'Kombucha': 180,
  'Vinegar': 150,
  'Bio-Hazard': 60,
};
export const DEFAULT_HYDRATION = 60;
export const MAX_HYDRATION = 200;

// --- ECONOMY ---
// The bench used to have no running costs and no ceiling on volume, so a single
// good recipe repeated forever was always the optimal play. These constants give
// the week a bill to pay and give bulk production a real trade-off.

// Batch volume is capped by the chosen vessel rather than a flat 4-reagent limit,
// so a bigger vessel genuinely produces more. Price grows with volume but
// SUBLINEARLY: doubling the batch does not double what the market will pay.
export const YIELD_SCALING_EXPONENT = 0.62;
// Absolute sanity ceiling on reagent units in one batch, whatever the vessel.
export const MAX_REAGENT_UNITS = 60;

// Weekly overheads. Rent is the floor you must beat; upkeep and utilities make
// expansion a commitment rather than a free upgrade.
export const WEEKLY_BENCH_RENT = 120;
// Upkeep is charged on the VOLUME of bench you keep, not the number of pots on
// it. Counting vessels was written when everything was a 1 kg jar; once reagents
// could be dialled by the gram and scaled to capacity, it inverted — a bench of
// two 60 L oak casks (120 L, four slots each) fell inside the free allowance and
// paid nothing at all, while eight 2 L mason jars (16 L) paid six lots of it.
// The free allowance is the starting jar and tray.
export const FREE_UPKEEP_LITRES = 5;
export const WEEKLY_UPKEEP_PER_LITRE = 2;
export const UTILITY_COST_PER_WATT = 1.10;

// Market saturation. Every sale depresses appetite for that ferment type;
// appetite recovers each week. Selling one type on repeat stops paying.
// MARKET ABSORPTION.
//
// These decide whether scaling up is a strategy or an exploit, and they were
// tuned when a batch was a 1 kg jar. Once a batch could be scaled to fill a 60 L
// cask, the market recovered faster than a full bench could flood it — spread
// across four ferment types, demand never fell below 0.95 and bulk ran to
// thirteen times the rent.
//
// Doubling the per-batch impact and slowing the recovery makes saturation
// actually bind. The opening is untouched, because a 2 kg batch barely dents
// anything and that is the whole point: the market notices tonnage, not effort.
// Measured over 30 weeks, full bench, four types, cheap substrate: the spread
// between the best and worst vessel falls from 2.8x to about 1.3x, so which
// vessel you use goes back to being a question about the ferment.
export const DEMAND_FLOOR = 0.25;
export const DEMAND_CEILING = 1.15;
export const DEMAND_DROP_PER_YIELD = 0.06;  // multiplied by the batch's yield multiplier
export const DEMAND_RECOVERY_PER_WEEK = 0.08;

// Insolvency. Ending a week in the red is a strike; three strikes closes the lab.
export const BANKRUPTCY_STRIKES = 3;

// --- STAFF ---
export const STAFF_ROLES: StaffRole[] = [
    {
        id: 'cleaner',
        name: 'Lab Porter',
        description: 'Dedicated cleaning staff to maintain sterility.',
        hiringCost: 300,
        weeklyWage: 100,
        icon: 'SprayCan',
        effectDescription: 'Hygiene never drops below 50%. Contamination risk reduced by 40%. Keeps large vessels a little more even.'
    },
    {
        id: 'tech',
        name: 'Lab Technician',
        description: 'Junior fermenter to monitor environmental controls.',
        hiringCost: 800,
        weeklyWage: 250,
        icon: 'Thermometer',
        effectDescription: 'Corrects temperature drift in incubators, and walks the benches turning large vessels — halves how fast they stratify.'
    },
    {
        id: 'chef',
        name: 'Sous Chef',
        description: 'Culinary expert to refine flavor profiles.',
        hiringCost: 2000,
        weeklyWage: 600,
        icon: 'ChefHat',
        effectDescription: 'Increases Sell Value by 15%. Extends "Peak Quality" window by 20%.'
    },
    {
        id: 'rd',
        name: 'Head of R&D',
        description: 'Master fermenter. A legend in the field.',
        hiringCost: 5000,
        weeklyWage: 1200,
        icon: 'Microscope',
        effectDescription: 'Prevents Thermal Death events. Maximizes Umami potential scaling.'
    }
];

// --- SUPPLIERS ---
export const SUPPLIERS: Supplier[] = [
  { id: 'nordic', name: 'Nordic Staples Co.', description: 'Local grains, salts, and basic legumes.', color: 'amber' },
  { id: 'asia_import', name: 'Silk Road Imports', description: 'Traditional soy, chilies, and rice varieties.', color: 'red' },
  { id: 'biolab', name: 'BioLab Cultures', description: 'Advanced spores and enzymatic starters.', color: 'purple' },
  { id: 'prime', name: 'Prime Sourcing Ltd.', description: 'High-end meats and seasonal produce.', color: 'rose' },
  FORAGE_SUPPLIER,
  { id: 'tech', name: 'Lab Tech Solutions', description: 'Heavy machinery and processing tools.', color: 'blue' },
  { id: 'black_market', name: 'The Underground', description: 'Restricted, dangerous, and legendary items.', color: 'zinc' },
  { id: 'in_house', name: 'In-House Production', description: 'Made in your own lab.', color: 'emerald' }
];

// --- VESSELS ---
export const VESSELS: Vessel[] = [
    {
        id: 'mason_jar',
        name: 'Glass Jar',
        slotsRequired: 1,
        powerDraw: 0,
        cost: 20,
        description: 'Basic anaerobic vessel. Good for beginners.',
        idealFor: [FermentType.LACTO, FermentType.VINEGAR, FermentType.ALCOHOL],
        insulationFactor: 0.2,
        capacityL: 2
    },
    {
        id: 'koji_tray',
        name: 'Cedar Tray',
        slotsRequired: 1,
        powerDraw: 0,
        cost: 50,
        description: 'Wide surface area for aerobic mold growth.',
        idealFor: [FermentType.KOJI, FermentType.MISO],
        insulationFactor: 0.1,
        capacityL: 3
    },
    {
        id: 'onggi',
        name: 'Earthenware Onggi',
        slotsRequired: 2,
        powerDraw: 0,
        cost: 200,
        description: 'Micro-porous clay. Breathable yet insulating.',
        idealFor: [FermentType.MISO, FermentType.SHOYU, FermentType.LACTO],
        insulationFactor: 0.7,
        capacityL: 20
    },
    {
        /* THE MURO.
           Koji had two bad options and no good one. A cedar tray is correct in
           form — wide, shallow, breathable — but it has no heat at all, so a
           bed in a cold month simply never gets going. The Thermal Chamber has
           the heat but insulates at 0.9, and the critic has always said so:
           "Incubators provide too much insulation for Koji. The metabolic heat
           trapped inside killed the mold." Both true, and between them nothing.

           A real muro is a cedar-lined warm cupboard: gently heated, breathable
           enough to shed the heat the bed makes itself, and misted by hand.
           Cheaper than the chamber, a third of the power, and capped at 34 C —
           it will hold a koji bed and it will not pasteurise a garum, so it does
           not quietly become a cut-price chamber. */
        id: 'koji_muro',
        name: 'Cedar Muro',
        slotsRequired: 2,
        powerDraw: 45,
        cost: 420,
        description: 'A warm cedar cupboard. Gentle heat to 35°C, breathable, misted by hand.',
        idealFor: [FermentType.KOJI],
        insulationFactor: 0.45,
        capacityL: 8,
        heatedTo: 35
    },
    {
        id: 'incubator',
        name: 'Thermal Chamber',
        slotsRequired: 2,
        powerDraw: 150,
        cost: 1500,
        description: 'Precise temperature control for sensitive projects.',
        idealFor: [FermentType.GARUM, FermentType.BLACK, FermentType.KOJI],
        insulationFactor: 0.9,
        capacityL: 10,
        heatedTo: 70
    },
    {
        id: 'cedar_barrel',
        name: 'Cedar Barrel',
        slotsRequired: 4,
        powerDraw: 0,
        cost: 500,
        description: 'Large scale wood fermentation. Adds tannin.',
        idealFor: [FermentType.MISO, FermentType.SHOYU, FermentType.VINEGAR],
        insulationFactor: 0.5,
        capacityL: 50
    },
    {
        id: 'oak_cask',
        name: 'Oak Cask',
        slotsRequired: 4,
        powerDraw: 0,
        cost: 800,
        description: 'For long-aging liquids. Complex flavor development.',
        idealFor: [FermentType.GARUM, FermentType.ALCOHOL, FermentType.VINEGAR],
        insulationFactor: 0.6,
        capacityL: 60
    }
];

// --- INGREDIENTS ---
export const INGREDIENTS: Ingredient[] = [
    // --- SUBSTRATES ---
    {
        id: 'barley',
        name: 'Pearl Barley',
        type: IngredientType.SUBSTRATE,
        baseCost: 5,
        currency: 'money',
        quality: 60,
        description: 'Polished grains, perfect for Koji.',
        idealFor: ['koji'],
        supplierId: 'nordic',
        tierRequired: 0,
        hiddenStats: { starchContent: 9, sugarContent: 6, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 3 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'soybeans',
        name: 'Yellow Soybeans',
        type: IngredientType.SUBSTRATE,
        baseCost: 8,
        currency: 'money',
        quality: 70,
        description: 'High protein legume for Miso.',
        idealFor: ['miso', 'shoyu'],
        supplierId: 'asia_import',
        tierRequired: 0,
        hiddenStats: { starchContent: 2, sugarContent: 3, nativeSalinity: 0, microbialDiversity: 3, fatContent: 4, proteinContent: 9 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'black_soybeans',
        name: 'Black Soybeans',
        type: IngredientType.SUBSTRATE,
        baseCost: 15,
        currency: 'money',
        quality: 85,
        description: 'Rich, savory beans for Douchi.',
        idealFor: ['miso'],
        supplierId: 'asia_import',
        tierRequired: 2,
        hiddenStats: { starchContent: 2, sugarContent: 4, nativeSalinity: 0, microbialDiversity: 4, fatContent: 5, proteinContent: 9 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'glutinous_rice',
        name: 'Glutinous Rice',
        type: IngredientType.SUBSTRATE,
        baseCost: 12,
        currency: 'money',
        quality: 75,
        description: 'Sticky rice, high starch content.',
        idealFor: ['miso', 'alcohol'],
        supplierId: 'asia_import',
        tierRequired: 1,
        hiddenStats: { starchContent: 10, sugarContent: 8, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 2 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'raw_milk',
        name: 'Raw Milk',
        type: IngredientType.SUBSTRATE,
        baseCost: 25,
        currency: 'money',
        quality: 80,
        description: 'Unpasteurized dairy. High risk, high reward.',
        idealFor: ['lacto', 'cheese'],
        supplierId: 'prime',
        tierRequired: 2,
        hiddenStats: { starchContent: 0, sugarContent: 5, nativeSalinity: 1, microbialDiversity: 8, fatContent: 8, proteinContent: 6 },
        mass: 1000,
        unitDisplay: 'ml',
        tags: ['HIGH_RISK']
    },
    {
        id: 'anchovies',
        name: 'Fresh Anchovies',
        type: IngredientType.SUBSTRATE,
        baseCost: 40,
        currency: 'money',
        quality: 90,
        description: 'Oily fish, perfect for Garum.',
        idealFor: ['garum'],
        supplierId: 'prime',
        tierRequired: 1,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 2, microbialDiversity: 6, fatContent: 7, proteinContent: 8 },
        mass: 1000,
        unitDisplay: 'g',
        tags: ['SEAFOOD']
    },
    {
        id: 'mackerel',
        name: 'Mackerel',
        type: IngredientType.SUBSTRATE,
        baseCost: 35,
        currency: 'money',
        quality: 80,
        description: 'Strong flavored fish.',
        idealFor: ['garum'],
        supplierId: 'prime',
        tierRequired: 1,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 1, microbialDiversity: 5, fatContent: 9, proteinContent: 8 },
        mass: 1000,
        unitDisplay: 'g',
        tags: ['SEAFOOD']
    },
    {
        id: 'mullet_roe',
        name: 'Mullet Roe Sack',
        type: IngredientType.SUBSTRATE,
        baseCost: 120,
        currency: 'money',
        quality: 95,
        description: 'Precious roe for Bottarga.',
        idealFor: ['curing'],
        supplierId: 'prime',
        tierRequired: 3,
        hiddenStats: { starchContent: 0, sugarContent: 1, nativeSalinity: 2, microbialDiversity: 4, fatContent: 8, proteinContent: 9 },
        mass: 500,
        unitDisplay: 'g',
        tags: ['SEAFOOD', 'HIGH_RISK']
    },
    {
        id: 'scallops',
        name: 'Dried Scallops',
        type: IngredientType.SUBSTRATE,
        baseCost: 200,
        currency: 'money',
        quality: 100,
        description: 'Concentrated Umami bombs.',
        idealFor: ['amino_paste'],
        supplierId: 'prime',
        tierRequired: 4,
        hiddenStats: { starchContent: 0, sugarContent: 4, nativeSalinity: 3, microbialDiversity: 2, fatContent: 2, proteinContent: 10 },
        mass: 500,
        unitDisplay: 'g',
        tags: ['SEAFOOD']
    },
    {
        id: 'ceps',
        name: 'Wild Ceps (Porcini)',
        type: IngredientType.SUBSTRATE,
        baseCost: 150,
        currency: 'money',
        quality: 95,
        description: 'Forest mushrooms. Earthy and sweet.',
        idealFor: ['lacto', 'shoyu'],
        supplierId: 'nordic',
        tierRequired: 3,
        hiddenStats: { starchContent: 1, sugarContent: 3, nativeSalinity: 0, microbialDiversity: 7, fatContent: 1, proteinContent: 5 },
        mass: 500,
        unitDisplay: 'g'
    },
    {
        id: 'plums',
        name: 'Green Plums',
        type: IngredientType.SUBSTRATE,
        baseCost: 15,
        currency: 'money',
        quality: 70,
        description: 'Unripe fruit, high acidity.',
        idealFor: ['lacto', 'vinegar'],
        supplierId: 'nordic',
        tierRequired: 0,
        hiddenStats: { starchContent: 1, sugarContent: 6, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'yellow_peas',
        name: 'Yellow Peas',
        type: IngredientType.SUBSTRATE,
        baseCost: 8,
        currency: 'money',
        quality: 60,
        description: 'Alternative to soy. Sweet and grassy.',
        idealFor: ['miso'],
        supplierId: 'nordic',
        tierRequired: 1,
        hiddenStats: { starchContent: 6, sugarContent: 5, nativeSalinity: 0, microbialDiversity: 3, fatContent: 2, proteinContent: 7 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'garlic_bulbs',
        name: 'Whole Garlic',
        type: IngredientType.SUBSTRATE,
        baseCost: 20,
        currency: 'money',
        quality: 80,
        description: 'Pungent allium. Turns black with heat.',
        idealFor: ['black'],
        supplierId: 'asia_import',
        tierRequired: 1,
        hiddenStats: { starchContent: 3, sugarContent: 7, nativeSalinity: 0, microbialDiversity: 4, fatContent: 1, proteinContent: 4 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'broad_beans',
        name: 'Broad Beans',
        type: IngredientType.SUBSTRATE,
        baseCost: 10,
        currency: 'money',
        quality: 65,
        description: 'Fava beans. Key for Doubanjiang.',
        idealFor: ['miso'],
        supplierId: 'asia_import',
        tierRequired: 1,
        hiddenStats: { starchContent: 6, sugarContent: 4, nativeSalinity: 0, microbialDiversity: 3, fatContent: 2, proteinContent: 8 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'shrimp_fry',
        name: 'Krill / Shrimp Fry',
        type: IngredientType.SUBSTRATE,
        baseCost: 30,
        currency: 'money',
        quality: 75,
        description: 'Tiny crustaceans for Bagoong.',
        idealFor: ['miso'],
        supplierId: 'asia_import',
        tierRequired: 2,
        hiddenStats: { starchContent: 0, sugarContent: 1, nativeSalinity: 3, microbialDiversity: 8, fatContent: 4, proteinContent: 9 },
        mass: 1000,
        unitDisplay: 'g',
        tags: ['SEAFOOD']
    },
    {
        id: 'coconut_sap',
        name: 'Coconut Sap',
        type: IngredientType.SUBSTRATE,
        baseCost: 25,
        currency: 'money',
        quality: 80,
        description: 'Sweet nectar for Tuba/Vinegar.',
        idealFor: ['vinegar'],
        supplierId: 'asia_import',
        tierRequired: 2,
        hiddenStats: { starchContent: 0, sugarContent: 10, nativeSalinity: 0, microbialDiversity: 6, fatContent: 2, proteinContent: 1 },
        mass: 1000,
        unitDisplay: 'ml'
    },
    {
        id: 'pine_needles',
        name: 'Young Pine Needles',
        type: IngredientType.SUBSTRATE,
        baseCost: 5,
        currency: 'money',
        quality: 90,
        description: 'Foraged wild aromatics.',
        idealFor: ['syrup'],
        supplierId: 'nordic',
        tierRequired: 0,
        hiddenStats: { starchContent: 0, sugarContent: 2, nativeSalinity: 0, microbialDiversity: 9, fatContent: 3, proteinContent: 0 },
        mass: 500,
        unitDisplay: 'g'
    },
    {
        id: 'rose_petals',
        name: 'Damask Rose Petals',
        type: IngredientType.SUBSTRATE,
        baseCost: 60,
        currency: 'money',
        quality: 95,
        description: 'Highly aromatic floral matter.',
        idealFor: ['garum', 'syrup'],
        supplierId: 'prime',
        tierRequired: 3,
        hiddenStats: { starchContent: 0, sugarContent: 4, nativeSalinity: 0, microbialDiversity: 5, fatContent: 1, proteinContent: 1 },
        mass: 250,
        unitDisplay: 'g'
    },

    // --- STARTERS ---
    {
        id: 'koji_spores',
        name: 'A. Oryzae Spores',
        type: IngredientType.STARTER,
        baseCost: 15,
        currency: 'money',
        quality: 80,
        description: 'Standard yellow koji-kin. Even-handed: makes both amylase and protease.',
        strainBias: 0.5,
        idealFor: ['koji'],
        supplierId: 'biolab',
        tierRequired: 0,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0 },
        mass: 10,
        unitDisplay: 'g',
        isLiving: true
    },
    {
        id: 'ancient_spores',
        name: 'Ancient Spores',
        type: IngredientType.STARTER,
        baseCost: 420,
        currency: 'money',
        quality: 100,
        description: 'Recovered from a clay pot 1000 years old. Protease-heavy and unpredictable.',
        strainBias: 0.35,
        idealFor: ['garum'],
        supplierId: 'black_market',
        tierRequired: 0,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 10, fatContent: 0, proteinContent: 0 },
        mass: 5,
        unitDisplay: 'g',
        isLiving: true,
        tags: ['HIGH_RISK'],
        contraband: true,
        heatPerUnit: 12,
        undergroundTier: 1
    },
    {
        id: 'fly_larvae',
        name: 'Cheese Fly Larvae',
        type: IngredientType.STARTER,
        baseCost: 260,
        currency: 'money',
        quality: 90,
        description: 'Piophila casei. Illegal in most countries.',
        idealFor: ['cheese'],
        supplierId: 'black_market',
        tierRequired: 0,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 10, fatContent: 5, proteinContent: 10 },
        mass: 50,
        unitDisplay: 'g',
        isLiving: true,
        tags: ['BIOHAZARD'],
        contraband: true,
        heatPerUnit: 15,
        undergroundTier: 2
    },

    // --- ADDITIVES ---
    {
        id: 'salt',
        name: 'Sea Salt',
        type: IngredientType.ADDITIVE,
        baseCost: 2,
        currency: 'money',
        quality: 50,
        description: 'Basic NaCl. Prevents spoilage.',
        idealFor: ['all'],
        supplierId: 'nordic',
        tierRequired: 0,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 10, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'trapani_salt',
        name: 'Trapani Sea Salt',
        type: IngredientType.ADDITIVE,
        baseCost: 15,
        currency: 'money',
        quality: 90,
        description: 'Hand-harvested Sicilian salt. Rich in minerals.',
        idealFor: ['all'],
        supplierId: 'prime',
        tierRequired: 2,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 10, microbialDiversity: 1, fatContent: 0, proteinContent: 0 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'water',
        name: 'Filtered Water',
        type: IngredientType.ADDITIVE,
        baseCost: 1,
        currency: 'money',
        quality: 50,
        description: 'H2O. Essential for brine.',
        idealFor: ['all'],
        supplierId: 'nordic',
        tierRequired: 0,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
        mass: 1000,
        unitDisplay: 'ml'
    },
    {
        id: 'sugar',
        name: 'Cane Sugar',
        type: IngredientType.ADDITIVE,
        baseCost: 5,
        currency: 'money',
        quality: 60,
        description: 'Food for yeast.',
        idealFor: ['alcohol', 'syrup'],
        supplierId: 'nordic',
        tierRequired: 0,
        hiddenStats: { starchContent: 0, sugarContent: 10, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'chili',
        name: 'Dried Chilies',
        type: IngredientType.ADDITIVE,
        baseCost: 12,
        currency: 'money',
        quality: 70,
        description: 'Adds heat and antibacterial properties.',
        idealFor: ['miso'],
        supplierId: 'asia_import',
        tierRequired: 1,
        hiddenStats: { starchContent: 0, sugarContent: 2, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 0 },
        mass: 250,
        unitDisplay: 'g'
    },
    {
        id: 'tears',
        name: 'Vial of Tears',
        type: IngredientType.ADDITIVE,
        baseCost: 900,
        currency: 'money',
        quality: 100,
        description: 'Collected from the grieving. Saline and sorrowful.',
        idealFor: ['garum'],
        supplierId: 'black_market',
        tierRequired: 0,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 9, microbialDiversity: 5, fatContent: 0, proteinContent: 1 },
        mass: 50,
        unitDisplay: 'ml',
        contraband: true,
        heatPerUnit: 22,
        undergroundTier: 3
    },
    {
        id: 'wheat',
        name: 'Roasted Wheat',
        type: IngredientType.ADDITIVE,
        baseCost: 5,
        currency: 'money',
        quality: 65,
        description: 'Essential for Shoyu.',
        idealFor: ['shoyu'],
        supplierId: 'asia_import',
        tierRequired: 0,
        hiddenStats: { starchContent: 0, sugarContent: 5, nativeSalinity: 0, microbialDiversity: 1, fatContent: 0, proteinContent: 2 },
        mass: 1000,
        unitDisplay: 'g'
    },

    // --- PROCESSED INTERMEDIATES (Can be bought or made) ---
    {
        id: 'barley_koji',
        name: 'Barley Koji',
        type: IngredientType.SUBSTRATE, // Can act as substrate for miso
        baseCost: 25,
        currency: 'money',
        quality: 80,
        description: 'Ready-to-use inoculated barley. Grown balanced, leaning savoury.',
        enzymes: { amylase: 44, protease: 52 },
        idealFor: ['miso'],
        supplierId: 'in_house', // Or buy from Biolab
        tierRequired: 0,
        hiddenStats: { starchContent: 8, sugarContent: 6, nativeSalinity: 0, microbialDiversity: 8, fatContent: 1, proteinContent: 4 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'koji_rice',
        name: 'Rice Koji',
        type: IngredientType.SUBSTRATE,
        baseCost: 30,
        currency: 'money',
        quality: 80,
        description: 'Inoculated rice grains. Grown on starch, so it is amylase-heavy — the sweet one.',
        enzymes: { amylase: 66, protease: 30 },
        idealFor: ['miso', 'amazake'],
        supplierId: 'biolab',
        tierRequired: 1,
        hiddenStats: { starchContent: 9, sugarContent: 8, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 2 },
        mass: 1000,
        unitDisplay: 'g'
    },
    {
        id: 'amino_sauce',
        name: 'Amino Sauce (Shoyu)',
        type: IngredientType.ADDITIVE, // Treated as sauce
        baseCost: 40,
        currency: 'money',
        quality: 80,
        description: 'Pressed liquid savory seasoning.',
        idealFor: ['flavor'],
        supplierId: 'in_house',
        tierRequired: 0,
        hiddenStats: { starchContent: 0, sugarContent: 2, nativeSalinity: 10, microbialDiversity: 5, fatContent: 0, proteinContent: 8 },
        mass: 1000,
        unitDisplay: 'ml'
    },

    // --- TOOLS ---
    {
        id: 'portable_fan',
        name: 'Clip-on Fan',
        type: IngredientType.TOOL,
        baseCost: 150,
        currency: 'money',
        quality: 50,
        description: 'Increases evaporation. Cools Koji.',
        idealFor: ['koji'],
        supplierId: 'tech',
        tierRequired: 1,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
        mass: 500,
        unitDisplay: 'g'
    },
    {
        id: 'humidifier',
        name: 'Ultrasonic Mister',
        type: IngredientType.TOOL,
        baseCost: 250,
        currency: 'money',
        quality: 70,
        description: 'Maintains high humidity.',
        idealFor: ['koji', 'curing'],
        supplierId: 'tech',
        tierRequired: 2,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
        mass: 800,
        unitDisplay: 'g'
    },
    {
        id: 'wooden_press',
        name: 'Hydro-Press',
        type: IngredientType.TOOL,
        baseCost: 500,
        currency: 'money',
        quality: 80,
        description: 'Extracts liquid from mash. Increases yield.',
        idealFor: ['shoyu'],
        supplierId: 'tech',
        tierRequired: 3,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
        mass: 5000,
        unitDisplay: 'g'
    },
    {
        id: 'centrifuge',
        name: 'Centrifuge',
        type: IngredientType.TOOL,
        baseCost: 2000,
        currency: 'money',
        quality: 100,
        description: 'Clarifies liquids by force. Removes solids.',
        idealFor: ['garum', 'vinegar'],
        supplierId: 'tech',
        tierRequired: 5,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
        mass: 10000,
        unitDisplay: 'g'
    },
    // --- AGITATION ---
    // Volume ferments unevenly, and evening it out by hand is the price of
    // working at scale. These are the capital answer to that labour: a paddle
    // helps you do it, a motor does it for you. Without them a 60 L cask caps
    // around 75; with the motor it looks after itself.
    {
        id: 'mash_paddle',
        name: 'Mash Paddle',
        type: IngredientType.TOOL,
        baseCost: 180,
        currency: 'money',
        quality: 100,
        description: 'A long oak paddle. Reaches the bottom of a cask, so one pass actually turns the whole mass instead of the top third.',
        idealFor: ['miso', 'shoyu', 'doubanjiang'],
        supplierId: 'tech',
        tierRequired: 1,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
        mass: 2000,
        unitDisplay: 'g'
    },
    {
        id: 'agitator',
        name: 'Geared Agitator',
        type: IngredientType.TOOL,
        baseCost: 2400,
        currency: 'money',
        quality: 100,
        description: 'A motor and a slow paddle on a timer. Keeps a large vessel turning by itself — the difference between a workshop and a works.',
        idealFor: ['miso', 'shoyu', 'garum'],
        supplierId: 'tech',
        tierRequired: 4,
        hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
        mass: 24000,
        unitDisplay: 'g'
    }
];

// --- BUYERS ---

// Grey-market copies. Chemically the same fish — they resolve as their legal
// counterpart in the recipe matrix — but the quality is 30 points lower, which
// pays through the EXISTING terroir cap in calculateCriticScore
// (qualityCap = 60 + avgQuality * 0.4). Cheap inputs cap your ceiling: irrelevant
// when you are selling to a school district, decisive when it is fine dining.
const greyCopy = (
  src: { id: string; name: string; type: IngredientType; baseCost: number; quality: number;
         idealFor: string[]; hiddenStats: HiddenStats; mass: number; unitDisplay: string; tags?: string[] },
  tier: number,
  heat: number
): Ingredient => ({
  id: `bm_${src.id}`,
  name: `${src.name} (no papers)`,
  type: src.type,
  baseCost: Math.round(src.baseCost * 0.48),
  currency: 'money',
  quality: Math.max(10, src.quality - 30),
  description: `Unlabelled ${src.name.toLowerCase()}. Half price, no provenance, no questions.`,
  idealFor: src.idealFor,
  supplierId: 'black_market',
  tierRequired: 0,
  hiddenStats: src.hiddenStats,
  mass: src.mass,
  unitDisplay: src.unitDisplay,
  tags: [...(src.tags ?? []), 'GREY_MARKET'],
  contraband: true,
  heatPerUnit: heat,
  legitCounterpartId: src.id,
  undergroundTier: tier,
});

export const GREY_MARKET_SOURCES: { id: string; tier: number; heat: number }[] = [
  { id: 'anchovies', tier: 1, heat: 2 },
  { id: 'mackerel', tier: 1, heat: 2 },
  { id: 'raw_milk', tier: 1, heat: 3 },
  { id: 'mullet_roe', tier: 2, heat: 4 },
  { id: 'scallops', tier: 2, heat: 4 },
];

// --- OTHER ORGANISMS ---
// The game only knew Aspergillus, which is a narrow view of fermentation. These
// are the other workhorses, and they behave genuinely differently: Rhizopus
// binds rather than saccharifies, Bacillus is a bacterium that wants heat no
// mould would survive, Penicillium ripens from the outside in, and nuruk is a
// wild consortium rather than a single selected strain.
const ORGANISMS: Ingredient[] = [
  {
    id: 'rhizopus',
    name: 'R. Oligosporus (Tempeh)',
    type: IngredientType.STARTER,
    baseCost: 35,
    currency: 'money',
    quality: 88,
    description: 'Binds cooked beans into a solid cake with white mycelium. Very little enzyme — it knits rather than digests.',
    idealFor: ['tempeh'],
    supplierId: 'biolab',
    tierRequired: 1,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 0 },
    mass: 15, unitDisplay: 'g', isLiving: true,
    strainBias: 0.45,
  },
  {
    id: 'bacillus_natto',
    name: 'B. Subtilis var. natto',
    type: IngredientType.STARTER,
    baseCost: 30,
    currency: 'money',
    quality: 86,
    description: 'A bacterium, not a mould. Wants 40°C and wet air — conditions that would kill koji outright.',
    idealFor: ['natto'],
    supplierId: 'biolab',
    tierRequired: 2,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 9, fatContent: 0, proteinContent: 0 },
    mass: 10, unitDisplay: 'g', isLiving: true,
    strainBias: 0.2,
  },
  {
    id: 'nuruk',
    name: 'Nuruk Cake',
    type: IngredientType.STARTER,
    baseCost: 48,
    currency: 'money',
    quality: 82,
    description: 'A wild Korean starter cake: moulds, yeasts and bacteria together. Less predictable than koji, and more alive.',
    idealFor: ['makgeolli', 'jang'],
    supplierId: 'asia_import',
    tierRequired: 2,
    hiddenStats: { starchContent: 3, sugarContent: 1, nativeSalinity: 0, microbialDiversity: 10, fatContent: 0, proteinContent: 1 },
    mass: 200, unitDisplay: 'g', isLiving: true,
    strainBias: 0.7,
  },
  {
    id: 'p_roqueforti',
    name: 'P. Roqueforti',
    type: IngredientType.STARTER,
    baseCost: 55,
    currency: 'money',
    quality: 90,
    description: 'Blue mould. Needs air in the paste to strike, which is why the cheese is pierced.',
    idealFor: ['cheese'],
    supplierId: 'biolab',
    tierRequired: 3,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 0 },
    mass: 10, unitDisplay: 'g', isLiving: true,
    strainBias: 0.25,
  },
  {
    id: 'a_glaucus',
    name: 'A. Glaucus (Katsuobushi)',
    type: IngredientType.STARTER,
    baseCost: 70,
    currency: 'money',
    quality: 94,
    description: 'Draws moisture out of dried fish over months of repeated sunning and moulding. Nothing is faster.',
    idealFor: ['katsuobushi'],
    supplierId: 'asia_import',
    tierRequired: 3,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 7, fatContent: 0, proteinContent: 0 },
    mass: 10, unitDisplay: 'g', isLiving: true,
    strainBias: 0.1,
  },
];

const NEW_SUBSTRATES: Ingredient[] = [
  {
    id: 'napa_cabbage', name: 'Napa Cabbage', type: IngredientType.SUBSTRATE,
    baseCost: 6, currency: 'money', quality: 72,
    description: 'Loose-leaved and full of water. Salted down, it gives up its liquid and makes its own brine.',
    idealFor: ['lacto', 'kimchi'], supplierId: 'nordic', tierRequired: 0,
    hiddenStats: { starchContent: 1, sugarContent: 4, nativeSalinity: 0, microbialDiversity: 7, fatContent: 0, proteinContent: 1 },
    mass: 1000, unitDisplay: 'kg',
  },
  {
    id: 'white_cabbage', name: 'White Cabbage', type: IngredientType.SUBSTRATE,
    baseCost: 4, currency: 'money', quality: 70,
    description: 'Dense and dry-leaved. Shredded and weighted, it ferments under its own liquid for months.',
    idealFor: ['lacto'], supplierId: 'nordic', tierRequired: 0,
    hiddenStats: { starchContent: 1, sugarContent: 5, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 1 },
    mass: 1000, unitDisplay: 'kg',
  },
  {
    id: 'pork_belly', name: 'Pork Belly', type: IngredientType.SUBSTRATE,
    baseCost: 55, currency: 'money', quality: 84,
    description: 'Fat and lean in layers. Cured and hung, the fat carries everything the culture makes.',
    idealFor: ['salumi'], supplierId: 'prime', tierRequired: 2,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 1, microbialDiversity: 3, fatContent: 9, proteinContent: 7 },
    mass: 1000, unitDisplay: 'kg',
  },
  {
    id: 'herring', name: 'Baltic Herring', type: IngredientType.SUBSTRATE,
    baseCost: 22, currency: 'money', quality: 76,
    description: 'Oily, and it turns fast. In a weak brine it ferments rather than cures — which is the point.',
    idealFor: ['garum', 'surstromming'], supplierId: 'prime', tierRequired: 1,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 2, microbialDiversity: 6, fatContent: 8, proteinContent: 8 },
    mass: 1000, unitDisplay: 'kg', tags: ['SEAFOOD', 'HIGH_RISK'],
  },
  {
    id: 'bonito', name: 'Skipjack Bonito', type: IngredientType.SUBSTRATE,
    baseCost: 48, currency: 'money', quality: 92,
    description: 'Lean, dense and almost fat-free — which is what lets it dry to something like wood.',
    idealFor: ['katsuobushi'], supplierId: 'prime', tierRequired: 3,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 1, microbialDiversity: 3, fatContent: 1, proteinContent: 12 },
    mass: 1000, unitDisplay: 'kg', tags: ['SEAFOOD'],
  },
  {
    id: 'rice_bran', name: 'Rice Bran (Nuka)', type: IngredientType.ADDITIVE,
    baseCost: 7, currency: 'money', quality: 74,
    description: 'The polishings. A bran bed lives for decades if you turn it by hand every day.',
    idealFor: ['nukazuke'], supplierId: 'asia_import', tierRequired: 1,
    hiddenStats: { starchContent: 5, sugarContent: 3, nativeSalinity: 0, microbialDiversity: 9, fatContent: 4, proteinContent: 3 },
    mass: 1000, unitDisplay: 'kg',
  },
];

const KOMBUCHA_KIT: Ingredient[] = [
  {
    id: 'scoby', name: 'SCOBY (Kombucha mother)', type: IngredientType.STARTER,
    baseCost: 28, currency: 'money', quality: 84,
    description: 'A cellulose raft of yeast and acetic bacteria. The yeast makes alcohol, the bacteria eat it and make acid — both at once.',
    idealFor: ['kombucha'], supplierId: 'biolab', tierRequired: 1,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 10, fatContent: 0, proteinContent: 0 },
    mass: 150, unitDisplay: 'g', isLiving: true, strainBias: 0.5,
  },
  {
    id: 'black_tea', name: 'Black Tea', type: IngredientType.SUBSTRATE,
    baseCost: 9, currency: 'money', quality: 80,
    description: 'Brewed strong. The tannins feed the culture as much as the sugar does — herbal infusions alone will starve it.',
    idealFor: ['kombucha'], supplierId: 'asia_import', tierRequired: 0,
    hiddenStats: { starchContent: 0, sugarContent: 2, nativeSalinity: 0, microbialDiversity: 1, fatContent: 0, proteinContent: 0 },
    mass: 1000, unitDisplay: 'ml',
  },
];

const PATHWAY_SUBSTRATES: Ingredient[] = [
  { id: 'heavy_cream', name: 'Heavy Cream', type: IngredientType.SUBSTRATE,
    baseCost: 18, currency: 'money', quality: 82,
    description: 'Almost pure butterfat. Nothing else in the pantry gives lipase this much to work on.',
    idealFor: ['lacto'], supplierId: 'prime', tierRequired: 1,
    hiddenStats: { starchContent: 0, sugarContent: 4, nativeSalinity: 0, microbialDiversity: 4, fatContent: 10, proteinContent: 3 },
    mass: 1000, unitDisplay: 'ml' },
  { id: 'hazelnuts', name: 'Toasted Hazelnuts', type: IngredientType.SUBSTRATE,
    baseCost: 42, currency: 'money', quality: 88,
    description: 'Half fat by weight, and enough protein to build a paste around it.',
    idealFor: ['miso'], supplierId: 'prime', tierRequired: 2,
    hiddenStats: { starchContent: 1, sugarContent: 3, nativeSalinity: 0, microbialDiversity: 2, fatContent: 9, proteinContent: 6 },
    mass: 1000, unitDisplay: 'kg' },
  { id: 'egg_yolks', name: 'Egg Yolks', type: IngredientType.SUBSTRATE,
    baseCost: 24, currency: 'money', quality: 86,
    description: 'Fat and protein and almost no water once the salt has had its way.',
    idealFor: ['cure'], supplierId: 'prime', tierRequired: 1,
    hiddenStats: { starchContent: 0, sugarContent: 1, nativeSalinity: 1, microbialDiversity: 2, fatContent: 9, proteinContent: 8 },
    mass: 500, unitDisplay: 'g' },
  { id: 'pineapple', name: 'Pineapple (rind & core)', type: IngredientType.SUBSTRATE,
    baseCost: 8, currency: 'money', quality: 70,
    description: 'The parts you would throw away. The yeast you need is already living on the skin.',
    idealFor: ['tepache'], supplierId: 'asia_import', tierRequired: 0,
    hiddenStats: { starchContent: 1, sugarContent: 9, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 1 },
    mass: 1000, unitDisplay: 'kg' },
  { id: 'apples', name: 'Cider Apples', type: IngredientType.SUBSTRATE,
    baseCost: 7, currency: 'money', quality: 76,
    description: 'Pressed for must. Sharp, tannic and full of the sugar two successive organisms want.',
    idealFor: ['vinegar'], supplierId: 'nordic', tierRequired: 0,
    hiddenStats: { starchContent: 1, sugarContent: 8, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1 },
    mass: 1000, unitDisplay: 'kg' },
];

INGREDIENTS.push(...ORGANISMS, ...NEW_SUBSTRATES, ...KOMBUCHA_KIT, ...PATHWAY_SUBSTRATES);

// --- SPORE STRAINS ---
// The same species bred in two directions. This is real: sake breweries and soy
// sauce brewers have selected A. oryzae for opposite ends of the enzyme ratio
// for centuries.
const STRAINS: Ingredient[] = [
  {
    id: 'sake_spores',
    name: 'Sake Koji-kin (Amylase strain)',
    type: IngredientType.STARTER,
    baseCost: 40,
    currency: 'money',
    quality: 88,
    description: 'Bred for saccharification. Run it warm and it will turn starch to sugar and little else.',
    idealFor: ['koji', 'amazake', 'alcohol'],
    supplierId: 'biolab',
    tierRequired: 1,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0 },
    mass: 10, unitDisplay: 'g', isLiving: true,
    strainBias: 0.85,
  },
  {
    id: 'shoyu_spores',
    name: 'Shoyu Koji-kin (Protease strain)',
    type: IngredientType.STARTER,
    baseCost: 45,
    currency: 'money',
    quality: 90,
    description: 'Bred for proteolysis. Run it cool and it will free more glutamate than anything else on the shelf.',
    idealFor: ['koji', 'shoyu', 'miso', 'garum'],
    supplierId: 'biolab',
    tierRequired: 2,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 0 },
    mass: 10, unitDisplay: 'g', isLiving: true,
    strainBias: 0.15,
  },
];
INGREDIENTS.push(...STRAINS);

// --- HIGHER-TIER STOCK ---
// Supplier loyalty levels up from spending, and the shelf gates on
// tierRequired — but several suppliers had nothing above tier 1 or 2, so
// levelling them paid out nothing. These are the rewards at the top of each
// ladder: higher quality (which raises the terroir cap) and stronger stats,
// so they raise the ceiling on what a batch can become.
const HIGH_TIER: Ingredient[] = [
  {
    id: 'aspergillus_luchuensis',
    name: 'A. Luchuensis (Black Koji)',
    type: IngredientType.STARTER,
    baseCost: 90,
    currency: 'money',
    quality: 92,
    description: 'Citric-acid producing black koji. Protease-leaning, and the acid protects a warm ferment from itself.',
    strainBias: 0.35,
    acidProtection: 18,
    idealFor: ['garum', 'shoyu'],
    supplierId: 'biolab',
    tierRequired: 2,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 2 },
    mass: 20, unitDisplay: 'g', isLiving: true,
  },
  {
    id: 'lacto_starter',
    name: 'Heirloom Lacto Culture',
    type: IngredientType.STARTER,
    baseCost: 130,
    currency: 'money',
    quality: 95,
    description: 'A stable, vigorous LAB culture. Sours cleanly instead of wildly.',
    idealFor: ['lacto'],
    supplierId: 'biolab',
    tierRequired: 3,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 9, fatContent: 0, proteinContent: 1 },
    mass: 25, unitDisplay: 'g', isLiving: true,
  },
  {
    id: 'aged_soybeans',
    name: 'Three-Year Soybeans',
    type: IngredientType.SUBSTRATE,
    baseCost: 34,
    currency: 'money',
    quality: 96,
    description: 'Dry-stored until the starch has gone. Almost pure protein.',
    idealFor: ['miso', 'shoyu'],
    supplierId: 'asia_import',
    tierRequired: 3,
    hiddenStats: { starchContent: 1, sugarContent: 1, nativeSalinity: 0, microbialDiversity: 3, fatContent: 6, proteinContent: 11 },
    mass: 1000, unitDisplay: 'kg',
  },
  {
    id: 'bluefin_trim',
    name: 'Bluefin Trim',
    type: IngredientType.SUBSTRATE,
    baseCost: 120,
    currency: 'money',
    quality: 100,
    description: 'Offcuts from the good part of the fish. The highest umami ceiling money buys.',
    idealFor: ['garum'],
    supplierId: 'prime',
    tierRequired: 4,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 1, microbialDiversity: 4, fatContent: 9, proteinContent: 13 },
    mass: 1000, unitDisplay: 'kg', tags: ['SEAFOOD'],
  },
  {
    id: 'noma_salt',
    name: 'Hand-Harvested Flor de Sal',
    type: IngredientType.ADDITIVE,
    baseCost: 26,
    currency: 'money',
    quality: 100,
    description: 'Raked off the surface by hand. Nothing in it but salt and the sea.',
    idealFor: ['all'],
    supplierId: 'prime',
    tierRequired: 5,
    hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 100, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
    mass: 1000, unitDisplay: 'kg',
  },
  {
    id: 'winter_ceps',
    name: 'Winter Black Trumpet',
    type: IngredientType.SUBSTRATE,
    baseCost: 68,
    currency: 'money',
    quality: 94,
    description: 'Foraged after the first frost. Deeply savoury for a mushroom.',
    idealFor: ['lacto', 'miso'],
    supplierId: 'nordic',
    tierRequired: 4,
    hiddenStats: { starchContent: 1, sugarContent: 2, nativeSalinity: 0, microbialDiversity: 7, fatContent: 1, proteinContent: 8 },
    mass: 1000, unitDisplay: 'kg',
  },
];
INGREDIENTS.push(...HIGH_TIER);

// --- THE FORAGER, THE HERITAGE STAPLES AND THE MARKET ---
// Appended, never interleaved. Nothing reads this list by position — the sheet
// art is looked up by id — but appending leaves every existing entry where it was.
INGREDIENTS.push(...FORAGED_MUSHROOMS, ...HERITAGE_INGREDIENTS, ...MARKET_INGREDIENTS);

// Generated from the real entries above, so a grey copy can never drift from the
// ingredient it is a copy of.
GREY_MARKET_SOURCES.forEach(({ id, tier, heat }) => {
  const src = INGREDIENTS.find(i => i.id === id);
  if (src) INGREDIENTS.push(greyCopy(src, tier, heat));
});

export const BUYERS: Buyer[] = [
    {
        id: 'culinary_coop',
        name: 'Metropolitan Culinary Co-op',
        type: 'Private',
        description: 'Local culinary network & craft fermentation exchange. Always buys honest ferments at fair market value.',
        minReputation: 0,
        desiredTypes: [
            FermentType.LACTO, 
            FermentType.KOJI, 
            FermentType.MISO, 
            FermentType.SHOYU, 
            FermentType.GARUM, 
            FermentType.VINEGAR, 
            FermentType.BLACK, 
            FermentType.ALCOHOL
        ],
        minScore: 10,
        paysIn: 'money',
        priceMultiplier: 1.0,
        appetite: 4,
        unlock: { kind: 'open' },
        warmth: { cool: 'They will take almost anything, and it shows.', known: 'The buyer sets your crates aside from the rest.', trusted: 'They ask you first when something is short.' },
        dialogue: { 
            intro: "We distribute artisan and craft ferments across local restaurant kitchens.", 
            success: "Clean artisan batch accepted! Payment disbursed immediately.", 
            reject: "Contaminated or unusable batch." 
        }
    },
    {
        id: 'bio_reclamation',
        name: 'Bio-Organic Reclamation Co.',
        type: 'Industry',
        description: 'Salvages spoiled, over-fermented, or contaminated cultures for enzymatic fertilizer compost.',
        minReputation: 0,
        desiredTypes: [
            FermentType.FAIL,
            FermentType.LACTO, 
            FermentType.KOJI, 
            FermentType.MISO, 
            FermentType.SHOYU, 
            FermentType.GARUM, 
            FermentType.VINEGAR, 
            FermentType.BLACK, 
            FermentType.ALCOHOL
        ],
        minScore: 0,
        paysIn: 'money',
        priceMultiplier: 0.4,
        dialogue: { 
            intro: "We reclaim biological mass for nutrient compost and organic fertilizer.", 
            success: "Salvage verified. Biological haul compensation transferred.", 
            reject: "Nothing to salvage." 
        }
    },
    {
        id: 'food_blogger',
        name: 'Trending Eats',
        type: 'Private',
        description: 'Influencer looking for content. Pays in Exposure (Renown).',
        minReputation: 0,
        desiredTypes: [FermentType.LACTO, FermentType.VINEGAR, FermentType.ALCOHOL],
        minScore: 50,
        paysIn: 'renown', 
        priceMultiplier: 1.0,
        dialogue: { intro: "Can I film this for my story?", success: "My followers love it!", reject: "Not photogenic enough." }
    },
    {
        id: 'mega_mart',
        name: 'SuperSave Market',
        type: 'Supermarket',
        description: 'Requires high volume and safety. Low margins.',
        minReputation: 0,
        desiredTypes: [FermentType.LACTO, FermentType.VINEGAR],
        minScore: 40,
        paysIn: 'money',
        priceMultiplier: 0.8,
        dialogue: { intro: "We need 500 units for aisle 4.", success: "Adequate. Payment sent.", reject: "This is inconsistent. Rejected." }
    },
    {
        id: 'hipster_deli',
        name: 'The Fermented Jar',
        type: 'Private',
        description: 'Boutique shop. Likes trendy, funky items.',
        minReputation: 10,
        desiredTypes: [FermentType.MISO, FermentType.KOJI, FermentType.LACTO],
        minScore: 60,
        paysIn: 'money',
        priceMultiplier: 1.5,
        appetite: 4,
        unlock: { kind: 'ingredient', ingredientId: 'black_soybeans', label: 'Buy black soybeans — they only stock what they cannot get elsewhere.' },
        warmth: { cool: 'They take your crate without looking up.', known: 'The owner asks what you are working on next.', trusted: 'Your name is chalked on the board behind the counter.' },
        dialogue: { intro: "Got anything... alive?", success: "The microbes are singing!", reject: "Too commercial. Pass." }
    },
    {
        id: 'fine_dining',
        name: 'L\'Etoile du Nord',
        type: 'Restaurant',
        description: '2-Star Michelin. Demands perfection and complexity.',
        minReputation: 50,
        desiredTypes: [FermentType.GARUM, FermentType.SHOYU, FermentType.BLACK],
        minScore: 85,
        paysIn: 'renown', 
        priceMultiplier: 2.5,
        appetite: 2,
        unlock: { kind: 'introduction', byBuyerId: 'hipster_deli', standing: 45, label: 'Someone has to vouch for you. Get the deli to know you well first.' },
        warmth: { cool: 'The pass is not the place for conversation.', known: 'The chef de cuisine knows your name.', trusted: 'You are walked through the kitchen, not left at the door.' },
        dialogue: { intro: "Surprise my palate.", success: "Exquisite. I will mention your name.", reject: "Pedestrian garbage." }
    },
    {
        id: 'korean_bbq',
        name: 'Han\'s Grill',
        type: 'Restaurant',
        description: 'High volume, traditional Korean flavors.',
        minReputation: 20,
        desiredTypes: [FermentType.MISO], 
        minScore: 70,
        paysIn: 'money',
        priceMultiplier: 1.2,
        appetite: 4,
        warmth: { cool: 'Handed over at the back door.', known: 'The owner sits you down and feeds you.', trusted: 'You are family, and family gets told the truth about a bad batch.' },
        dialogue: { intro: "Need strong jang for the marinade.", success: "Good depth. More next week.", reject: "Weak flavor." }
    },
    {
        id: 'sichuan_house',
        name: 'Red Dragon Wok',
        type: 'Restaurant',
        description: 'Needs authentic, numbing fermentation.',
        minReputation: 25,
        desiredTypes: [FermentType.MISO], // Doubanjiang
        minScore: 75,
        paysIn: 'money',
        priceMultiplier: 1.4,
        appetite: 5,
        unlock: { kind: 'mastery', recipeId: 'doubanjiang', level: 2, label: 'Cook doubanjiang until you have the hang of it. The chef will not buy a paste from someone who has not.' },
        warmth: { cool: 'The chef tastes it, says nothing, and pays.', known: 'The chef starts telling you what was wrong with the last one.', trusted: 'You are consulted before the menu changes.' },
        dialogue: { intro: "Is it authentic?", success: "Perfect spice.", reject: "Lacks soul." }
    },
    {
        id: 'pharma',
        name: 'Zenith Pharma',
        type: 'Industry',
        description: 'Buying enzymes and molds for extraction.',
        minReputation: 30,
        desiredTypes: [FermentType.KOJI, FermentType.VINEGAR],
        minScore: 80,
        paysIn: 'money',
        priceMultiplier: 2.0,
        appetite: 6,
        unlock: { kind: 'renown', value: 40, label: 'Renown 40. They read about you before they call you.' },
        warmth: { cool: 'A purchase order and nothing else.', known: 'The buyer starts asking technical questions.', trusted: 'They send you their assay results unprompted.' },
        dialogue: { intro: "Purity is paramount.", success: "Bio-availability is high. Proceed.", reject: "Contaminated." }
    },
    {
        // --- THE FENCES ---
        // These pay MONEY, and they buy exactly what the licensed trade refuses.
        // That is the whole point: failure now has an outlet with teeth, instead
        // of only the 0.4x Bio-Reclamation salvage floor.
        id: 'bio_broker',
        name: 'Vitrine & Sons',
        type: 'Underground',
        description: 'Reclamation brokers. No questions about what died in there.',
        minReputation: 0,
        desiredTypes: [FermentType.GARUM, FermentType.MISO, FermentType.LACTO, FermentType.SHOYU,
                       FermentType.VINEGAR, FermentType.BLACK, FermentType.KOJI, FermentType.ALCOHOL, FermentType.FAIL],
        minScore: 0,
        paysIn: 'money',
        priceMultiplier: 1.0,
        undergroundTier: 1,
        pricesContraband: true,
        maxSafety: 55,          // refuses anything a legitimate buyer would take
        heatPerSale: 8,
        dialogue: { intro: "Show us the ruined stock.", success: "We can move that.", reject: "Too wholesome. Try a grocer." }
    },
    {
        id: 'collector',
        name: 'The Curator',
        type: 'Underground',
        description: 'Buys dangerous or extinct flavors. Illegal.',
        minReputation: 0,
        desiredTypes: [FermentType.GARUM, FermentType.MISO, FermentType.BLACK, FermentType.FAIL],
        minScore: 0,
        paysIn: 'money',
        priceMultiplier: 3.2,
        undergroundTier: 2,
        pricesContraband: true,
        requiresContraband: true,   // only wants things with no provenance
        requiresIntact: true,       // but not rot — it must still be a thing
        heatPerSale: 12,
        dialogue: { intro: "Do you have the forbidden sauce?", success: "Thrillingly toxic.", reject: "Boringly safe." }
    },
    {
        id: 'night_market',
        name: 'The Night Market',
        type: 'Underground',
        description: 'Cash, crates, no paperwork. Pays under the odds but never asks.',
        minReputation: 0,
        desiredTypes: [FermentType.LACTO, FermentType.MISO, FermentType.KOJI, FermentType.SHOYU,
                       FermentType.VINEGAR, FermentType.ALCOHOL, FermentType.BLACK, FermentType.GARUM],
        minScore: 25,
        paysIn: 'money',
        priceMultiplier: 0.9,
        undergroundTier: 2,
        heatPerSale: 5,
        dialogue: { intro: "Cash tonight, no receipt.", success: "Pleasure.", reject: "Not worth the crate." }
    },
    {
        id: 'mixologist',
        name: 'The Alchemist Bar',
        type: 'Private',
        description: 'Experimental cocktail bar. Needs unique acids and umami.',
        minReputation: 15,
        desiredTypes: [FermentType.ALCOHOL, FermentType.VINEGAR, FermentType.GARUM],
        minScore: 65,
        paysIn: 'money',
        priceMultiplier: 1.8,
        appetite: 3,
        unlock: { kind: 'recipeCount', count: 4, minScore: 70, label: 'Bring four different ferments to 70 or better. They want range, not one good trick.' },
        warmth: { cool: 'A polite nod across the bar.', known: 'They keep a bottle of yours behind the counter.', trusted: 'Two drinks on the list are built around your work.' },
        dialogue: { intro: "I need something to shock the senses.", success: "This will make a phenomenal garnish.", reject: "Flat. Boring." }
    },
    {
        id: 'school_district',
        name: 'City District Schools',
        type: 'Industry',
        description: 'Bulk buying for cafeteria lunches. Low standards.',
        minReputation: 5,
        desiredTypes: [FermentType.MISO],
        minScore: 30,
        paysIn: 'money',
        priceMultiplier: 0.6,
        dialogue: { intro: "We need 50kg of paste, doesn't need to be fancy.", success: "Contract signed.", reject: "Too expensive or weird." }
    },
    {
        id: 'vegan_startup',
        name: 'No-Moo Foods',
        type: 'Industry',
        description: 'Creating plant-based alternatives. Paying for clean labels.',
        minReputation: 20,
        desiredTypes: [FermentType.LACTO, FermentType.MISO],
        minScore: 75,
        paysIn: 'money',
        priceMultiplier: 1.6,
        appetite: 5,
        warmth: { cool: 'A courier collects it. You never meet anyone.', known: 'Someone from product finally calls you directly.', trusted: 'They want you on the packaging.' },
        dialogue: { intro: "Is it 100% plant-based and punchy?", success: "Excellent umami profile.", reject: "Contains animal notes." }
    }
];

// --- RECIPES ---
export const RECIPES: Recipe[] = [
  // --- 1. THE ITALIAN SCHOOL (Time & Wood) ---
  {
    id: 'colatura',
    name: 'Colatura di Alici',
    type: FermentType.GARUM,
    description: 'The Waiting Game. Oak aging required. Harvest early = Failure.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'colatura_bottle',
    requiredVesselId: 'oak_cask',
    baseDurationSeconds: 400, // Very Slow
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 20, humidity: 60, salinity: 25 },
    idealFlavorProfile: { umami: 95, acidity: 10, funk: 30, sweetness: 5, safety: 100 },
    difficulty: 3
  },
  {
    id: 'bottarga',
    name: 'Cured Bottarga',
    type: FermentType.MISO, // Mechanic: Curing
    description: 'Dry Curing. If humidity spikes > 40%, it rots immediately.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'bottarga_block',
    requiredVesselId: 'koji_tray', // For airflow
    baseDurationSeconds: 60,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: 'Flip',
    idealParams: { temp: 15, humidity: 30, salinity: 15 }, // Needs LOW humidity
    idealFlavorProfile: { umami: 85, acidity: 5, funk: 40, sweetness: 10, safety: 95 },
    difficulty: 2
  },
  {
    id: 'ricotta_forte',
    name: 'Ricotta Forte',
    type: FermentType.LACTO,
    description: 'Controlled Rot. Requires frequent stirring to prevent bad mold.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'ricotta_jar',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 120,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: 'Stir',
    idealParams: { temp: 18, humidity: 70, salinity: 5 },
    idealFlavorProfile: { umami: 60, acidity: 70, funk: 90, sweetness: 10, safety: 80 },
    difficulty: 4
  },
  {
    id: 'garum_sociorum',
    name: 'Garum Sociorum',
    type: FermentType.GARUM,
    description: 'Ancient Roman Ketchup. Mackerel fermented with heat for speed.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'garum_bottle',
    requiredVesselId: 'incubator',
    baseDurationSeconds: 150,
    peakWindowStart: 85,
    peakWindowEnd: 95,
    activeIntervention: 'Skim',
    idealParams: { temp: 40, humidity: 50, salinity: 20 }, // Roman quick-garum: 40C / 20% salt
    idealFlavorProfile: { umami: 100, acidity: 15, funk: 80, sweetness: 0, safety: 95 },
    difficulty: 2
  },

  // --- 2. THE EAST ASIAN SCHOOL (Koji & Soy) ---
  {
    id: 'doubanjiang',
    name: 'Pixian Doubanjiang',
    type: FermentType.MISO,
    description: 'The Soul of Sichuan. Requires stirring daily or chilies float and mold.',
    requiredIngredients: { substrate: true, starter: 'koji_rice', additive: 'chili' }, // + Wheat implied
    outputIngredientId: 'doubanjiang_paste',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 160,
    peakWindowStart: 85,
    peakWindowEnd: 95,
    activeIntervention: 'Stir', // Daily stir
    idealParams: { temp: 22, humidity: 60, salinity: 12 },
    idealFlavorProfile: { umami: 85, acidity: 25, funk: 60, sweetness: 15, safety: 100 },
    difficulty: 3
  },
  {
    id: 'douchi',
    name: 'Douchi (Black Beans)',
    type: FermentType.MISO,
    description: 'Savory umami bombs. Beans inoculated directly with spores.',
    requiredIngredients: { substrate: true, starter: 'koji_spores', additive: 'salt' },
    outputIngredientId: 'douchi_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 90,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: 'Clean',
    idealParams: { temp: 25, humidity: 65, salinity: 12 },
    idealFlavorProfile: { umami: 90, acidity: 10, funk: 75, sweetness: 5, safety: 100 },
    difficulty: 2
  },
  {
    id: 'gochujang',
    name: 'Gochujang',
    type: FermentType.MISO,
    description: 'Starch Conversion. If temp is too high (>30C), turns into alcohol.',
    requiredIngredients: { substrate: true, starter: 'koji_rice', additive: 'chili' }, // + Rice
    outputIngredientId: 'gochujang_paste',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 140,
    peakWindowStart: 80,
    peakWindowEnd: 90,
    activeIntervention: 'Stir',
    idealParams: { temp: 20, humidity: 55, salinity: 8 },
    idealFlavorProfile: { umami: 70, acidity: 20, funk: 30, sweetness: 70, safety: 100 },
    difficulty: 2
  },
  {
    id: 'cheong',
    name: 'Pine Needle Cheong',
    type: FermentType.ALCOHOL, // Syrup/Extract
    description: 'Osmotic Extraction. If Hygiene low -> Yeast Infection -> Moonshine.',
    requiredIngredients: { substrate: true, starter: null, additive: 'sugar' },
    outputIngredientId: 'cheong_syrup',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 100,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 20, humidity: 50, salinity: 0 },
    idealFlavorProfile: { umami: 0, acidity: 20, funk: 10, sweetness: 100, safety: 100 },
    difficulty: 1
  },
  {
    /* ------------------------------------------------------------------
       SHOYU — the ferment the game declared and never made.

       FermentType.SHOYU existed, AGEING_BY_TYPE knew it matured, the
       hydration target was set to 130 for a wet mash, a dedicated
       protease starter was in the pantry, "Amino Sauce (Shoyu)" was
       sitting there as an output, and the wooden press was built to
       separate a wet mash into liquid and cake. Every part of the
       apparatus, and no recipe.

       Real process: cooked soybeans and roasted cracked wheat, roughly
       equal parts, inoculated to make koji; that koji goes into a strong
       brine to become moromi; the moromi ferments for months to years and
       is stirred and aerated throughout — kai-ire, which is the one
       genuinely agitated ferment in the whole catalogue; then it is
       pressed, and the liquid that runs out is shoyu.
       ------------------------------------------------------------------ */
    id: 'moromi',
    name: 'Moromi',
    type: FermentType.SHOYU,
    description: 'Soybean and roasted wheat koji in strong brine. Stirred through months of ferment, then pressed — the liquid that runs out is shoyu.',
    requiredIngredients: { substrate: true, starter: 'shoyu_spores', additive: 'salt' },
    outputIngredientId: 'amino_sauce',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 260,
    peakWindowStart: 92,
    peakWindowEnd: 100,
    activeIntervention: 'Stir',
    // 18% against the substrate, held at cellar temperature. The brine is what
    // keeps a mash this wet safe for two years without any heat at all.
    idealParams: { temp: 25, humidity: 60, salinity: 18 },
    idealFlavorProfile: { umami: 92, acidity: 40, funk: 55, sweetness: 20, safety: 100 },
    difficulty: 4
  },
  {
    id: 'tamari',
    name: 'Tamari',
    type: FermentType.SHOYU,
    description: 'Shoyu with no wheat in it. Started as the liquid pooling on a miso and became its own thing — thicker, darker, and squarely savoury.',
    requiredIngredients: { substrate: true, starter: 'koji_spores', additive: 'salt' },
    outputIngredientId: 'amino_sauce',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 230,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 25, humidity: 60, salinity: 16 },
    idealFlavorProfile: { umami: 96, acidity: 28, funk: 58, sweetness: 12, safety: 100 },
    difficulty: 4
  },
  {
    id: 'hatcho_miso',
    name: 'Hatcho Miso',
    type: FermentType.MISO,
    description: 'The Emperor\'s Miso. Pure soybean koji in cedar. Chocolate-dark.',
    requiredIngredients: { substrate: true, starter: 'koji_spores', additive: 'salt' },
    outputIngredientId: 'hatcho_miso',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 250, // Long
    peakWindowStart: 95,
    peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 20, humidity: 50, salinity: 10 },
    idealFlavorProfile: { umami: 95, acidity: 30, funk: 60, sweetness: 5, safety: 100 },
    difficulty: 4
  },
  {
    id: 'shiro_miso',
    name: 'Shiro Miso',
    type: FermentType.MISO,
    description: 'Sweet White Miso. High Koji ratio, short ferment.',
    requiredIngredients: { substrate: true, starter: 'koji_rice', additive: 'salt' },
    outputIngredientId: 'shiro_miso',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 60, // Fast
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: 'Clean',
    idealParams: { temp: 28, humidity: 60, salinity: 5 },
    idealFlavorProfile: { umami: 60, acidity: 5, funk: 10, sweetness: 80, safety: 100 },
    difficulty: 1
  },

  // --- 3. THE SOUTHEAST ASIAN SCHOOL ---
  {
    id: 'nuoc_mam',
    name: 'Nuoc Mam Nhi',
    type: FermentType.GARUM,
    description: 'First Press Fish Sauce. High salt, cedar aged.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'fish_sauce',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 300,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 30, humidity: 70, salinity: 25 },
    idealFlavorProfile: { umami: 95, acidity: 20, funk: 90, sweetness: 5, safety: 100 },
    difficulty: 1
  },
  {
    id: 'bagoong',
    name: 'Bagoong Alamang',
    type: FermentType.MISO,
    description: 'Pink Ferment. Needs air (prop lid) to turn pink. Anaerobic = Grey.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'bagoong_paste',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 180,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: 'Ventilate', // Needs air
    idealParams: { temp: 30, humidity: 60, salinity: 20 },
    idealFlavorProfile: { umami: 90, acidity: 20, funk: 85, sweetness: 10, safety: 100 },
    difficulty: 2
  },
  {
    id: 'coconut_vin',
    name: 'Tuba Vinegar',
    type: FermentType.VINEGAR,
    description: 'Two-Stage. First Alcohol (Tuba), then Vinegar. Timing is key.',
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: 'coconut_vinegar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 150,
    peakWindowStart: 85,
    peakWindowEnd: 95,
    activeIntervention: 'Stir',
    idealParams: { temp: 28, humidity: 70, salinity: 0 },
    idealFlavorProfile: { umami: 10, acidity: 90, funk: 30, sweetness: 10, safety: 100 },
    difficulty: 2
  },

  // --- 4. THE NOMA / MODERNIST SCHOOL ---
  {
    id: 'scallop_fudge',
    name: 'Scallop Fudge',
    type: FermentType.BLACK, 
    description: 'The Mistake. Dehydrated enzymatic paste. Ultra-high Umami, zero water.',
    requiredIngredients: { substrate: true, starter: 'koji_rice', additive: null }, // No added salt, uses evaporation
    outputIngredientId: 'scallop_fudge',
    requiredVesselId: 'incubator',
    baseDurationSeconds: 220, // Long
    peakWindowStart: 95,
    peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 60, humidity: 20, salinity: 0 }, // Low humidity
    idealFlavorProfile: { umami: 100, acidity: 10, funk: 40, sweetness: 80, safety: 90 },
    difficulty: 4
  },
  {
    id: 'lacto_ceps',
    name: 'Lacto Porcini',
    type: FermentType.LACTO,
    description: 'Texture Preservation. High humidity to mimic vacuum bag. Output is Porcini Soy.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'lacto_ceps',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 70,
    peakWindowStart: 80,
    peakWindowEnd: 90,
    activeIntervention: 'Clean',
    idealParams: { temp: 20, humidity: 95, salinity: 2 }, // High humidity
    idealFlavorProfile: { umami: 80, acidity: 60, funk: 30, sweetness: 10, safety: 95 },
    difficulty: 2
  },
  {
    id: 'rose_garum',
    name: 'Rose Garum',
    type: FermentType.GARUM,
    description: 'Perfume Risk. If too hot (>62C), floral notes vanish. Precise heat required.',
    requiredIngredients: { substrate: true, starter: 'koji_rice', additive: 'water' },
    outputIngredientId: 'rose_garum',
    requiredVesselId: 'incubator',
    baseDurationSeconds: 140,
    peakWindowStart: 85,
    peakWindowEnd: 95,
    activeIntervention: 'Stir',
    idealParams: { temp: 60, humidity: 50, salinity: 0 },
    idealFlavorProfile: { umami: 70, acidity: 40, funk: 10, sweetness: 60, safety: 90 },
    difficulty: 3
  },
  {
    id: 'black_apple',
    name: 'Black Apple',
    type: FermentType.BLACK,
    description: 'Maillard Reaction. Not fermentation. Pure chemistry. Needs High Temp + High Humidity.',
    requiredIngredients: { substrate: true, starter: null, additive: null }, // Garlic or Fruit
    outputIngredientId: 'black_apple',
    requiredVesselId: 'incubator',
    baseDurationSeconds: 200,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 60, humidity: 80, salinity: 0 },
    idealFlavorProfile: { umami: 70, acidity: 40, funk: 20, sweetness: 80, safety: 100 },
    difficulty: 2
  },
  {
    id: 'yellow_peaso',
    name: 'Pearl Barley Peaso',
    type: FermentType.MISO,
    description: 'The Noma classic. Sweet, grassy, earthy.',
    requiredIngredients: { substrate: true, starter: 'barley_koji', additive: 'salt' },
    outputIngredientId: 'peaso_paste',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 90,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: 'Clean',
    idealParams: { temp: 20, humidity: 55, salinity: 6 },
    idealFlavorProfile: { umami: 60, acidity: 20, funk: 20, sweetness: 50, safety: 100 },
    difficulty: 1
  },

  // --- 5. THE BLACK MARKET ---
  {
    id: 'tears_garum',
    name: 'Lacryma (The Weeping)',
    type: FermentType.GARUM,
    description: 'Saline Balance. Tears are salty. Adding more salt ruins it. Synthesized sorrow.',
    requiredIngredients: { substrate: false, starter: 'koji_rice', additive: 'salt' }, // Uses Tears (Additive)
    outputIngredientId: 'lacryma_vial',
    requiredVesselId: 'incubator',
    baseDurationSeconds: 150,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: 'Skim',
    idealParams: { temp: 37, humidity: 60, salinity: 9 }, // Body temp
    idealFlavorProfile: { umami: 100, acidity: 10, funk: 10, sweetness: 20, safety: 80 },
    difficulty: 5
  },
  {
    id: 'ancient_garum',
    name: 'Primordial Garum',
    type: FermentType.FAIL, // Or Special
    description: 'The Gamble. Ancient Spores are volatile. 30% chance of Bio-Hazard.',
    requiredIngredients: { substrate: true, starter: 'ancient_spores', additive: null },
    outputIngredientId: 'ambrosia',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 200,
    peakWindowStart: 95,
    peakWindowEnd: 100,
    activeIntervention: 'Flip',
    idealParams: { temp: 30, humidity: 80, salinity: 15 },
    idealFlavorProfile: { umami: 100, acidity: 50, funk: 100, sweetness: 100, safety: 50 },
    difficulty: 5
  },
  {
    id: 'casu_marzu',
    name: 'Casu Marzu II',
    type: FermentType.MISO, // Cheese
    description: 'Hygiene Inversion. Requires LOW HYGIENE to feed the larvae.',
    requiredIngredients: { substrate: true, starter: 'fly_larvae', additive: null },
    outputIngredientId: 'forbidden_cheese',
    requiredVesselId: 'koji_tray', // Open tray
    baseDurationSeconds: 100,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: 'Mix',
    idealParams: { temp: 25, humidity: 60, salinity: 5 },
    idealFlavorProfile: { umami: 90, acidity: 80, funk: 100, sweetness: 0, safety: 10 },
    difficulty: 4
  },

  // --- UTILITY / GENERIC ---
  {
    id: 'barley_koji',
    name: 'Barley Koji',
    type: FermentType.KOJI,
    description: 'Inoculated grains. Foundation of flavor.',
    requiredIngredients: { substrate: true, starter: 'koji_spores', additive: null },
    outputIngredientId: 'barley_koji',
    requiredVesselId: 'koji_tray',
    baseDurationSeconds: 48, 
    peakWindowStart: 85,
    peakWindowEnd: 100,
    activeIntervention: 'Flip',
    idealParams: { temp: 34, humidity: 80, salinity: 0 },
    idealFlavorProfile: { umami: 40, acidity: 10, funk: 20, sweetness: 60, safety: 100 },
    difficulty: 1
  },
  {
    id: 'shio_koji',
    name: 'Shio Koji',
    type: FermentType.KOJI,
    description: 'Living seasoning paste made from koji, salt, and water. Rich in enzymes that tenderize and enhance umami.',
    requiredIngredients: { substrate: true, starter: 'barley_koji', additive: 'salt' },
    outputIngredientId: 'amino_sauce',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 50,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: 'Stir',
    idealParams: { temp: 25, humidity: 60, salinity: 12 },
    idealFlavorProfile: { umami: 75, acidity: 20, funk: 30, sweetness: 60, safety: 100 },
    difficulty: 1
  },
  {
    id: 'amazake',
    name: 'Amazake',
    type: FermentType.KOJI,
    description: 'Traditional sweet fermented rice/barley drink. Rapid enzymatic breakdown converts starches into rich natural glucose.',
    requiredIngredients: { substrate: true, starter: 'barley_koji', additive: 'water' },
    outputIngredientId: 'amino_sauce',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 45,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: 'Stir',
    idealParams: { temp: 55, humidity: 70, salinity: 0 },
    idealFlavorProfile: { umami: 20, acidity: 10, funk: 10, sweetness: 95, safety: 100 },
    difficulty: 1
  },

  // ============================================================================
  // ERA II — THE SILK ROAD, continued
  // ============================================================================
  {
    id: 'tempeh',
    name: 'Tempeh',
    type: FermentType.KOJI,   // solid-substrate mould cultivation
    description: 'Rhizopus knits cooked beans into a firm white cake. It binds rather than digests — there is very little enzyme here.',
    requiredIngredients: { substrate: true, starter: 'rhizopus', additive: null },
    outputIngredientId: 'tempeh_block',
    requiredVesselId: 'koji_tray',
    baseDurationSeconds: 55,
    peakWindowStart: 85, peakWindowEnd: 96,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 31, humidity: 75, salinity: 0 },
    idealFlavorProfile: { umami: 45, acidity: 10, funk: 35, sweetness: 10, safety: 100 },
    difficulty: 2
  },
  {
    id: 'natto',
    name: 'Nattō',
    type: FermentType.KOJI,
    description: 'Bacillus, not a mould. It wants 40°C and saturated air — conditions that would kill koji outright — and it turns the beans ropy.',
    requiredIngredients: { substrate: true, starter: 'bacillus_natto', additive: null },
    outputIngredientId: 'natto_pack',
    requiredVesselId: 'incubator',
    baseDurationSeconds: 50,
    peakWindowStart: 88, peakWindowEnd: 100,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 40, humidity: 95, salinity: 0 },
    idealFlavorProfile: { umami: 80, acidity: 15, funk: 85, sweetness: 5, safety: 95 },
    difficulty: 3
  },
  {
    id: 'meju',
    name: 'Meju Block',
    type: FermentType.KOJI,
    description: 'Crushed soybeans pressed into bricks and hung to catch whatever is in the air. The wild ancestor of every Korean jang.',
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: 'meju_block',
    requiredVesselId: 'koji_tray',
    baseDurationSeconds: 120,
    peakWindowStart: 88, peakWindowEnd: 100,
    activeIntervention: 'Flip',
    idealParams: { temp: 22, humidity: 65, salinity: 0 },
    idealFlavorProfile: { umami: 70, acidity: 20, funk: 75, sweetness: 8, safety: 88 },
    difficulty: 4
  },
  {
    id: 'doenjang',
    name: 'Doenjang',
    type: FermentType.MISO,
    description: 'Meju broken into brine and left in an onggi through a summer. The paste sinks; the liquid drawn off the top becomes ganjang.',
    requiredIngredients: { substrate: true, starter: 'meju_block', additive: 'salt' },
    outputIngredientId: 'doenjang_jar',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 260,
    peakWindowStart: 90, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 24, humidity: 55, salinity: 16 },
    idealFlavorProfile: { umami: 90, acidity: 25, funk: 70, sweetness: 12, safety: 100 },
    difficulty: 4
  },
  {
    id: 'makgeolli',
    name: 'Makgeolli',
    type: FermentType.ALCOHOL,
    description: 'Nuruk, rice and water. A wild consortium does the saccharifying and the fermenting at once — parallel, not sequential.',
    requiredIngredients: { substrate: true, starter: 'nuruk', additive: 'water' },
    outputIngredientId: 'makgeolli_jar',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 110,
    peakWindowStart: 80, peakWindowEnd: 94,
    activeIntervention: 'Stir',
    idealParams: { temp: 25, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 25, acidity: 55, funk: 40, sweetness: 60, safety: 95 },
    difficulty: 3
  },
  {
    id: 'nukazuke',
    name: 'Nukazuke',
    type: FermentType.LACTO,
    description: 'A living bed of rice bran, salt and lactobacillus. Vegetables go in for a day and come out sour; the bed is turned by hand and outlives its keeper.',
    requiredIngredients: { substrate: true, starter: null, additive: 'rice_bran' },
    outputIngredientId: 'nukazuke_jar',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 70,
    peakWindowStart: 82, peakWindowEnd: 95,
    activeIntervention: 'Stir',
    idealParams: { temp: 22, humidity: 60, salinity: 8 },
    idealFlavorProfile: { umami: 40, acidity: 70, funk: 45, sweetness: 15, safety: 96 },
    difficulty: 2
  },
  {
    id: 'katsuobushi',
    name: 'Katsuobushi',
    type: FermentType.MISO,   // curing mechanic
    description: 'Bonito simmered, smoked, then moulded and sunned in cycles for months until it can be shaved like wood. The hardest food on earth.',
    requiredIngredients: { substrate: true, starter: 'a_glaucus', additive: null },
    outputIngredientId: 'katsuobushi_block',
    requiredVesselId: 'koji_tray',
    baseDurationSeconds: 300,
    peakWindowStart: 92, peakWindowEnd: 100,
    activeIntervention: 'Flip',
    idealParams: { temp: 26, humidity: 35, salinity: 4 },
    idealFlavorProfile: { umami: 100, acidity: 5, funk: 55, sweetness: 5, safety: 100 },
    difficulty: 5
  },

  // ============================================================================
  // ERA III — THE CELLARS OF EUROPE
  // ============================================================================
  {
    id: 'sauerkraut',
    name: 'Sauerkraut',
    type: FermentType.LACTO,
    description: 'Shredded cabbage, two percent salt, and its own weight pressing it under its own liquid. The simplest ferment there is, and unforgiving of air.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'sauerkraut_crock',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 95,
    peakWindowStart: 85, peakWindowEnd: 98,
    activeIntervention: 'Clean',
    idealParams: { temp: 18, humidity: 60, salinity: 2 },
    idealFlavorProfile: { umami: 20, acidity: 85, funk: 25, sweetness: 20, safety: 100 },
    difficulty: 1
  },
  {
    id: 'kimchi',
    name: 'Kimchi',
    type: FermentType.LACTO,
    description: 'Brined napa, chili, and a little fish sauce to feed it. Cold and slow in an onggi, sour and effervescent by the third week.',
    requiredIngredients: { substrate: true, starter: null, additive: 'chili' },
    outputIngredientId: 'kimchi_jar',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 85,
    peakWindowStart: 82, peakWindowEnd: 96,
    activeIntervention: 'Clean',
    idealParams: { temp: 8, humidity: 65, salinity: 3 },
    idealFlavorProfile: { umami: 45, acidity: 75, funk: 55, sweetness: 20, safety: 98 },
    difficulty: 2
  },
  {
    id: 'salumi',
    name: 'Cured Salumi',
    type: FermentType.MISO,   // curing mechanic
    description: 'Salt, then a slow drop in humidity over weeks. Too fast and the outside case-hardens, sealing the wet inside to rot.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'salumi_hung',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 220,
    peakWindowStart: 90, peakWindowEnd: 100,
    activeIntervention: 'Flip',
    idealParams: { temp: 13, humidity: 75, salinity: 3 },
    idealFlavorProfile: { umami: 75, acidity: 25, funk: 60, sweetness: 5, safety: 92 },
    difficulty: 4
  },
  {
    id: 'blue_cheese',
    name: 'Blue Cheese',
    type: FermentType.LACTO,
    description: 'Penicillium needs air to strike, so the paste is pierced. The blue follows the needle tracks and nothing else.',
    requiredIngredients: { substrate: true, starter: 'p_roqueforti', additive: 'salt' },
    outputIngredientId: 'blue_wheel',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 175,
    peakWindowStart: 88, peakWindowEnd: 100,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 11, humidity: 92, salinity: 4 },
    idealFlavorProfile: { umami: 70, acidity: 40, funk: 95, sweetness: 5, safety: 90 },
    difficulty: 4
  },
  {
    id: 'surstromming',
    name: 'Surströmming',
    type: FermentType.GARUM,
    description: 'Herring in a brine too weak to preserve it, sealed in the tin and left to work. Not spoiled — fermented, deliberately, at the edge.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'surstromming_tin',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 190,
    peakWindowStart: 86, peakWindowEnd: 100,
    activeIntervention: 'Skim',
    idealParams: { temp: 16, humidity: 60, salinity: 6 },
    idealFlavorProfile: { umami: 85, acidity: 60, funk: 100, sweetness: 0, safety: 72 },
    difficulty: 5
  },

  // ============================================================================
  // LIPASE-DOMINANT — fat is the substrate, free fatty acids are the product
  // ============================================================================
  {
    id: 'cultured_butter',
    name: 'Cultured Cream',
    type: FermentType.LACTO,
    description: 'Mesophilic LAB turn citrate into diacetyl — the compound that makes butter smell like butter — while souring the cream underneath it.',
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: 'cultured_cream',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 65,
    peakWindowStart: 80, peakWindowEnd: 94,
    activeIntervention: 'Stir',
    idealParams: { temp: 21, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 30, acidity: 60, funk: 45, sweetness: 20, safety: 98 },
    difficulty: 2
  },
  {
    id: 'nut_miso',
    name: 'Hazelnut Miso',
    type: FermentType.MISO,
    description: 'High-fat substrate under barley koji. Proteases build the savour, lipases turn the nut oil praline-rich rather than rancid.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
    outputIngredientId: 'nut_miso_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 165,
    peakWindowStart: 88, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 20, humidity: 55, salinity: 8 },
    idealFlavorProfile: { umami: 70, acidity: 20, funk: 60, sweetness: 25, safety: 100 },
    difficulty: 3
  },
  {
    id: 'shio_tamago',
    name: 'Shio-Tamago',
    type: FermentType.MISO,
    description: 'Yolks buried in a salt-koji bed. Osmosis pulls the water out while proteases firm them into something translucent and gratable.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
    outputIngredientId: 'cured_yolk',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 90,
    peakWindowStart: 88, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 6, humidity: 55, salinity: 10 },
    idealFlavorProfile: { umami: 88, acidity: 10, funk: 40, sweetness: 15, safety: 100 },
    difficulty: 3
  },

  // ============================================================================
  // OSMOTIC — sugar does the work, no heat and no microbes wanted
  // ============================================================================
  {
    id: 'maesil_cheong',
    name: 'Maesil Cheong',
    type: FermentType.VINEGAR,
    description: 'Green plums under their own weight in sugar for a hundred days. Osmotic pressure draws the nectar out; nothing is heated and nothing ferments if you keep it clean.',
    requiredIngredients: { substrate: true, starter: null, additive: 'sugar' },
    outputIngredientId: 'maesil_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 145,
    peakWindowStart: 86, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 20, humidity: 55, salinity: 0 },
    idealFlavorProfile: { umami: 5, acidity: 45, funk: 10, sweetness: 95, safety: 100 },
    difficulty: 2
  },
  {
    id: 'tepache',
    name: 'Tepache',
    type: FermentType.ALCOHOL,
    description: 'Pineapple rind, raw sugar, four warm days. The yeast is already on the skin — you are only giving it something to eat.',
    requiredIngredients: { substrate: true, starter: null, additive: 'sugar' },
    outputIngredientId: 'tepache_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 60,
    peakWindowStart: 76, peakWindowEnd: 90,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 26, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 10, acidity: 60, funk: 35, sweetness: 65, safety: 96 },
    difficulty: 1
  },

  // ============================================================================
  // ACETIC — strictly aerobic; a sealed vinegar never sours
  // ============================================================================
  {
    id: 'cider_vinegar',
    name: 'Cider Vinegar',
    type: FermentType.VINEGAR,
    description: 'Two stages in one vessel: yeast takes the fruit sugar to alcohol, then Acetobacter takes the alcohol to acid. The second stage needs air or it stops.',
    requiredIngredients: { substrate: true, starter: null, additive: 'water' },
    outputIngredientId: 'cider_vinegar_jar',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 175,
    peakWindowStart: 84, peakWindowEnd: 100,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 24, humidity: 65, salinity: 0 },
    idealFlavorProfile: { umami: 15, acidity: 92, funk: 35, sweetness: 15, safety: 100 },
    difficulty: 3
  },
  {
    id: 'chili_mash',
    name: 'Aged Chili Mash',
    type: FermentType.LACTO,
    description: 'Crushed chilies under salt in a cask for years. Halotolerant LAB round the heat off into something fruity rather than merely fierce.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'chili_mash_cask',
    requiredVesselId: 'oak_cask',
    baseDurationSeconds: 210,
    peakWindowStart: 88, peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 22, humidity: 60, salinity: 9 },
    idealFlavorProfile: { umami: 30, acidity: 80, funk: 55, sweetness: 25, safety: 100 },
    difficulty: 3
  },

  // ============================================================================
  // MAILLARD — no microbes at all; pure chemistry under steady heat
  // ============================================================================
  {
    id: 'black_garlic',
    name: 'Black Garlic',
    type: FermentType.BLACK,
    description: 'Not a fermentation at all — every microbe is dead at this temperature. Reducing sugars and amino acids react for six weeks until the cloves turn to sweet black balsamic.',
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: 'black_garlic_head',
    requiredVesselId: 'incubator',
    baseDurationSeconds: 230,
    peakWindowStart: 90, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 60, humidity: 80, salinity: 0 },
    idealFlavorProfile: { umami: 55, acidity: 25, funk: 30, sweetness: 85, safety: 100 },
    difficulty: 3
  },
  {
    id: 'kombucha',
    name: 'Kombucha',
    type: FermentType.KOMBUCHA,
    description: 'Sweet tea under a cellulose raft. Yeast turns sugar to alcohol and acetic bacteria turn that to acid — two ferments running at once in the same jar.',
    requiredIngredients: { substrate: true, starter: 'scoby', additive: 'sugar' },
    outputIngredientId: 'kombucha_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 110,
    peakWindowStart: 78, peakWindowEnd: 92,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 24, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 15, acidity: 78, funk: 40, sweetness: 35, safety: 98 },
    difficulty: 2
  },
  {
    id: 'bio_sludge',
    name: 'Bio-Sludge',
    type: FermentType.FAIL,
    description: 'An unrecognizable, rotting mess.',
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: 'bio_sludge',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 30,
    peakWindowStart: 0,
    peakWindowEnd: 0,
    activeIntervention: 'Clean',
    idealParams: { temp: 0, humidity: 0, salinity: 0 },
    idealFlavorProfile: { umami: 0, acidity: 100, funk: 100, sweetness: 0, safety: 0 },
    difficulty: 0
  }
];

RECIPES.push(...FORAGE_RECIPES, ...HERITAGE_RECIPES, ...MARKET_RECIPES);

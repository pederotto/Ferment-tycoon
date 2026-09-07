
import { Ingredient, IngredientType, Recipe, FermentType, Supplier, Vessel, Buyer, StaffRole, MatrixEntry, Book, HiddenStats } from './types';

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
export const RAID_HEAT_THRESHOLD = 55;      // below this the inspector never calls
export const RAID_BASE_CHANCE = 0.004;      // scaled by how far over the threshold you are
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
  { recipeId: 'shio_koji', substrate: { kind: 'none' }, requires: ['koji', 'salt', 'water'], vesselId: null },
  { recipeId: 'amazake',   substrate: { kind: 'none' }, requires: ['koji', 'water'], forbids: ['salt'], vesselId: null },
  { recipeId: 'shio_koji', substrate: { kind: 'none' }, requires: ['koji', 'salt'], forbids: ['water'], vesselId: null },

  { recipeId: 'colatura',       substrate: { kind: 'is', id: 'anchovies' },      requires: ['salt'], vesselId: 'oak_cask' },
  { recipeId: 'bottarga',       substrate: { kind: 'is', id: 'mullet_roe' },     requires: ['salt'], vesselId: 'koji_tray' },
  { recipeId: 'ricotta_forte',  substrate: { kind: 'is', id: 'raw_milk' },       requires: ['salt'], vesselId: 'onggi' },
  { recipeId: 'garum_sociorum', substrate: { kind: 'is', id: 'mackerel' },       requires: ['salt'], vesselId: 'incubator' },

  { recipeId: 'doubanjiang', substrate: { kind: 'is', id: 'broad_beans' },    requires: ['chili', 'koji', 'salt'], vesselId: 'onggi' },
  { recipeId: 'douchi',      substrate: { kind: 'is', id: 'black_soybeans' }, requires: ['spores', 'salt'],        vesselId: 'mason_jar' },
  { recipeId: 'gochujang',   substrate: { kind: 'is', id: 'glutinous_rice' }, requires: ['koji', 'chili', 'salt'], vesselId: 'onggi' },
  { recipeId: 'cheong',      substrate: { kind: 'is', id: 'pine_needles' },   requires: ['sugar'],                 vesselId: 'mason_jar' },

  { recipeId: 'hatcho_miso', substrate: { kind: 'includes', token: 'soybean' }, requires: ['spores', 'salt'], vesselId: 'cedar_barrel' },
  { recipeId: 'shiro_miso',  substrate: { kind: 'includes', token: 'soybean' }, requires: ['koji', 'salt'],   vesselId: 'mason_jar' },

  { recipeId: 'nuoc_mam',    substrate: { kind: 'is', id: 'anchovies' },   requires: ['salt'], vesselId: 'cedar_barrel' },
  { recipeId: 'bagoong',     substrate: { kind: 'is', id: 'shrimp_fry' },  requires: ['salt'], vesselId: 'mason_jar' },
  { recipeId: 'coconut_vin', substrate: { kind: 'is', id: 'coconut_sap' }, requires: [],       vesselId: 'mason_jar' },

  { recipeId: 'scallop_fudge', substrate: { kind: 'is', id: 'scallops' },    requires: ['koji'],          vesselId: 'incubator' },
  { recipeId: 'lacto_ceps',    substrate: { kind: 'is', id: 'ceps' },        requires: ['salt'],          vesselId: 'mason_jar' },
  { recipeId: 'rose_garum',    substrate: { kind: 'is', id: 'rose_petals' }, requires: ['koji', 'water'], vesselId: 'incubator' },
  { recipeId: 'black_apple',   substrate: { kind: 'oneOf', ids: ['garlic_bulbs', 'plums'] }, requires: [], forbids: ['salt'], vesselId: 'incubator' },
  { recipeId: 'yellow_peaso',  substrate: { kind: 'is', id: 'yellow_peas' }, requires: ['barley_koji', 'salt'], vesselId: 'mason_jar' },

  { recipeId: 'tears_garum',   substrate: { kind: 'any' },               requires: ['tears', 'koji', 'salt'], vesselId: 'incubator' },
  { recipeId: 'casu_marzu',    substrate: { kind: 'is', id: 'raw_milk' }, requires: ['larvae'],               vesselId: 'koji_tray' },
  { recipeId: 'ancient_garum', substrate: { kind: 'is', id: 'mackerel' }, requires: ['ancient_spores'],       vesselId: 'onggi' },

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
  tears: 'Vial of Tears',
  larvae: 'Cheese fly larvae',
  barley_koji: 'Barley koji',
  ancient_spores: 'Ancient spores',
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
export const WEEKLY_VESSEL_UPKEEP = 18;     // per owned vessel beyond the starting two
export const FREE_UPKEEP_VESSELS = 2;
export const UTILITY_COST_PER_WATT = 1.10;

// Market saturation. Every sale depresses appetite for that ferment type;
// appetite recovers each week. Selling one type on repeat stops paying.
export const DEMAND_FLOOR = 0.35;
export const DEMAND_CEILING = 1.15;
export const DEMAND_DROP_PER_YIELD = 0.035; // multiplied by the batch's yield multiplier
export const DEMAND_RECOVERY_PER_WEEK = 0.12;

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
        effectDescription: 'Hygiene never drops below 50%. Contamination risk reduced by 40%.'
    },
    {
        id: 'tech',
        name: 'Lab Technician',
        description: 'Junior fermenter to monitor environmental controls.',
        hiringCost: 800,
        weeklyWage: 250,
        icon: 'Thermometer',
        effectDescription: 'Automatically corrects temperature drift in Incubators. Stabilizes humidity.'
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
        id: 'incubator',
        name: 'Thermal Chamber',
        slotsRequired: 2,
        powerDraw: 150,
        cost: 1500,
        description: 'Precise temperature control for sensitive projects.',
        idealFor: [FermentType.GARUM, FermentType.BLACK, FermentType.KOJI],
        insulationFactor: 0.9,
        capacityL: 10
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
        hiddenStats: { sugarContent: 6, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 3 },
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
        hiddenStats: { sugarContent: 3, nativeSalinity: 0, microbialDiversity: 3, fatContent: 4, proteinContent: 9 },
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
        hiddenStats: { sugarContent: 4, nativeSalinity: 0, microbialDiversity: 4, fatContent: 5, proteinContent: 9 },
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
        hiddenStats: { sugarContent: 8, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 2 },
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
        hiddenStats: { sugarContent: 5, nativeSalinity: 1, microbialDiversity: 8, fatContent: 8, proteinContent: 6 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 2, microbialDiversity: 6, fatContent: 7, proteinContent: 8 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 1, microbialDiversity: 5, fatContent: 9, proteinContent: 8 },
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
        hiddenStats: { sugarContent: 1, nativeSalinity: 2, microbialDiversity: 4, fatContent: 8, proteinContent: 9 },
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
        hiddenStats: { sugarContent: 4, nativeSalinity: 3, microbialDiversity: 2, fatContent: 2, proteinContent: 10 },
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
        hiddenStats: { sugarContent: 3, nativeSalinity: 0, microbialDiversity: 7, fatContent: 1, proteinContent: 5 },
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
        hiddenStats: { sugarContent: 6, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1 },
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
        hiddenStats: { sugarContent: 5, nativeSalinity: 0, microbialDiversity: 3, fatContent: 2, proteinContent: 7 },
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
        hiddenStats: { sugarContent: 7, nativeSalinity: 0, microbialDiversity: 4, fatContent: 1, proteinContent: 4 },
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
        hiddenStats: { sugarContent: 4, nativeSalinity: 0, microbialDiversity: 3, fatContent: 2, proteinContent: 8 },
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
        hiddenStats: { sugarContent: 1, nativeSalinity: 3, microbialDiversity: 8, fatContent: 4, proteinContent: 9 },
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
        hiddenStats: { sugarContent: 10, nativeSalinity: 0, microbialDiversity: 6, fatContent: 2, proteinContent: 1 },
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
        hiddenStats: { sugarContent: 2, nativeSalinity: 0, microbialDiversity: 9, fatContent: 3, proteinContent: 0 },
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
        hiddenStats: { sugarContent: 4, nativeSalinity: 0, microbialDiversity: 5, fatContent: 1, proteinContent: 1 },
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
        description: 'Standard Yellow Koji-kin.',
        idealFor: ['koji'],
        supplierId: 'biolab',
        tierRequired: 0,
        hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0 },
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
        description: 'Recovered from a clay pot 1000 years old. Unpredictable.',
        idealFor: ['garum'],
        supplierId: 'black_market',
        tierRequired: 0,
        hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 10, fatContent: 0, proteinContent: 0 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 10, fatContent: 5, proteinContent: 10 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 10, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 10, microbialDiversity: 1, fatContent: 0, proteinContent: 0 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
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
        hiddenStats: { sugarContent: 10, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
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
        hiddenStats: { sugarContent: 2, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 0 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 9, microbialDiversity: 5, fatContent: 0, proteinContent: 1 },
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
        hiddenStats: { sugarContent: 5, nativeSalinity: 0, microbialDiversity: 1, fatContent: 0, proteinContent: 2 },
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
        description: 'Ready-to-use inoculated barley.',
        idealFor: ['miso'],
        supplierId: 'in_house', // Or buy from Biolab
        tierRequired: 0,
        hiddenStats: { sugarContent: 6, nativeSalinity: 0, microbialDiversity: 8, fatContent: 1, proteinContent: 4 },
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
        description: 'Inoculated rice grains.',
        idealFor: ['miso', 'amazake'],
        supplierId: 'biolab',
        tierRequired: 1,
        hiddenStats: { sugarContent: 8, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 2 },
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
        hiddenStats: { sugarContent: 2, nativeSalinity: 10, microbialDiversity: 5, fatContent: 0, proteinContent: 8 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
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
        hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
        mass: 10000,
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
    idealParams: { temp: 40, humidity: 50, salinity: 20 },
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

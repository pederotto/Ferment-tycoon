import { WILD } from './constants.wild';
import { FacilityId, FamilyId, CropStage } from './types.farm';

/* =============================================================================
   WHAT GROWS HERE, AND HOW

   One growth model for everything planted, set per FAMILY with a handful of
   numbers, and per VARIETY with three more. The model (services/growth.ts) is
   driven by the day's weather at 45°N (services/climate.ts):

   - WARMTH above the family's base temperature is what moves a crop through its
     stages (growing degree days). Cold slows it; frost kills tender stages
     unless something is over them.
   - WATER, FEED and HEALTH are the three gauges on every bed. Stress in the
     stage that forms a part of the yield costs that part: a dry spell while a
     cabbage is heading costs head, a dry spell while a bean flowers costs pods.
   - QUALITY comes from how the crop was ripened — sun, restraint with water and
     feed, a live soil — and is written into the ingredient's own stats when it
     is picked, so a sun-ripened Brandywine makes a better garum than the van's.

   Yields are real-world. `kgPerPlant` is the POTENTIAL under expert care; a
   well-run planting realises about 85% of it, which lands each crop in the
   range a good grower gets at this latitude. Measured in sim/farm.ts — re-run it
   before changing any number here.
   ============================================================================= */

export type HarvestMode = 'once' | 'continuous';

export interface CropFamily {
  id: FamilyId;
  label: string;
  /** Growing degree days accumulate above this. */
  tBase: number;
  /** ...and stop accumulating above this. */
  tCap: number;
  /** Night minimum that kills an established, unprotected crop. */
  kill: number;
  /** ...and a young one (the first fifth of its development). */
  killYoung: number;
  /** Flowers die below this (fava, strawberries, blossom). */
  flowerKill?: number;
  /** Flowers abort above this day maximum. */
  heatSet?: number;
  /** Flowers fail to set below this night minimum (tomatoes, beans, chili). */
  nightSet?: number;
  harvest: HarvestMode;
  /** Where the stages start, as shares of the development to first ripe. */
  stages: { leafy: number; flower: number; fruit: number };
  /** What the stages are called on this family's label. */
  words?: Partial<Record<CropStage, string>>;
  /** Crop coefficient: how much of the reference evaporation it drinks, early / full / late. */
  kc: [number, number, number];
  /** Fertility points a full planting draws over its life. */
  feedDraw: number;
  /** Nitrogen a legume leaves in the soil when it is cleared. */
  fixes?: number;
  /** Days a ripe crop waits before it starts to go over: split, bolt, shed, blow. */
  holdDays: number;
  /** Picking rate by hand, kg an hour. */
  pickKgH: number;
  /** The piece-state words on the picking card. */
  kind: string;
  /** Comes back each year from the same roots rather than being replanted. */
  perennial?: boolean;
  /** Problems this family is prone to. */
  problems: string[];
}

export const FAMILIES: Record<FamilyId, CropFamily> = {
  tomato: {
    id: 'tomato', label: 'Tomatoes', tBase: 10, tCap: 30, kill: 0, killYoung: 1, heatSet: 33, nightSet: 11,
    harvest: 'continuous', stages: { leafy: 0.12, flower: 0.4, fruit: 0.62 },
    words: { fruiting: 'setting trusses', ripe: 'ripening', over: 'finishing' },
    kc: [0.5, 1.15, 0.85], feedDraw: 55, holdDays: 5, pickKgH: 25, kind: 'fruitveg',
    problems: ['blight', 'whitefly', 'ber', 'tuta', 'weeds'],
  },
  chili: {
    id: 'chili', label: 'Chili', tBase: 12, tCap: 32, kill: 0, killYoung: 2, heatSet: 35, nightSet: 13,
    harvest: 'continuous', stages: { leafy: 0.12, flower: 0.45, fruit: 0.62 },
    words: { ripe: 'reddening' },
    kc: [0.5, 1.05, 0.85], feedDraw: 35, holdDays: 14, pickKgH: 6, kind: 'fruitveg',
    problems: ['aphids', 'whitefly', 'ber', 'weeds'],
  },
  strawberry: {
    id: 'strawberry', label: 'Strawberries', tBase: 5, tCap: 28, kill: -12, killYoung: -6, flowerKill: -1,
    harvest: 'continuous', stages: { leafy: 0.1, flower: 0.5, fruit: 0.7 }, perennial: true,
    words: { leafy: 'in leaf', ripe: 'fruiting', spent: 'runnering' },
    kc: [0.4, 0.9, 0.7], feedDraw: 20, holdDays: 2, pickKgH: 5, kind: 'fruitveg',
    problems: ['botrytis', 'slugs', 'birds_fruit', 'weeds'],
  },
  brassica: {
    id: 'brassica', label: 'Cabbages', tBase: 4, tCap: 26, kill: -10, killYoung: -4,
    harvest: 'once', stages: { leafy: 0.1, flower: 0.5, fruit: 0.5 },
    words: { flowering: 'heading', fruiting: 'heading', ripe: 'firm', over: 'splitting' },
    kc: [0.45, 1.05, 0.95], feedDraw: 55, holdDays: 40, pickKgH: 50, kind: 'cabbage',
    problems: ['whites', 'pigeons', 'slugs', 'flea', 'clubroot', 'weeds'],
  },
  napa: {
    id: 'napa', label: 'Napa cabbage', tBase: 5, tCap: 25, kill: -4, killYoung: -2,
    harvest: 'once', stages: { leafy: 0.1, flower: 0.55, fruit: 0.55 },
    words: { flowering: 'heading', fruiting: 'heading', ripe: 'firm', over: 'bolting' },
    kc: [0.45, 1.0, 0.95], feedDraw: 40, holdDays: 18, pickKgH: 40, kind: 'cabbage',
    problems: ['slugs', 'flea', 'whites', 'clubroot', 'weeds'],
  },
  allium: {
    id: 'allium', label: 'Garlic', tBase: 0, tCap: 24, kill: -16, killYoung: -10,
    harvest: 'once', stages: { leafy: 0.08, flower: 0.72, fruit: 0.72 },
    words: { flowering: 'bulbing', fruiting: 'bulbing', ripe: 'leaves browning', over: 'splitting' },
    kc: [0.4, 0.95, 0.6], feedDraw: 25, holdDays: 12, pickKgH: 10, kind: 'bulb',
    problems: ['rust', 'white_rot', 'weeds'],
  },
  fava: {
    id: 'fava', label: 'Broad beans', tBase: 3, tCap: 25, kill: -10, killYoung: -8, flowerKill: -2,
    harvest: 'once', stages: { leafy: 0.12, flower: 0.42, fruit: 0.6 },
    words: { ripe: 'pods black and dry', over: 'shattering' },
    kc: [0.4, 1.05, 0.5], feedDraw: 6, fixes: 14, holdDays: 14, pickKgH: 3, kind: 'pod',
    problems: ['blackfly', 'chocolate_spot', 'weeds'],
  },
  pea: {
    id: 'pea', label: 'Dry peas', tBase: 4, tCap: 25, kill: -8, killYoung: -6,
    harvest: 'once', stages: { leafy: 0.12, flower: 0.45, fruit: 0.62 },
    words: { ripe: 'pods dry', over: 'shattering' },
    kc: [0.4, 1.05, 0.5], feedDraw: 6, fixes: 12, holdDays: 10, pickKgH: 3, kind: 'pod',
    problems: ['pea_moth', 'pigeons', 'mildew', 'weeds'],
  },
  chickpea: {
    id: 'chickpea', label: 'Chickpeas', tBase: 5, tCap: 30, kill: -5, killYoung: -3,
    harvest: 'once', stages: { leafy: 0.12, flower: 0.45, fruit: 0.62 },
    words: { ripe: 'pods rattling', over: 'shattering' },
    kc: [0.4, 1.0, 0.5], feedDraw: 5, fixes: 10, holdDays: 15, pickKgH: 2.5, kind: 'pod',
    problems: ['ascochyta', 'weeds'],
  },
  lentil: {
    id: 'lentil', label: 'Lentils', tBase: 5, tCap: 28, kill: -6, killYoung: -4,
    harvest: 'once', stages: { leafy: 0.12, flower: 0.45, fruit: 0.62 },
    words: { ripe: 'pods tan', over: 'shattering' },
    kc: [0.4, 1.0, 0.45], feedDraw: 5, fixes: 10, holdDays: 8, pickKgH: 1.5, kind: 'pod',
    problems: ['aphids', 'weeds'],
  },
  bean: {
    id: 'bean', label: 'Dry beans', tBase: 10, tCap: 30, kill: 0, killYoung: 1, heatSet: 34, nightSet: 9,
    harvest: 'once', stages: { leafy: 0.12, flower: 0.45, fruit: 0.62 },
    words: { ripe: 'pods dry', over: 'shattering' },
    kc: [0.4, 1.05, 0.5], feedDraw: 8, fixes: 10, holdDays: 12, pickKgH: 3, kind: 'pod',
    problems: ['slugs', 'blackfly', 'weeds'],
  },
  wintergrain: {
    id: 'wintergrain', label: 'Winter grain', tBase: 0, tCap: 26, kill: -20, killYoung: -12,
    harvest: 'once', stages: { leafy: 0.08, flower: 0.62, fruit: 0.72 },
    words: { leafy: 'tillering', flowering: 'in ear', fruiting: 'filling', ripe: 'ripe', over: 'shedding' },
    kc: [0.35, 1.1, 0.4], feedDraw: 35, holdDays: 10, pickKgH: 0, kind: 'grain',
    problems: ['grain_rust', 'birds_grain', 'weeds'],
  },
  springgrain: {
    id: 'springgrain', label: 'Spring grain', tBase: 3, tCap: 28, kill: -8, killYoung: -5,
    harvest: 'once', stages: { leafy: 0.08, flower: 0.6, fruit: 0.7 },
    words: { leafy: 'tillering', flowering: 'in ear', fruiting: 'filling', ripe: 'ripe', over: 'shedding' },
    kc: [0.35, 1.1, 0.4], feedDraw: 32, holdDays: 10, pickKgH: 0, kind: 'grain',
    problems: ['grain_rust', 'birds_grain', 'weeds'],
  },
  corn: {
    id: 'corn', label: 'Corn', tBase: 10, tCap: 30, kill: -1, killYoung: 0, heatSet: 36,
    harvest: 'once', stages: { leafy: 0.1, flower: 0.5, fruit: 0.6 },
    words: { flowering: 'silking', fruiting: 'filling', ripe: 'husks dry', over: 'mouldering' },
    kc: [0.4, 1.2, 0.6], feedDraw: 50, holdDays: 25, pickKgH: 30, kind: 'corn',
    problems: ['crows', 'borer', 'boar', 'weeds'],
  },
  rose: {
    id: 'rose', label: 'Damask roses', tBase: 5, tCap: 28, kill: -18, killYoung: -10, flowerKill: -1,
    harvest: 'continuous', stages: { leafy: 0.1, flower: 0.8, fruit: 0.8 }, perennial: true,
    words: { leafy: 'in leaf', flowering: 'in bud', fruiting: 'in bud', ripe: 'in bloom', spent: 'hips forming' },
    kc: [0.4, 0.8, 0.6], feedDraw: 12, holdDays: 2, pickKgH: 1, kind: 'petal',
    problems: ['blackspot', 'aphids'],
  },
};

export interface CropSpec {
  id: string;
  family: FamilyId;
  where: FacilityId[];
  /** Months (0-11) it can go in. */
  plant: number[];
  /** What goes in the ground. */
  how: 'seed' | 'plug' | 'clove' | 'crown' | 'bush';
  /** Plants per square metre. */
  perM2: number;
  /** Potential per plant under expert care, kg. */
  kgPerPlant: number;
  /** Degree days from planting to first ripe (perennials: from the new year). */
  gddToRipe: number;
  /** Continuous crops: how long the picking season runs, days. */
  cropDays?: number;
  /** Seed, plugs or crowns, $ per square metre. */
  costM2: number;
  /** One line of character, printed on the seed packet. */
  note: string;
}

const tom = (id: string, kg: number, gdd: number, note: string, perM2 = 2): CropSpec =>
  ({ id, family: 'tomato', where: ['polytunnel'], plant: [3, 4], how: 'plug', perM2, kgPerPlant: kg, gddToRipe: gdd, cropDays: 85, costM2: 2.5 * perM2, note });
const corn = (id: string, kg: number, gdd: number, note: string): CropSpec =>
  ({ id, family: 'corn', where: ['top_field', 'walled_garden'], plant: [4], how: 'seed', perM2: 7, kgPerPlant: kg, gddToRipe: gdd, costM2: 0.35, note });
const drybean = (id: string, kg: number, gdd: number, note: string): CropSpec =>
  ({ id, family: 'bean', where: ['walled_garden', 'top_field'], plant: [4, 5], how: 'seed', perM2: 12, kgPerPlant: kg, gddToRipe: gdd, costM2: 0.9, note });

export const CROPS: Record<string, CropSpec> = Object.fromEntries(([
  // --- The polytunnel ---
  tom('cuore_di_bue', 5.6, 830, 'Early for a big tomato, and heavy.'),
  tom('brandywine', 5.0, 990, 'Late, shy to set in the heat, and worth the wait.'),
  tom('black_krim', 4.8, 830, 'Early, dark and salty-edged. Splits if the watering is uneven.'),
  tom('green_zebra', 4.6, 810, 'Early and prolific. Ripe when it blushes yellow.'),
  tom('cherokee_purple', 4.8, 970, 'Late and soft. Pick it the day it colours.'),
  tom('san_marzano', 2.6, 920, 'A dwarf: planted close, cropped hard.', 3.5),
  tom('costoluto_genovese', 5.0, 840, 'Ribbed and early. Stands the heat better than most.'),
  tom('white_beauty', 4.2, 970, 'Late, pale and low in acid.'),
  tom('striped_german', 5.0, 1000, 'The latest of all, and the biggest fruit.'),
  tom('paul_robeson', 4.2, 940, 'Light-cropping and very fine.'),
  { id: 'chili', family: 'chili', where: ['polytunnel'], plant: [3, 4], how: 'plug', perM2: 2.5, kgPerPlant: 0.9, gddToRipe: 960, cropDays: 95, costM2: 5, note: 'Slow to start and slow to redden. Give it the warmest bay.' },
  { id: 'pineberry', family: 'strawberry', where: ['polytunnel', 'walled_garden'], plant: [7, 8], how: 'crown', perM2: 6, kgPerPlant: 0.3, gddToRipe: 560, cropDays: 32, costM2: 9, note: 'Crowns in late summer, fruit the next spring and for two more after.' },

  // --- The walled garden ---
  { id: 'white_cabbage', family: 'brassica', where: ['walled_garden'], plant: [3, 4], how: 'plug', perM2: 3, kgPerPlant: 2.3, gddToRipe: 2350, costM2: 1.8, note: 'A storage white. Planted in spring, cut in autumn, and it stands in the cold.' },
  { id: 'napa_cabbage', family: 'napa', where: ['walled_garden', 'polytunnel'], plant: [6, 7], how: 'seed', perM2: 5, kgPerPlant: 1.4, gddToRipe: 1000, costM2: 0.6, note: 'Sow after midsummer or it bolts in the long days.' },
  { id: 'garlic_bulbs', family: 'allium', where: ['walled_garden', 'top_field'], plant: [9, 10], how: 'clove', perM2: 25, kgPerPlant: 0.068, gddToRipe: 2250, costM2: 6, note: 'Cloves in autumn, bulbs at midsummer. Save the fattest to plant again.' },
  { id: 'broad_beans', family: 'fava', where: ['walled_garden', 'top_field'], plant: [1, 2, 10], how: 'seed', perM2: 12, kgPerPlant: 0.04, gddToRipe: 1500, costM2: 0.8, note: 'Sow in November to stand the winter, or in February. Leaves the soil richer.' },
  { id: 'yellow_peas', family: 'pea', where: ['walled_garden', 'top_field'], plant: [1, 2], how: 'seed', perM2: 60, kgPerPlant: 0.0062, gddToRipe: 1350, costM2: 0.5, note: 'Sown thick in late winter, pulled dry in July.' },
  { id: 'chickpeas', family: 'chickpea', where: ['walled_garden', 'top_field'], plant: [2, 3], how: 'seed', perM2: 35, kgPerPlant: 0.0082, gddToRipe: 1500, costM2: 0.6, note: 'Wants a dry spring. A wet one brings blight.' },
  { id: 'black_beluga_lentils', family: 'lentil', where: ['walled_garden', 'top_field'], plant: [2, 3], how: 'seed', perM2: 120, kgPerPlant: 0.00165, gddToRipe: 1250, costM2: 0.6, note: 'A poor competitor. Keep the weeds off it.' },
  drybean('calypso_beans', 0.028, 1250, 'Bush habit, black and white. Dry on the plant in September.'),
  drybean('applegrower_beans', 0.03, 1300, 'A pole bean: give it a cane and it climbs.'),
  drybean('sea_island_red_peas', 0.026, 1180, 'A cowpea. Loves heat, sulks in a cold June.'),
  drybean('tepary_beans', 0.02, 1080, 'Desert bean. Fast, and it laughs at drought.'),
  { id: 'rose_petals', family: 'rose', where: ['walled_garden'], plant: [9, 10, 1, 2], how: 'bush', perM2: 1, kgPerPlant: 0.36, gddToRipe: 600, cropDays: 26, costM2: 18, note: 'Damask roses. One flush in June: pick in the morning before the sun takes the scent.' },

  // --- The top field (600 m² strips) ---
  { id: 'einkorn', family: 'wintergrain', where: ['top_field'], plant: [9, 10], how: 'seed', perM2: 300, kgPerPlant: 0.00066, gddToRipe: 2400, costM2: 0.06, note: 'The oldest wheat. Light yields, and it asks nothing of the soil.' },
  { id: 'emmer', family: 'wintergrain', where: ['top_field'], plant: [9, 10], how: 'seed', perM2: 300, kgPerPlant: 0.0008, gddToRipe: 2320, costM2: 0.06, note: 'Farro. Tall and hulled; it stands the wet better than wheat.' },
  { id: 'spelt', family: 'wintergrain', where: ['top_field'], plant: [9, 10], how: 'seed', perM2: 300, kgPerPlant: 0.001, gddToRipe: 2450, costM2: 0.06, note: 'The heaviest of the old wheats, and the latest.' },
  { id: 'freekeh', family: 'wintergrain', where: ['top_field'], plant: [9, 10], how: 'seed', perM2: 300, kgPerPlant: 0.0009, gddToRipe: 2080, costM2: 0.06, note: 'Durum cut green and fired in the field. Ten days before the rest.' },
  { id: 'kamut', family: 'springgrain', where: ['top_field'], plant: [2, 3], how: 'seed', perM2: 250, kgPerPlant: 0.0012, gddToRipe: 1650, costM2: 0.07, note: 'Khorasan wheat, sown in spring. Wants a hot dry July.' },
  corn('hopi_blue_corn', 0.052, 1380, 'Flour corn, short and early.'),
  corn('glass_gem_corn', 0.05, 1420, 'Every cob different. Ripe when the husks rustle.'),
  corn('painted_corn', 0.05, 1400, 'Multicoloured flint. Dependable.'),
  corn('oaxacan_green_corn', 0.058, 1480, 'Tall and late. Needs the long September.'),
  corn('bloody_butcher_corn', 0.056, 1450, 'Blood-red dent, heavy on good ground.'),
  corn('mandan_bride_corn', 0.042, 1160, 'Bred for short northern summers. First to dry.'),
  corn('strawberry_popcorn', 0.034, 1260, 'Small red cobs. A popcorn yields lightly.'),
  corn('navajo_wedding_corn', 0.05, 1350, 'Desert flint; takes a dry July in its stride.'),
  corn('cherokee_long_ear_corn', 0.048, 1440, 'Long thin ears, many colours.'),
  corn('fire_chief_corn', 0.05, 1420, 'Red and gold, and the birds love it.'),
] as CropSpec[]).map(c => [c.id, c]));

/* -----------------------------------------------------------------------------
   TREES, VINES AND POTTED CITRUS
   --------------------------------------------------------------------------- */
export interface TreeSpec {
  cropId: string;
  /** Degree days from 1 January (base 5) to blossom, and to ripe. */
  gddBloom: number;
  gddRipe: number;
  /** Days ripe fruit hangs before it drops. */
  hangDays: number;
  /** Potential crop at full maturity, kg. */
  prime: number;
  /** Age at which it reaches that. */
  primeAge: number;
  /** Frost at blossom kills flowers below this. */
  bloomKill: number;
  /** Kills the tree itself below this. */
  treeKill: number;
  /** Heavy years are followed by rest years unless the fruit is thinned. */
  biennial: boolean;
  /** Bees raise the set. */
  beePollinated: boolean;
  pickKgH: number;
  problems: string[];
  kind: string;
  /** Evergreen: no winter drop, and fruit can hang into the new year. */
  evergreen?: boolean;
  /** Needs the orangery's warmth to live through a winter here. */
  tender?: boolean;
}

export const TREE_SPECS: Record<string, TreeSpec> = {
  apples: { cropId: 'apples', gddBloom: 230, gddRipe: 2250, hangDays: 30, prime: 150, primeAge: 25, bloomKill: -2, treeKill: -30, biennial: true, beePollinated: true, pickKgH: 35, problems: ['codling', 'scab', 'wasps', 'aphids'], kind: 'tree' },
  plums: { cropId: 'plums', gddBloom: 140, gddRipe: 640, hangDays: 18, prime: 45, primeAge: 12, bloomKill: -2, treeKill: -28, biennial: false, beePollinated: true, pickKgH: 20, problems: ['plum_moth', 'aphids', 'brown_rot'], kind: 'tree' },
  yuzu: { cropId: 'yuzu', gddBloom: 420, gddRipe: 2900, hangDays: 70, prime: 14, primeAge: 12, bloomKill: 0, treeKill: -10, biennial: false, beePollinated: true, pickKgH: 12, problems: ['scale', 'aphids'], kind: 'tree', evergreen: true },
  akebi: { cropId: 'akebi', gddBloom: 250, gddRipe: 2150, hangDays: 12, prime: 6, primeAge: 8, bloomKill: -2, treeKill: -20, biennial: false, beePollinated: true, pickKgH: 6, problems: ['aphids'], kind: 'tree' },
  finger_limes: { cropId: 'finger_limes', gddBloom: 380, gddRipe: 4100, hangDays: 90, prime: 2.4, primeAge: 8, bloomKill: 1, treeKill: -3, biennial: false, beePollinated: false, pickKgH: 3, problems: ['scale'], kind: 'tree', evergreen: true, tender: true },
  calamansi: { cropId: 'calamansi', gddBloom: 350, gddRipe: 3300, hangDays: 80, prime: 4.5, primeAge: 6, bloomKill: 1, treeKill: -3, biennial: false, beePollinated: false, pickKgH: 5, problems: ['scale', 'aphids'], kind: 'tree', evergreen: true, tender: true },
  buddhas_hand: { cropId: 'buddhas_hand', gddBloom: 400, gddRipe: 3900, hangDays: 60, prime: 3.5, primeAge: 7, bloomKill: 1, treeKill: -2, biennial: false, beePollinated: false, pickKgH: 8, problems: ['scale'], kind: 'tree', evergreen: true, tender: true },
  black_sapote: { cropId: 'black_sapote', gddBloom: 600, gddRipe: 4300, hangDays: 40, prime: 6, primeAge: 8, bloomKill: 2, treeKill: -1, biennial: false, beePollinated: false, pickKgH: 10, problems: ['scale'], kind: 'tree', evergreen: true, tender: true },
};

/* -----------------------------------------------------------------------------
   PLACES
   --------------------------------------------------------------------------- */
export interface PlotTemplate { id: string; label: string; areaM2: number }
export interface TreeTemplate { id: string; cropId: string; label: string; age: number; potted?: boolean }

export interface FacilitySpec {
  id: FacilityId;
  name: string;
  cost: number;
  /** One line: what you are buying. */
  about: string;
  /** Minutes to walk here from the farmhouse. */
  walk: number;
  /** Minutes to walk the rows and see every problem. */
  walkRows: number;
  plots?: PlotTemplate[];
  trees?: TreeTemplate[];
  /** Under cover: no rain, warmer days and nights. */
  covered?: { dayUp: number; nightUp: number };
  /** Water a bed by can, minutes per m². */
  canMinPerM2?: number;
  /** Where on the estate: the farm around the house, or the coast. */
  map: 'farm' | 'wild';
}

export const FACILITIES: Record<FacilityId, FacilitySpec> = {
  walled_garden: {
    id: 'walled_garden', name: 'The Kitchen Garden', cost: 400, map: 'farm', walk: 3, walkRows: 10, canMinPerM2: 3,
    about: 'Seven raised beds and a border of damask roses inside old lime-washed walls. Cabbages, garlic, beans and peas.',
    // The painted plate has three small beds at the back and two pairs of big
    // ones in front, so the model has too: 36 m² of bed either way.
    plots: [
      { id: 'bed1', label: 'Back bed, left', areaM2: 4 }, { id: 'bed2', label: 'Back bed, middle', areaM2: 4 }, { id: 'bed3', label: 'Back bed, right', areaM2: 4 },
      { id: 'bed4', label: 'Middle bed, left', areaM2: 6 }, { id: 'bed5', label: 'Middle bed, right', areaM2: 6 },
      { id: 'bed6', label: 'Front bed, left', areaM2: 6 }, { id: 'bed7', label: 'Front bed, right', areaM2: 6 },
      { id: 'roses', label: 'The rose border', areaM2: 10 },
    ],
  },
  polytunnel: {
    id: 'polytunnel', name: 'The Polytunnel', cost: 650, map: 'farm', walk: 4, walkRows: 8, canMinPerM2: 2.5,
    about: 'Two long beds under plastic, four bays: heirloom tomatoes, chili and pineberries. No rain gets in — someone has to water.',
    covered: { dayUp: 6, nightUp: 2.5 },
    plots: [
      { id: 'bay1', label: 'Left bed, near', areaM2: 4 }, { id: 'bay2', label: 'Left bed, far', areaM2: 4 },
      { id: 'bay3', label: 'Right bed, near', areaM2: 4 }, { id: 'bay4', label: 'Right bed, far', areaM2: 4 },
    ],
  },
  top_field: {
    id: 'top_field', name: 'The Top Field', cost: 1200, map: 'farm', walk: 8, walkRows: 20, canMinPerM2: 0,
    about: 'Three strips of plough, 600 m² each: heritage grains, landrace corn and field pulses. Rain-fed.',
    plots: [
      { id: 'strip1', label: 'Far strip', areaM2: 600 }, { id: 'strip2', label: 'Middle strip', areaM2: 600 }, { id: 'strip3', label: 'Near strip', areaM2: 600 },
    ],
  },
  orchard: {
    id: 'orchard', name: 'The Orchard', cost: 900, map: 'farm', walk: 5, walkRows: 12,
    about: 'Two apples — one old standard, one young — two plums for green-plum picking, a yuzu on the south wall and an akebi on the pergola.',
    trees: [
      { id: 'apple_old', cropId: 'apples', label: 'The old apple', age: 40 },
      { id: 'apple_young', cropId: 'apples', label: 'The young apple', age: 8 },
      { id: 'plum_near', cropId: 'plums', label: 'The near plum', age: 15 },
      { id: 'plum_far', cropId: 'plums', label: 'The far plum', age: 11 },
      { id: 'yuzu_wall', cropId: 'yuzu', label: 'The yuzu on the wall', age: 9 },
      { id: 'akebi_pergola', cropId: 'akebi', label: 'The akebi on the pergola', age: 6 },
    ],
  },
  orangery: {
    id: 'orangery', name: 'The Lemon House', cost: 2200, map: 'farm', walk: 3, walkRows: 6,
    about: 'Glass, a stove and four citrus in pots. Frost-free as long as someone keeps the stove in.',
    covered: { dayUp: 8, nightUp: 3 },
    trees: [
      { id: 'finger_lime', cropId: 'finger_limes', label: 'Finger lime', age: 6, potted: true },
      { id: 'calamansi_pot', cropId: 'calamansi', label: 'Calamansi', age: 5, potted: true },
      { id: 'buddhas_hand_pot', cropId: 'buddhas_hand', label: 'Buddha’s hand', age: 6, potted: true },
      { id: 'black_sapote_pot', cropId: 'black_sapote', label: 'Black sapote', age: 6, potted: true },
    ],
  },
  hives: {
    id: 'hives', name: 'The Apiary', cost: 500, map: 'farm', walk: 6, walkRows: 5,
    about: 'Three hives on the meadow bank. Acacia in May, chestnut and lime in June, ivy in October.',
  },
  hen_run: {
    id: 'hen_run', name: 'The Hen Run', cost: 300, map: 'farm', walk: 2, walkRows: 4,
    about: 'Six hens, a coop and a run. Fewer eggs in the dark months; more on fly larvae.',
  },
  salt_pans: {
    id: 'salt_pans', name: 'The Salt Pans', cost: 450, map: 'wild', walk: 45, walkRows: 5,
    about: 'Three clay pans behind the dunes. Let the sea in, and a hot still week does the rest.',
  },
  worm_shed: {
    id: 'worm_shed', name: 'The Worm and Fly Shed', cost: 350, map: 'farm', walk: 2, walkRows: 4,
    about: 'Worm bins and black soldier fly bins against the barn. The lab’s wet waste goes in; castings, frass and larvae come out.',
  },
};

export const FACILITY_ORDER: FacilityId[] = ['walled_garden', 'polytunnel', 'top_field', 'orchard', 'orangery', 'hives', 'hen_run', 'worm_shed', 'salt_pans'];

/* -----------------------------------------------------------------------------
   PROBLEMS

   What you see, what it is, and what deals with it. The daily odds live in
   services/growth.ts because they read the weather; the words live here.
   --------------------------------------------------------------------------- */
export interface ProblemSpec {
  id: string;
  label: string;
  see: string;
  is: string;
  /** Health lost per day while it runs. */
  hit: number;
  /** Quality lost per day on what is ripening. */
  qHit?: number;
  /** The fix: what you do, how long it takes per bed, and what it costs. */
  fix: string;
  minutes: number;
  cost?: number;
  /** A cover or treatment that stops it happening at all. */
  stoppedBy?: string[];
}

export const PROBLEMS: Record<string, ProblemSpec> = {
  weeds: { id: 'weeds', label: 'Weeds', see: 'A green haze between the rows', is: 'Chickweed and fat hen, coming up faster than the crop and drinking its water.', hit: 0.1, fix: 'Hoe the bed', minutes: 25, stoppedBy: ['mulch'] },
  slugs: { id: 'slugs', label: 'Slugs', see: 'Silver trails and holed leaves', is: 'Slugs, out after the rain. A seedling goes in a night.', hit: 2.5, fix: 'Go out with a torch at dusk', minutes: 20 },
  whites: { id: 'whites', label: 'Cabbage whites', see: 'White butterflies over the bed', is: 'Cabbage whites laying under the leaves. In a week the caterpillars lace every leaf.', hit: 2.2, fix: 'Pick off the eggs and caterpillars', minutes: 15, stoppedBy: ['net'] },
  pigeons: { id: 'pigeons', label: 'Pigeons', see: 'Leaves stripped to the rib', is: 'Wood pigeons. Winter is their season.', hit: 1.6, fix: 'Net the bed', minutes: 10, stoppedBy: ['net'] },
  flea: { id: 'flea', label: 'Flea beetle', see: 'Tiny shot-holes in young leaves', is: 'Flea beetles, out in a dry warm spell. Seedlings stall.', hit: 2.0, fix: 'Water well and cover with fleece', minutes: 10, stoppedBy: ['fleece'] },
  clubroot: { id: 'clubroot', label: 'Clubroot', see: 'Plants wilting in the afternoon sun', is: 'Clubroot: swollen roots, from cabbages grown too often on this soil. Only rotation cures it.', hit: 1.2, fix: 'Lime the bed and pull the worst', minutes: 20 },
  blight: { id: 'blight', label: 'Blight', see: 'Brown patches spreading on the lower leaves', is: 'Late blight, out of warm wet weather. It moves up a plant in days and takes the fruit.', hit: 6, qHit: 1, fix: 'Strip the affected leaves and burn them', minutes: 20, stoppedBy: ['act', 'lab'] },
  whitefly: { id: 'whitefly', label: 'Whitefly', see: 'A white cloud when you brush the leaves', is: 'Whitefly under the plastic, and sooty mould on the honeydew they leave.', hit: 1.0, fix: 'Hang sticky traps and spray the undersides', minutes: 12, stoppedBy: ['sticky_traps'] },
  ber: { id: 'ber', label: 'Blossom-end rot', see: 'Black leathery patches on the fruit', is: 'Blossom-end rot: calcium not reaching the fruit, from watering that goes dry then wet.', hit: 0, qHit: 1.5, fix: 'Water evenly, and feed calcium', minutes: 10, stoppedBy: ['wca'] },
  tuta: { id: 'tuta', label: 'Tomato leafminer', see: 'Pale blotches and tunnels in the leaves', is: 'Tuta absoluta, the Mediterranean leafminer. It bores into the fruit next.', hit: 1.8, qHit: 0.6, fix: 'Pick off mined leaves and hang pheromone traps', minutes: 15, stoppedBy: ['traps'] },
  aphids: { id: 'aphids', label: 'Aphids', see: 'Curled tips crowded with greenfly', is: 'Aphids on the soft growth. The ladybirds are a week behind them.', hit: 0.9, fix: 'Spray the tips with LAB serum or pinch them out', minutes: 10, stoppedBy: ['lab'] },
  blackfly: { id: 'blackfly', label: 'Blackfly', see: 'Black specks packed on the tips', is: 'Blackfly. Pinch out the tops once the lowest pods set, and they go with them.', hit: 1.8, fix: 'Pinch out the tips', minutes: 10 },
  chocolate_spot: { id: 'chocolate_spot', label: 'Chocolate spot', see: 'Brown freckles on the leaves', is: 'Chocolate spot, a wet-spring fungus on broad beans.', hit: 1.2, fix: 'Thin the plants for air and pick off the worst', minutes: 12, stoppedBy: ['act'] },
  pea_moth: { id: 'pea_moth', label: 'Pea moth', see: 'Small caterpillars inside the pods', is: 'Pea moth larvae, eating the peas from inside.', hit: 0.4, qHit: 0.8, fix: 'Net the rows through June', minutes: 10, stoppedBy: ['net'] },
  mildew: { id: 'mildew', label: 'Powdery mildew', see: 'White dust on the leaves', is: 'Powdery mildew, in a dry spell after a damp one.', hit: 0.8, fix: 'Spray with compost tea and water at the root', minutes: 10, stoppedBy: ['act'] },
  ascochyta: { id: 'ascochyta', label: 'Ascochyta blight', see: 'Brown rings on the chickpea leaves', is: 'Ascochyta blight. A wet spring is what chickpeas cannot stand.', hit: 3, fix: 'Strip the worst and hope it dries', minutes: 15, stoppedBy: ['act'] },
  rust: { id: 'rust', label: 'Rust', see: 'Orange pustules on the leaves', is: 'Allium rust, in a mild wet spring. The bulbs stay small.', hit: 1.4, fix: 'Take off the worst leaves and feed potash', minutes: 12, stoppedBy: ['lab'] },
  white_rot: { id: 'white_rot', label: 'White rot', see: 'Yellowing plants and fluffy white roots', is: 'White rot, from garlic on the same soil too soon. It stays in the ground for years.', hit: 2, fix: 'Lift and burn the affected plants', minutes: 15 },
  grain_rust: { id: 'grain_rust', label: 'Rust', see: 'Rusty streaks on the flag leaves', is: 'Stripe rust in a warm humid May. Old wheats stand it better than new.', hit: 1.0, fix: 'Nothing but patience — next time, a resistant line', minutes: 0 },
  birds_grain: { id: 'birds_grain', label: 'Birds in the grain', see: 'Sparrows working the ripe ears', is: 'Sparrows and pigeons in the ripe grain. Every day it stands costs you.', hit: 0, fix: 'Cut it', minutes: 0 },
  birds_fruit: { id: 'birds_fruit', label: 'Blackbirds', see: 'Pecked fruit', is: 'Blackbirds at the ripe fruit.', hit: 0, qHit: 0.5, fix: 'Net the bed', minutes: 10, stoppedBy: ['net'] },
  botrytis: { id: 'botrytis', label: 'Grey mould', see: 'Grey fur on the fruit', is: 'Botrytis in damp still air.', hit: 1.2, qHit: 1, fix: 'Pick off the mouldy fruit and open the tunnel', minutes: 12, stoppedBy: ['mulch'] },
  crows: { id: 'crows', label: 'Crows at the drill', see: 'Crows walking the rows, pulling seedlings', is: 'Crows after the seed you just sowed.', hit: 3, fix: 'Put up the scarecrow', minutes: 15, stoppedBy: ['scarecrow'] },
  borer: { id: 'borer', label: 'Corn borer', see: 'Frass and broken tassels', is: 'European corn borer, tunnelling the stalks. Broken plants lose their ears.', hit: 1.2, fix: 'Cut out and burn the broken stalks', minutes: 20 },
  boar: { id: 'boar', label: 'Wild boar', see: 'Plants flattened and the ground turned over', is: 'Cinghiali. A sounder can take a strip of corn in two nights.', hit: 6, fix: 'Put up the electric fence', minutes: 30, stoppedBy: ['electric_fence'] },
  blackspot: { id: 'blackspot', label: 'Black spot', see: 'Black blotches, yellowing leaves', is: 'Rose black spot, in a wet summer.', hit: 0.9, fix: 'Pick up fallen leaves and spray compost tea', minutes: 15, stoppedBy: ['act'] },
  codling: { id: 'codling', label: 'Codling moth', see: 'Tiny holes with brown frass', is: 'Codling moth: a grub in the core of every third apple.', hit: 0, qHit: 0.6, fix: 'Hang pheromone traps', minutes: 15, cost: 12, stoppedBy: ['traps'] },
  scab: { id: 'scab', label: 'Scab', see: 'Olive blotches on leaves and fruit', is: 'Apple scab from a wet spring. Ugly more than ruinous.', hit: 0.3, qHit: 0.5, fix: 'Rake up the leaves; spray compost tea next spring', minutes: 20, stoppedBy: ['act'] },
  wasps: { id: 'wasps', label: 'Wasps', see: 'Wasps in the windfalls', is: 'Wasps hollowing the ripe fruit on the tree as well as on the ground.', hit: 0, qHit: 0.4, fix: 'Pick up the windfalls', minutes: 15 },
  plum_moth: { id: 'plum_moth', label: 'Plum moth', see: 'Fruit colouring early and dropping', is: 'Plum moth larvae in the stones.', hit: 0, qHit: 0.6, fix: 'Hang pheromone traps', minutes: 10, cost: 10, stoppedBy: ['traps'] },
  brown_rot: { id: 'brown_rot', label: 'Brown rot', see: 'Brown fruit with rings of white spots', is: 'Brown rot, through wasp and bird wounds in wet weather.', hit: 0.5, qHit: 0.6, fix: 'Pick off the rotten fruit', minutes: 15 },
  scale: { id: 'scale', label: 'Scale', see: 'Sticky leaves and black mould', is: 'Scale insects under the leaves, and sooty mould on the honeydew.', hit: 0.8, fix: 'Wipe the leaves with soapy water', minutes: 20 },
};

/* -----------------------------------------------------------------------------
   THE KIT: tools that change how long things take, or that act on their own
   --------------------------------------------------------------------------- */
export interface FarmTool {
  id: string;
  name: string;
  cost: number;
  about: string;
  /** Which places it works in; absent = anywhere. */
  where?: FacilityId[];
  /** A cover/treatment key the tool provides (traps, scarecrow, fence). */
  provides?: string;
}

export const FARM_TOOLS: FarmTool[] = [
  { id: 'hose', name: 'Hose and reel', cost: 45, about: 'Water a bed in a quarter of the time a can takes.', where: ['walled_garden', 'polytunnel'] },
  { id: 'drip', name: 'Drip line and timer', cost: 180, about: 'Waters every bed here whenever it gets dry, without anyone.', where: ['walled_garden', 'polytunnel'] },
  { id: 'stirrup_hoe', name: 'Stirrup hoe', cost: 25, about: 'Hoe a bed in half the time.', where: ['walled_garden', 'polytunnel', 'top_field'] },
  { id: 'netting', name: 'Netting and hoops', cost: 40, about: 'Keeps butterflies and pigeons off brassicas, birds off fruit.', where: ['walled_garden', 'polytunnel', 'top_field'] },
  { id: 'fleece', name: 'Horticultural fleece', cost: 30, about: 'Two degrees of frost, and flea beetle, kept off.', where: ['walled_garden', 'polytunnel', 'top_field'] },
  { id: 'sprayer', name: 'Pump sprayer', cost: 70, about: 'Put a soil-lab brew on a bed in a few minutes.' },
  { id: 'traps', name: 'Pheromone traps', cost: 35, about: 'Codling moth, plum moth, tomato leafminer: caught before they lay.', provides: 'traps', where: ['orchard', 'polytunnel'] },
  { id: 'sticky_traps', name: 'Yellow sticky traps', cost: 15, about: 'Whitefly and aphids under glass and plastic.', provides: 'sticky_traps', where: ['polytunnel', 'orangery'] },
  { id: 'scarecrow', name: 'Scarecrow', cost: 20, about: 'Crows at the seed drill think twice.', provides: 'scarecrow', where: ['top_field'] },
  { id: 'electric_fence', name: 'Electric fence', cost: 220, about: 'The only thing a wild boar respects.', provides: 'electric_fence', where: ['top_field'] },
  { id: 'seed_drill', name: 'Hand seed drill', cost: 260, about: 'Sow a strip in twenty minutes instead of an hour, evenly.', where: ['top_field'] },
  { id: 'scythe', name: 'Scythe and flail', cost: 45, about: 'Cut and thresh a strip by hand. A long day.', where: ['top_field'] },
  { id: 'long_pruner', name: 'Long-arm pruner', cost: 55, about: 'Prune a tree in half the time, from the ground.', where: ['orchard'] },
  { id: 'ladder', name: 'Orchard ladder', cost: 90, about: 'Three legs, and the top of the tree within reach: picking goes twice as fast.', where: ['orchard'] },
  { id: 'extractor', name: 'Honey extractor', cost: 240, about: 'Spin the frames instead of crushing the comb. The bees keep it.', where: ['hives'] },
  { id: 'auto_door', name: 'Automatic coop door', cost: 120, about: 'Shuts at dusk and opens at dawn. The fox finds it shut.', where: ['hen_run'] },
];

/* -----------------------------------------------------------------------------
   THE VAN: raw produce, sold at the gate

   The forager's van buys what you grow, at a wholesale share of what it sells
   the same thing for — and its appetite is small. Each class of produce has a
   weekly appetite in kg; selling past it pushes the price down, and it recovers
   over the following weeks. Selling raw is a floor under the farm, never the
   business: the lab is where a glut becomes money.
   --------------------------------------------------------------------------- */
export const VAN_WHOLESALE = 0.4;
export const VAN_RECOVERY = 0.35;          // share of the gap to 1 recovered each week
/* -----------------------------------------------------------------------------
   BIODYNAMIC: no synthetic sprays, no bought-in feed, living soil, heirloom seed
   The label is earned per bed and per tree: a year clean of synthetic sprays
   and bought manure (the conversion — land comes to you farmed conventionally,
   so the year starts the day you buy it), and soil life of 60 or more at the
   harvest, which the soil lab's compost, castings and IMO build. Every seed in
   the game is an heirloom or a landrace, so non-GMO is given.
   --------------------------------------------------------------------------- */
export const BIO_CONVERSION_DAYS = 336;
export const BIO_LIFE_MIN = 60;
/** What a synthetic spray clears at once and keeps off for a fortnight: pests, fungi and weeds. Not frost, birds, boar or the soil diseases. */
export const SPRAYABLE = new Set(['weeds', 'slugs', 'whites', 'flea', 'blight', 'whitefly', 'tuta', 'aphids', 'blackfly', 'chocolate_spot', 'pea_moth', 'mildew', 'ascochyta', 'rust', 'grain_rust', 'botrytis', 'borer', 'blackspot', 'codling', 'scab', 'plum_moth', 'brown_rot', 'scale']);
export const SPRAY_DAYS = 14;
/** Dollars of spray per square metre; a tree takes as much as 10 m². */
export const SPRAY_COST_M2 = 0.12;

/* THE MARKET FOR WHAT YOU GROW. Home-grown sells over the van's wholesale; a
   biodynamic label sells for a great deal more, but the buyers who pay for it
   are few, so the premium saturates fast and recovers weekly. */
export const HOME_GROWN_PREMIUM = 1.25;
export const BIO_VAN_PREMIUM = 1.6;
export const BIO_APPETITE_KG = 6;

export const PRODUCE_CLASS: Record<string, { label: string; appetiteKg: number }> = {
  tomato: { label: 'Tomatoes', appetiteKg: 14 },
  chili: { label: 'Chili', appetiteKg: 3 },
  berries: { label: 'Berries', appetiteKg: 4 },
  brassica: { label: 'Cabbages', appetiteKg: 30 },
  allium: { label: 'Garlic', appetiteKg: 8 },
  pulse: { label: 'Dry pulses', appetiteKg: 20 },
  grain: { label: 'Grain', appetiteKg: 45 },
  corn: { label: 'Corn', appetiteKg: 45 },
  petal: { label: 'Rose petals', appetiteKg: 1.5 },
  orchard: { label: 'Orchard fruit', appetiteKg: 40 },
  citrus: { label: 'Citrus', appetiteKg: 6 },
  honey: { label: 'Honey', appetiteKg: 12 },
  eggs: { label: 'Eggs', appetiteKg: 3 },
  salt: { label: 'Salt', appetiteKg: 25 },
  flor: { label: 'Flor de sal', appetiteKg: 2 },
  mushrooms: { label: 'Wild mushrooms', appetiteKg: 6 },
  wild_fruit: { label: 'Wild fruit and nuts', appetiteKg: 6 },
  catch: { label: 'The catch', appetiteKg: 25 },
};

export const produceClassOf = (cropId: string): string => {
  const c = CROPS[cropId];
  if (c) {
    switch (c.family) {
      case 'tomato': return 'tomato';
      case 'chili': return 'chili';
      case 'strawberry': return 'berries';
      case 'brassica': case 'napa': return 'brassica';
      case 'allium': return 'allium';
      case 'fava': case 'pea': case 'chickpea': case 'lentil': case 'bean': return 'pulse';
      case 'wintergrain': case 'springgrain': return 'grain';
      case 'corn': return 'corn';
      case 'rose': return 'petal';
    }
  }
  if (cropId === 'apples' || cropId === 'plums' || cropId === 'akebi') return 'orchard';
  if (['yuzu', 'finger_limes', 'calamansi', 'buddhas_hand', 'black_sapote'].includes(cropId)) return 'citrus';
  if (cropId === 'honey') return 'honey';
  if (cropId === 'egg_yolks') return 'eggs';
  if (cropId === 'noma_salt') return 'flor';
  if (cropId === 'salt') return 'salt';
  const w = WILD[cropId];
  if (w) return w.kind === 'mushroom' ? 'mushrooms' : w.kind === 'fish' || w.kind === 'shrimp' ? 'catch' : 'wild_fruit';
  return 'orchard';
};

/** The words for a piece on the picking card, by kind. */
export const PIECE_WORDS: Record<string, { young: string; prime: string; past: string; help: string }> = {
  cabbage: { young: 'loose', prime: 'firm', past: 'split', help: 'Cut the firm heads. A loose head is not ready; a split or bolted one is bitter.' },
  bulb: { young: 'green', prime: 'cured', past: 'split', help: 'Lift them when half the leaves are brown. Split bulbs do not keep; keep the fattest to plant again.' },
  pod: { young: 'green', prime: 'dry', past: 'shattered', help: 'Take the dry pods. Green ones will not keep. Leave some to shatter and that is next year’s seed, already used to this soil.' },
  fruitveg: { young: 'green', prime: 'ripe', past: 'split', help: 'Take the ripe. Leave a few of the best to go soft on the plant and you can save their seed.' },
  grain: { young: 'green', prime: 'ripe', past: 'shedding', help: 'Cut it ripe. Green grain will not keep; shedding grain is lost to the birds.' },
  corn: { young: 'milky', prime: 'dry', past: 'mouldy', help: 'Take the dry cobs for the mill. Save the best ears: a landrace learns the field it grows in.' },
  petal: { young: 'bud', prime: 'open', past: 'blown', help: 'Pick fully open blooms in the morning, before the sun takes the scent.' },
  tree: { young: 'unripe', prime: 'ripe', past: 'windfall', help: 'Take the ripe. Unripe fruit can hang another week; windfalls are bruised and poor.' },
};

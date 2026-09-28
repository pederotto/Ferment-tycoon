/* =============================================================================
   THE ESTATE: what the farm and the wild keep in the save.

   Everything here is advanced once a game day by services/farm.ts, which is
   pure, and read by the farm and wild rooms. Dates are absolute day numbers
   (services/climate.ts `absoluteDay`) so nothing breaks at the turn of a year.
   ============================================================================= */

export type FacilityId =
  | 'walled_garden' | 'polytunnel' | 'top_field' | 'orchard' | 'orangery'
  | 'hives' | 'hen_run' | 'salt_pans' | 'worm_shed';

export type FamilyId =
  | 'tomato' | 'chili' | 'strawberry' | 'brassica' | 'napa' | 'allium'
  | 'fava' | 'pea' | 'chickpea' | 'lentil' | 'bean'
  | 'wintergrain' | 'springgrain' | 'corn' | 'rose';

/** Where a planting is in its life. The scene draws one picture per stage. */
export type CropStage = 'sown' | 'seedling' | 'leafy' | 'flowering' | 'fruiting' | 'ripe' | 'over' | 'spent' | 'dead';

/** Things laid over or around a bed. Each is bought once and then costs a few minutes to put on. */
export interface CropCover {
  fleece?: boolean;   // +2 °C on a frosty night, keeps flea beetle and carrot fly off
  net?: boolean;      // butterflies, pigeons, birds at the fruit
  mulch?: boolean;    // holds water, smothers weeds, feeds the soil life slowly
}

export interface ActiveProblem {
  id: string;
  /** Day it appeared. */
  since: number;
  /** Seen by walking the rows or looking closely. An unseen problem still does its damage. */
  seen: boolean;
}

/**
 * One planting: a single variety on one plot. A bed is managed as a planting,
 * not plant by plant — the scene still draws every plant at its stage.
 */
export interface Planting {
  id: string;
  cropId: string;
  plants: number;
  plantedDay: number;
  /** Growing degree days since planting, above the family's base temperature. */
  gdd: number;
  stage: CropStage;
  health: number;           // 0-100: pests, disease, frost
  /** Accumulated conditions, each 0-1, averaged over the stage that forms them. */
  vigour: number;           // the plant's frame: leaf, root, stem
  setAvg: number;           // how well flowers are turning into fruit (a moving average)
  fill: number;             // how well the fruit or grain is filling
  /** Days counted into each running average, so a short stage is still a fair mean. */
  vigourDays: number;
  fillDays: number;
  /** Ripening conditions, -1 (wet, grey, lush) to +1 (sun, restraint, a live soil). */
  flavour: number;
  flavourDays: number;
  /** For a once-over crop: what the planting will give, fixed as it ripens. */
  potentialKg: number;
  /** Ripe and waiting to be picked, kg, and how long it has waited on average. */
  ripeKg: number;
  ripeAge: number;
  /** Ripened so far this season (continuous crops), as a share of the nominal crop. */
  released: number;
  pickedKg: number;
  lostKg: number;
  /** Mean quality of what has been picked, for the ledger. */
  pickedQ: number;
  daysRipe: number;
  problems: ActiveProblem[];
  cover: CropCover;
  /** Soil-lab treatments still working, keyed by treatment id, value = day it wears off. */
  treated: Record<string, number>;
  /** Tomatoes: side-shoots pinched and trusses tied. Wears off in a week. */
  trainedUntil?: number;
  /** A perennial's age in seasons, for crowns and bushes. */
  seasons?: number;
  /** Seed line generation this planting came from: saved seed adapts to the garden. */
  line?: number;
  /** The fruit left to go to seed rather than picked, for saving. */
  seedKept?: boolean;
  deathCause?: string;
}

export interface Plot {
  id: string;
  label: string;
  areaM2: number;
  /** Soil moisture as a share of what the soil can hold, 0-100. */
  water: number;
  /** Nutrients the crop can reach, 0-100. */
  fertility: number;
  /** Soil biology: how fast organic matter becomes food, how well disease is held down. */
  life: number;
  /** Families grown here, most recent first. The same family back on the same soil brings its diseases. */
  history: string[];
  planting?: Planting;
  /** A cover crop sown to rest and feed the plot through winter. */
  greenManure?: { sownDay: number; kind: 'clover' | 'phacelia' | 'rye_vetch' };
  /** Last day a synthetic spray went on (or the day the land was bought: the
      previous owner's sprays count). A year clean is the conversion period. */
  sprayedDay?: number;
  /** Last day bought-in manure went on. Biodynamic feeds only from its own farm. */
  boughtFeedDay?: number;
}

/** A fruit tree, bush or potted citrus. */
export interface Tree {
  id: string;
  cropId: string;
  label: string;
  /** Last synthetic spray (or the day the orchard was bought). */
  sprayedDay?: number;
  /** Years old. A young tree crops lightly and a standard in its prime heavily. */
  age: number;
  health: number;
  /** This year: blossom and fruit. */
  bloom: number;            // 0-1, how well it flowered (frost, biennial rest)
  set: number;              // 0-1 of the bloom that became fruit
  fruitKg: number;          // hanging, green or ripe
  ripeKg: number;
  pickedKg: number;
  lostKg: number;
  pickedQ: number;
  /** Heavy crop last year and not thinned: this year it rests. */
  lastCropKg: number;
  prunedYear?: number;      // winter pruning done in this year
  summerPrunedYear?: number;
  thinnedYear?: number;
  flavour: number;
  flavourDays: number;
  gdd: number;              // since the new year, base 5
  problems: ActiveProblem[];
  treated: Record<string, number>;
  cover: CropCover;
  /** Potted citrus live or die by the stove. */
  potted?: boolean;
}

export interface Hive {
  id: string;
  alive: boolean;
  /** Colony strength, 0.2 (a nucleus) to 1.4 (a big colony). */
  strength: number;
  /** Honey the bees need to live on, kg. */
  stores: number;
  /** Capped honey above the brood, kg: yours to take. */
  surplus: number;
  varroa: number;           // 0-100 mite load
  queenAge: number;         // seasons
  swarmedYear?: number;
  lastTake: number;         // day of the last harvest
  problems: ActiveProblem[];
  /** Kept in the ledger: honey taken this year. */
  takenKg: number;
  fed?: number;             // day last fed
}

export interface HenRun {
  hens: number;
  health: number;
  /** Eggs laid and not yet collected. */
  eggs: number;
  /** Mite load in the coop, 0-100. */
  mites: number;
  feedKg: number;           // layers' feed in the bin
  /** BSF larvae in the feed bin, kg: the hens' favourite and a real laying boost. */
  larvaeKg: number;
  doorShut: boolean;        // shut in for the night
  problems: ActiveProblem[];
  laidTotal: number;
  /** The rest of the feed bin, kilos as fed (pellets are `feedKg`, fly larvae `larvaeKg`). Absent on old saves. */
  bin?: Partial<Record<HenFeed, number>>;
  /** Grade of the eggs waiting in the nest box, set by what the hens ate while laying them. */
  eggQ?: number;
  /** What the hens ate yesterday, for the panel. */
  diet?: HenDiet;
}

/** What goes in the hens' bin besides bought pellets and fly larvae. */
export type HenFeed = 'grain' | 'corn' | 'pulses' | 'greens' | 'mash' | 'worms' | 'shells';
export interface HenDiet {
  /** Dry matter eaten against what the flock needs, 0-1+. */
  fed: number;
  /** Crude protein, share of dry matter. */
  protein: number;
  /** 0-1: enough calcium for a sound shell. */
  calcium: number;
  /** 0-1: carotenoids from greens and maize, the depth of the yolk's colour. */
  yolk: number;
}

export interface SaltPan {
  id: string;
  /** Depth of brine in the pan, mm. */
  brineMm: number;
  /** Salt in the brine, g per litre — seawater comes in at 35. */
  gPerL: number;
  /** Crystallised on the floor, kg. */
  crustKg: number;
  /** Floating on a still hot day, kg. The prize. */
  florKg: number;
  covered: boolean;
}

/** The worm bins and the black soldier fly bins, in the shed by the barn. */
export interface WormShed {
  wormsKg: number;
  wormFeedKg: number;       // waste waiting in the worm bins
  castingsKg: number;
  bsfLarvaeKg: number;
  bsfFeedKg: number;
  frassKg: number;
  /** Prepupae crawled out and ready: hen food, or next generation. */
  prepupaeKg: number;
  /** 0-1: how well made the worms' waiting feed is (bedding, acidity). Absent on old saves. */
  wormFeedQ?: number;
  /** Grade of the castings in the bottom tier. */
  castingsGrade?: number;
  /** Prepupae per kilo of the flies' waiting feed, which depends on what it is. */
  bsfConv?: number;
}

export interface FacilityState {
  id: FacilityId;
  boughtDay: number;
  plots: Plot[];
  trees: Tree[];
  /** Standing orders: what staff and tools do here without being asked. */
  orders: StandingOrders;
  /** Tools installed here that change how work is done. */
  kit: Record<string, boolean>;
  /** Day the rows were last walked, and so which problems were seen. */
  walkedDay?: number;
  hives?: Hive[];
  hens?: HenRun;
  pans?: SaltPan[];
  shed?: WormShed;
  /** The stove in the orangery. */
  stoveLit?: boolean;
  fuelKg?: number;
}

export interface StandingOrders {
  water?: boolean;          // water any bed that is getting dry
  pick?: boolean;           // pick whatever is ripe
  weed?: boolean;           // hoe and weed on sight
  pests?: boolean;          // deal with problems as they are seen
  protect?: boolean;        // fleece on frost nights, nets on brassicas
  feed?: boolean;           // feed from the soil store when a bed runs low
  train?: boolean;          // pinch and tie tomatoes weekly
  bees?: boolean;           // inspect, feed, stop swarms
  hens?: boolean;           // collect eggs, shut the coop at dusk
  spray?: boolean;          // spray pests and weeds instead of fixing by hand (loses the biodynamic label)
}


/** What happened on the estate yesterday, for the morning note. */
export interface EstateLogEntry {
  day: number;
  text: string;
  kind: 'good' | 'warn' | 'bad' | 'info';
  facility?: FacilityId;
}

/** A place in the wild and how it is doing. */
export type GroundId = 'home_oak' | 'beech_hanger' | 'river_poplars' | 'hedgerow' | 'chip_track' | 'coast_thorn' | 'bog' | 'pine_plantation' | 'hazel_coppice' | 'harbour';
export type WildKind = 'mushroom' | 'fruit' | 'tips' | 'nut' | 'fish' | 'shrimp';

export interface WildPatch {
  /** 0.2 (picked out) to 1.5 (thriving): taking everything costs next year. */
  vigour: number;
  /** What this year's picking has earned the patch, applied when the year turns. */
  next?: number;
  lastPicked?: number;
  /** Picked over: nothing worth taking again until this day. */
  restUntil?: number;
}

export interface FieldGuideEntry {
  found: boolean;
  /** The tells learned for telling it from its lookalike. */
  tells: string[];
  months: number[];
  isNew?: boolean;
  /** Has met its lookalike, and left it. */
  lookalike?: boolean;
  /** The best single haul, kg. */
  best?: number;
  where?: string;
}

export type PieceState = 'young' | 'prime' | 'past';
export interface WildPiece { st: PieceState; kg: number; q: number; picked: boolean }
export interface VisitEntry { label: string; kind: 'decoy' | 'clue' | 'find' | 'info' | 'lay'; text: string; species?: string; find?: number }
/** One day's outing to one ground: what has been looked at, found, examined and picked. */
export interface WildVisit {
  ground: GroundId;
  day: number;
  read: string[];
  log: VisitEntry[];
  finds: { species: string; sid: string; at: [number, number]; done: boolean }[];
  /** A find under the hand lens. `real` is decided when it is picked up, and hidden. */
  spec?: { find: number; species: string; real: boolean; done: string[] };
  verdict?: { tone: 'good' | 'bad' | 'warn' | 'plain'; stamp: string; text: string; then: 'pick' | 'none'; flag: 'ok' | 'poor' | 'ruin' | 'deadly' | 'unnamed' };
  pick?: { find: number; species: string; flag: 'ok' | 'poor' | 'ruin' | 'deadly' | 'unnamed'; real: boolean; pieces: WildPiece[]; flush: boolean };
}
export interface WildState {
  visit?: WildVisit;
  /** The day a wine-cap bed was laid on the chip-track verge. */
  bedAt?: number | null;
  bogFound?: boolean;
  /** Whether the shrub by the gate is haskap or twinberry: fixed for good the first time you look. */
  hedgeReal?: boolean;
  /** Last year the patches were settled. */
  settledYear?: number;
}

export interface EstateState {
  facilities: Partial<Record<FacilityId, FacilityState>>;
  /** Raw-produce appetite at the van, per produce class, 1 = normal. */
  vanDemand: Record<string, number>;
  log: EstateLogEntry[];
  /** Saved seed lines: crop id → generation. */
  seedLines: Record<string, number>;
  /** Kept per crop for the ledger. */
  ledger: Record<string, { kg: number; value: number; q: number; n: number }>;
  patches: Record<string, WildPatch>;
  guide: Record<string, FieldGuideEntry>;
  wild?: WildState;
  /** Last absolute day the estate was advanced, so a day is never run twice. */
  lastDay: number;
  /** The part-kilo of an item not yet a whole unit in the pantry, by item id:
      produce, waste and soil products all live in `inventory` in whole units. */
  carry?: Record<string, number>;
  /** The run of wet and dry days, ending yesterday. */
  wetStreak?: number;
  dryStreak?: number;
}

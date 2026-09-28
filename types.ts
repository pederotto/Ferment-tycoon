import type { EstateState } from './types.farm';

export enum IngredientType {
  SUBSTRATE = 'SUBSTRATE',
  STARTER = 'STARTER',
  ADDITIVE = 'ADDITIVE',
  TOOL = 'TOOL' // New Type for purchasable hardware
}

export interface Supplier {
  id: string;
  name: string;
  description: string;
  color: string; 
}

/**
 * Substrate composition, on a 0-10 scale that tracks real proportions of dry
 * matter. Rough anchors: polished rice is ~7% protein / ~78% starch, pearl
 * barley ~10/73, soybeans ~36% protein with almost no starch, oily fish ~19%
 * protein / 0 starch / ~14% fat.
 *
 * The split between `starchContent` and `sugarContent` is what makes koji
 * enzymes mean anything: amylase converts STARCH into sugar, it does not
 * conjure sugar out of a fish.
 */
export interface HiddenStats {
  sugarContent: number;        // free/simple sugars already present
  starchContent: number;       // polysaccharide that amylase can convert
  nativeSalinity: number; 
  microbialDiversity: number; 
  fatContent: number; 
  proteinContent: number;      // what protease converts into glutamate/umami
  /**
   * Free glutamate and nucleotides ALREADY in the thing, needing no enzyme.
   * A ripe tomato, a cep and a dried scallop are savoury raw; that is a
   * different quantity from protein a protease has to cut up first, and
   * reading only `proteinContent` capped every mushroom ferment far under.
   */
  innateUmami?: number;
  /**
   * How sour the raw thing is, before anything ferments. A citrus, a green
   * plum and a sea buckthorn arrive acidic — a wine's sharpness is the fruit's,
   * not the yeast's — and with no term for it a ponzu could reach acidity 0.
   */
  innateAcidity?: number;
}

/**
 * What a koji is actually FOR.
 *
 * Aspergillus secretes two families that matter here: amylases, which cut
 * starch into fermentable sugar, and proteases, which cut protein into free
 * amino acids — glutamate above all, which is umami. A sake koji is bred for
 * amylase; a shoyu or miso koji is bred for protease. The same spore grown
 * differently lands somewhere else again, which is the decision this models.
 */
export interface EnzymeProfile {
  amylase: number;   // starch -> sugar
  protease: number;  // protein -> free amino acids (umami)
  lipase?: number;   // triglycerides -> free fatty acids (pungency, aged funk)
}

export interface Ingredient {
  id: string;
  name: string;
  type: IngredientType;
  baseCost: number;
  currency: 'money' | 'renown';
  quality: number;
  description: string;
  idealFor: string[];
  supplierId: string;
  tierRequired: number;
  tags?: string[]; // 'SEAFOOD', 'HIGH_RISK', etc.

  /**
   * WHICH MONTHS THIS IS ON THE SHELF, 0-11, matching GameState.month.
   *
   * Absent means always, so every commodity keeps behaving as it did — a sack of
   * barley is a sack of barley in March. Foraged goods are the exception: what
   * the forager has depends on what is fruiting, which turns buying into
   * planning. Read through `inSeason` in constants.forage.ts, never directly, so
   * the "absent means always" rule lives in exactly one place.
   */
  season?: number[];

  // --- UNDERGROUND ---
  contraband?: boolean;        // sold by the fence; a batch built with one is contraband
  heatPerUnit?: number;        // inspector heat added per unit bought
  legitCounterpartId?: string; // grey-market copy: resolves as this legal ingredient
  undergroundTier?: number;    // min tier (from bench xp) the fence will sell this at
  hiddenStats: HiddenStats;
  variantGroup?: string; 
  
  // Physics Properties
  mass: number; // in grams
  unitDisplay: string; // 'kg', 'g', 'L', 'ml'
  
  isLiving?: boolean;
  generation?: number; 

  // --- KOJI ---
  // On a spore: which way the strain is bred, 0 = pure protease, 1 = pure amylase.
  strainBias?: number;
  // On a finished koji: the enzyme activity it actually carries into the next batch.
  enzymes?: EnzymeProfile;
  // Black koji (A. luchuensis) throws citric acid, which protects a warm ferment.
  acidProtection?: number;
  // The heritable profile of a propagated culture. Read by the simulation, and
  // by advanceEnzymes via strainBias — this is what makes generation N of your
  // own strain behave differently from generation N of anyone else's.
  lineage?: Lineage;
}

/**
 * CHAMBER CONTROLS
 *
 * Every appliance the player can hold at a setting while a batch runs. These are
 * levels, not toggles, and the physics reads them each tick:
 *
 *   vent   airflow. Sheds heat AND moisture — one lever, two consequences.
 *   mist   added water. Cools by evaporation, but only as fast as the vent can
 *          carry the vapour away, and wets the substrate itself as it goes.
 *   heat   an incubator setpoint in degrees C, rather than the machine silently
 *          holding whatever the recipe wanted.
 */
export interface ChamberControls {
  vent: 0 | 1 | 2 | 3;   // sealed · cracked · open · forced (needs a fan)
  mist: 0 | 1 | 2;       // off · periodic · continuous (needs a humidifier)
  heat: number | null;   // setpoint in C, null = heating off
}

/**
 * A CULTURE'S LINEAGE
 *
 * Carried on the spore, not recomputed from a generation counter. Vigour and
 * resilience accumulate as you propagate; `bias` is the interesting one — it
 * drifts toward whatever conditions you actually cultivated the parent bed in,
 * so a house strain becomes yours over generations rather than just becoming a
 * bigger number.
 */
export interface Lineage {
  generation: number;
  vigor: number;       // growth speed multiplier, 1.0 = founder stock
  resilience: number;  // stress tolerance and effective hygiene buffer
  bias: number;        // 0 = pure protease, 1 = pure amylase
  /**
   * STRENGTH OF THE CULTURE, 1.0 = the stock you can buy.
   *
   * How well the parent bed was actually run — clean, unstressed, properly
   * developed — decides how strong its children are. Without it every
   * sporulation was a free upgrade: vigour and resilience climbed a fixed step
   * per generation whatever you did, so ten careless runs bought +45% speed and
   * +45 effective hygiene at no risk, and generation alone set the price.
   *
   * Potency is what makes a lineage something you can improve OR ruin, and it
   * is what a strain is actually worth.
   */
  potency?: number;    // ~0.45 (sickly) to ~1.4 (exceptional)
}

export enum FermentType {
  LACTO = 'Lacto-Fermentation',
  KOJI = 'Koji Cultivation',
  MISO = 'Miso/Paste',
  SHOYU = 'Shoyu/Sauce',
  GARUM = 'Garum',
  VINEGAR = 'Vinegar',
  BLACK = 'Blackening',
  FAIL = 'Bio-Hazard',
  ALCOHOL = 'Alcoholic Brew',
  KOMBUCHA = 'Kombucha',
  /** The soil lab: compost, bokashi, the KNF preparations, EM and compost tea. Its own physics (services/soil.ts). */
  SOIL = 'Soil Culture'
}

export interface Vessel {
  id: string;
  name: string;
  slotsRequired: number;
  powerDraw: number;
  cost: number;
  description: string;
  idealFor: FermentType[];
  insulationFactor: number; // 0.1 (Tray) to 0.9 (Incubator/Onggi)
  /**
   * Whether this vessel can be held at a setpoint at all, and how far it will
   * go. The Thermal Chamber runs to 70 C, which is what makes the modern
   * low-salt garum route (heat instead of salt) reachable. A koji muro is a
   * warm cedar cupboard: it holds body heat and nothing more, so it cannot buy
   * you out of salting a garum and is not a cheap substitute for the chamber.
   */
  heatedTo?: number; // max setpoint in C; absent = unheated
  capacityL: number; // Volume capacity in Liters
  /** Part of a room rather than something you buy: never offered in a shop or the vessel picker. */
  builtIn?: boolean;
}

/** Where a batch's mass has gone since it was charged, in grams. */
export interface MassLoss {
  waterG: number;
  gasG: number;
  pressedG: number;
  leesG: number;
  /** Components a press or centrifuge took off (waterG, saltG, aminoG, sugarG, acidG, ethanolG, proteinG, starchG, fibreG, fatG). */
  removed?: Record<string, number>;
}

export interface FlavorProfile {
  umami: number;
  acidity: number;
  funk: number;
  sweetness: number;
  safety: number;
}

export interface Recipe {
  id: string;
  name: string;
  type: FermentType;
  description: string;
  requiredIngredients: {
    substrate: boolean; 
    starter: string | null; 
    additive: string | null; 
  };
  outputIngredientId?: string; 
  requiredVesselId?: string;
  
  // Simulation Params
  baseDurationSeconds: number;
  peakWindowStart: number; 
  peakWindowEnd: number; 
  activeIntervention?: string; 
  
  idealParams: {
    temp: number;
    humidity: number;
    salinity: number;
  };

  idealFlavorProfile: FlavorProfile;

  /**
   * What this should come out at, % alcohol by mass. Only the ferments that are
   * SUPPOSED to make alcohol declare one, and only those are scored on it —
   * alcohol is a spec, not a flavour axis, so it does not belong in the profile
   * that all 71 recipes carry. A sake at 4% is not a sake, and nothing in
   * umami/acidity/funk/sweetness could ever say so.
   */
  targetAbv?: number;
  difficulty: number; 
}

export interface Batch {
  id: string;
  /** The fermenter's level when it was sealed: whose hand made it (services/skills.ts). */
  craftLevel?: number;
  recipeId: string;
  cachedRecipe?: Recipe;
  substrateId: string;
  starterId: string | null;
  inputIngredientIds: string[]; 
  
  // Physics State
  ingredientQuantities?: Record<string, number>; // Map of IngredientID -> Grams used
  totalMass: number; // grams
  yieldVolume: number; // relative multiplier for value calc
  /** Mass gone from the charge: evaporated water, fermentation gas, pressed liquid, spun lees (services/massBalance.ts). */
  massLoss?: MassLoss;
  
  vesselId: string;
  startTime: number;
  lastTick: number;
  
  progress: number; 
  status: 'active' | 'ready' | 'spoiled' | 'analyzed';
  
  params: {
    temp: number;
    humidity: number;
    salinity: number;
  };
  
  quality: FlavorProfile;
  messages: string[];

  generation: number;
  // The strain profile this batch is running on, copied off the starter at
  // inoculation. Absent on saves made before lineage was heritable — the sim
  // falls back to deriving it from `generation`.
  lineage?: Lineage;
  lineageDamaged: boolean;
  evaluationScore?: number;
  
  // New Physics Mechanics (Stress & Inertia)
  stress: number; // 0-100 Health Bar
  disturbanceTimer: number; // Ticks where growth is paused due to intervention
  flags: {
      // Derived from controls.vent every tick, kept because several older call
      // sites still ask the simple question "is it open".
      isLidPropped: boolean;
  };

  // --- LIVE CHAMBER CONTROLS ---
  // Appliances are held at a setting for the whole run rather than poked once.
  // The tick reads these every step, so changing one mid-ferment changes the
  // curve from that moment on.
  controls?: ChamberControls;

  /**
   * HOW EVENLY THE BATCH IS FERMENTING, 100 = uniform.
   *
   * A 2 L jar ferments as one thing. A 60 L cask does not: the core runs warmer
   * than the edge, salt settles, the surface dries while the bottom stays wet,
   * and what comes out is an average of several different ferments. That is the
   * real reason scaling up is hard — not cost — and it is why a miso mash gets
   * turned and a soy mash gets stirred.
   *
   * Falls faster with volume and with how solid the batch is, and is restored by
   * the interventions that physically move it about.
   */
  evenness?: number;

  /**
   * WHAT HAS GROWN ON THE SURFACE, 0 = clear.
   *
   * Anything wet and open grows a skin. On a brine or a garum that is kahm
   * yeast and mould — you take it off, and if you leave it it pushes the whole
   * vessel off. On a vinegar or a kombucha the same film is the mother, and
   * taking it off is the mistake. Same physics, opposite meaning, which is why
   * it is one quantity and not two.
   *
   * It exists because Skim had nothing to act on. It read the safety number and
   * pushed it up a little, so it was a weaker Clean with a different label; and
   * once stratification was correctly narrowed to koji and shoyu, Stir lost its
   * scale on liquids too. Both now act on something that is actually there.
   */
  surfaceFilm?: number; // 0-100

  /**
   * OXIDISED FAT, 0 = none. Irreversible.
   *
   * Rancidity was a 1% dice roll above 35 C that bumped a risk factor and was
   * never seen again. It is the characteristic way a fatty ferment fails, and
   * it happens at the air interface: fat rises, sits on top, and oxidises
   * there — which is precisely where the film is. So a fatty batch skins over
   * faster, and a skin left on a fatty batch turns it.
   *
   * Skimming takes the oxidised layer off with the film, which is the whole
   * reason you skim a garum rather than just leaving it shut. What has already
   * gone into the body does not come back.
   */
  rancidity?: number; // 0-100

  // Free water sitting ON the substrate, as opposed to vapour in the air around
  // it. Misting raises it, airflow drives it off. Chamber humidity and substrate
  // wetness are not the same quantity and conflating them is the classic error:
  // a wet bed grows bacteria while the air above it reads perfectly.
  surfaceWater?: number; // 0-100
  
  // A thinned record of the run so far, for the telemetry graph and the
  // post-mortem. Capped in processBatchTick.
  history?: TelemetrySample[];

  // Live enzyme development, only meaningful while this is a koji cultivation.
  // The temperature and moisture you hold decide the ratio, so the profile is
  // steered over the whole run rather than fixed at inoculation.
  enzymes?: EnzymeProfile;

  // Built with at least one contraband reagent. Stored on the batch so the
  // fences and the heat tick never have to re-derive it from the ingredient list.
  contraband?: boolean;

  // Moved to the cellar to age. Cellared batches free their bench slot, tick
  // slowly, and are protected from the hazards of an open bench.
  cellared?: boolean;

  /** On a shelf in the koji room: off the bench, held warm, tended by the keeper if there is one. */
  kojiRoom?: boolean;
  /** The keeper is letting this bed run on to spore rather than taking it at its peak. */
  kojiReserve?: boolean;

  // Post-Processing State
  isPressed?: boolean;
  isFiltered?: boolean;

  /**
   * Stopped at its peak by the technician's standing order: bottled, and no
   * longer developing, so a batch left while you are out on the estate cannot
   * go over. It waits on the bench to be sold like any finished batch.
   */
  held?: boolean;

  /** A soil-lab batch's own state: heat, air and how well it has been run (services/soil.ts). */
  soil?: SoilState;
}

export interface SoilState {
  /** Running judgement of how right the conditions have been, 0-1. */
  rightness: number;
  samples: number;
  /** Hottest it has been, °C — a hot compost must pass 55. */
  peakTemp: number;
  /** Ticks spent at or above 55 °C. Three days kills the weed seed. */
  hotTicks: number;
  /** Oxygen in the mass, 0-100. A heap uses it up; turning puts it back. */
  oxygen: number;
  turns: number;
  /** Past its best and on the way to something else (wine, rot, anaerobic slime). */
  turned?: boolean;
}

export interface LogEntry {
    id: string;
    recipeName: string;
    substrateName: string;
    date: number;
    rating: number;
    value: number;
    notes: string;
    config?: {
        recipeId: string;
        substrateId: string;
        starterId: string | null;
        inputIngredientIds: string[];
        vesselId: string;
        params: { temp: number, humidity: number, salinity: number };
    };

    /**
     * THE FULL RUN RECORD
     *
     * The archive used to keep a name, a substrate and a price, which is enough
     * to remember that a batch happened and nothing about why it went the way it
     * did. This is everything the post-mortem knows, kept so a run can be read
     * back months later — and so the harvest report and the logbook can be the
     * same component looking at the same data.
     *
     * Optional because it postdates a lot of saved entries.
     */
    record?: {
        score: number;
        vesselName: string;
        massG: number;
        buyer: string;
        renown: number;
        peakPulledAt: number;       // progress % at harvest
        peakWindow: [number, number];
        held: { temp: number; humidity: number; salinity: number };
        target: { temp: number; humidity: number; salinity: number };
        peakTemp?: number;
        offTargetPct?: number;      // share of the run outside the band
        evenness?: number;          // how uniformly it fermented, 100 = one mass
        enzymes?: EnzymeProfile;
        faults: string[];           // human-readable, already labelled
        controls?: ChamberControls;
        lineage?: Lineage;
        spoiled: boolean;
    };
}

// --- RECIPE BOOKS ---
// Recipes used to be learnable only by brute-forcing 35 ingredients against 6
// vessels. A book is the deliberate path: it names the combination outright.
export interface Book {
  id: string;
  title: string;
  author: string;
  blurb: string;
  teaches: string[];            // Recipe ids written into unlockedRecipes on purchase
  revealsProcedural?: boolean;  // the Primer alone unfogs the generated recipes
  price: number;
  xpRequired: number;           // gated on lifetime bench xp, not on cash alone
  gatedBy?: { supplierId: string; level: number };
  heatOnPurchase?: number;
  shelf: 'bindery' | 'underground';
}

// unknown -> known (you have the formula) -> analyzed (you have actually run it)
export type RecipeKnowledge = 'unknown' | 'known' | 'analyzed';
// How a formula came to be known.
export type LearnedVia = 'book' | 'discovery' | 'unknown';

// --- RECIPE MATRIX ---
// The combination that produces each named recipe. Recipe.requiredIngredients is
// too vague to read from — it says {substrate: true, additive: 'salt'} for
// Colatura and never names anchovies — so this table is the single place the real
// combination lives. The resolver iterates it and the recipe books print from it,
// which is what stops the two from drifting apart.
export type MatrixSubstrate =
  | { kind: 'is'; id: string }          // sub.id === id
  | { kind: 'oneOf'; ids: string[]; label?: string } // sub.id is one of these; `label` names the family on a recipe card
  | { kind: 'includes'; token: string } // sub.id contains token
  | { kind: 'none' }                    // no substrate present
  | { kind: 'kojiBase' }                // koji IS the substrate, nothing else is
  | { kind: 'present' }                 // any substrate, identity irrelevant
  | { kind: 'any' };                    // substrate not consulted

export interface MatrixEntry {
  recipeId: string;
  substrate: MatrixSubstrate;
  requires: string[];
  forbids?: string[];
  // null = vessel not consulted. A list is one PROCESS that more than one vessel
  // does: a koji bed grows on a cold tray or in a warm muro alike.
  vesselId: string | string[] | null;
}

// --- RECIPE MASTERY ---
// One track per recipe. Levels are persisted rather than recomputed so a
// level-up is detectable at the moment it happens.
/**
 * One sample of a running batch. The sim evolves temperature, moisture, stress
 * and enzymes continuously but only ever showed the current instant, so cause
 * and effect were invisible — you could not see that the spike which killed a
 * batch happened forty seconds ago. Samples are thinned as they are taken, so a
 * long run costs no more to keep than a short one.
 */
export interface TelemetrySample {
    p: number;    // progress % at the sample
    temp: number;
    hum: number;
    stress: number;
    amy?: number; // enzymes, koji runs only
    pro?: number;
}

/** One finished run, kept so the bench can tell you what you keep getting wrong. */
export interface BatchOutcome {
    score: number;
    pulledAt: number;   // progress % when it was taken
    faults: string[];   // diagnosis tags, see services/mastery.ts
}

export interface RecipeMastery {
    xp: number;         // cumulative, never decreases
    level: number;      // 1..MASTERY_MAX_LEVEL
    cooks: number;      // completed batches on this track
    bestScore: number;  // highest critic score reached; gates the top rung
    avgScore: number;   // running mean across every run
    recent: BatchOutcome[];  // last few runs, newest first
}

// --- BUYER SYSTEM ---
export type BuyerType = 'Restaurant' | 'Supermarket' | 'Private' | 'Industry' | 'Underground';

export interface Buyer {
    id: string;
    name: string;
    type: BuyerType;
    description: string;
    minReputation: number;
    
    desiredTypes: FermentType[];
    minScore: number;
    paysIn: 'money' | 'renown';
    priceMultiplier: number; 
    
    // --- UNDERGROUND FENCES ---
    undergroundTier?: number;     // min bench tier before this fence exists
    pricesContraband?: boolean;   // values funk/rot/potency instead of the critic score
    requiresContraband?: boolean; // refuses clean-sourced batches
    requiresIntact?: boolean;     // refuses spoiled stock
    maxSafety?: number;           // refuses anything SAFER than this
    heatPerSale?: number;

    dialogue: {
        intro: string;
        success: string;
        reject: string;
    }

    /** How this vendor enters the game. Defaults to the reputation gate. */
    unlock?: VendorUnlock;

    /** Lines keyed by standing tier, so a vendor who knows you talks differently. */
    warmth?: {
        cool?: string;
        known?: string;
        trusted?: string;
    };

    /** Roughly how much they can absorb per contract. Shapes the offers made. */
    appetite?: number;
}

/* =============================================================================
   VENDOR RELATIONSHIPS AND CONTRACTS

   Buyers were a price multiplier and a line of dialogue: you sold to whoever
   paid most that week and nothing accumulated. Two things change that.

   STANDING is what a buyer thinks of you, built by selling them good stock and
   eroded by neglect and by failed promises. It buys a better price, and it is
   what makes a vendor offer you work.

   CONTRACTS are that work. A vendor commits to taking a quantity of something
   at an agreed price by an agreed week; you commit to producing it. This is the
   piece the economy was missing — spot sales are lumpy and saturate the market,
   while a contract is guaranteed absorption at a fixed price. It is also the
   natural home for story: a contract is a person asking you for something.
   ============================================================================= */

/** 0-100. What one buyer thinks of you. */
export type VendorStanding = number;

export interface StandingTier {
  min: number;
  label: string;
  priceBonus: number;    // added to the buyer's own multiplier
  blurb: string;
}

export interface Contract {
  id: string;
  buyerId: string;
  buyerName: string;

  /** What they want. A named recipe is a harder, better-paid ask than a family. */
  fermentType?: FermentType;
  recipeId?: string;
  minScore: number;
  unitsRequired: number;
  unitsDelivered: number;

  /** Agreed price per unit. Fixed at signing — the market cannot touch it. */
  pricePerUnit: number;

  offeredWeek: number;
  dueWeek: number;
  status: 'offered' | 'active' | 'complete' | 'failed' | 'declined';

  /** Consequences, both ways. */
  standingReward: number;
  standingPenalty: number;
  cashPenalty: number;

  /** What the vendor said when they offered it. */
  pitch: string;
}

/** How a buyer becomes available at all. */
export type VendorUnlock =
  | { kind: 'open' }
  | { kind: 'reputation'; value: number; label?: string }
  | { kind: 'renown'; value: number; label?: string }
  | { kind: 'ingredient'; ingredientId: string; label: string }
  | { kind: 'mastery'; recipeId: string; level: number; label: string }
  | { kind: 'recipeCount'; count: number; minScore: number; label: string }
  | { kind: 'introduction'; byBuyerId: string; standing: number; label: string };

/* =============================================================================
   THE CREW

   Staff were four booleans. You paid a flat wage for a flat multiplier, nobody
   had a name, and the only decision was whether you could afford it — which is
   not a decision, it is arithmetic.

   Hires are people now. Each has a name, a role, a wage they came with, a skill
   that grows while they work, and a trait that makes them good at one thing and
   awkward at another. They are drawn from a rotating pool, so who is available
   this month is part of the situation rather than a fixed menu.

   This is the other side of the volume problem. A large vessel stratifies and
   needs turning; a good technician is how you buy that labour back. It is also
   where the game has people in it at all, which is what a story would need.
   ============================================================================= */

export type StaffRoleType = 'cleaner' | 'tech' | 'chef' | 'rd' | 'toji'
  // The estate's hands. Each works one kind of place and carries out its standing orders.
  | 'gardener' | 'orchardist' | 'beekeeper' | 'poultry' | 'soil_tech' | 'forager';

export interface CrewTrait {
  id: string;
  label: string;
  /** What they are good at, in their own words. */
  blurb: string;
  /** Multipliers applied on top of the role. 1 = no change. */
  effects: {
    upkeep?: number;      // how much they slow stratification
    hygiene?: number;     // contamination resistance
    wage?: number;        // what they cost relative to the role's base
    quality?: number;     // effect on sale value
  };
}

export interface CrewMember {
  id: string;
  name: string;
  role: StaffRoleType;
  traitId: string;
  /** Level 1-15 (services/skills.ts). Rises with the work they do, not the weeks. */
  skill: number;
  /** Experience earned by doing the work; sets `skill` through CREW_LEVELS. */
  xp?: number;
  /** Accumulated weeks of service, which is what raises skill. */
  weeksWorked: number;
  weeklyWage: number;
  hiringCost: number;
  /** Week they were taken on, for the crew list. */
  hiredWeek: number;
  /** One line of theirs, shown on the roster. */
  line: string;
}

export interface StaffRole {
    id: StaffRoleType;
    name: string;
    description: string;
    hiringCost: number;
    weeklyWage: number;
    icon: string; // lucide icon name reference
    effectDescription: string;
}

// --- WEATHER SYSTEM ---
export type WeatherType = 'Sunny' | 'Rainy' | 'Stormy' | 'Snowy' | 'Heatwave' | 'Cloudy' | 'Foggy';

export interface WeatherState {
    type: WeatherType;
    tempModifier: number;
    humidityModifier: number;
    description: string;
}

export interface GameState {
  money: number;
  reputation: number; 
  renown: number; 
  xp: number;
  day: number; // 1-7
  week: number;
  month: number; // 0-11, representing Jan-Dec
  year: number;
  
  // Resources
  hygiene: number; 
  heat: number; 
  power: number;
  maxPower: number;

  inventory: Record<string, number>;
  batches: Batch[];
  logbook: LogEntry[];
  
  // Discovery System.
  // unlockedRecipes = you know the formula (bought in a book, or learned by
  // cooking it). analyzedRecipeIds = you have actually produced it at least once.
  // Cooking writes BOTH, so analyzedRecipeIds is always a subset and no read site
  // has to check twice.
  unlockedRecipes: string[];
  analyzedRecipeIds: string[];
  ownedBookIds: string[];
  // Recipe ids you worked out at the bench rather than read in a book. Kept
  // separately because "I found this" and "I bought this" are different
  // achievements and the Codex should not flatten them together.
  discoveredRecipeIds: string[];

  equipmentSlots: number;
  // How many of each vessel you own. This was a string[] with an includes()
  // guard, so a second Glass Jar was impossible — eight bench slots but only six
  // vessels, one apiece. A working bench has a shelf of jars.
  ownedVessels: Record<string, number>;
  
  supplierRelationships: Record<string, { level: number, xp: number }>;
  customIngredients: Ingredient[];
  
  // Staff
  staff: Record<StaffRoleType, boolean>;
  /** Named hires. The boolean roles above remain as the derived summary. */
  crew: CrewMember[];
  /** Who is available to hire right now. Rotates. */
  crewPool: CrewMember[];

  /** What each buyer thinks of you, keyed by buyer id. Absent = never dealt with. */
  vendorStanding: Record<string, VendorStanding>;
  /** Offered, active and settled contracts. Settled ones are kept as history. */
  contracts: Contract[];
  /** Buyers unlocked by something other than a standing stat check. */
  unlockedVendorIds: string[];

  // Weather
  weather: WeatherState;

  // Market appetite per ferment type (1 = normal). Every sale depresses the
  // type you sold; appetite recovers weekly. Stops one recipe paying forever.
  marketDemand: Record<string, number>;

  // Per-recipe mastery. Buys progressively more precise advice, never a bonus.
  recipeMastery: Record<string, RecipeMastery>;

  // The player's own hands, 1-15 (services/skills.ts). The forager's lives in
  // estate.wild.xp; these two are the gardener's and the fermenter's.
  craft: { gardener?: number; fermenter?: number };

  // Raids conceded. Escalates later fines and stops heat decaying on its own.
  undergroundBusts: number;

  // The guided opening has been finished or waved away.
  onboardingDone: boolean;

  /** The koji room has been built. A later stage: needs a Head of R&D. */
  kojiRoomOwned: boolean;
  /** Kilograms of koji the keeper keeps in the pantry. */
  kojiTargetKg: number;

  // Consecutive weeks ended in the red. Three closes the lab.
  insolvencyStrikes: number;
  gameOver: boolean;

  /**
   * THE WORLD CLOCK: minutes since midnight of the current day.
   *
   * One clock for the bench and the land. In the lab it runs live — a tick of
   * the bench is three hours — and out in the field it moves by what the player
   * does: twenty minutes to hoe a bed is twenty minutes the bench ferments
   * without you. See services/climate.ts and advanceWorld in App.tsx.
   */
  minute: number;

  /** The farm, the wild and the soil lab's store. See types.farm.ts. */
  estate: EstateState;

  /**
   * Standing orders on a batch, carried out by the technician while you are
   * elsewhere. Keyed by batch id.
   */
  labOrders: Record<string, LabOrders>;

  /** Errands done for each townsperson, by id (constants.town.ts). Absent = none. */
  town: Record<string, number>;
}

/** What the technician does with a batch without being asked. */
export interface LabOrders {
  /** Bottle it at the height of its peak window, so it waits for you instead of going over. */
  bottleAtPeak?: boolean;
  /** Carry it down to the cellar the moment it is ready, if it is the kind that ages. */
  cellarWhenReady?: boolean;
  /** Skim the surface film when it gets thick — never on a vinegar or a kombucha. */
  skim?: boolean;
  /** Turn it when it stratifies. */
  turn?: boolean;
}


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
  amylase: number;   // 0-100 activity units
  protease: number;  // 0-100 activity units
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
  lineageBuffs?: {
    speedMultiplier: number; 
    resilience: number; 
  };
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
  KOMBUCHA = 'Kombucha'
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
  capacityL: number; // Volume capacity in Liters
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
  difficulty: number; 
}

export interface Batch {
  id: string;
  recipeId: string;
  cachedRecipe?: Recipe;
  substrateId: string;
  starterId: string | null;
  inputIngredientIds: string[]; 
  
  // Physics State
  ingredientQuantities?: Record<string, number>; // Map of IngredientID -> Grams used
  totalMass: number; // grams
  yieldVolume: number; // relative multiplier for value calc
  
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
  lineageDamaged: boolean;
  evaluationScore?: number;
  
  // New Physics Mechanics (Stress & Inertia)
  stress: number; // 0-100 Health Bar
  disturbanceTimer: number; // Ticks where growth is paused due to intervention
  flags: {
      isLidPropped: boolean;
  };
  
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

  // Post-Processing State
  isPressed?: boolean;
  isFiltered?: boolean;
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

// --- RECIPE MATRIX ---
// The combination that produces each named recipe. Recipe.requiredIngredients is
// too vague to read from — it says {substrate: true, additive: 'salt'} for
// Colatura and never names anchovies — so this table is the single place the real
// combination lives. The resolver iterates it and the recipe books print from it,
// which is what stops the two from drifting apart.
export type MatrixSubstrate =
  | { kind: 'is'; id: string }          // sub.id === id
  | { kind: 'oneOf'; ids: string[] }    // sub.id is one of these
  | { kind: 'includes'; token: string } // sub.id contains token
  | { kind: 'none' }                    // no substrate present
  | { kind: 'present' }                 // any substrate, identity irrelevant
  | { kind: 'any' };                    // substrate not consulted

export interface MatrixEntry {
  recipeId: string;
  substrate: MatrixSubstrate;
  requires: string[];
  forbids?: string[];
  vesselId: string | null;   // null = vessel not consulted
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
}

// --- STAFF SYSTEM ---
export type StaffRoleType = 'cleaner' | 'tech' | 'chef' | 'rd';

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

  equipmentSlots: number;
  ownedVesselIds: string[]; // NEW: Track owned vessels
  
  supplierRelationships: Record<string, { level: number, xp: number }>;
  customIngredients: Ingredient[];
  
  // Staff
  staff: Record<StaffRoleType, boolean>;

  // Weather
  weather: WeatherState;

  // Market appetite per ferment type (1 = normal). Every sale depresses the
  // type you sold; appetite recovers weekly. Stops one recipe paying forever.
  marketDemand: Record<string, number>;

  // Per-recipe mastery. Buys progressively more precise advice, never a bonus.
  recipeMastery: Record<string, RecipeMastery>;

  // Raids conceded. Escalates later fines and stops heat decaying on its own.
  undergroundBusts: number;

  // The guided opening has been finished or waved away.
  onboardingDone: boolean;

  // Consecutive weeks ended in the red. Three closes the lab.
  insolvencyStrikes: number;
  gameOver: boolean;
}

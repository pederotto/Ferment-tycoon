import { Batch, FermentType, FlavorProfile, Ingredient, IngredientType, MassLoss, Recipe } from '../types';

/**
 * WHAT A BATCH IS MADE OF, AND WHERE IT GOES.
 *
 * A batch's yield was fixed the moment it was sealed: nothing evaporated, no gas
 * left a wine, a koji bed lost nothing to its own breathing, a salumi hung for
 * weeks weighed what it weighed raw, pressing a dry mash added a quarter again
 * out of nothing, and every press gave the same "amino sauce" whatever was in it.
 *
 * So a batch carries its COMPOSITION, derived from what went in and what has
 * happened to it:
 *
 *   liquid phase — water, dissolved salt, amino acids (protein a protease has
 *                  cut), free sugars, acids, alcohol
 *   solids       — intact protein, unconverted starch, fibre and cell wall, fat,
 *                  and salt beyond what the water can hold (~36 g per 100 g)
 *
 * Progress and enzymes move mass from solids to solution (proteolysis,
 * amylolysis); the family's fermentation turns sugar into alcohol and CO2, or
 * into acid; evaporation takes water (and alcohol faster than water). Nothing
 * here is a recovery table: a press takes the liquid phase minus what the solids
 * hold back, and fibre holds several times its weight where fat holds almost
 * none, so what runs off — and what it tastes of — comes out of the batch
 * itself. A long-hydrolysed moromi gives more sauce, and richer, than a young
 * one; a fibrous fruit mash gives less than a clear brew.
 *
 * Pure: no game state, no randomness, safe inside a StrictMode updater.
 */

export const emptyLoss = (): MassLoss => ({ waterG: 0, gasG: 0, pressedG: 0, leesG: 0, removed: {} });

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* =========================================================================
   THE CHARGE
   ========================================================================= */

/**
 * Families whose grain or pulse goes in steamed or cooked. A koji bed, a tempeh
 * or a natto charges grain and NO water — the steaming is implied, so that grain
 * carries its cooking water. A moromi charges water on the hydration dial, and
 * counting the beans as cooked as well would give that mash its water twice, so
 * `chargeOf` only passes the recipe type through when nothing charged water.
 */
const COOKED_BASE = new Set<FermentType>([FermentType.KOJI, FermentType.MISO, FermentType.SHOYU]);

/**
 * Share of an ingredient's mass that is water. The data has no moisture field,
 * so this reads the id, tags and stats; the harness in sim/ prints it for the
 * whole list so a wrong guess is visible rather than silent.
 */
export const moistureOf = (i: Ingredient, recipeType?: FermentType): number => {
  const id = i.id;
  const tags = i.tags ?? [];
  const h = i.hiddenStats;
  if (id === 'water') return 1;
  if (/salt/.test(id)) return 0;
  if (i.type === IngredientType.TOOL) return 0;
  if (i.type === IngredientType.STARTER) {
    if (id === 'scoby') return 0.9;
    if (id === 'lacto_starter') return 0.8;
    if (id === 'fly_larvae') return 0.7;
    if (id === 'nuruk') return 0.12;
    return 0.05;
  }
  if (id === 'sugar') return 0;
  if (id === 'honey') return 0.18;
  if (/^tears$|amino|yu_jang|shiokara|brine_|garum_|sake_|wine_|vinegar_|kombucha_/.test(id)) return 0.75;
  if (/koji/.test(id)) return 0.3;
  if (/cream/.test(id)) return 0.6;
  if (/milk/.test(id)) return 0.87;
  if (/yolk/.test(id)) return 0.5;
  if (/coconut_sap|black_tea/.test(id)) return 0.95;
  if (id === 'niboshi') return 0.15;
  if (/smoked_eel|anchovy_fillets/.test(id)) return 0.55;
  if (tags.includes('SEAFOOD')) return 0.72;
  if (/pork|beef|lamb|duck/.test(id)) return 0.6;
  if (/rice_bran/.test(id)) return 0.1;
  if (/hazelnut/.test(id)) return 0.05;
  if (id === 'pine_needles') return 0.55;
  if (id === 'rose_petals') return 0.8;
  if (/garlic/.test(id)) return 0.62;
  if (id === 'chili') return 0.8;
  if (tags.includes('FUNGI') || /ceps/.test(id)) return 0.9;
  if (isProduce(i)) return 0.87;
  const dryGrainOrPulse = h.starchContent >= 5 || (h.proteinContent >= 7 && h.sugarContent <= 5) || id === 'wheat';
  if (dryGrainOrPulse) return recipeType && COOKED_BASE.has(recipeType) ? 0.45 : 0.12;
  return 0.6;
};

const isProduce = (i: Ingredient) => {
  const tags = i.tags ?? [];
  return tags.includes('PRODUCE') || tags.includes('FRUIT') || tags.includes('FUNGI')
    || /cabbage|plums|apples|pineapple|ceps|garlic|chili|rose_petals|pine_needles/.test(i.id);
};
const isAnimal = (i: Ingredient) =>
  (i.tags ?? []).includes('SEAFOOD') || /pork|beef|lamb|duck|yolk|milk|cream|larvae/.test(i.id);

export interface Composition {
  massG: number;
  // liquid phase
  waterG: number; saltG: number; aminoG: number; sugarG: number; acidG: number; ethanolG: number;
  // solids
  proteinG: number; starchG: number; fibreG: number; fatG: number;
  /** Salt the water cannot hold, sitting in the solids. Part of saltG. */
  undissolvedSaltG: number;
  gasG: number;
}

type Part = 'waterG' | 'saltG' | 'aminoG' | 'sugarG' | 'acidG' | 'ethanolG' | 'proteinG' | 'starchG' | 'fibreG' | 'fatG';
const PARTS: Part[] = ['waterG', 'saltG', 'aminoG', 'sugarG', 'acidG', 'ethanolG', 'proteinG', 'starchG', 'fibreG', 'fatG'];
const LIQUID_PARTS: Part[] = ['waterG', 'saltG', 'aminoG', 'sugarG', 'acidG', 'ethanolG'];

interface Charge { waterG: number; saltG: number; proteinG: number; fatG: number; sugarG: number; starchG: number; fibreG: number; massG: number; koji: boolean }

/**
 * What went in, by component. One entry per UNIT, like calculateBatchDynamics.
 * Dry matter is split by the ingredient's own stats, with a cell-wall share that
 * depends on what it is: produce is mostly wall once the water is out, a grain
 * or pulse a little, flesh very little.
 */
export const chargeOf = (
  ingredients: Ingredient[], quantities: Record<string, number> | undefined, recipe: Recipe
): Charge => {
  const c: Charge = { waterG: 0, saltG: 0, proteinG: 0, fatG: 0, sugarG: 0, starchG: 0, fibreG: 0, massG: 0, koji: false };
  // Water on the charge means the grain went in dry and was hydrated here.
  const charged = ingredients.some(i => i.id === 'water') ? undefined : recipe.type;
  for (const i of ingredients) {
    const m = quantities && quantities[i.id] !== undefined ? quantities[i.id] : i.mass;
    c.massG += m;
    if (i.type === IngredientType.TOOL) continue;
    if (/koji/.test(i.id) && !/spores/.test(i.id)) c.koji = true;
    if (i.id === 'water') { c.waterG += m; continue; }
    if (/salt/.test(i.id)) { c.saltG += m; continue; }
    if (i.id === 'sugar') { c.sugarG += m; continue; }
    if (i.id === 'honey') { c.waterG += m * 0.18; c.sugarG += m * 0.8; c.fibreG += m * 0.02; continue; }
    const w = moistureOf(i, charged);
    c.waterG += m * w;
    let dry = m * (1 - w);
    const h = i.hiddenStats;
    // Native salt (a salted fillet, a fish sauce) comes out of the dry matter first.
    const nativeSalt = Math.min(dry * 0.9, m * clamp(h.nativeSalinity, 0, 10) * 0.012);
    c.saltG += nativeSalt; dry -= nativeSalt;
    // Cell wall for produce, bone/skin/connective tissue for flesh, bran and hull for grain.
    const wall = isProduce(i) ? 6 : isAnimal(i) ? 3.5 : 2;
    const total = h.proteinContent + h.fatContent + h.sugarContent + h.starchContent + wall;
    if (total <= 0) { c.fibreG += dry; continue; }
    c.proteinG += dry * h.proteinContent / total;
    c.fatG += dry * h.fatContent / total;
    c.sugarG += dry * h.sugarContent / total;
    c.starchG += dry * h.starchContent / total;
    c.fibreG += dry * wall / total;
  }
  return c;
};

/* =========================================================================
   THE PROCESS
   ========================================================================= */

export type ProductForm = 'liquid' | 'paste' | 'solid' | 'bed' | 'dried';

export interface ProcessModel {
  /** Share of the charge's water that leaves over the run, in the recipe's own vessel at its own conditions. */
  dry: number;
  /** How far protein is cut into amino acids by the end, before enzymes scale it. */
  proteolysis: number;
  /** How far starch is cut into sugar by the end, before enzymes scale it. */
  amylolysis: number;
  /** Share of the free sugar the culture consumes by the end. */
  attenuation: number;
  /** Where the consumed sugar goes, as shares that sum to 1 (toSolids: browned into insoluble melanoidins). */
  toEthanol: number; toAcid: number; toGas: number; toSolids?: number;
  /** Starch a living bed respires away, share by the end. */
  respiration: number;
  form: ProductForm;
}

/* The chemistry of each family, rounded from the working figures of the craft. */
const BY_TYPE: Record<FermentType, ProcessModel> = {
  [FermentType.LACTO]:    { dry: 0.02, proteolysis: 0.12, amylolysis: 0.05, attenuation: 0.85, toEthanol: 0.02, toAcid: 0.88, toGas: 0.10, respiration: 0,    form: 'solid' },
  [FermentType.KOJI]:     { dry: 0.14, proteolysis: 0.30, amylolysis: 0.35, attenuation: 0.30, toEthanol: 0,    toAcid: 0.05, toGas: 0.95, respiration: 0.12, form: 'bed' },
  [FermentType.MISO]:     { dry: 0.03, proteolysis: 0.60, amylolysis: 0.70, attenuation: 0.55, toEthanol: 0.20, toAcid: 0.45, toGas: 0.35, respiration: 0,    form: 'paste' },
  [FermentType.SHOYU]:    { dry: 0.04, proteolysis: 0.80, amylolysis: 0.75, attenuation: 0.62, toEthanol: 0.25, toAcid: 0.45, toGas: 0.30, respiration: 0,    form: 'liquid' },
  [FermentType.GARUM]:    { dry: 0.06, proteolysis: 0.85, amylolysis: 0.05, attenuation: 0.20, toEthanol: 0,    toAcid: 0.50, toGas: 0.50, respiration: 0,    form: 'liquid' },
  [FermentType.VINEGAR]:  { dry: 0.06, proteolysis: 0.05, amylolysis: 0.05, attenuation: 0.95, toEthanol: 0.02, toAcid: 0.60, toGas: 0.38, respiration: 0,    form: 'liquid' },
  [FermentType.BLACK]:    { dry: 0.40, proteolysis: 0.10, amylolysis: 0.10, attenuation: 0.35, toEthanol: 0,    toAcid: 0.15, toGas: 0.25, toSolids: 0.60, respiration: 0, form: 'dried' },
  [FermentType.FAIL]:     { dry: 0.03, proteolysis: 0.40, amylolysis: 0.20, attenuation: 0.50, toEthanol: 0.10, toAcid: 0.40, toGas: 0.50, respiration: 0,    form: 'paste' },
  [FermentType.ALCOHOL]:  { dry: 0.01, proteolysis: 0.10, amylolysis: 0.90, attenuation: 0.92, toEthanol: 0.46, toAcid: 0.08, toGas: 0.46, respiration: 0,    form: 'liquid' },
  [FermentType.KOMBUCHA]: { dry: 0.04, proteolysis: 0.03, amylolysis: 0,    attenuation: 0.50, toEthanol: 0.10, toAcid: 0.45, toGas: 0.45, respiration: 0,    form: 'liquid' },
};

/* SECONDARY FERMENTATION IS MOST OF WHAT A LONG MASH DOES. A moromi is not
   finished when the koji's enzymes are: halophilic lactobacillus and yeasts move
   in behind them and work for months, souring it and taking most of the sugar.
   Attenuation for the salted mashes was set as if only the mould acted, which
   left a shoyu at acidity 6 against a target of 38 and far too sweet.

   Recipes that are not their family's average: cures that are mostly the water
   they lose, drinks and seasonings filed under koji, syrups filed as brews. */
const BY_RECIPE: Record<string, Partial<ProcessModel>> = {
  bottarga:      { dry: 0.62, proteolysis: 0.15, form: 'dried' },
  salumi:        { dry: 0.55, proteolysis: 0.20, attenuation: 0.9, toAcid: 0.9, toGas: 0.1, toEthanol: 0, form: 'dried' },
  katsuobushi:   { dry: 0.92, proteolysis: 0.25, form: 'dried' },
  shio_tamago:   { dry: 0.90, proteolysis: 0.10, form: 'dried' },
  douchi:        { dry: 0.60, form: 'dried' },
  meju:          { dry: 0.55, form: 'dried' },
  black_garlic:  { dry: 0.55 },
  black_apple:   { dry: 0.35 },
  scallop_fudge: { dry: 0.30 },
  casu_marzu:    { dry: 0.10, proteolysis: 0.7, form: 'solid' },
  blue_cheese:   { dry: 0.14, proteolysis: 0.35, form: 'solid' },
  ricotta_forte: { dry: 0.05, proteolysis: 0.30, form: 'paste' },
  cultured_butter: { dry: 0.02, form: 'paste' },
  chili_mash:    { form: 'paste' },
  /* A shiro miso is deliberately SHORT and koji-heavy so the sugar survives —
     that is the whole point of a white miso, and the family's long-ferment
     attenuation ate it. */
  shiro_miso:    { attenuation: 0.18, toAcid: 0.25 },
  yellow_peaso:  { attenuation: 0.30, toAcid: 0.35 },
  /* Openly WILD brews: no pitched yeast, so lactic acid bacteria work alongside
     whatever yeast lands and the result is sour as well as alcoholic. A pitched
     wine or mead is not like this, which is why it is per-recipe and not a
     family default. */
  makgeolli:     { toEthanol: 0.34, toAcid: 0.30, toGas: 0.36 },
  corn_chicha:   { toEthanol: 0.30, toAcid: 0.36, toGas: 0.34 },
  berry_kvass:   { attenuation: 0.55, toEthanol: 0.22, toAcid: 0.42, toGas: 0.36 },
  tepache:       { attenuation: 0.60, toEthanol: 0.28, toAcid: 0.36, toGas: 0.36 },
  nukazuke:      { dry: 0.08 },
  tempeh:        { dry: 0.06, proteolysis: 0.25, form: 'solid' },
  natto:         { dry: 0.03, proteolysis: 0.35, attenuation: 0.2, form: 'solid' },
  amazake:       { dry: 0.02, amylolysis: 0.85, attenuation: 0.05, respiration: 0, form: 'liquid' },
  shio_koji:     { dry: 0.01, proteolysis: 0.35, amylolysis: 0.5, attenuation: 0.05, respiration: 0, form: 'paste' },
  ponzu:         { dry: 0.01, proteolysis: 0, amylolysis: 0, attenuation: 0 },
  surstromming:  { dry: 0, proteolysis: 0.5, attenuation: 0.6, toAcid: 0.5, toGas: 0.5, form: 'solid' },
  cheong:        { attenuation: 0.08, toEthanol: 0.5, toAcid: 0.1, toGas: 0.4 },
  maesil_cheong: { attenuation: 0.06, toEthanol: 0.4, toAcid: 0.3, toGas: 0.3 },
};

export const processModel = (recipe: Recipe): ProcessModel =>
  ({ ...BY_TYPE[recipe.type] ?? BY_TYPE[FermentType.FAIL], ...(BY_RECIPE[recipe.id] ?? {}) });

/* How much air reaches the surface. A tray is open by design; a mason jar under a
   lid barely breathes; wood and unglazed clay breathe slowly; the heated
   cupboards move air on purpose. The vent opens any of them further. */
const OPENNESS: Record<string, number> = {
  koji_tray: 1, koji_room_bed: 1, koji_muro: 0.55, incubator: 0.45,
  mason_jar: 0.12, onggi: 0.3, oak_cask: 0.18, cedar_barrel: 0.25,
};
export const vesselOpenness = (vesselId: string | undefined, vent: number): number =>
  (OPENNESS[vesselId ?? ''] ?? 0.3) * (1 + 0.45 * Math.max(0, vent));

/** Enzyme strength behind the breakdown: the batch's own koji where it has one, else the family's native activity. */
const enzymeScale = (batch: Batch, charge: Charge, kind: 'protease' | 'amylase', recipe: Recipe): number => {
  const e = batch.enzymes?.[kind];
  if (e !== undefined && charge.koji) return clamp(e / 70, 0.2, 1.3);
  // Fish and flesh break themselves down; a brew's amylase comes from its koji or nuruk.
  if (kind === 'protease' && recipe.type === FermentType.GARUM) return 1;
  if (charge.koji) return 0.8;
  return kind === 'amylase' && recipe.type === FermentType.ALCOHOL ? 0.15 : 0.6;
};

/**
 * The batch as it now is, component by component. Deterministic from the charge,
 * progress, the batch's enzymes and its loss account, so it never drifts from
 * what the tick has recorded.
 */
export const compositionOf = (batch: Batch, recipe: Recipe, ingredients: Ingredient[]): Composition => {
  const ch = chargeOf(ingredients, batch.ingredientQuantities, recipe);
  const model = processModel(recipe);
  const loss = batch.massLoss ?? emptyLoss();
  const x = clamp((batch.progress ?? 0) / 100, 0, 1);

  const amino = ch.proteinG * clamp(model.proteolysis * enzymeScale(batch, ch, 'protease', recipe), 0, 0.95) * x;
  const breath = ch.starchG * model.respiration * x;
  const converted = Math.max(0, ch.starchG - breath) * clamp(model.amylolysis * enzymeScale(batch, ch, 'amylase', recipe), 0, 0.95) * x;
  const available = ch.sugarG + converted;
  const used = available * model.attenuation * x;

  const evaporated = ch.waterG > 0 ? clamp(loss.waterG / ch.waterG, 0, 1) : 0;
  const c: Composition = {
    massG: 0,
    waterG: Math.max(0, ch.waterG - loss.waterG),
    saltG: ch.saltG,
    aminoG: amino,
    sugarG: available - used,
    // Acetic acid is volatile too, a little; ethanol leaves faster than water.
    acidG: used * model.toAcid * (recipe.type === FermentType.VINEGAR ? 1 - 0.3 * evaporated : 1),
    ethanolG: used * model.toEthanol * (1 - Math.min(0.9, 1.4 * evaporated)),
    proteinG: ch.proteinG - amino,
    starchG: Math.max(0, ch.starchG - breath - converted),
    fibreG: ch.fibreG + used * (model.toSolids ?? 0),
    fatG: ch.fatG,
    undissolvedSaltG: 0,
    gasG: used * model.toGas + breath,
  };
  // YEAST DIES IN ITS OWN ALCOHOL, and nothing here said so. `attenuation` caps
  // how much sugar ferments but not what the result may reach, so a sugar-heavy
  // must ran to 30% — a strength no fermentation gets to. Sake yeast is the
  // toughest of these at around 20% (multiple parallel fermentation is why),
  // wine and mead yeasts stop nearer 16, and the wild consortia in a kvass or a
  // tepache give up far sooner. Sugar the yeast could not eat stays sugar,
  // which is exactly why a stuck mead is sweet.
  const tolerance = recipe.id === 'grain_sake' ? 20
    : recipe.type === FermentType.ALCOHOL ? 16
    : recipe.type === FermentType.KOMBUCHA ? 4 : 14;
  const massNow = PARTS.reduce((a, p) => a + c[p], 0);
  const ceiling = massNow * (tolerance / 100);
  if (c.ethanolG > ceiling) {
    // Everything the yeast could not get to is still sugar in the glass.
    c.sugarG += (c.ethanolG - ceiling) / Math.max(0.01, model.toEthanol);
    c.ethanolG = ceiling;
  }

  // What a press or a centrifuge has already taken off.
  const removed = loss.removed ?? {};
  for (const p of PARTS) c[p] = Math.max(0, c[p] - (removed[p] ?? 0));
  c.undissolvedSaltG = Math.max(0, c.saltG - 0.357 * c.waterG);
  c.massG = PARTS.reduce((a, p) => a + c[p], 0);
  return c;
};

/* =========================================================================
   THE TICK
   ========================================================================= */

export interface TickLossInput {
  batch: Batch;
  recipe: Recipe;
  ingredients: Ingredient[];
  prevProgress: number;
  progress: number;
  temp: number;
  humidity: number;
  vent: number;
}

/**
 * Advance the loss account by one tick. Water leaves with progress through the
 * run, scaled by conditions: a vented tray in dry warm air sheds more than the
 * same bed in the humid room it is meant for, and past the end of the run a
 * vessel keeps breathing slowly (a cask's angels' share). Gas is whatever the
 * composition says has fermented away by now.
 */
export const tickMassLoss = (t: TickLossInput): MassLoss => {
  const loss: MassLoss = { ...emptyLoss(), ...(t.batch.massLoss ?? {}) };
  const dp = t.progress - t.prevProgress;
  if (!(dp > 0) || t.batch.status === 'spoiled') return loss;

  const ch = chargeOf(t.ingredients, t.batch.ingredientQuantities, t.recipe);
  const model = processModel(t.recipe);
  const open = vesselOpenness(t.batch.vesselId, t.vent);
  const refOpen = vesselOpenness(t.recipe.requiredVesselId ?? t.batch.vesselId, 0);
  const idealDryness = Math.max(0.05, 1 - (t.recipe.idealParams.humidity ?? 60) / 100);
  const dryness = Math.max(0.02, 1 - t.humidity / 100);
  const air = clamp(dryness / idealDryness, 0.3, 2.5) * clamp(Math.exp(0.04 * (t.temp - t.recipe.idealParams.temp)), 0.5, 2);
  const conditions = clamp(open / Math.max(0.05, refOpen), 0.1, 4) * air;

  // A cure is done at its peak, not at 100: the water leaves over the run to the
  // start of the peak window, then only the slow breathing of ageing continues.
  const runEnd = clamp(t.recipe.peakWindowStart ?? 100, 40, 100);
  const inRun = Math.max(0, Math.min(t.progress, runEnd) - Math.min(t.prevProgress, runEnd)) * (100 / runEnd);
  const ageing = Math.max(0, t.progress - Math.max(t.prevProgress, 100));
  const removedWater = loss.removed?.waterG ?? 0;
  const waterLeft = Math.max(0, ch.waterG - removedWater - loss.waterG);
  const dW = ch.waterG * model.dry * (inRun / 100) * conditions + ch.waterG * 0.02 * open * air * (ageing / 100);
  const waterCap = ch.waterG * Math.min(0.92, model.dry * 2 + 0.08);
  loss.waterG = Math.min(waterCap, loss.waterG + clamp(dW, 0, waterLeft));

  const comp = compositionOf({ ...t.batch, progress: t.progress, massLoss: loss }, t.recipe, t.ingredients);
  loss.gasG = Math.max(loss.gasG, comp.gasG);
  return loss;
};

/* =========================================================================
   READING IT
   ========================================================================= */

export const currentMassG = (batch: Batch): number => {
  const l = batch.massLoss ?? emptyLoss();
  return Math.max(0, (batch.totalMass || 0) - l.waterG - l.gasG - l.pressedG - l.leesG);
};

/** How much the batch has reduced: 1 = as charged. Separation takes liquid at the batch's own strength, so it does not count. */
export const concentrationFactor = (batch: Batch): number => {
  const l = batch.massLoss ?? emptyLoss();
  const m0 = batch.totalMass || 0;
  if (m0 <= 0) return 1;
  return clamp(m0 / Math.max(1, m0 - l.waterG - l.gasG), 1, 4);
};

/** Salt share of what is left: the salt stays when the water goes. */
export const effectiveSalinity = (batch: Batch): number =>
  clamp((batch.params?.salinity ?? 0) * concentrationFactor(batch), 0, 40);

/**
 * The flavour as it now is. Umami, funk and sweetness intensify as water leaves;
 * acidity less, because acetic acid leaves with it; a salted or dried batch is
 * also safer, because water activity falls. At factor 1 this is the batch's own
 * profile, so a sealed ferment scores exactly as before.
 */
/**
 * ALCOHOL, as a percentage of the batch by mass.
 *
 * Ethanol has been tracked in the composition since the mass balance was
 * written — it decides what a pressed sake or a mead comes out at — but nothing
 * upstream could see it. It is not one of the four flavour axes, so it cannot be
 * scored; what it CAN do is what alcohol really does: preserve the thing, and
 * change how it reads on the palate.
 */
export const alcoholPct = (batch: Batch, recipe: Recipe, ingredients: Ingredient[]): number => {
  const c = compositionOf(batch, recipe, ingredients);
  return c.massG > 0 ? clamp((c.ethanolG / c.massG) * 100, 0, 30) : 0;
};

export const concentratedProfile = (batch: Batch, recipe: Recipe): FlavorProfile => {
  const q = batch.quality;
  const e = concentrationFactor(batch) - 1;
  if (e <= 0.001) return q;
  const up = (v: number, k: number) => clamp(v * (1 + k * e), 0, 100);
  const preserve = (batch.params?.salinity ?? 0) > 1 || processModel(recipe).form === 'dried' ? 15 : 6;
  return {
    umami: up(q.umami, 0.8),
    funk: up(q.funk, 0.6),
    sweetness: up(q.sweetness, 0.6),
    acidity: up(q.acidity, 0.35),
    safety: clamp(q.safety + Math.min(8, e * preserve), 0, 100),
  };
};

/* =========================================================================
   SEPARATION
   ========================================================================= */

/**
 * Grams of liquid a gram of each solid still holds after pressing. Plant cell
 * wall is a sponge (pomace leaves a cider press at about 70% moisture); a fish
 * or meat residue is gelatinous and holds nearly as much, which is why a garum
 * gives up half its mash and not three quarters; gelatinised starch binds about
 * twice its weight; fat in flesh emulsifies into the paste rather than running
 * off clear; salt crystals that never dissolved trap brine between them. A
 * centrifuge wrings solids harder than a press.
 */
const HOLD = { fibreG: 2.8, proteinG: 2.0, starchG: 2.2, fatG: 1.2, salt: 1.0 };

/* Whole pieces (a cabbage, a porcini) keep their cells shut and hold far more than
   a crushed fruit mash; a paste sits between. */
const WHOLE_PIECES: Record<ProductForm, number> = { solid: 2.5, paste: 1.2, liquid: 1, bed: 1, dried: 1 };

export interface Separation {
  tool: 'press' | 'centrifuge';
  /** Liquid actually runs off; otherwise the press only packs it down. */
  runsOff: boolean;
  massG: number;
  liquidG: number;
  liquidUnits: number;
  cakeG: number;
  leesG: number;
  /** Concentrations in the liquid that runs off (or the batch's own salt if none does), per 100 g. */
  saltPct: number; aminoPct: number; sugarPct: number; acidPct: number; ethanolPct: number;
  /** Components the separation takes off the batch, for the loss account. */
  removed: Partial<Record<Part, number>>;
  product: Ingredient | null;
  qualityAfter: FlavorProfile;
  note: string;
}

type LiquidName = { id: string; name: string };

const liquidNameFor = (recipe: Recipe): LiquidName => {
  const byId: Record<string, LiquidName> = {
    moromi: { id: 'amino_raw_shoyu', name: 'Raw Shoyu' },
    tamari: { id: 'amino_tamari', name: 'Tamari' },
    pulse_amino: { id: 'amino_pulse', name: 'Pulse Amino' },
    tomato_amino: { id: 'amino_tomato', name: 'Tomato Amino' },
    ponzu: { id: 'ponzu_strained', name: 'Ponzu' },
    bagoong: { id: 'garum_bagoong_liquor', name: 'Bagoong Liquor' },
    nuoc_mam: { id: 'garum_fish_sauce', name: 'Fish Sauce' },
    colatura: { id: 'garum_colatura', name: 'Colatura' },
    tomato_garum: { id: 'garum_tomato_liquor', name: 'Tomato Garum Liquor' },
    rose_garum: { id: 'garum_rose_liquor', name: 'Rose Garum Liquor' },
    surstromming: { id: 'garum_surstromming_brine', name: 'Surströmming Brine' },
    cultured_butter: { id: 'buttermilk_cultured', name: 'Cultured Buttermilk' },
    chili_mash: { id: 'brine_chili', name: 'Chili Brine' },
    grain_sake: { id: 'sake_pressed', name: 'Pressed Sake' },
    makgeolli: { id: 'makgeolli_strained', name: 'Strained Makgeolli' },
    cheong: { id: 'cheong_syrup', name: 'Pine Cheong Syrup' },
    maesil_cheong: { id: 'cheong_syrup_maesil', name: 'Maesil Syrup' },
    country_wine: { id: 'wine_pressed', name: 'Pressed Wine' },
    fruit_mead: { id: 'mead_pressed', name: 'Pressed Mead' },
    berry_kvass: { id: 'kvass_strained', name: 'Strained Kvass' },
    tepache: { id: 'tepache_strained', name: 'Strained Tepache' },
    corn_chicha: { id: 'chicha_strained', name: 'Strained Chicha' },
    amazake: { id: 'amazake_strained', name: 'Strained Amazake' },
    shio_koji: { id: 'shio_koji_liquid', name: 'Shio Koji Liquid' },
  };
  if (byId[recipe.id]) return byId[recipe.id];
  switch (recipe.type) {
    case FermentType.SHOYU: return { id: 'amino_pressed', name: 'Amino Sauce' };
    case FermentType.MISO: return { id: 'amino_tamari', name: 'Tamari' };
    case FermentType.GARUM: return { id: 'garum_liquor', name: 'Garum Liquor' };
    case FermentType.LACTO: return { id: `brine_${recipe.id}`, name: `${recipe.name} Brine` };
    case FermentType.ALCOHOL: return { id: 'brew_strained', name: `Strained ${recipe.name}` };
    case FermentType.VINEGAR: return { id: 'vinegar_raw', name: 'Raw Vinegar' };
    case FermentType.KOMBUCHA: return { id: 'kombucha_strained', name: 'Strained Kombucha' };
    case FermentType.KOJI: return { id: 'koji_liquor', name: 'Koji Liquor' };
    case FermentType.BLACK: return { id: 'black_syrup', name: 'Black Syrup' };
    default: return { id: 'runoff_murky', name: 'Murky Run-off' };
  }
};

const tasteWords = (salt: number, amino: number, sugar: number, acid: number, ethanol: number): string[] => {
  const w: string[] = [salt >= 16 ? 'very salty' : salt >= 8 ? 'salty' : salt >= 2 ? 'lightly salted' : 'unsalted'];
  if (amino >= 6) w.push('deeply savoury'); else if (amino >= 2.5) w.push('savoury');
  if (sugar >= 12) w.push('sweet'); else if (sugar >= 4) w.push('rounded');
  if (acid >= 4) w.push('sharp'); else if (acid >= 1) w.push('bright');
  if (ethanol >= 2.5) w.push(`${ethanol.toFixed(0)}% alcohol`);
  return w;
};

/**
 * What a press or a centrifuge would do to this batch, without doing it. The
 * press screen previews with this and the App applies it, so the two cannot
 * disagree. Recovery is the liquid phase minus what the solids hold; the liquid
 * carries the liquid phase's own concentrations, and the batch left behind is
 * the cake — the solids and the liquid they kept.
 */
export const planSeparation = (
  batch: Batch, recipe: Recipe, ingredients: Ingredient[], tool: 'press' | 'centrifuge', substrate?: Ingredient
): Separation => {
  const c = compositionOf(batch, recipe, ingredients);
  const liquidPhase = LIQUID_PARTS.reduce((a, p) => a + c[p], 0) - c.undissolvedSaltG;
  const pct = (g: number) => (liquidPhase > 0 ? (g / liquidPhase) * 100 : 0);
  const dissolvedSalt = c.saltG - c.undissolvedSaltG;
  const conc = {
    saltPct: pct(dissolvedSalt), aminoPct: pct(c.aminoG), sugarPct: pct(c.sugarG), acidPct: pct(c.acidG), ethanolPct: pct(c.ethanolG),
  };

  const pieces = WHOLE_PIECES[processModel(recipe).form] ?? 1;
  const held = (solidsScale: number) =>
    solidsScale * (HOLD.fibreG * pieces * c.fibreG + HOLD.proteinG * c.proteinG + HOLD.starchG * c.starchG + HOLD.fatG * c.fatG + HOLD.salt * c.undissolvedSaltG);
  // What leaves a share of the liquid phase takes of each dissolved component.
  const liquidTake = (share: number): Partial<Record<Part, number>> => ({
    waterG: c.waterG * share, saltG: dissolvedSalt * share, aminoG: c.aminoG * share,
    sugarG: c.sugarG * share, acidG: c.acidG * share, ethanolG: c.ethanolG * share,
  });
  const sum = (r: Partial<Record<Part, number>>) => Object.values(r).reduce((a, v) => a + (v ?? 0), 0);

  if (tool === 'centrifuge') {
    // The spinner throws out what is suspended — most of the solids — with the
    // little liquid they still hold when wrung that hard.
    const solidShare = 0.85;
    const liquidShare = liquidPhase > 0 ? clamp(held(0.35) * solidShare / liquidPhase, 0, 1) : 0;
    const removed: Partial<Record<Part, number>> = {
      ...liquidTake(liquidShare),
      proteinG: c.proteinG * solidShare, starchG: c.starchG * solidShare, fibreG: c.fibreG * solidShare, fatG: c.fatG * solidShare,
    };
    const leesG = sum(removed);
    return {
      tool, runsOff: true, massG: c.massG, liquidG: 0, liquidUnits: 0, cakeG: 0, leesG, ...conc, removed, product: null,
      qualityAfter: { ...batch.quality, funk: batch.quality.funk * 0.85, safety: clamp(batch.quality.safety + 3, 0, 100) },
      note: `Centrifuged: ${(leesG / 1000).toFixed(2)} kg of lees spun out, the rest clear.`,
    };
  }

  const extractable = Math.max(0, liquidPhase - held(1));
  if (extractable < c.massG * 0.05) {
    // A little water squeezed out of a dry mash, and nothing else.
    const removed: Partial<Record<Part, number>> = { waterG: Math.min(c.waterG, c.massG * 0.01) };
    return {
      tool, runsOff: false, massG: c.massG, liquidG: 0, liquidUnits: 0, cakeG: c.massG, leesG: 0, ...conc,
      saltPct: effectiveSalinity(batch), removed, product: null, qualityAfter: batch.quality,
      note: 'Pressed: the solids held what liquid there was; it only packed down.',
    };
  }

  const share = extractable / liquidPhase;
  const removed = liquidTake(share);
  const liquidG = sum(removed);
  const cakeG = c.massG - liquidG;
  const base = liquidNameFor(recipe);
  const lean = recipe.type === FermentType.ALCOHOL || recipe.type === FermentType.VINEGAR || recipe.type === FermentType.KOMBUCHA;
  const q = concentratedProfile(batch, recipe);
  const saltStat = clamp(conc.saltPct / 2.5, 0, 10);
  const proteinStat = clamp(conc.aminoPct * 0.9, 0, 10);
  const sugarStat = clamp(conc.sugarPct * 0.5, 0, 10);
  const quality = Math.round(clamp(35 + 0.35 * q.safety + (lean ? 2.5 * conc.acidPct + conc.ethanolPct : 4 * conc.aminoPct) + 0.8 * conc.sugarPct, 30, 97));
  const subId = substrate?.id ?? batch.substrateId ?? 'mash';
  const subName = substrate?.name ?? 'the mash';
  const product: Ingredient = {
    id: `${base.id}_${subId}_s${Math.round(saltStat)}u${Math.round(proteinStat)}g${Math.round(sugarStat)}`,
    name: `${base.name} · ${subName}`,
    type: IngredientType.ADDITIVE,
    baseCost: Math.round(12 + quality * 0.5 + saltStat),
    currency: 'money',
    quality,
    description: `${base.name}: ${tasteWords(conc.saltPct, conc.aminoPct, conc.sugarPct, conc.acidPct, conc.ethanolPct).join(', ')} — `
      + `${conc.saltPct.toFixed(1)}% salt, ${conc.aminoPct.toFixed(1)}% amino acids, ${conc.sugarPct.toFixed(1)}% sugar. `
      + `Pressed from ${recipe.name}; ${Math.round((liquidG / c.massG) * 100)}% of the mash ran off.`,
    idealFor: [recipe.type],
    supplierId: 'in_house',
    tierRequired: 0,
    hiddenStats: {
      sugarContent: sugarStat,
      starchContent: 0,
      nativeSalinity: saltStat,
      microbialDiversity: 5,
      fatContent: 0,
      proteinContent: proteinStat,
    },
    mass: 1000,
    unitDisplay: 'ml',
  };
  // The cake keeps the solids and the liquid they held, so it keeps that share of
  // what was dissolved; what gave the batch its savour mostly left with the sauce.
  const kept = 1 - share;
  return {
    tool, runsOff: true, massG: c.massG, liquidG, liquidUnits: Math.floor(liquidG / 1000), cakeG, leesG: 0, ...conc, removed, product,
    qualityAfter: {
      ...batch.quality,
      umami: batch.quality.umami * (0.3 + 0.7 * kept),
      sweetness: batch.quality.sweetness * (0.3 + 0.7 * kept),
      acidity: batch.quality.acidity * (0.5 + 0.5 * kept),
    },
    note: `Pressed ${(liquidG / 1000).toFixed(1)} kg of ${base.name.toLowerCase()} (${conc.saltPct.toFixed(1)}% salt, ${conc.aminoPct.toFixed(1)}% amino acids); ${(cakeG / 1000).toFixed(1)} kg of cake stays as the batch.`,
  };
};

/** Add a separation's removed components to a loss account. */
export const addRemoved = (a: Record<string, number> | undefined, b: Partial<Record<string, number>>): Record<string, number> => {
  const out: Record<string, number> = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + (v ?? 0);
  return out;
};

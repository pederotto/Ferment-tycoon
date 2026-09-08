
import { Batch, Recipe, FermentType, Ingredient, Vessel, HiddenStats, FlavorProfile, IngredientType, Buyer, StaffRoleType, WeatherState, MatrixSubstrate, MatrixEntry, RecipeKnowledge, TelemetrySample, ChamberControls, Lineage, GameState, CrewMember } from '../types';
import { advanceEnzymes, getBatchEnzymes, getAcidProtection, isKojiRecipe } from './koji';
import { standingTier, isVendorUnlocked } from './vendors';
import { crewEffect } from './crew';
import {
  RECIPES, VESSELS, BUYERS, INGREDIENTS, RECIPE_MATRIX, MATRIX_TOKEN_LABELS, BOOKS,
  getUndergroundTierFromXp,
  YIELD_SCALING_EXPONENT, WEEKLY_BENCH_RENT,
  UTILITY_COST_PER_WATT, FREE_UPKEEP_LITRES, WEEKLY_UPKEEP_PER_LITRE, DEMAND_FLOOR, DEMAND_CEILING, DEMAND_DROP_PER_YIELD, DEMAND_RECOVERY_PER_WEEK,
  AGEING_BY_TYPE, AGEING_MAX_PROGRESS, AGEING_PEAK_BONUS, AGEING_VALUE_BONUS, CELLAR_TICK_DIVISOR,
  SPORULATION_START, SPORULATION_FULL, SPORULATION_SPOIL
} from '../constants';

// --- GAMEPLAY CONSTANTS ---
const OPTIMAL_TEMP = 30; // The "Goldilocks" zone
const DANGER_TEMP = 42;  // Where Stress begins
// INCREASED INERTIA: Represents 5kg-10kg of mass. Temp moves much slower now.
const THERMAL_MASS_FACTOR = 120; 

/**
 * Helper to safely resolve a batch's recipe (procedural, standard, or fallback)
 */
export const getRecipeForBatch = (batch: Batch): Recipe => {
  if (batch.cachedRecipe) return batch.cachedRecipe;
  const found = RECIPES.find(r => r.id === batch.recipeId);
  if (found) return found;
  return RECIPES.find(r => r.id === 'bio_sludge')!;
}; 

/**
 * THE MATRIX: Determines recipe based on inputs.
 * Now includes PROCEDURAL GENERATION for generic recipes.
 */
export const resolveRecipeFromMatrix = (
  ingredients: Ingredient[], 
  vesselId: string
): Recipe => {
  // A grey-market copy is chemically the same fish, so it resolves as its legal
  // counterpart. Only its `quality` differs, and that is paid for through the
  // existing terroir cap in calculateCriticScore — no separate penalty.
  ingredients = ingredients.map(i =>
    i.legitCounterpartId ? { ...i, id: i.legitCounterpartId } : i
  );

  const hasId = (idPart: string) => ingredients.some(i => i.id.includes(idPart));
  const sub = ingredients.find(i => i.type === IngredientType.SUBSTRATE);
  
  const hasSalt = hasId('salt');
  const hasSugar = hasId('sugar');
  const hasKoji = ingredients.some(i => i.id.includes('koji') && !i.id.includes('spores'));
  const hasSpores = hasId('spores');
  const hasChili = hasId('chili') || hasId('pepper');
  const hasWheat = hasId('wheat');
  const hasWater = hasId('water');
  const hasTears = hasId('tears');
  const hasLarvae = hasId('larvae');

  // Token semantics for RECIPE_MATRIX. 'koji' means live koji rather than spores,
  // and 'chili' also matches peppers — both carried over from the old chain.
  const matrixToken = (t: string): boolean => {
    if (t === 'koji') return hasKoji;
    if (t === 'chili') return hasChili;
    return hasId(t);
  };

  // --- 1. NAMED RECIPES, FROM THE MATRIX TABLE ---
  // This was a 24-line if-chain. It is a data table now (constants.RECIPE_MATRIX)
  // so the recipe books can print the same combination the resolver matches on —
  // Recipe.requiredIngredients is too vague to read from, it never names the
  // substrate. Order is load-bearing and the table preserves it; the extraction
  // was differential-tested over 8,064 ingredient/vessel combinations.
  const matchSubstrate = (m: MatrixSubstrate): boolean => {
    switch (m.kind) {
      case 'is': return sub?.id === m.id;
      case 'oneOf': return !!sub && m.ids.includes(sub.id);
      case 'includes': return !!sub?.id.includes(m.token);
      case 'none': return !sub;
      // Shio koji and amazake are made FROM koji, with nothing else as the base.
      // The original chain tested `!sub`, but both koji ingredients are typed
      // SUBSTRATE, so that condition could never be true and both recipes have
      // been unreachable since the game shipped — while the Bench Primer taught
      // them. This asks the real question: is koji the base here?
      case 'kojiBase': {
        const substrates = ingredients.filter(i => i.type === IngredientType.SUBSTRATE);
        return substrates.length > 0 && substrates.every(i => i.id.includes('koji'));
      }
      case 'present': return !!sub;
      case 'any': return true;
    }
  };

  for (const entry of RECIPE_MATRIX) {
    if (entry.vesselId !== null && entry.vesselId !== vesselId) continue;
    if (!matchSubstrate(entry.substrate)) continue;
    if (!entry.requires.every(matrixToken)) continue;
    if (entry.forbids?.some(matrixToken)) continue;
    const found = RECIPES.find(r => r.id === entry.recipeId);
    if (found) return found;
  }

  // --- 2. PROCEDURAL GENERATION FALLBACKS ---
  // If no specific recipe matches, apply chemical logic to generate a generic one.

  if (sub) {
      // A. LACTO-FERMENTATION RULE
      // Logic: Substrate + Salt + Anaerobic Vessel + NO Koji = Lacto
      // UPDATED: Now allows Water (Brine)
      if (hasSalt && !hasKoji && !hasSugar && !hasSpores && (vesselId === 'mason_jar' || vesselId === 'onggi')) {
          const isBrine = hasWater;
          return {
              id: `lacto_${sub.id}_gen`,
              name: isBrine ? `Brined ${sub.name.split(' ').pop()}` : `Lacto-Fermented ${sub.name.split(' ').pop()}`, 
              type: FermentType.LACTO,
              description: isBrine ? `Salt-brine pickle. Slower, safer.` : `Dry-salted ${sub.name}. Crisp, acidic, and probiotic.`,
              requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
              outputIngredientId: `lacto_${sub.id}`,
              requiredVesselId: vesselId,
              baseDurationSeconds: isBrine ? 80 : 60, // Brine is slower
              peakWindowStart: 85,
              peakWindowEnd: 100,
              activeIntervention: 'Clean',
              idealParams: { temp: 20, humidity: 60, salinity: 3 }, 
              // Fixed target. What a lacto SHOULD taste like is a property of the
              // process, not of whatever you put in it — deriving the target from
              // the substrate made every substrate score the same.
              idealFlavorProfile: { 
                  umami: 20, 
                  acidity: isBrine ? 60 : 80, // Brine dilutes acid
                  funk: 30, 
                  sweetness: 30, 
                  safety: isBrine ? 100 : 90 // Brine is safer
              },
              difficulty: 1
          };
      }

      // B. MISO RULE
      // Logic: Substrate + Koji + Salt + Anaerobic/Semi Vessel = Miso
      // UPDATED: Now allows Water (Amino Mash)
      if (hasKoji && hasSalt && (vesselId === 'onggi' || vesselId === 'mason_jar' || vesselId === 'cedar_barrel')) {
          const isWet = hasWater;
          return {
              id: `miso_${sub.id}_gen`,
              name: isWet ? `Amino Mash (${sub.name.split(' ').pop()})` : `${sub.name.split(' ').pop()} Miso`, 
              type: FermentType.MISO,
              description: isWet ? `Wet mash of ${sub.name}. Can be pressed for sauce.` : `Amino paste made from ${sub.name}. Savory and rich.`,
              requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
              outputIngredientId: `miso_${sub.id}`,
              requiredVesselId: vesselId,
              baseDurationSeconds: 120, 
              peakWindowStart: 90,
              peakWindowEnd: 100,
              activeIntervention: isWet ? 'Stir' : 'Clean',
              idealParams: { temp: 25, humidity: 60, salinity: 8 },
              idealFlavorProfile: { 
                  umami: 75,      // fixed: a good miso is a good miso
                  acidity: 20, 
                  funk: 50, 
                  sweetness: 25, 
                  safety: 100 
              },
              difficulty: 2
          };
      }

      // C. GARUM RULE
      // Logic: Substrate + Koji + Salt + HEAT (Incubator) = Garum
      if (hasKoji && hasSalt && vesselId === 'incubator') {
          return {
              id: `garum_${sub.id}_gen`,
              name: `${sub.name.split(' ').pop()} Garum`, // e.g. "Beef Garum"
              type: FermentType.GARUM,
              description: `High-temperature enzymatic breakdown of ${sub.name}. Liquid Umami.`,
              requiredIngredients: { substrate: true, starter: 'koji', additive: 'salt' },
              outputIngredientId: `garum_${sub.id}`,
              requiredVesselId: vesselId,
              baseDurationSeconds: 150,
              peakWindowStart: 90,
              peakWindowEnd: 100,
              activeIntervention: 'Skim',
              // The modern method: less than half the Roman salt, held at 60 C so the
              // heat does the preserving instead. Faster, cleaner, and far less salty.
              idealParams: { temp: 60, humidity: 50, salinity: 13 },
              idealFlavorProfile: { 
                  umami: 95,      // fixed, and deliberately high: only a
                  acidity: 30,    // protein-rich substrate can ever reach it
                  funk: 60, 
                  sweetness: 10, 
                  safety: 90 
              },
              difficulty: 3
          };
      }

      // D. CHEONG RULE
      // Logic: Substrate + Sugar + Jar = Cheong (Syrup)
      if (hasSugar && !hasSalt && !hasKoji && vesselId === 'mason_jar') {
          return {
              id: `cheong_${sub.id}_gen`,
              name: `${sub.name.split(' ').pop()} Cheong`, // e.g. "Plum Cheong"
              type: FermentType.ALCOHOL, // Categorized as Alcohol/Syrup class
              description: `Osmotic sugar extraction of ${sub.name}. Intense sweetness and aroma.`,
              requiredIngredients: { substrate: true, starter: null, additive: 'sugar' },
              outputIngredientId: `cheong_${sub.id}`,
              requiredVesselId: vesselId,
              baseDurationSeconds: 80,
              peakWindowStart: 85,
              peakWindowEnd: 100,
              activeIntervention: 'Ventilate',
              idealParams: { temp: 20, humidity: 50, salinity: 0 },
              idealFlavorProfile: { 
                  umami: 0, 
                  acidity: 10, 
                  funk: 10, 
                  sweetness: 100, 
                  safety: 100 
              },
              difficulty: 1
          };
      }
      
      // E. BLACKENING RULE (Maillard)
      // Logic: Substrate + NO SALT + Incubator = Black [Substrate]
      if (!hasSalt && !hasKoji && !hasSugar && vesselId === 'incubator') {
           return {
              id: `black_${sub.id}_gen`,
              name: `Black ${sub.name.split(' ').pop()}`, // e.g. "Black Garlic"
              type: FermentType.BLACK,
              description: `Slow Maillard reaction of ${sub.name}. Sweet, savory, and soft.`,
              requiredIngredients: { substrate: true, starter: null, additive: null },
              outputIngredientId: `black_${sub.id}`,
              requiredVesselId: vesselId,
              baseDurationSeconds: 200,
              peakWindowStart: 90,
              peakWindowEnd: 100,
              activeIntervention: 'Clean',
              idealParams: { temp: 60, humidity: 80, salinity: 0 },
              idealFlavorProfile: { 
                  umami: 50, 
                  acidity: 20, 
                  funk: 40, 
                  sweetness: 80, 
                  safety: 100 
              },
              difficulty: 2
          };
      }
  }

  // --- 3. TOTAL FAILURE ---
  return RECIPES.find(r => r.id === 'bio_sludge')!;
};

export const getInitialParamsFromTerroir = (substrate: Ingredient): { temp: number, humidity: number, salinity: number } => {
  const salinity = substrate.hiddenStats.nativeSalinity;
  // Default to a higher humidity for better UX, usually tweaked in Controller
  return { temp: 25, humidity: 80, salinity: salinity };
};

export const calculateBatchDynamics = (ingredients: Ingredient[], customQuantities?: Record<string, number>) => {
    // New Logic: Mass-based physics with Custom Quantities support
    
    // Helper to get mass of an ingredient (either custom amount or static definition)
    // A titrated quantity of exactly 0 is a legitimate answer — salt at 0% or a
    // bone-dry mash — so this has to test for presence, not truthiness. The old
    // truthy check fell back to the full 1kg unit mass whenever the dial hit
    // zero, silently dumping a kilo of salt or water into the batch.
    const getMass = (i: Ingredient) =>
      customQuantities && customQuantities[i.id] !== undefined ? customQuantities[i.id] : i.mass;

    const totalMass = ingredients.reduce((acc, i) => acc + getMass(i), 0);
    
    // Water has high specific heat capacity, affects reaction speed (dilution)
    const waterMass = ingredients.filter(i => i.id === 'water').reduce((acc, i) => acc + getMass(i), 0);
    
    // Koji drives the enzymatic engine
    const kojiMass = ingredients.filter(i => i.id.includes('koji') && !i.id.includes('spores')).reduce((acc, i) => acc + getMass(i), 0);
    
    // Yield "Volume" is now a ratio based on total mass vs standard batch (1000g)
    const yieldVolume = totalMass / 1000; 
    
    // Concentration decreases as water increases relative to solid mass
    const solidMass = totalMass - waterMass;
    const concentration = solidMass > 0 ? solidMass / totalMass : 0.1;
    const waterRatio = totalMass > 0 ? waterMass / totalMass : 0;
    
    // Speed: Koji speeds it up, Water slows it down (dilution), Salt slows it down (handled active check)
    // Base speed is 1.0. 
    const enzymeDensity = kojiMass / (totalMass || 1); 
    const speedModifier = 1 + (enzymeDensity * 4); // Enzymes really speed things up

    return { yieldVolume, concentration, speedModifier, totalMass, waterRatio };
};

export const getAmbientConditions = (month: number, weather: WeatherState) => {
    // 0 = Jan, 11 = Dec
    // Northern Hemisphere Approximation
    const baseTemp = 18;
    const tempVar = 10;
    // Cosine peaks at 0 (Jan) so we invert or shift. 
    let ambientTemp = baseTemp - Math.cos((month / 12) * 2 * Math.PI) * tempVar;

    // Humidity
    let ambientHumidity = 45;
    if (month >= 5 && month <= 7) ambientHumidity = 75; // Summer
    else if (month >= 11 || month <= 1) ambientHumidity = 30; // Winter
    else ambientHumidity = 55; // Spring/Autumn

    // Apply Weather Modifiers
    ambientTemp += weather.tempModifier;
    ambientHumidity = Math.max(0, Math.min(100, ambientHumidity + weather.humidityModifier));

    return { ambientTemp, ambientHumidity };
};

/**
 * APPLY INTERVENTION
 * Handles Mix, Mist, Lid Toggles, etc.
 */
/**
 * THE SKIN ON TOP.
 *
 * Anything with a wet surface open to air grows one. Three things decide how
 * fast, and all three are the real ones: warmth (it is a culture), salt (which
 * is what a brine is defending itself with), and how much free water is sitting
 * on top. A sealed vessel starves it of oxygen and it barely moves.
 *
 * Vessels do not grow film in proportion to their volume — they grow it in
 * proportion to their SURFACE, which is why a wide tray skins over faster than
 * a narrow onggi of the same litreage and why a cask can be left longer.
 */
export const filmsOver = (recipe?: Recipe): boolean =>
  !!recipe && [
    FermentType.GARUM, FermentType.VINEGAR, FermentType.LACTO,
    FermentType.SHOYU, FermentType.KOMBUCHA, FermentType.ALCOHOL,
  ].includes(recipe.type);

/**
 * On a vinegar or a kombucha the film IS the culture — the mother, the SCOBY.
 * Skimming it is not housekeeping, it is throwing the ferment away. The whole
 * point of making it one quantity is that the player has to know which vessel
 * they are standing over.
 */
export const filmIsTheCulture = (recipe?: Recipe): boolean =>
  !!recipe && (recipe.type === FermentType.VINEGAR || recipe.type === FermentType.KOMBUCHA);

/** Points of film per tick. Zero for anything dry, packed or sealed shut. */
/**
 * HOW FAST AN UNSKIMMED FATTY SURFACE TURNS.
 *
 * Lipid oxidation happens at the air interface, so it needs three things at
 * once: fat, exposure, and time. Salt slows it (which is the >12% rule the
 * critic has always quoted), and the film itself is both the symptom and the
 * catalyst — it holds the fat at the surface where the air is.
 */
export const rancidityRate = (
  fatContent: number,
  surfaceFilm: number,
  salinity: number,
  temp: number,
  vent: number
): number => {
  if (fatContent <= 4 || surfaceFilm < 15) return 0;
  const fat = Math.min(2, (fatContent - 4) / 8);
  // The film is what keeps the fat sitting in the air. Below a quarter cover
  // there is not enough of it to matter.
  const held = (surfaceFilm - 15) / 85;
  // Salt slows oxidation, it does not stop it. Dividing by 12 put the floor
  // exactly at the 12% the critic has always quoted, so every salinity at or
  // above it behaved identically and an oily 12% garum left open for a whole
  // run came out at 6 points of rancidity — not a consequence, noise. At /20,
  // 12% is partial cover (0.4) and 18% is near-total (0.1), which is the same
  // thing the rest of the salt model says.
  const salt = Math.max(0.1, 1 - salinity / 20);
  const heat = Math.max(0.2, Math.min(1.8, (temp - 4) / 26));
  const air = vent >= 2 ? 1.3 : vent >= 1 ? 1 : 0.6;
  return 0.4 * fat * held * salt * heat * air;
};

export const filmGrowthRate = (
  recipe: Recipe | undefined,
  temp: number,
  salinity: number,
  surfaceWater: number,
  vent: number,
  fatContent = 0
): number => {
  if (!filmsOver(recipe)) return 0;
  // A hump, not a ramp. Surface yeasts and moulds run best around blood heat
  // and are killed off by the same heat that pasteurises everything else — a
  // ramp made the 60 C low-salt route the fastest-filming vessel in the game,
  // which is backwards: that route is hot precisely so nothing establishes.
  // Zero below 8 C, peak at 29 C, zero again by 50 C.
  const warmth = Math.max(0, 1 - Math.abs(temp - 29) / 21);
  // Salt is the brine's defence. Past ~18% almost nothing establishes on top,
  // which is the same threshold the rest of the safety model uses.
  const brine = Math.max(0.05, 1 - salinity / 18);
  // A dry surface has nothing to grow in; a flooded one is a petri dish.
  const wet = 0.35 + (surfaceWater / 100) * 0.9;
  // Air is the other half of it. Sealed, a film still forms, but slowly.
  const air = vent >= 2 ? 1.25 : vent >= 1 ? 1 : 0.45;
  // Fat floats. An oily fish gives the surface something to hold, so a mackerel
  // or a pork belly skins over roughly twice as fast as a lean grain — and the
  // skin it grows is the one that goes rancid.
  const oil = 1 + Math.min(1.3, fatContent / 12);
  return 0.9 * warmth * brine * wet * air * oil;
};

/**
 * HOW MUCH OF THE VESSEL ONE PASS OF HANDLING ACTUALLY REACHES.
 *
 * A jar you stir through completely; a 60 L cask you do not — you get the top
 * third and the rest keeps doing what it was doing. This is why volume needs
 * MORE handling rather than the same handling.
 *
 * The ladder is the whole reason the hardware exists, and it was half wired: the
 * paddle was read here and the agitator was not, so the most expensive tool in
 * the game did nothing for the action it was named after. A paddle extends your
 * arm; a geared agitator drives the whole vessel, so volume stops mattering at
 * all. That is what you are buying.
 */
export const interventionReach = (
  litres: number,
  inventory?: Record<string, number>
): number => {
  if ((inventory?.['agitator'] || 0) > 0) return 1;
  const paddleBonus = (inventory?.['mash_paddle'] || 0) > 0 ? 1.9 : 1;
  return Math.max(0.25, Math.min(1, (1.35 * paddleBonus) / Math.pow(Math.max(0.1, litres), 0.42)));
};

/** Which implement `interventionReach` just used, for the UI to name. */
export const reachImplement = (
  inventory?: Record<string, number>
): { id: string; name: string } | null =>
  (inventory?.['agitator'] || 0) > 0 ? { id: 'agitator', name: 'Geared agitator' }
  : (inventory?.['mash_paddle'] || 0) > 0 ? { id: 'mash_paddle', name: 'Mash paddle' }
  : null;

export const applyBatchIntervention = (
    batch: Batch, 
    action: string, 
    ambientTemp: number,
    recipe?: Recipe,
    inventory?: Record<string, number>
): Batch => {
    const newParams = { ...batch.params };
    const messages = [...batch.messages];
    const flags = { ...(batch.flags || { isLidPropped: false }) };
    let quality = { ...batch.quality };
    let enzymes = batch.enzymes ? { ...batch.enzymes } : undefined;
    let stress = batch.stress ?? 0;
    let evenness = batch.evenness ?? 100;
    let surfaceFilm = batch.surfaceFilm ?? 0;
    let rancidity = batch.rancidity ?? 0;

    // How much of the batch one pass of handling actually reaches. A jar you
    // stir through completely; a 60 L cask you do not — you get the top third
    // and the rest keeps doing what it was doing. This is why volume needs more
    // handling rather than the same handling, and why it can never be fully
    // undone by hand.
    const litres = Math.max(0.1, (batch.totalMass || 1000) / 1000);
    // A long paddle reaches the bottom of a cask; a spoon does not. This is the
    // cheap answer to volume, and it is deliberately cheap — the expensive
    // answer is the agitator, which removes the labour rather than easing it.
    const reach = interventionReach(litres, inventory);

    // Interventions used to be flat, context-free bumps — Stir always gave +2
    // umami whether or not stirring was what the batch needed, so there was
    // never a reason to think about which one to use or when. They now depend on
    // the state of the batch and on whether this is the handling the recipe
    // actually asks for, and the wrong move costs you paused growth for nothing.
    const wanted = recipe?.activeIntervention;
    const onPoint = !!wanted && (wanted === action || (wanted === 'Ventilate' && action === 'ToggleLid'));
    const inLogPhase = batch.progress > 18 && batch.progress < 88;

    let disturbance = 0;

    switch (action) {
        case 'Mix':
        case 'Flip': {
            // Turning the bed releases trapped heat and redistributes the
            // mycelium. Real koji practice, and the payoff is real too: an even
            // bed secretes more enzyme. Done during the lag phase there is
            // nothing to redistribute, so it is just lost time.
            const cooling = (newParams.temp - ambientTemp) * 0.15;
            newParams.temp -= cooling;
            stress = Math.max(0, stress - 12);
            disturbance = 8;

            // Turning the whole mass is the strongest thing you can do about
            // stratification — and the one most blunted by volume.
            const evened = (100 - evenness) * 0.62 * reach;
            evenness = Math.min(100, evenness + evened);
            if (evened > 4) messages.push(`Turned through — ${evened.toFixed(0)} points of unevenness worked out.`);

            if (enzymes && inLogPhase) {
                enzymes.amylase = Math.min(100, enzymes.amylase * 1.06);
                enzymes.protease = Math.min(100, enzymes.protease * 1.06);
                messages.push('Bed turned: heat released, growth evened out.');
            } else if (enzymes) {
                messages.push('Bed turned too early — nothing to redistribute yet.');
            } else {
                messages.push('Turned. Heat released.');
            }
            break;
        }

        case 'Mist': {
            // Worth doing when it is drying out, actively harmful once it is wet:
            // a soaked bed invites bacteria rather than mould.
            const before = newParams.humidity;
            newParams.humidity = Math.min(100, newParams.humidity + 15);
            newParams.temp = Math.max(ambientTemp, newParams.temp - 2);
            disturbance = 2;
            if (before < 55) {
                messages.push('Misted: it was drying out.');
            } else if (before > 88) {
                quality.safety -= 3;
                messages.push('Misted an already-wet bed — you are inviting bacteria.');
            }
            break;
        }

        case 'ToggleLid':
        case 'Ventilate':
            flags.isLidPropped = !flags.isLidPropped;
            messages.push(flags.isLidPropped
                ? 'Lid propped — it will run cooler and drier from here.'
                : 'Lid closed — heat and moisture stay in.');
            break;

        case 'Stir': {
            // Stirring a liquid ferment does two real things: it breaks the skin
            // back into the mass, and it puts substrate back in contact with the
            // enzyme that is working on it. The second is why a roused garum
            // develops and a still one stalls.
            //
            // It used to be a flat +0.4 umami, or +2.5 if the recipe happened to
            // ask for stirring. That is a button, not a decision. Both halves now
            // scale with the state it finds: a vessel with a skin on it and
            // solids settled out has a great deal to gain, a clear one has none.
            disturbance = 2;
            const filmBroken = Math.min(surfaceFilm, surfaceFilm * 0.55 * reach);

            if (filmIsTheCulture(recipe)) {
                // Rousing a vinegar sinks the mother. It survives, but it has to
                // re-form at the surface before it does anything again.
                surfaceFilm = Math.max(0, surfaceFilm - filmBroken);
                quality.acidity = Math.max(0, quality.acidity - filmBroken * 0.12);
                messages.push(filmBroken > 3
                  ? `Roused it — the mother sank. It will have to re-form.`
                  : 'Roused. Little in suspension to move.');
                break;
            }

            surfaceFilm = Math.max(0, surfaceFilm - filmBroken);
            // Anything that stratifies gains from being moved; anything that does
            // not simply has nothing to redistribute, and the term is zero.
            const stirEvened = (100 - evenness) * (onPoint ? 0.45 : 0.3) * reach;
            evenness = Math.min(100, evenness + stirEvened);

            // The hydrolysis half. Worth most mid-run, when there is both
            // substrate left and enzyme working; worth nothing before the culture
            // has established or after it has finished.
            const window = inLogPhase ? 1 : 0.15;
            const headroom = Math.max(0, (recipe?.idealFlavorProfile.umami ?? 60) - quality.umami);
            const drawn = headroom * 0.055 * reach * window * (onPoint ? 1.6 : 0.7);
            quality.umami = Math.min(100, quality.umami + drawn);

            if (!onPoint && (recipe?.type === FermentType.LACTO || recipe?.type === FermentType.MISO)) {
                // Opening an anaerobic ferment to stir it is the fault, not the fix.
                quality.safety = Math.max(0, quality.safety - 3);
                messages.push('Stirred a sealed ferment — you have just given it air.');
            } else if (filmBroken > 3 && drawn > 1) {
                messages.push(`Stirred through — skin broken up, ${drawn.toFixed(1)} points of savour drawn out.`);
            } else if (filmBroken > 3) {
                messages.push(`Stirred through — ${filmBroken.toFixed(0)} points of skin broken back in.`);
            } else if (drawn > 1) {
                messages.push(`Roused — ${drawn.toFixed(1)} points of savour drawn out of the solids.`);
            } else if (stirEvened > 4) {
                messages.push('Stirred. It needed evening out, if nothing else.');
            } else {
                messages.push('Stirred. Nothing much had settled or formed.');
            }
            break;
        }

        case 'Skim': {
            // Taking the film off. It used to read the safety number and nudge it,
            // which made it a weaker Clean — there was nothing on the surface for
            // it to remove because nothing accumulated there. Now there is, so
            // the action has a size, and leaving it too long has a price.
            disturbance = 2;

            if (filmIsTheCulture(recipe)) {
                // The player is allowed to do this. They should not want to.
                const lost = surfaceFilm;
                surfaceFilm = 0;
                quality.acidity = Math.max(0, quality.acidity - lost * 0.35);
                messages.push(lost > 8
                  ? `You skimmed off the mother. That was the culture — ${lost.toFixed(0)} points of it.`
                  : 'Skimmed. There was barely a mother there to lose.');
                break;
            }

            // Reach matters more here than anywhere else: a skimmer takes the top
            // off a jar completely and a cask one ladle at a time.
            const taken = surfaceFilm * Math.min(0.95, 0.55 + reach * 0.4);
            surfaceFilm = Math.max(0, surfaceFilm - taken);

            // The film is the most divergent layer in the vessel — it has been in
            // contact with air the whole run — so removing it evens what is left.
            evenness = Math.min(100, evenness + (100 - evenness) * 0.22 * reach);

            if (taken > 1) {
                // What you win back is what the film had been costing, not a flat
                // top-up: safety it had dragged down, funk it had pushed up.
                quality.safety = Math.min(100, quality.safety + Math.min(12, taken * 0.35));
                quality.funk = Math.max(0, quality.funk - taken * 0.14);

                // The oxidised fat is IN the layer you just lifted off, so some of
                // it leaves with the film. This is the reason to skim a fatty
                // ferment rather than simply shut it — but only what is still on
                // top. Whatever has already worked into the body stays there.
                const onTop = rancidity * (taken / Math.max(1, taken + surfaceFilm)) * 0.5;
                rancidity = Math.max(0, rancidity - onTop);

                messages.push(
                  onTop > 2
                    ? `Skimmed ${taken.toFixed(0)} points of film off, and the turned fat with it. It was going rancid.`
                    : taken > 22
                      ? `Skimmed ${taken.toFixed(0)} points of film off. That was well on its way to turning.`
                      : `Skimmed the surface — ${taken.toFixed(0)} points of film off.`
                );
            } else {
                messages.push('Surface is clear. Nothing to take off.');
            }
            break;
        }

        case 'Clean': {
            // Wiping the vessel down. Scales with how far safety has actually
            // fallen, so it is a rescue rather than a free top-up.
            disturbance = 2;
            const deficit = 100 - quality.safety;
            const gain = Math.min(10, 2 + deficit * 0.4);
            quality.safety = Math.min(100, quality.safety + gain);
            messages.push(deficit > 12 ? 'Wiped down. That needed doing.' : 'Wiped down.');
            break;
        }
    }

    return { 
        ...batch, 
        params: newParams,
        enzymes,
        evenness,
        surfaceFilm,
        rancidity,
        stress, 
        quality: quality,
        flags: flags,
        messages: messages.slice(-5),
        disturbanceTimer: (batch.disturbanceTimer || 0) + disturbance 
    };
};

/**
 * HOW FAST A BATCH GOES UNEVEN.
 *
 * Two things drive it, and both are physical rather than punitive:
 *
 *   VOLUME. Heat is made throughout and lost only at the surface, so the ratio
 *   that matters is volume over surface area — which grows as the cube root of
 *   volume. A 60 L cask has roughly three times the core-to-edge gradient of a
 *   2 L jar for the same activity. That is why the exponent is 1/3 and not
 *   something invented.
 *
 *   CONSISTENCY. A brine convects and largely mixes itself. A stiff paste does
 *   not move at all, so nothing evens out on its own. Concentration is already
 *   computed for every batch, so it comes free.
 *
 * A mason jar drifts so slowly it can be ignored, which is the point: this must
 * not add busywork to the early game. It becomes real somewhere around the
 * onggi, and it dominates a cask.
 */
/**
 * DOES THIS FERMENT GET AGITATED AT ALL?
 *
 * Volume stratifies, but "turn it" is only the right answer for ferments where
 * turning is actual practice. Applying it to everything made the game a chore
 * and taught something false:
 *
 *   KOJI    is turned — te-ire, two or three times a cycle, to release heat and
 *           even the bed. This is real and it is the whole craft.
 *   SHOYU   moromi is stirred and aerated — kai-ire — through the whole ferment.
 *           It is the one ferment here whose defining technique is agitation.
 *
 * Garum was in this list and should not have been. Colatura di Cetara is
 * layered with salt in a terzigno, weighted, and left; the liquid seeps out over
 * months and is drawn off the bottom. Nothing is stirred, and the modern
 * incubator method is held at temperature rather than agitated.
 *
 * Everything else is sealed and left alone, and disturbing it is the mistake
 * rather than the fix. A miso is packed, weighted and shut for months; you mix
 * it when it comes out, not while it works. A lacto pickle is anaerobic and
 * opening it is a fault. Black garlic sits in a closed box for weeks.
 *
 * So those ferments do not stratify in any sense the player has to manage, and
 * are exempt outright rather than merely cheap.
 */
export const isAgitatedFerment = (recipe?: Recipe): boolean =>
  !!recipe && (
    recipe.type === FermentType.KOJI ||
    recipe.type === FermentType.SHOYU
  );

export const unevennessRate = (totalMassG: number, concentration: number): number => {
  const litres = Math.max(0.1, totalMassG / 1000);
  const gradient = Math.pow(litres, 1 / 3);        // core-to-edge, ~1.26 at 2L, ~3.9 at 60L
  // Below roughly three litres, conduction and convection genuinely do even a
  // vessel out over fermentation timescales, so small batches are exempt rather
  // than merely cheap. This is what keeps the mechanic out of the early game:
  // a mason jar and a koji tray never stratify at all and never need turning.
  const excess = Math.max(0, gradient - Math.cbrt(3));
  const stiffness = 0.35 + concentration * 0.85;   // a brine self-mixes, a paste cannot
  return 0.144 * excess * stiffness;
};

/**
 * WHERE UNEVENNESS SETTLES.
 *
 * A vessel does not stratify without limit. Diffusion and convection push back
 * against settling, and the two reach a steady state — which is why a barrel of
 * anything is uneven rather than infinitely uneven.
 *
 * Modelling it as unbounded decay was wrong twice over. Physically, because
 * nothing behaves that way; and in play, because a long recipe simply ran the
 * number to zero. A 400-tick Colatura in an oak cask bottomed out around tick
 * 300 and capped at 55 whatever the player did, which removes the decision the
 * mechanic exists to create.
 *
 * The equilibrium depends only on the geometry, so a small vessel settles at
 * perfectly even and a 60 L cask settles around half.
 */
export const evennessEquilibrium = (totalMassG: number): number => {
  const litres = Math.max(0.1, totalMassG / 1000);
  const excess = Math.max(0, Math.pow(litres, 1 / 3) - Math.cbrt(3));
  return Math.max(25, 100 - excess * 20);
};

/**
 * What unevenness costs. Deliberately a ceiling rather than a subtraction: an
 * uneven batch is not a ruined batch, it is a batch whose best parts are dragged
 * down by its worst. 100 evenness costs nothing at all.
 */
export const evennessCeiling = (evenness: number): number =>
  100 - (100 - Math.max(0, Math.min(100, evenness))) * 0.45;

/**
 * The chamber settings a batch is running at. Older saves have no `controls`
 * block, so they fall back to the binary lid flag they were built around.
 */
export const getControls = (batch: Batch): ChamberControls => {
  if (batch.controls) return batch.controls;
  return { vent: batch.flags?.isLidPropped ? 2 : 0, mist: 0, heat: null };
};

/**
 * A culture's heritable profile. Stored on the spore once it has been
 * propagated; derived from the generation counter for founder stock and for
 * saves that predate heritable lineage.
 */
export const getLineage = (batch: Batch): Lineage => {
  if (batch.lineage) return batch.lineage;
  const generation = batch.generation || 1;
  const genBonus = Math.min(10, generation - 1);
  return {
    generation,
    vigor: 1 + genBonus * 0.05,
    resilience: genBonus * 5,
    bias: 0.5,
  };
};

/**
 * THE VENT / MIST INTERACTION
 *
 * Airflow does two things at once — it carries heat away and it carries water
 * away — which is why it cannot be treated as a temperature knob. Misting adds
 * water, and cools, but only by evaporating: a sealed chamber saturates and the
 * mist just sits there, while an open one carries the vapour off and takes the
 * latent heat with it.
 *
 * So the combination the player will find is mist + vent: humidity roughly
 * holds while the temperature falls hard. That is a swamp cooler, and it is the
 * only way to run a bed cool and damp at the same time.
 *
 * The cost is that the water has to land somewhere. `surfaceWater` is free water
 * on the substrate itself, which is not the same as vapour in the air — a wet
 * bed grows bacteria while the hygrometer above it reads fine.
 */
export const chamberExchange = (c: ChamberControls, hasFan: boolean) => {
  const vent = hasFan ? c.vent : Math.min(2, c.vent) as 0 | 1 | 2;
  return {
    vent,
    // Heat shed to the room, as a fraction of the gap.
    coolingFactor: 0.011 + vent * 0.098,
    // Vapour lost to the room per tick.
    moistureLoss: 0.001 + vent * 0.066,
    // Water added per tick.
    moistureGain: c.mist * 0.09,
    // Evaporative cooling: proportional to what is being evaporated AND to how
    // fast the vent removes it. Sealed, misting barely cools at all.
    evapCooling: c.mist * (0.15 + vent * 0.55),
    // Free water arriving on the substrate, less what the airflow dries off.
    surfaceDelta: c.mist * 0.4 - vent * 0.25,
  };
};

/**
 * CORE SIMULATION LOOP
 * Updated with Conditional Logic Hooks for Recipe Matrix
 */
export const processBatchTick = (
    batch: Batch, 
    recipe: Recipe, 
    hygiene: number, 
    substrate: Ingredient, 
    ingredients: Ingredient[],
    activeStaff: Record<StaffRoleType, boolean>,
    inventory: Record<string, number>, 
    currentMonth: number,
    weather: WeatherState,
    isPowerAvailable: boolean = true,
    /**
     * The actual people employed, so a skilled methodical technician slows
     * stratification more than a green one. Without this the crew would be a
     * wage with a name attached.
     */
    crew: CrewMember[] = []
): Batch => {
  const newParams = { ...batch.params };
  const newQuality = { ...batch.quality };
  let messages = [...batch.messages];
  let progress = batch.progress;
  let status = batch.status;
  let stress = batch.stress || 0;
  let disturbanceTimer = batch.disturbanceTimer || 0;
  let enzymes = batch.enzymes;
  const flags = { ...(batch.flags || { isLidPropped: false }) };
  let lineageDamaged = batch.lineageDamaged;

  // Pass custom quantities if they exist on the batch
  const { speedModifier, concentration, totalMass } = calculateBatchDynamics(ingredients, batch.ingredientQuantities);
  const vessel = VESSELS.find(v => v.id === batch.vesselId) || VESSELS[0];
  
  // Lineage is carried on the culture now rather than recomputed from a counter,
  // so a strain you damaged stays damaged and a strain you selected stays
  // selected. getLineage() falls back to the old derivation for founder stock.
  const lineage = getLineage(batch);
  const genSpeedBuff = lineage.vigor;
  const resilienceBuffer = lineage.resilience;

  // Live appliance settings, read fresh every tick so a mid-run change bites
  // immediately.
  const controls = getControls(batch);
  const hasFan = (inventory['portable_fan'] || 0) > 0;
  const hasHumidifier = (inventory['humidifier'] || 0) > 0;
  const ex = chamberExchange(
    { ...controls, mist: (hasHumidifier ? controls.mist : Math.min(1, controls.mist)) as 0 | 1 | 2 },
    hasFan
  );
  let surfaceWater = batch.surfaceWater ?? 0;
  let surfaceFilm = batch.surfaceFilm ?? 0;
  let rancidity = batch.rancidity ?? 0;

  // A batch drifts out of uniformity on its own; only handling brings it back.
  // Staff help because this is exactly the work you would hire someone for — a
  // technician watching the benches turns things before they stratify.
  let evenness = batch.evenness ?? 100;
  const hasAgitator = (inventory['agitator'] || 0) > 0;
  // Who is on the benches, and how good they are. crewEffect already folds in
  // skill and diminishing returns, so a second technician helps and helps less.
  const crewUpkeep = crew.length > 0
    ? crewEffect(crew, 'upkeep', ['tech', 'cleaner'])
    : (activeStaff['tech'] ? 0.5 : 1) * (activeStaff['cleaner'] ? 0.85 : 1);
  const evenDecay = unevennessRate(totalMass, concentration)
    * crewUpkeep
    // A geared agitator does the work continuously and does not get tired,
    // which is the whole argument for buying one.
    * (hasAgitator ? 0.18 : 1);

  const isKoji = recipe.type === FermentType.KOJI;
  // Heated vessels are the ones that SAY they are heated. Hardcoding the id
  // meant a second heated vessel could not exist without editing the physics —
  // and the Cedar Muro is the whole answer to koji having no good vessel.
  const heatCeiling = vessel.heatedTo;
  const isIncubated = heatCeiling !== undefined;
  const isBreathable = batch.vesselId === 'koji_tray' || batch.vesselId === 'cedar_barrel' || batch.vesselId === 'onggi';

  // ENVIRONMENT
  const { ambientTemp, ambientHumidity } = getAmbientConditions(currentMonth, weather);

  // --- DISTURBANCE CHECK ---
  if (disturbanceTimer > 0) {
      disturbanceTimer -= 1;
      // Minimal passive equilibriation during disturbance
      const passiveCooling = (newParams.temp - ambientTemp) * 0.01;
      newParams.temp -= passiveCooling;
      
      return { ...batch, params: newParams, disturbanceTimer };
  }

  // --- PHYSICS ENGINE SELECTION ---

  if (isKoji) {
      // === NEW KOJI PHYSICS (High Inertia / Biogenic Heat) ===
      
      // 1. DETERMINE ACTIVITY PHASE (Bell Curve)
      let metabolicActivity = 0;
      if (progress < 20) {
          // Lag Phase: Dormant, needs ambient warmth.
          metabolicActivity = 0.1;
      } else if (progress >= 20 && progress < 80) {
          // Log Phase: The "Engine" turns on.
          // Widened Optimal Zone (25 divisor instead of 15)
          const optimalTemp = recipe.idealParams.temp;
          const tempOptimality = 1 - (Math.abs(newParams.temp - optimalTemp) / 25);
          metabolicActivity = Math.max(0, tempOptimality) * 3.0; 
      } else {
          // Stationary Phase: Cools down.
          metabolicActivity = 0.2;
      }

      // 2. THERMAL PHYSICS (Inertia System)
      // Biogenic heat used to overwhelm the cooling term by two orders of
      // magnitude: every bed, at any setpoint, ran away roughly 16 C and had to
      // be rescued by propping the lid. That made the one interesting decision
      // mandatory, which is what made koji feel like a chore. A bed now drifts a
      // few degrees above where you set it, and only a genuinely hot setpoint
      // needs managing.
      const selfGeneratedHeat = (metabolicActivity * 1.05) * concentration * speedModifier;

      // Cooling is the vent setting, damped by how well the vessel holds heat.
      // A sealed insulated crock barely sheds anything; a forced-air tray sheds
      // a lot. The player sets this and lives with both of its consequences.
      const coolingFactor = ex.coolingFactor * (1 - vessel.insulationFactor * 0.5);

      const ambientDelta = newParams.temp - ambientTemp;
      const coolingLoss = ambientDelta * coolingFactor;

      // Evaporative cooling is not proportional to the gap — it works even when
      // the bed is already at room temperature, which is exactly why misting
      // into a draught is the tool for a bed running hot in a warm room.
      const netTempChange =
        (selfGeneratedHeat - coolingLoss - ex.evapCooling) / (THERMAL_MASS_FACTOR / 10);
      newParams.temp += netTempChange;

      // 3. HUMIDITY PHYSICS
      // Loss and gain are separate terms rather than one signed number, because
      // they have different causes and the player needs to be able to run both
      // at once. mist 2 + vent 2 comes out near neutral on humidity while the
      // evaporation above drags the temperature down: the swamp-cooler trick.
      let moistureLoss = ex.moistureLoss;
      if (newParams.temp > 35) moistureLoss += 0.02; // sweating

      newParams.humidity = Math.max(0, Math.min(100,
        newParams.humidity - moistureLoss + ex.moistureGain
      ));

      // Water that did not evaporate has landed on the bed. Airflow takes it
      // back off again; a sealed chamber lets it pool.
      surfaceWater = Math.max(0, Math.min(100, surfaceWater + ex.surfaceDelta));

      // A soaked bed is a bacterial substrate, not a fungal one. This is the
      // cost of holding the mist on: the air reads perfect and the bed rots.
      if (surfaceWater > 55) {
          const sodden = (surfaceWater - 55) / 45;
          newQuality.safety = Math.max(0, newQuality.safety - sodden * 0.35);
          if (surfaceWater > 80 && !messages.includes('Bed waterlogged — bacteria, not mould')) {
              messages.push('Bed waterlogged — bacteria, not mould');
          }
      }

      // 4. STRESS SYSTEM
      // 4. STRESS SYSTEM & R&D PROTECTION
      if (newParams.temp > DANGER_TEMP) {
          // Danger Zone (42C+)
          const severity = (newParams.temp - DANGER_TEMP);
          stress += severity * 0.5; 
          lineageDamaged = true;

          // R&D Master Intervention: Prevents Thermal Death
          if (activeStaff['rd'] && stress >= 75) {
              stress = Math.min(70, stress);
              newParams.temp = Math.max(32, newParams.temp - 4); // Cool trays
              if (!messages.includes('R&D Emergency Tray Turn')) {
                  messages.push('R&D Emergency Tray Turn: Burnout Prevented');
              }
          }

          if (stress > 50 && !messages.includes('Warning: Heat Stress')) {
              messages.push('Warning: Heat Stress');
          }
      } else if (newParams.temp < DANGER_TEMP && stress > 0) {
          // Recovery
          stress -= 0.2;
      }

      // 5. ENZYME DEVELOPMENT
      // What the bed is actually producing, steered by the heat and moisture the
      // player is holding right now. This is the whole point of a koji run: you
      // are not waiting out a timer, you are deciding what the koji will be FOR.
      const starterIng = ingredients.find(i => i.type === IngredientType.STARTER);
      enzymes = advanceEnzymes(
        enzymes, substrate, starterIng, newParams.temp, newParams.humidity, stress, progress / 100
      );

      // 6. PROGRESSION
      if (stress < 90 && newParams.humidity > 30) {
          const speedMult = 1 + ((newParams.temp - 30) / 20);
          const baseGrowth = (100 / recipe.baseDurationSeconds);
          progress += (baseGrowth * speedMult * speedModifier * genSpeedBuff);
      }

      // 7. SPOILAGE
      if (stress >= 100) {
          status = 'spoiled';
          if (!messages.includes('CRITICAL: Burnout')) messages.push('CRITICAL: Burnout');
      }

  } else {
      // === STANDARD FERMENTATION MODEL (Liquid/Paste) ===
      
      const thermalInertia = Math.max(1, (totalMass / 1000) * 10); // Liquid is very stable
      
      // 1. Passive Temp Equilibration with Vessel Insulation Buffering
      let targetTemp = ambientTemp;
      let heatingPower = 0;
      
      if (isIncubated) {
          if (isPowerAvailable) {
              // The chamber used to silently hold whatever the recipe wanted,
              // which meant the one decision that separates Roman garum from the
              // modern method — how much heat you substitute for salt — was made
              // for you. The setpoint is the player's now; null means heating
              // off, and the batch simply sits at room temperature.
              // A muro cannot be driven past body heat, so it cannot be used
              // to buy your way out of salting a garum.
              targetTemp = Math.min(heatCeiling!, controls.heat ?? recipe.idealParams.temp);
              // A thermostat drives hardest when it is furthest from setpoint,
              // rather than trickling at a fixed rate. The flat 2.0 took so long
              // to climb that a low-salt batch spoiled somewhere in the twenties
              // on its way to 60 C — which made the heat-instead-of-salt route
              // unreachable in practice even though the safety model supports it.
              heatingPower = controls.heat === null
                ? 0
                : Math.min(9, Math.max(0, (targetTemp - newParams.temp) * 0.85));
              if (controls.heat !== null && controls.heat > heatCeiling!
                  && !messages.includes(`This vessel only heats to ${heatCeiling}C`)) {
                messages.push(`This vessel only heats to ${heatCeiling}C`);
              }
          } else {
              targetTemp = ambientTemp;
              heatingPower = 0;
              if (Math.random() < 0.1 && !messages.includes('Grid Brownout: Heating Offline')) {
                  messages.push('Grid Brownout: Heating Offline');
              }
          }
      }
      
      // Vessel Insulation dampens ambient exposure (e.g. Onggi, Cedar Barrel, Casks)
      const insulationDamping = Math.max(0.2, 1 - (vessel.insulationFactor * 0.75));
      const passiveEquilRate = (0.05 * insulationDamping) / thermalInertia;

      // Move towards target
      if (newParams.temp < targetTemp) {
          newParams.temp += (heatingPower / thermalInertia) + (targetTemp - newParams.temp) * passiveEquilRate;
      } else {
          newParams.temp -= ((newParams.temp - targetTemp) * passiveEquilRate);
      }

      // 2. Humidity Logic
      if (isBreathable) {
         const drift = (newParams.humidity - ambientHumidity) * 0.01;
         newParams.humidity -= drift;
      }

      // The vent and the mister are not koji-only tools. A cure like bottarga
      // rots above 40% RH and had no counterplay at all in a humid month; a
      // garum held open runs cooler than its setpoint. Same levers, same
      // consequences, in both physics branches.
      newParams.humidity = Math.max(0, Math.min(100,
        newParams.humidity - ex.moistureLoss * 4 + ex.moistureGain * 4
      ));
      // Airflow over a liquid or a paste pulls its temperature down too, and
      // misting into that airflow pulls it down further.
      newParams.temp -= (ex.evapCooling * 0.5 + (newParams.temp - ambientTemp) * ex.coolingFactor * 0.35) / thermalInertia;

      surfaceWater = Math.max(0, Math.min(100, surfaceWater + ex.surfaceDelta));

      // 3. Temperature-Dependent Progress
      if (newParams.temp > 10 && newParams.temp < 65) {
           const tempOptimality = 1 - (Math.abs(newParams.temp - recipe.idealParams.temp) / 50);
           progress += (100 / recipe.baseDurationSeconds) * speedModifier * genSpeedBuff * Math.max(0.1, tempOptimality);
      } else if (newParams.temp >= 65) {
           // Enzymes are proteins and they denature. Past 65 C nothing further
           // happens, ever — which is a legitimate outcome but a baffling one to
           // watch, because the batch simply stops with no explanation. Now it
           // says so. Cooling back down does not undo it; the enzymes are gone.
           if (!messages.includes('Enzymes denatured — too hot to develop further')) {
               messages.push('Enzymes denatured — too hot to develop further');
           }
      } else if (newParams.temp <= 10 && !messages.includes('Too cold to develop')) {
           messages.push('Too cold to develop');
      }
  }

  // A skin forms on anything wet and open while it is running. This is what
  // gives Skim something to remove and Stir something to break up; without it
  // both were reading the safety number and nudging it, which is why they felt
  // like the same button twice.
  if (status === 'active' && progress > 3 && filmsOver(recipe)) {
    const fat = substrate?.hiddenStats.fatContent ?? 0;
    surfaceFilm = Math.min(100, surfaceFilm + filmGrowthRate(
      recipe, newParams.temp, newParams.salinity, surfaceWater, ex.vent, fat
    ));

    // Fat held at the surface by the film oxidises there. This is the loop the
    // player is being asked to close: an oily substrate skins faster, and a skin
    // left on an oily substrate turns it. Skimming breaks both halves at once.
    if (!filmIsTheCulture(recipe)) {
      const turning = rancidityRate(fat, surfaceFilm, newParams.salinity, newParams.temp, ex.vent);
      if (turning > 0) {
        rancidity = Math.min(100, rancidity + turning);
        // Rancid is not funk. It reads as savour lost and safety lost, and it
        // does not come back when you finally do skim.
        newQuality.safety = Math.max(0, newQuality.safety - turning * 0.6);
        newQuality.umami = Math.max(0, newQuality.umami - turning * 0.25);
        if (rancidity > 30 && !messages.includes('Fat has begun to turn under the film')) {
          messages.push('Fat has begun to turn under the film');
        }
      }
    }

    if (filmIsTheCulture(recipe)) {
      // The mother is the engine. A vinegar with a good pellicle acidifies; one
      // you keep skimming or rousing does not.
      newQuality.acidity = Math.min(100, newQuality.acidity + surfaceFilm * 0.0035);
      if (surfaceFilm > 30 && !messages.includes('A mother has formed on the surface')) {
        messages.push('A mother has formed on the surface');
      }
    } else if (surfaceFilm > 25) {
      // Past a quarter cover it stops being cosmetic. Safety slides and the funk
      // it throws is the wrong kind — this is the cost of not looking in.
      const cover = (surfaceFilm - 25) / 75;
      newQuality.safety = Math.max(0, newQuality.safety - cover * 0.32);
      newQuality.funk = Math.min(100, newQuality.funk + cover * 0.1);
      if (surfaceFilm > 55 && !messages.includes('Film across the surface — it wants skimming')) {
        messages.push('Film across the surface — it wants skimming');
      }
    }
  }

  // Uniformity decays while the batch is actually doing something. A dormant lag
  // phase does not stratify, and neither does a finished one.
  if (status === 'active' && progress > 5 && isAgitatedFerment(recipe)) {
    // Asymptotic toward the vessel's steady state rather than a straight slide
    // to zero: the further it already is from even, the slower it drifts.
    const floor = evennessEquilibrium(totalMass);
    if (evenness > floor) {
      evenness = Math.max(floor, evenness - evenDecay * ((evenness - floor) / 45));
    }
  }

  // --- UNIVERSAL SPOILAGE LOGIC (Safety Decay) ---
  let safetyDecay = 0;
  let riskFactor = 1;

  // New Contamination Logic for Cold/Wet Koji
  if (isKoji && newParams.temp < 25 && newParams.humidity > 85) {
      if (Math.random() < (100 - hygiene) / 500) {
          safetyDecay += 5;
          if (!messages.includes('Mold Contamination')) messages.push('Mold Contamination');
      }
  }

  // Fat Rancidity
  if (newParams.temp > 35 && substrate.hiddenStats.fatContent > 4) {
      if (Math.random() < 0.01) {
          riskFactor += 2.0;
      }
  }

  // --- THERMAL SAFETY ---
  // Salt is not the only preservative, and the sim only knew about salt. Heat is
  // the other: pathogens do not grow above roughly 55 C, and they grow very
  // slowly near freezing. Between the two lies the danger zone, which is exactly
  // where salt has to do the work on its own.
  //
  // This is the difference between Roman garum and the modern method. The Romans
  // used 20%+ salt and left it in the Mediterranean sun; Noma uses far less salt
  // and holds it at 60 C instead. Both are safe. Either lever alone can carry a
  // ferment, and lowering one means raising the other.
  if (newParams.temp >= 55) {
      riskFactor *= 0.15;                      // too hot for anything to establish
  } else if (newParams.temp >= 48) {
      riskFactor *= 0.45;
  } else if (newParams.temp <= 8) {
      riskFactor *= 0.35;                      // too cold to get going
  } else if (newParams.temp >= 20 && newParams.temp <= 45) {
      riskFactor *= 1.6;                       // the danger zone; salt must cover this
  }

  // Salinity Preservative Barrier Dynamics
  if (recipe.idealParams.salinity > 0) {
      if (newParams.salinity < recipe.idealParams.salinity * 0.4) {
          // Severely under-salted — unless the heat is carrying it instead, which
          // is a legitimate method rather than a mistake.
          //
          // A chamber climbing toward a heat-preserving setpoint is a third case:
          // the batch is passing through the danger zone rather than sitting in
          // it. That is a real risk and a bounded one, so it decays slowly
          // instead of not at all. Without this the modern low-salt route could
          // never be reached, because the batch died during the warm-up.
          const heatIsCarryingIt = newParams.temp >= 55;
          const climbingToHeat = !heatIsCarryingIt && isIncubated && isPowerAvailable
            && (controls.heat ?? recipe.idealParams.temp) >= 55;
          if (!heatIsCarryingIt) safetyDecay += climbingToHeat ? 0.5 : 2;
          if (Math.random() < 0.05 && !messages.includes('Under-salted: Pathogen Risk')) {
              messages.push('Under-salted: Pathogen Risk');
          }
      } else if (newParams.salinity >= recipe.idealParams.salinity * 0.8) {
          // Properly salted: Strong osmotic protection
          riskFactor *= 0.35;
      } else if (newParams.salinity > recipe.idealParams.salinity * 1.8) {
          // Over-salted: Safe but slows enzymatic kinetics
          riskFactor *= 0.1;
      }
  }

  // Lactobacillus / Acetic Acid Natural Sterilization (pH Drop)
  if (newQuality.acidity >= 45) {
      riskFactor *= 0.2; // Acidified environment suppresses pathogens
  }

  // Black koji throws citric acid, which drops the pH and keeps a warm ferment
  // from turning on itself — the reason it exists in hot climates.
  const acidShield = getAcidProtection(ingredients);
  if (acidShield > 0) riskFactor *= Math.max(0.3, 1 - acidShield / 40);

  // Hygiene Check & Cleaner Staff
  if (activeStaff['cleaner']) riskFactor *= 0.5;
  const adjustedHygiene = Math.min(100, hygiene + resilienceBuffer);
  const contaminationChance = ((100 - adjustedHygiene) / 2000) * riskFactor;
  
  if (Math.random() < contaminationChance) {
     safetyDecay += 1;
  }

  // --- RECIPE SPECIFIC CONDITIONAL LOGIC HOOKS ---
  
  // 1. Bottarga (Humidity sensitivity)
  if (recipe.id === 'bottarga') {
      if (newParams.humidity > 40) {
          safetyDecay += 5;
          if (Math.random() < 0.1 && !messages.includes("High Humidity Warning")) messages.push("High Humidity Warning");
      }
  }

  // 2. Casu Marzu (Hygiene Inversion)
  if (recipe.id === 'casu_marzu') {
      // Must be dirty to feed larvae
      if (hygiene > 50) {
          progress *= 0.1; // Slows down
          if (Math.random() < 0.05 && !messages.includes("Larvae Starving")) messages.push("Larvae Starving (Too Clean!)");
      }
  }

  // 3. Bagoong (Oxidation)
  if (recipe.id === 'bagoong') {
      if (!flags.isLidPropped) {
          // Anaerobic -> Grey
          newQuality.funk += 0.1;
          newQuality.umami -= 0.05;
          if (Math.random() < 0.01 && !messages.includes("Anaerobic (Turning Grey)")) messages.push("Anaerobic (Turning Grey)");
      } else {
          // Aerobic -> Pink
          newQuality.umami += 0.1;
      }
  }

  // 4. Cheong (Wild Yeast Risk)
  if (recipe.id === 'cheong') {
      if (hygiene < 50) {
          if (Math.random() < 0.05) {
              newQuality.safety -= 2;
              newQuality.funk += 5; // Alcohol funk
              if (!messages.includes("Wild Yeast Infection")) messages.push("Wild Yeast Infection");
          }
      }
  }

  // 5. Gochujang (Heat -> Alcohol)
  if (recipe.id === 'gochujang') {
      if (newParams.temp > 30) {
          newQuality.safety -= 1;
          newQuality.sweetness -= 0.5; // Sugar eaten by yeast
          if (Math.random() < 0.05 && !messages.includes("Turning Alcoholic")) messages.push("Turning Alcoholic");
      }
  }

  // 6. Ancient Garum (Gamble)
  if (recipe.id === 'ancient_garum') {
      if (Math.random() < 0.02) { // 2% chance per tick to go bad -> roughly 30% over duration
          safetyDecay += 50;
          if (!messages.includes("BIO-HAZARD EVENT")) messages.push("BIO-HAZARD EVENT");
      }
  }

  // 7. Coconut Vinegar (Stages)
  if (recipe.id === 'coconut_vin') {
      if (progress < 50) {
          // Stage 1: Alcohol
          newQuality.sweetness -= 0.2;
      } else {
          // Stage 2: Acetic Acid
          newQuality.acidity += 0.2;
      }
  }

  newQuality.safety = Math.max(0, newQuality.safety - safetyDecay);

  // Peak Window Definition (Sous Chef extends window by 25%)
  const peakStart = recipe.peakWindowStart;
  const peakBonus = activeStaff['chef'] ? Math.round((recipe.peakWindowEnd - recipe.peakWindowStart) * 0.25) : 0;
  const effectivePeakEnd = recipe.peakWindowEnd + peakBonus;

  // Status Check
  if (newQuality.safety < 20) {
    status = 'spoiled';
  } else if (recipe.type === FermentType.KOJI) {
    // Koji has its own end, at SPORULATION_SPOIL. The generic "+40 past peak is
    // spoiled" rule would kill the bed at 140 — inside the window where it is
    // still giving spores.
    if (progress >= SPORULATION_SPOIL) status = 'spoiled';
    else if (progress >= 100 && batch.progress < 100) {
      status = 'ready';
      if (!messages.includes('Fermentation Complete (Peak Ready)')) {
        messages.push('Fermentation Complete (Peak Ready)');
      }
    }
  } else if (progress >= effectivePeakEnd + 40 && ageingBehaviour(recipe) !== 'matures') {
    status = 'spoiled'; // Over-fermented — but only for the ferments that can be
  } else if (progress >= 100 && batch.progress < 100) {
    status = 'ready';
    if (!messages.includes('Fermentation Complete (Peak Ready)')) {
      messages.push('Fermentation Complete (Peak Ready)');
    }
  } else if (status !== 'spoiled' && status !== 'ready') {
    status = 'active';
  }

  // --- STAFF AUTOMATION (Tech) ---
  if (activeStaff['tech']) {
      if (!isKoji) {
          // Tech keeps incubators locked to ideal
          if (Math.abs(newParams.temp - recipe.idealParams.temp) > 2) {
              newParams.temp += (recipe.idealParams.temp - newParams.temp) * 0.15;
          }
      } else {
          // For Koji, Tech prevents catastrophic humidity loss
          if (newParams.humidity < 60) newParams.humidity += 1.5;
      }
  }

  // --- FLAVOUR DEVELOPMENT ---
  // Quality converges toward what the substrate can actually support, at a rate
  // set by how close to ideal you are holding the vessel. This replaces a flat
  // trickle (+0.05/tick) that moved the needle about 6 points over a whole batch
  // and left the outcome essentially equal to its starting value.
  const rdUmamiMult = activeStaff['rd'] ? 1.35 : 1.0;
  const potential = getFlavorPotential(ingredients, concentration, batch.ingredientQuantities);

  // How well the batch is being run, 0..1. Enzymes stall when it is too cold and
  // denature when it is too hot, so this is a band around the recipe's ideal.
  const tempMiss = Math.abs(newParams.temp - recipe.idealParams.temp);
  const processQuality = Math.max(0.05, 1 - tempMiss / 28) * (1 - Math.min(0.6, stress / 100));

  // Salt is the other half: an under-salted ferment goes sour and thin instead
  // of deep, an over-salted one simply stops working.
  const idealSal = recipe.idealParams.salinity;
  const salFactor = idealSal <= 0
    ? 1
    : Math.max(0.25, 1 - Math.abs(newParams.salinity - idealSal) / (idealSal * 1.6));

  const convert = 0.035 * processQuality * salFactor;

  if (progress <= effectivePeakEnd) {
    newQuality.umami += (potential.umami * rdUmamiMult - newQuality.umami) * convert;
    newQuality.funk += (potential.funk - newQuality.funk) * convert * 0.8;
    if (potential.sweetness > newQuality.sweetness) {
      // Starch converts to sugar early, then the sugar gets eaten.
      newQuality.sweetness += (potential.sweetness - newQuality.sweetness) * convert * 0.6;
    }
    if (progress >= peakStart) newQuality.acidity += 0.05;
  } else if (ageingBehaviour(recipe) === 'matures') {
    // The ferments defined by age keep improving past the window rather than
    // falling over: proteolysis continues slowly, sharp edges mellow, and the
    // flavour darkens. Diminishing, never reversing.
    const maturity = getMaturity(batch, recipe);
    const gain = convert * 0.35 * (1 - maturity);
    newQuality.umami += (potential.umami * 1.25 - newQuality.umami) * gain;
    newQuality.funk += (potential.funk * 1.1 - newQuality.funk) * gain * 0.7;
    // Acidity rounds off with time — the thing long ageing is actually for.
    if (newQuality.acidity > recipe.idealFlavorProfile.acidity) {
      newQuality.acidity -= 0.03;
    }
  } else if (recipe.type === FermentType.KOJI && progress >= SPORULATION_START) {
    // Fruiting, not merely fading. The mould stops making enzyme and starts
    // making spores, so the bed goes bitter and the enzymatic value — the entire
    // point of a koji — drains away. This is the price of a lineage, and it has
    // to be a real one or holding the bed is free.
    //
    // Scaled by PROGRESS, not by ticks. Per-tick decay made the cost depend on
    // baseDurationSeconds: koji runs 48s, so the whole window from 110 to 145 is
    // 17 ticks and the bed lost about six points of enzyme for thirteen packets
    // of spore. Against progress, the window drains it whatever the clock does.
    const dp = Math.max(0, progress - batch.progress);
    newQuality.umami = Math.max(0, newQuality.umami - 1.4 * dp);
    newQuality.sweetness = Math.max(0, newQuality.sweetness - 1.2 * dp);
    newQuality.funk = Math.min(100, newQuality.funk + 1.0 * dp);
    if (enzymes) {
      enzymes.amylase = Math.max(0, enzymes.amylase - 2.0 * dp);
      enzymes.protease = Math.max(0, enzymes.protease - 2.0 * dp);
    }
    if (progress >= SPORULATION_START + 2 && !messages.includes('Going to spore — green showing on the bed')) {
      messages.push('Going to spore — green showing on the bed');
    }
    if (progress >= SPORULATION_SPOIL) status = 'spoiled';
  } else {
    // Everything else declines past the window: a lacto pickle softens and
    // over-sours, a bottarga dries past use.
    newQuality.umami -= 0.12;
    newQuality.funk += 0.2;
  }

  // --- TELEMETRY ---
  // Sample on progress rather than on ticks, so a 400-second colatura and a
  // 45-second koji both end up with a comparably readable trace.
  const history = [...(batch.history ?? [])];
  const lastP = history.length ? history[history.length - 1].p : -99;
  if (progress - lastP >= 1.5 || history.length === 0) {
    const sample: TelemetrySample = {
      p: Math.round(progress * 10) / 10,
      temp: Math.round(newParams.temp * 10) / 10,
      hum: Math.round(newParams.humidity),
      stress: Math.round(stress),
    };
    if (enzymes) { sample.amy = Math.round(enzymes.amylase); sample.pro = Math.round(enzymes.protease); }
    history.push(sample);
  }

  return {
    ...batch,
    history,
    enzymes,
    totalMass, 
    progress: progress,
    params: newParams,
    quality: newQuality,
    status: status,
    messages: messages.slice(-5),
    lastTick: Date.now(),
    lineageDamaged: lineageDamaged,
    controls,
    surfaceWater,
    surfaceFilm,
    rancidity,
    evenness,
    // Kept in step with the vent so the older call sites that ask the simple
    // open/closed question still get a true answer.
    flags: { ...flags, isLidPropped: ex.vent >= 2 },
    stress: Math.max(0, stress),
    disturbanceTimer: disturbanceTimer,
  };
};

export const calculateCriticScore = (batch: Batch, recipe: Recipe, activeStaff?: Record<StaffRoleType, boolean>): number => {
  if (recipe.type === FermentType.FAIL || batch.status === 'spoiled') return 0;
  
  const q = batch.quality;
  const t = recipe.idealFlavorProfile;

  let clarityBonus = batch.isFiltered ? 10 : 0;
  
  // NEW TERROIR MECHANIC: Calculate average quality of ingredients used in batch
  // Requires resolving ingredients from IDs (simulated here assuming we have access or pass simple metric)
  const batchIngredients = batch.inputIngredientIds.map(id => INGREDIENTS.find(i => i.id === id)).filter(Boolean) as Ingredient[];
  
  let avgQuality = 50;
  if (batchIngredients.length > 0) {
      avgQuality = batchIngredients.reduce((acc, i) => acc + i.quality, 0) / batchIngredients.length;
  }

  // Calculate Euclidean distance from ideal profile
  const diff = Math.abs(q.umami - t.umami) + Math.abs(q.acidity - t.acidity) + 
               Math.abs(q.funk - t.funk) + Math.abs(q.sweetness - t.sweetness);
  
  let score = Math.max(0, 100 - (diff / 3)) + clarityBonus;
  
  if (activeStaff?.rd) score += 5;
  if (activeStaff?.chef) score += 3; // Sous Chef refinement

  // Penalize low safety heavily
  if (q.safety < 50) score = 0;
  else if (q.safety < 90) score *= (q.safety / 100);

  // Progress & Peak Window Dynamics
  const isPeak = batch.progress >= recipe.peakWindowStart && batch.progress <= recipe.peakWindowEnd;
  const maturity = getMaturity(batch, recipe);
  if (maturity > 0) {
      // A three-year miso is not a miso that missed its window.
      score += 5 + Math.round(score * AGEING_PEAK_BONUS * maturity);
  } else if (isPeak) {
      score += 5; // Peak window mastery bonus
  } else if (batch.progress < recipe.peakWindowStart && batch.status !== 'ready' && batch.status !== 'analyzed') {
      const completionRatio = Math.max(0.3, batch.progress / Math.max(1, recipe.peakWindowStart));
      score *= completionRatio;
  }

  // TERROIR CAP: You cannot get a perfect score with bad ingredients.
  // If avg quality is 50 (Industrial Salt), max score is capped around 80.
  // If avg quality is 100 (Trapani Salt + High End Fish), max score is 100.
  // Age lifts the ceiling a little as well as the score — otherwise a long-aged
  // miso made from ordinary beans would hit the terroir cap and the years would
  // count for nothing.
  const qualityCap = 60 + (avgQuality * 0.4) + Math.round(12 * maturity);

  // A batch that fermented unevenly cannot score as if it were one good batch,
  // because it is not: it is the average of a warm core and a cool edge. This is
  // the cost of working at volume, and the only way to avoid it is to do the
  // work — turn it, stir it, keep it moving.
  const evenCap = evennessCeiling(batch.evenness ?? 100);

  return Math.floor(Math.min(qualityCap, evenCap, score));
};

/**
 * What this batch could become if you run it well.
 *
 * This is the load-bearing idea: the substrate sets your CEILING, not your
 * target. A protein-rich fish can reach a garum's umami; pearl barley cannot,
 * no matter how perfectly you run it. Previously the procedural recipes derived
 * their own idealFlavorProfile from these same stats, so the goalposts moved
 * with the ball and every substrate scored roughly the same.
 */
export const getFlavorPotential = (
  ingredients: Ingredient[],
  concentration: number,
  quantities?: Record<string, number>
): { umami: number; funk: number; sweetness: number } => {
  const sub = ingredients.find(i => i.type === IngredientType.SUBSTRATE) || ingredients[0];
  if (!sub) return { umami: 0, funk: 0, sweetness: 0 };
  const c = Math.max(0.15, concentration);
  const h = sub.hiddenStats;

  // The enzymes present decide how much of the substrate is actually reachable.
  // Protein sitting in a bean is not umami until a protease cuts it up, and
  // starch is not sweet until an amylase does. A rich substrate with no koji is
  // a missed opportunity; a strong koji on a poor substrate has nothing to work
  // on. Both halves have to be right.
  const enz = getBatchEnzymes(ingredients, quantities);

  // A floor of background activity: wild organisms and native enzymes do a
  // little of this on their own, which is how a plain lacto pickle works.
  const proteolysis = 0.18 + (enz.protease / 100) * 0.95;
  const saccharification = 0.15 + (enz.amylase / 100) * 1.0;
  // Lipolysis frees butyric, caproic and caprylic acids from fat. That is where
  // the sharp, pungent character of an aged dairy ferment or a cured roe comes
  // from — fatContent was tracked all along and only ever used for rancidity.
  const lipolysis = 0.1 + ((enz.lipase ?? 0) / 100) * 1.1;

  return {
    umami: h.proteinContent * 11 * c * proteolysis,
    // Funk comes from two places: the wild life already in the substrate, and
    // fat being taken apart.
    funk: (h.microbialDiversity * 9 + h.fatContent * 6 * lipolysis) * c,
    // Free sugar is already there; starch only counts once amylase reaches it.
    sweetness: (h.sugarContent * 5 + h.starchContent * 7 * saccharification) * c,
  };
};

export const generateInitialQuality = (ingredients: Ingredient[]): FlavorProfile => {
    const sub = ingredients.find(i => i.type === IngredientType.SUBSTRATE) || ingredients[0];
    const { concentration } = calculateBatchDynamics(ingredients);

    // Raw inputs start near zero. Everything the batch becomes is developed by
    // the ferment itself, which is what makes the process worth simulating.
    return {
        umami: sub.hiddenStats.proteinContent * concentration * 1.2,
        acidity: 4 * concentration,
        funk: sub.hiddenStats.microbialDiversity * concentration * 0.8,
        // Only the free sugar tastes sweet at the start — the starch has not
        // been converted yet, which is what the ferment is for.
        sweetness: sub.hiddenStats.sugarContent * concentration * 1.5,
        safety: 100
    };
};

export const getInterestedBuyers = (
    batch: Batch,
    recipe: Recipe,
    score: number,
    renown: number,
    xp: number = 0,
    reputation: number = 0,
    /**
     * The whole state, when available, so the unlock routes are real rather
     * than decorative. Without it the licensed ladder falls back to the
     * reputation gate, which is what it did before vendors had unlock routes.
     */
    gameState?: GameState
): Buyer[] => {
    const tier = getUndergroundTier(xp);
    const matching = BUYERS.filter(b => {
        if (b.type === 'Underground') {
            // Standing at the bench, not reputation, is what gets you in the door.
            // Renown used to gate this, which was backwards: it gated the
            // underground behind the currency the underground paid out in.
            if ((b.undergroundTier ?? 1) > tier) return false;
            if (!b.desiredTypes.includes(recipe.type)) return false;
            // Fences apply their own criteria; the score band does not apply.
            return buyerWillTake(batch, recipe, b, score) || b.pricesContraband === true;
        }
        if (!b.desiredTypes.includes(recipe.type)) return false;
        // Reputation was declared on all 13 buyers and never once checked, so the
        // whole licensed ladder was open from day one. Selling safe, good stock is
        // what opens the better restaurants.
        //
        // A vendor with its own unlock route is gated by that instead — buying a
        // particular ingredient, mastering a recipe, being introduced. Without
        // this the routes would show as locked in the order book while the buyer
        // still turned up in the sell list, which is worse than not having them.
        if (b.unlock && gameState) {
            if (!isVendorUnlocked(b, gameState)) return false;
        } else if (reputation < b.minReputation) {
            return false;
        }
        if (score < b.minScore - 25) return false;
        return true;
    });

    // Always guarantee the Culinary Co-op for non-spoiled batches
    const coop = BUYERS.find(b => b.id === 'culinary_coop');
    if (coop && batch.status !== 'spoiled' && !matching.some(b => b.id === 'culinary_coop')) {
        matching.unshift(coop);
    }

    // For spoiled or hazardous batches, guarantee Bio-Reclamation salvage
    if (batch.status === 'spoiled' || recipe.type === FermentType.FAIL) {
        const bio = BUYERS.find(b => b.id === 'bio_reclamation');
        if (bio && !matching.some(b => b.id === 'bio_reclamation')) {
            matching.push(bio);
        }
    }

    return matching;
};

/* =========================================================================
   AGEING — what happens after the peak window
   ========================================================================= */

export const ageingBehaviour = (recipe: Recipe) => AGEING_BY_TYPE[recipe.type] ?? 'peaks';

/**
 * HOW FAR A KOJI BED HAS GONE TO SPORE, 0..1.
 *
 * Zero until SPORULATION_START — a bed at its peak is a white felt and there is
 * nothing to collect. The button for taking a lineage used to be gated on the
 * critic score instead, which had two problems: a bed you had run beautifully
 * offered spores the moment it was ready, with no cost and no waiting, and a bed
 * you had run adequately could never give you a strain at all. Neither is how it
 * works. Sporulation is a phase, not a reward.
 */
export const sporulation = (batch: Batch, recipe: Recipe): number => {
  if (recipe.type !== FermentType.KOJI) return 0;
  if (batch.progress < SPORULATION_START) return 0;
  const span = SPORULATION_FULL - SPORULATION_START;
  return Math.min(1, (batch.progress - SPORULATION_START) / span);
};

/** How many packets a bed yields, and whether it can be taken at all. */
export const sporeYield = (batch: Batch, recipe: Recipe): number => {
  const s = sporulation(batch, recipe);
  if (s <= 0 || batch.progress > SPORULATION_SPOIL) return 0;
  // A healthy bed fruits more heavily than a stressed one. Score is not the gate
  // any more, but it still decides how much you get.
  const health = Math.max(0.35, Math.min(1.25, batch.quality.safety / 100));
  return Math.max(1, Math.round(14 * s * health));
};

export const describeSporulation = (batch: Batch, recipe: Recipe): string | null => {
  if (recipe.type !== FermentType.KOJI) return null;
  const s = sporulation(batch, recipe);
  if (batch.progress > SPORULATION_SPOIL) return 'Over-run. Bitter, and the spores with it — this bed is finished.';
  if (batch.progress < SPORULATION_START) {
    const away = SPORULATION_START - batch.progress;
    return batch.progress >= 100
      ? `White and at its best. Hold it ${away.toFixed(0)}% longer and it will begin to fruit — good for spores, ruined for the kitchen.`
      : null;
  }
  if (s <= 0.02) return 'Just turning. Green will show within the hour, and the bed stops being food.';
  if (s < 0.35) return 'The first green is showing. It is going to spore now, and it will not come back.';
  if (s < 0.8) return 'Yellow-green across the bed. Take the spores whenever you like; the food is already gone.';
  return 'Fully sporulated. This is as many spores as it will give.';
};

/**
 * Maturity as a 0..1 fraction of "as good as age will make it".
 *
 * Logarithmic on purpose: a hatcho miso gains most of its depth in the first
 * year and refines slowly after, so the fifth year is worth chasing but not
 * five times the first.
 */
export const getMaturity = (batch: Batch, recipe: Recipe): number => {
  if (ageingBehaviour(recipe) !== 'matures') return 0;
  const over = batch.progress - recipe.peakWindowEnd;
  if (over <= 0) return 0;
  const span = AGEING_MAX_PROGRESS - recipe.peakWindowEnd;
  return Math.min(1, Math.log1p((over / span) * 9) / Math.log(10));
};

/** A human read of how far along a maturing batch is. */
export const describeMaturity = (batch: Batch, recipe: Recipe): string | null => {
  if (ageingBehaviour(recipe) !== 'matures') return null;
  const m = getMaturity(batch, recipe);
  if (m <= 0.001) return null;
  if (m < 0.2) return 'Young — just past ready.';
  if (m < 0.45) return 'Coming together. The edges are softening.';
  if (m < 0.7) return 'Properly mature. This is what the age is for.';
  if (m < 0.92) return 'Deep and dark. Very little left to gain.';
  return 'As far as it goes. Nothing more will come of waiting.';
};

/* =========================================================================
   THE UNDERGROUND — valuation and access.
   Fences do not price on correctness. They price on character, rot and risk,
   which is why a batch the licensed trade calls a failure is worth something
   here and a clean textbook batch is worth nothing.
   ========================================================================= */

export const getUndergroundTier = (xp: number): number => getUndergroundTierFromXp(xp);

/** True when the batch was built with at least one contraband reagent. */
export const isContrabandBatch = (batch: Batch): boolean => {
  if (batch.contraband !== undefined) return batch.contraband;
  return (batch.inputIngredientIds ?? []).some(
    id => INGREDIENTS.find(i => i.id === id)?.contraband === true
  );
};

/** What a fence sees in a batch: funk, hazard and potency. Roughly 18-150. */
export const getContrabandValue = (batch: Batch): number => {
  const q = batch.quality;
  const funk = Math.min(120, q.funk) * 0.55;
  const hazard = Math.max(0, 60 - q.safety) * 0.9;      // 0 when safe, 54 when dead
  const potency = Math.max(0, q.umami + q.acidity) * 0.25;
  return 18 + funk + hazard + potency;
};

/**
 * One gate for every buyer. Licensed buyers judge on the critic score; fences
 * have their own, stricter, stranger criteria.
 */
export const buyerWillTake = (
  batch: Batch,
  recipe: Recipe,
  buyer: Buyer,
  score: number
): boolean => {
  if (buyer.type !== 'Underground') return score >= buyer.minScore;
  if (buyer.requiresContraband && !isContrabandBatch(batch)) return false;
  if (buyer.requiresIntact && batch.status === 'spoiled') return false;
  // maxSafety inverts the usual test: this fence only wants what is NOT saleable.
  if (buyer.maxSafety !== undefined && batch.quality.safety > buyer.maxSafety) return false;
  return score >= buyer.minScore;
};

/* =========================================================================
   RECIPE KNOWLEDGE — what the player knows, and how they came to know it.
   ========================================================================= */

/**
 * Three states, not two. You can know a formula without ever having run it
 * (a book), and you cannot have run it without knowing it (cooking writes both).
 */
export const getRecipeKnowledge = (
  recipeId: string,
  unlockedRecipes: string[],
  analyzedRecipeIds: string[],
  ownedBookIds: string[] = []
): RecipeKnowledge => {
  if (analyzedRecipeIds.includes(recipeId)) return 'analyzed';
  if (unlockedRecipes.includes(recipeId)) return 'known';
  // Procedural recipes carry generated ids (lacto_<sub>_gen and friends). They are
  // never written into unlockedRecipes — that array would grow one entry per
  // substrate — so the Primer unfogs the whole family at once instead.
  if (recipeId.endsWith('_gen') &&
      ownedBookIds.some(id => BOOKS.find(b => b.id === id)?.revealsProcedural)) {
    return 'known';
  }
  return 'unknown';
};

export const getMatrixEntry = (recipeId: string): MatrixEntry | undefined =>
  RECIPE_MATRIX.find(e => e.recipeId === recipeId);

/**
 * The readable form of a recipe's combination, for the book card and the Codex.
 * Reads the same table the resolver matches on, so the two cannot drift.
 */
export const describeFormula = (recipeId: string): {
  substrateLabel: string;
  addLabels: string[];
  forbidLabels: string[];
  vesselName: string;
} | null => {
  const entry = getMatrixEntry(recipeId);
  if (!entry) return null;

  const nameOf = (id: string) => INGREDIENTS.find(i => i.id === id)?.name ?? id;

  let substrateLabel: string;
  switch (entry.substrate.kind) {
    case 'is': substrateLabel = nameOf(entry.substrate.id); break;
    case 'oneOf': substrateLabel = entry.substrate.ids.map(nameOf).join(' or '); break;
    case 'includes': substrateLabel = `Any ${entry.substrate.token}`; break;
    case 'none': substrateLabel = 'No substrate'; break;
    case 'present': substrateLabel = 'Any substrate'; break;
    default: substrateLabel = 'Any substrate';
  }

  return {
    substrateLabel,
    addLabels: entry.requires.map(t => MATRIX_TOKEN_LABELS[t] ?? t),
    forbidLabels: (entry.forbids ?? []).map(t => MATRIX_TOKEN_LABELS[t] ?? t),
    vesselName: entry.vesselId
      ? (VESSELS.find(v => v.id === entry.vesselId)?.name ?? entry.vesselId)
      : 'Any vessel',
  };
};

/* =========================================================================
   ECONOMY — one source of truth for what a batch is worth.
   The offer maths used to be copy-pasted into four call sites, which meant a
   rebalance had to be made four times and the quick-harvest number could drift
   away from the number shown on the buyer cards. Everything routes through
   calculateOffer() now.
   ========================================================================= */

/**
 * Batch volume pays SUBLINEARLY. A 20L crock is worth more than a 2L jar, but
 * not ten times more — bulk trades margin for throughput instead of dominating.
 */
export const getYieldMultiplier = (yieldVolume: number): number => {
  const v = Math.max(0, yieldVolume);
  if (v <= 0) return 0;
  return Math.pow(v, YIELD_SCALING_EXPONENT);
};

/** Appetite for one ferment type, clamped to its sane range. */
export const getDemandFor = (
  type: FermentType,
  marketDemand?: Record<string, number>
): number => {
  const raw = marketDemand?.[type];
  if (raw === undefined) return 1;
  return Math.min(DEMAND_CEILING, Math.max(DEMAND_FLOOR, raw));
};

export interface OfferContext {
  score: number;
  activeStaff?: Record<StaffRoleType, boolean>;
  marketDemand?: Record<string, number>;
  /** What each buyer thinks of you. A relationship is worth money, not just tone. */
  vendorStanding?: Record<string, number>;
}

/**
 * What one buyer will pay for this batch. Returns money OR renown depending on
 * how the buyer settles up; the other field is always 0.
 */
export const calculateOffer = (
  batch: Batch,
  recipe: Recipe,
  buyer: Buyer,
  ctx: OfferContext
): { money: number; renown: number } => {
  const { score, activeStaff, marketDemand } = ctx;
  // A fence will happily buy something that scored zero — that is its entire
  // trade — so only the licensed buyers bail out here.
  if (score <= 0 && !buyer.pricesContraband) return { money: 0, renown: 0 };

  const chefMultiplier = activeStaff?.chef ? 1.15 : 1.0;
  const yieldMult = getYieldMultiplier(batch.yieldVolume || 1);
  const demand = getDemandFor(recipe.type, marketDemand);
  // A buyer who knows you pays over the odds, and that is the return on the
  // relationship. Fences are excluded deliberately — the underground does not
  // do loyalty, which is part of what makes it the underground.
  const standingBonus = buyer.pricesContraband
    ? 1
    : 1 + standingTier(ctx.vendorStanding?.[buyer.id] ?? 0).priceBonus;

  if (buyer.paysIn === 'renown') {
    // Reputation buyers care about the piece, not the poundage — volume gives
    // only a gentle bump so bulk cannot buy prestige.
    const renown = Math.floor(
      (score / 5) * buyer.priceMultiplier * standingBonus * Math.min(1.5, Math.sqrt(yieldMult))
    );
    return { money: 0, renown: Math.max(0, renown) };
  }

  // Fences price on what they can actually shift, not on the critic score, and
  // they are deliberately outside marketDemand in both directions — which makes
  // the underground the release valve for a glutted legitimate market.
  if (buyer.pricesContraband) {
    const fenceMoney = Math.floor(
      getContrabandValue(batch) * yieldMult * buyer.priceMultiplier * chefMultiplier
    );
    return { money: Math.max(0, fenceMoney), renown: 0 };
  }

  // Age commands a price of its own, on top of what it does to the score.
  const ageMult = 1 + AGEING_VALUE_BONUS * getMaturity(batch, recipe);

  const money = Math.floor(
    50 * recipe.difficulty * (score / 50) * yieldMult * buyer.priceMultiplier * standingBonus * chefMultiplier * demand * ageMult
  );
  return { money: Math.max(0, money), renown: 0 };
};

/**
 * The wholesale floor: what you get for dumping a batch without courting a
 * buyer. Deliberately worse than any real offer, and worth nothing if the batch
 * genuinely failed.
 */
export const calculateWholesale = (
  batch: Batch,
  recipe: Recipe,
  ctx: OfferContext
): number => {
  if (ctx.score <= 0) return 0;
  const chefMultiplier = ctx.activeStaff?.chef ? 1.15 : 1.0;
  const yieldMult = getYieldMultiplier(batch.yieldVolume || 1);
  const demand = getDemandFor(recipe.type, ctx.marketDemand);
  return Math.max(
    5,
    Math.floor(40 * recipe.difficulty * (ctx.score / 50) * yieldMult * chefMultiplier * demand)
  );
};

/** Best money and best renown available across every interested buyer. */
export const getBestOffer = (
  batch: Batch,
  recipe: Recipe,
  ctx: OfferContext,
  renownLevel: number
): { money: number; renown: number; buyerName: string } => {
  const buyers = getInterestedBuyers(batch, recipe, ctx.score, renownLevel);
  let money = calculateWholesale(batch, recipe, ctx);
  let renown = 0;
  let buyerName = 'Metropolitan Culinary Co-op';

  for (const buyer of buyers) {
    if (!buyerWillTake(batch, recipe, buyer, ctx.score)) continue;
    const offer = calculateOffer(batch, recipe, buyer, ctx);
    if (offer.money > money) { money = offer.money; buyerName = buyer.name; }
    if (offer.renown > renown) { renown = offer.renown; }
  }
  return { money, renown, buyerName };
};

/** How far one sale depresses appetite for that ferment type. */
export const getDemandHitForSale = (batch: Batch): number =>
  DEMAND_DROP_PER_YIELD * getYieldMultiplier(batch.yieldVolume || 1);

/** Weekly appetite recovery, drifting every type back toward normal. */
export const recoverDemand = (
  marketDemand: Record<string, number>
): Record<string, number> => {
  const next: Record<string, number> = {};
  for (const key of Object.keys(marketDemand)) {
    const current = marketDemand[key];
    const drifted = current < 1
      ? Math.min(1, current + DEMAND_RECOVERY_PER_WEEK)
      : Math.max(1, current - DEMAND_RECOVERY_PER_WEEK * 0.5);
    next[key] = Math.min(DEMAND_CEILING, Math.max(DEMAND_FLOOR, drifted));
  }
  return next;
};

export interface Overheads {
  rent: number;
  upkeep: number;
  utilities: number;
  wages: number;
  total: number;
}

/** Everything the lab owes at the end of a week. */
export const calculateOverheads = (
  ownedVessels: Record<string, number>,
  currentPower: number,
  wages: number
): Overheads => {
  const rent = WEEKLY_BENCH_RENT;
  // Litres, not pots. See FREE_UPKEEP_LITRES for why counting vessels stopped
  // working once a batch could be scaled to fill whatever it was in.
  const totalLitres = Object.entries(ownedVessels).reduce(
    (acc, [id, n]) => acc + (VESSELS.find(v => v.id === id)?.capacityL ?? 0) * n,
    0
  );
  const billableLitres = Math.max(0, totalLitres - FREE_UPKEEP_LITRES);
  const upkeep = Math.round(billableLitres * WEEKLY_UPKEEP_PER_LITRE);
  const utilities = Math.round(currentPower * UTILITY_COST_PER_WATT);
  return { rent, upkeep, utilities, wages, total: rent + upkeep + utilities + wages };
};


/* ===========================================================================
   ORGANOLEPTIC NOTES

   The panel was headed "Organoleptic Tasting Notes" and printed process
   diagnostics: fixed strings, all caps, one per broken rule — "CHEMISTRY: High
   protein substrate failed to yield Umami." Nothing in it described how the
   thing tasted, two rules fired on the same fault so the list repeated itself,
   and the same batch produced the same sentence every time because the sentence
   never depended on more than one number.

   These are notes. They read the whole state — where it landed against its
   target, how far it got, what is on its surface, how evenly it ran, and what it
   was made of — and describe the result. Diagnostics still exist; they are now
   somewhere else, under a heading that admits what they are.

   Variation is deterministic, seeded off the batch id: the same jar always reads
   the same, two jars never read alike. It must not be Math.random — this is
   called during render, and StrictMode would give two different answers.
   =========================================================================== */

export interface TastingNote {
  facet: 'Colour' | 'Aroma' | 'Palate' | 'Texture' | 'Finish';
  text: string;
}

const noteHash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const pickFrom = <T,>(arr: T[], seed: string): T => arr[noteHash(seed) % arr.length];

/** Clauses into one sentence: capitalised, Oxford-less, single full stop. */
const sentence = (parts: string[]): string => {
  // Clauses are written to stand alone, but some carry a leading conjunction
  // from when they were concatenated by hand — strip it, or the join produces
  // "wild and and a flat, yeasty note".
  const clean = parts.map(p => p.trim().replace(/^(and|with)\s+/i, '')).filter(Boolean);
  if (!clean.length) return '';
  // Comma-joined, the way tasting notes are actually written. An " and " before
  // the last clause fought the "and"s already inside the clauses themselves.
  const joined = clean.join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1).replace(/\.?$/, '.');
};

/** House vocabulary per family. Real terms of art, not adjectives at random. */
const FAMILY_COLOUR: Partial<Record<FermentType, string[]>> = {
  [FermentType.GARUM]: ['a clear amber', 'the colour of weak tea', 'a deep russet'],
  [FermentType.SHOYU]: ['near-black with a red edge', 'dark mahogany', 'black until you tilt it'],
  [FermentType.MISO]: ['a warm ochre', 'the brown of wet clay', 'pale straw shot with darker flecks'],
  [FermentType.KOJI]: ['bloomed white, close to the grain', 'a dense white felt', 'white going faintly green at the edges'],
  [FermentType.VINEGAR]: ['bright and slightly hazy', 'clear gold', 'cloudy, with the mother suspended'],
  [FermentType.LACTO]: ['dulled from raw, brine gone milky', 'olive-drab, as it should be', 'still bright under a cloudy brine'],
  [FermentType.BLACK]: ['gone entirely black, glossy', 'black and slightly tacky', 'jet, with a bloom of sugar on the cut'],
};

export const generateTastingNotes = (batch: Batch, recipe: Recipe): TastingNote[] => {
  const q = batch.quality;
  const t = recipe.idealFlavorProfile;
  const id = batch.id || recipe.id;
  const notes: TastingNote[] = [];

  const ings = batch.inputIngredientIds
    .map(i => INGREDIENTS.find(x => x.id === i))
    .filter(Boolean) as Ingredient[];
  const sub = ings.find(i => i.type === IngredientType.SUBSTRATE);
  const fatty = (sub?.hiddenStats.fatContent ?? 0) > 4;
  const proteinous = (sub?.hiddenStats.proteinContent ?? 0) > 5;

  const film = batch.surfaceFilm ?? 0;
  const rancid = batch.rancidity ?? 0;
  const even = batch.evenness ?? 100;
  const under = batch.progress < recipe.peakWindowStart;
  const over = batch.progress > recipe.peakWindowEnd + 20;
  const spoiled = batch.status === 'spoiled' || q.safety < 60;

  // How far each axis landed from where this recipe wanted it, so the notes talk
  // about THIS ferment rather than about high or low numbers in the abstract.
  const rel = (actual: number, target: number) => target <= 0 ? 0 : actual / target;

  /* --- COLOUR ------------------------------------------------------------ */
  const baseColour = FAMILY_COLOUR[recipe.type];
  if (spoiled) {
    notes.push({ facet: 'Colour', text: pickFrom([
      'Grey at the edges and weeping. Whatever this was, it is not that now.',
      'Dull, separated, with a slick on top. It has gone over.',
    ], id + 'col') });
  } else if (baseColour) {
    let text = `Pours ${pickFrom(baseColour, id + 'col')}`;
    if (recipe.type === FermentType.KOJI) text = `Comes up ${pickFrom(baseColour, id + 'col')}`;
    if (under) text += ', paler than it should be for the age';
    else if (over) text += ', darker than the window wanted';
    if (film > 40 && !filmIsTheCulture(recipe)) text += ', with a skin you can lift off in one piece';
    notes.push({ facet: 'Colour', text: text + '.' });
  }

  /* --- AROMA ------------------------------------------------------------- */
  const aromaParts: string[] = [];
  if (q.funk > 70) aromaParts.push(pickFrom(['barnyard and ripe', 'high, cheesy, insistent', 'pungent enough to carry across the room'], id + 'a1'));
  else if (q.funk > 40) aromaParts.push(pickFrom(['savoury and a little wild', 'ripe without tipping over', 'earthy, mushroomy'], id + 'a1'));
  else if (q.funk > 15) aromaParts.push(pickFrom(['quiet, mostly clean', 'restrained', 'faintly savoury'], id + 'a1'));
  else aromaParts.push(pickFrom(['almost neutral', 'clean to the point of shy', 'barely there'], id + 'a1'));

  if (recipe.type === FermentType.KOJI) {
    aromaParts.push(q.sweetness > 60
      ? pickFrom(['sweet chestnut and steamed rice', 'melon and cut hay'], id + 'a2')
      : pickFrom(['damp cellar rather than chestnut', 'grainy, not yet sweet'], id + 'a2'));
  } else if (proteinous && q.umami > 60) {
    aromaParts.push(pickFrom(['deep anchovy underneath', 'a marine, brothy depth', 'cured-meat sweetness behind it'], id + 'a2'));
  }
  if (rancid > 30) {
    aromaParts.push(pickFrom(['and over it all the crayon-and-old-oil note of fat that has turned', 'with rancid fat sitting on top of everything else'], id + 'a3'));
  } else if (rancid > 10) {
    aromaParts.push(pickFrom(['with the first hint of oxidised oil', 'and a faint waxiness that was not there a month ago'], id + 'a3'));
  } else if (film > 55 && !filmIsTheCulture(recipe)) {
    aromaParts.push(pickFrom(['and a flat, yeasty note off the surface that should have been skimmed', 'with a stale top note — that is the film talking'], id + 'a3'));
  }
  if (recipe.type === FermentType.VINEGAR && q.acidity > 80) {
    aromaParts.push(pickFrom(['sharp enough to catch the back of the nose', 'acetic, right at the edge of solvent'], id + 'a3'));
  }
  notes.push({ facet: 'Aroma', text: sentence(aromaParts) });

  /* --- PALATE ------------------------------------------------------------ */
  const umamiRel = rel(q.umami, t.umami);
  const sweetRel = rel(q.sweetness, t.sweetness);
  const acidRel = rel(q.acidity, t.acidity);
  const palate: string[] = [];

  // Only speak to an axis the style actually cares about. Reading "sweeter than
  // intended" off a garum whose sweetness target is 5 is arithmetic, not tasting
  // — every batch trips it, which is exactly what made the panel feel canned.
  const MATTERS = 20;
  // Weighted, then cut to the two loudest. A batch that misses on all four axes
  // was reporting all four in one sentence — "thin where the protein should have
  // shown — the enzymes never got at it, short on sweetness — the starch never
  // really turned, flat, wanting acid, salt over everything" — which is a fault
  // list wearing a note's clothes. A taster says the two things that dominate.
  const weighed: { w: number; text: string }[] = [];
  if (t.umami >= MATTERS) {
    weighed.push({
      w: Math.abs(umamiRel - 1) + 0.35, // umami leads in almost every family here
      text: umamiRel > 1.1 ? 'savour well past what the style asks for'
        : umamiRel > 0.85 ? 'savoury right through, where it should be'
        : umamiRel > 0.55 ? 'savoury, but it stops short'
        : proteinous ? 'thin where the protein should have shown — the enzymes never got at it'
        : 'thin, with little here to make savour from',
    });
  }
  if (t.sweetness >= MATTERS && Math.abs(sweetRel - 1) > 0.25) {
    weighed.push({ w: Math.abs(sweetRel - 1),
      text: sweetRel > 1 ? 'sweeter than the style wants' : 'short on sweetness — the starch never turned' });
  }
  if (t.acidity >= MATTERS && Math.abs(acidRel - 1) > 0.25) {
    weighed.push({ w: Math.abs(acidRel - 1),
      text: acidRel > 1 ? 'sharp over the top of it' : 'flat, wanting acid' });
  }
  if (batch.params.salinity > 18) weighed.push({ w: 1.2, text: 'salt over everything — it needs cutting to be usable' });
  else if (batch.params.salinity < 5 && recipe.type !== FermentType.KOJI) weighed.push({ w: 0.5, text: 'under-seasoned for what it is' });

  // At most one clause carrying an em-dash aside. Two of them in one sentence
  // ("salt over everything — it needs cutting, short on sweetness — the starch
  // never turned") reads as two sentences jammed together.
  const ranked = weighed.sort((a, b) => b.w - a.w);
  let usedAside = false;
  for (const c of ranked) {
    if (palate.length >= 2) break;
    const aside = c.text.includes('—');
    if (aside && usedAside) continue;
    if (aside) usedAside = true;
    palate.push(c.text);
  }
  if (!palate.length) palate.push(spoiled ? 'nothing you would willingly put in your mouth' : 'balanced, with nothing pushing forward');
  notes.push({ facet: 'Palate', text: sentence(palate) });

  /* --- TEXTURE ----------------------------------------------------------- */
  const texture: string[] = [];
  if (batch.isPressed) texture.push('Pressed clear of its solids');
  if (batch.isFiltered) texture.push('Spun bright');
  if (rancid > 45) texture.push('a rancid slick right through it — the fat turned under the film and stayed');
  else if (rancid > 15) texture.push('an oily edge where the surface was left too long');
  else if (fatty && batch.params.temp > 30 && batch.params.salinity >= 12) texture.push('rich and viscous where the fat has rendered in');
  if (recipe.type === FermentType.KOJI) texture.push(batch.surfaceWater && batch.surfaceWater > 70 ? 'the bed sodden and matted' : 'the grain still separate under the bloom');
  if (texture.length) notes.push({ facet: 'Texture', text: sentence(texture) });

  /* --- FINISH ------------------------------------------------------------ */
  let finish: string;
  if (even < 60 && isAgitatedFerment(recipe)) {
    finish = pickFrom([
      'Different from one spoonful to the next — it never ran as one thing, and the jar tastes like an average of several.',
      'Uneven. The top and the bottom are two different ferments and you can taste the seam.',
    ], id + 'f');
  } else if (under) {
    finish = 'Short. It was pulled before it had finished saying anything.';
  } else if (over) {
    finish = 'Long but tired — the edges have gone soft and the top notes have burned off.';
  } else if (rancid > 25) {
    finish = 'It turns oily at the end and stays there. Rancidity does not fade — the fat oxidised and that is permanent.';
  } else if (q.safety < 90) {
    finish = 'A faint off-note on the back of the tongue that will not leave.';
  } else if (umamiRel > 0.85 && q.safety >= 95) {
    finish = pickFrom([
      'Holds for a long time after swallowing. This is the one.',
      'Long, clean, and it keeps developing after it has gone. Nothing to fix here.',
    ], id + 'f');
  } else {
    finish = 'Clean, and it fades quickly.';
  }
  notes.push({ facet: 'Finish', text: finish });

  return notes;
};

// NEW: Detailed Feedback System
export const generateCriticFeedback = (batch: Batch, recipe: Recipe): string[] => {
    const feedback: string[] = [];
    const q = batch.quality;
    const t = recipe.idealFlavorProfile;
    
    // Resolve ingredients for deep analysis
    const batchIngredients = batch.inputIngredientIds.map(id => INGREDIENTS.find(i => i.id === id)).filter(Boolean) as Ingredient[];
    const sub = batchIngredients.find(i => i.type === IngredientType.SUBSTRATE);

    // --- 1. MACRONUTRIENT & LOGIC FEEDBACK ---
    if (sub) {
        // Protein -> Umami
        if (sub.hiddenStats.proteinContent > 5 && q.umami < 60) {
            feedback.push("CHEMISTRY: High protein substrate failed to yield Umami. Ensure Protease (Koji) activity is sufficient.");
        }
        // Starch -> Sweetness
        if (sub.hiddenStats.sugarContent > 5 && q.sweetness < 50 && recipe.type !== FermentType.ALCOHOL) {
            feedback.push("CHEMISTRY: Starch conversion incomplete. Amylase needed more time or better temperature.");
        }
        // Fat -> Rancidity
        if (sub.hiddenStats.fatContent > 4) {
            const r = batch.rancidity ?? 0;
            if (r > 25) {
                 feedback.push(`SPOILAGE: ${r.toFixed(0)}% of the fat oxidised under an unskimmed surface. A fatty substrate skins over roughly twice as fast — skim it, seal it, or carry more salt.`);
            } else if (r > 5) {
                 feedback.push("SPOILAGE: The fat has started to turn at the surface. Skimming takes the oxidised layer off with the film.");
            } else if (batch.params.temp > 30 && batch.params.salinity >= 12) {
                 feedback.push("TEXTURE: High heat and salt rendered fat into rich viscosity.");
            }
        }
    }

    // --- 2. VESSEL LOGIC FEEDBACK ---
    if (recipe.type === FermentType.KOJI && batch.vesselId === 'incubator') {
        feedback.push("EQUIPMENT FAULT: Incubators provide too much insulation for Koji. The metabolic heat trapped inside killed the mold.");
    }
    if (recipe.type === FermentType.GARUM && batch.vesselId === 'koji_tray') {
        feedback.push("EQUIPMENT FAULT: Trays possess too much surface area. Garum requires heat retention (Incubator/Cask) for autolysis.");
    }

    // --- 3. RECIPE SPECIFIC MECHANICS FEEDBACK ---
    
    // Bottarga
    if (recipe.id === 'bottarga') {
        if (batch.params.humidity > 40) {
            feedback.push("CRITICAL: Texture is mushy. The environment was too humid for curing.");
        } else if (q.umami > 80) {
            feedback.push("Excellent waxy texture. Perfect humidity control.");
        }
    }

    // Bagoong
    if (recipe.id === 'bagoong') {
        if (!batch.flags?.isLidPropped) {
            feedback.push("APPEARANCE: Grey and lifeless. This paste requires Oxygen (Open Lid) to turn pink.");
        } else {
            feedback.push("APPEARANCE: Vibrant pink. Good oxidation.");
        }
    }

    // Cheong
    if (recipe.id === 'cheong') {
        if (q.funk > 20) {
            feedback.push("OFF-FLAVOR: Alcoholic notes detected. Wild yeast contamination due to low hygiene.");
        }
    }

    // Gochujang
    if (recipe.id === 'gochujang') {
        if (q.sweetness < 50 && q.funk > 30) {
            feedback.push("FAULT: Starch converted to Alcohol. Fermentation temperature was too high.");
        }
    }

    // Casu Marzu
    if (recipe.id === 'casu_marzu') {
        if (batch.progress < 50) {
            feedback.push("FAILURE: The culture died out. The lab might be too clean for this specific 'delicacy'.");
        } else {
            feedback.push("WARNING: Extremely bioactive. Handling requires caution.");
        }
    }

    // Colatura
    if (recipe.id === 'colatura') {
        if (batch.progress < 100) {
            feedback.push("NOTE: Lacks depth. Colatura requires extreme patience.");
        }
    }

    // Black Apple
    if (recipe.id === 'black_apple') {
        if (batch.params.humidity < 70) {
            feedback.push("TEXTURE: Dried out. Needs higher humidity for the Maillard reaction to keep it moist.");
        }
    }

    // --- 4. GENERAL FEEDBACK ---

    // 1. SAFETY
    if (q.safety < 60) feedback.push("CRITICAL: Contamination detected. Unsafe for consumption.");
    else if (q.safety < 90) feedback.push("Warning: Slight off-flavors detected. Check hygiene.");

    // 2. PROGRESS
    if (batch.progress < recipe.peakWindowStart) feedback.push("Under-developed. Fermentation stopped too early.");
    else if (batch.progress > recipe.peakWindowEnd + 20) feedback.push("Over-fermented. Texture is degrading.");

    // 3. FLAVOR BALANCE (Simple Delta)
    if (t.umami > 0) {
        if (q.umami < t.umami * 0.7) feedback.push("ADVICE: Lacks savory depth (Umami). Needs more time or protein.");
    }
    if (t.sweetness > 0) {
        if (q.sweetness < t.sweetness * 0.7) feedback.push("ADVICE: Not sweet enough. Sugar conversion was inefficient.");
    }
    if (t.funk > 0) {
        if (q.funk < t.funk * 0.5) feedback.push("ADVICE: Too clean. Lacks the characteristic 'funk'.");
        if (q.funk > t.funk * 1.5) feedback.push("ADVICE: Aroma is overpowering/pungent.");
    }

    // 4. KOJI SPECIFIC
    if (recipe.type === FermentType.KOJI) {
        feedback.push("NOTE: Koji is an enzymatic starter. Evaluated on amylase/protease potential, not flavor balance.");
        
        if (batch.stress > 20) feedback.push("ADVICE: Metabolic heat spiked. Mix trays more frequently to cool down.");
        if (batch.params.humidity < 60) feedback.push("ADVICE: Spores dried out. Keep lid closed or mist to retain moisture.");
        if (batch.params.temp < 25) feedback.push("ADVICE: Temperature too low. Mold went dormant.");
    }

    // Two rules fired on the same fault: the substrate rule ("High protein
    // substrate failed to yield Umami") and the balance rule ("Lacks savory
    // depth"), so a low-umami garum reported its one problem twice — which is
    // what made the panel read as canned. The specific note wins; the generic
    // one only speaks when nothing more precise did.
    const saidUmami = feedback.some(f => f.includes('Umami') || f.includes('savory depth'));
    const deduped = feedback.filter((f, i) =>
      feedback.indexOf(f) === i &&
      !(saidUmami && f === "ADVICE: Lacks savory depth (Umami). Needs more time or protein."
        && feedback.some(g => g.startsWith('CHEMISTRY: High protein')))
    );

    if (deduped.length === 0) deduped.push("Nothing to fault in the process.");

    return deduped;
}


import { Batch, Recipe, FermentType, Ingredient, Vessel, HiddenStats, FlavorProfile, IngredientType, Buyer, StaffRoleType, WeatherState, MatrixSubstrate, MatrixEntry, RecipeKnowledge, TelemetrySample } from '../types';
import { advanceEnzymes, getBatchEnzymes, getAcidProtection, isKojiRecipe } from './koji';
import {
  RECIPES, VESSELS, BUYERS, INGREDIENTS, RECIPE_MATRIX, MATRIX_TOKEN_LABELS, BOOKS,
  getUndergroundTierFromXp,
  YIELD_SCALING_EXPONENT, WEEKLY_BENCH_RENT, WEEKLY_VESSEL_UPKEEP, FREE_UPKEEP_VESSELS,
  UTILITY_COST_PER_WATT, DEMAND_FLOOR, DEMAND_CEILING, DEMAND_DROP_PER_YIELD, DEMAND_RECOVERY_PER_WEEK,
  AGEING_BY_TYPE, AGEING_MAX_PROGRESS, AGEING_PEAK_BONUS, AGEING_VALUE_BONUS, CELLAR_TICK_DIVISOR
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
              idealParams: { temp: 60, humidity: 50, salinity: 9 },
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
export const applyBatchIntervention = (
    batch: Batch, 
    action: string, 
    ambientTemp: number,
    recipe?: Recipe
): Batch => {
    const newParams = { ...batch.params };
    const messages = [...batch.messages];
    const flags = { ...(batch.flags || { isLidPropped: false }) };
    let quality = { ...batch.quality };
    let enzymes = batch.enzymes ? { ...batch.enzymes } : undefined;
    let stress = batch.stress ?? 0;

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
            // Keeps the surface from setting and the solids from packing down.
            // Only really matters for the ferments that ask for it.
            disturbance = 2;
            if (onPoint) {
                quality.umami += 2.5;
                quality.safety = Math.min(100, quality.safety + 2);
                messages.push('Stirred through. This one wants the movement.');
            } else {
                quality.umami += 0.4;
                messages.push('Stirred. Little to gain here.');
            }
            break;
        }

        case 'Skim': {
            // Pulling the film off a garum. Meaningful when something has
            // actually formed on top — i.e. when safety has started to slip.
            disturbance = 2;
            const slipping = quality.safety < 92;
            if (onPoint && slipping) {
                quality.safety = Math.min(100, quality.safety + 7);
                quality.funk = Math.max(0, quality.funk - 2);
                messages.push('Skimmed the film. That was about to turn.');
            } else if (slipping) {
                quality.safety = Math.min(100, quality.safety + 3);
                messages.push('Skimmed.');
            } else {
                messages.push('Nothing on the surface worth skimming.');
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
        stress, 
        quality: quality,
        flags: flags,
        messages: messages.slice(-5),
        disturbanceTimer: (batch.disturbanceTimer || 0) + disturbance 
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
    isPowerAvailable: boolean = true
): Batch => {
  const newParams = { ...batch.params };
  const newQuality = { ...batch.quality };
  let messages = [...batch.messages];
  let progress = batch.progress;
  let status = batch.status;
  let stress = batch.stress || 0;
  let disturbanceTimer = batch.disturbanceTimer || 0;
  let enzymes = batch.enzymes;
  const flags = batch.flags || { isLidPropped: false };
  let lineageDamaged = batch.lineageDamaged;

  // Pass custom quantities if they exist on the batch
  const { speedModifier, concentration, totalMass } = calculateBatchDynamics(ingredients, batch.ingredientQuantities);
  const vessel = VESSELS.find(v => v.id === batch.vesselId) || VESSELS[0];
  
  const generation = batch.generation || 1;
  const genBonus = Math.min(10, generation - 1);
  const genSpeedBuff = 1 + (genBonus * 0.05); 
  const resilienceBuffer = genBonus * 5; 

  const isKoji = recipe.type === FermentType.KOJI;
  const isIncubated = batch.vesselId === 'incubator';
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
      
      // Cooling Logic
      let coolingFactor = 0.02 * (1 - vessel.insulationFactor); 
      
      if (flags.isLidPropped) {
          coolingFactor = 0.3; // Lid Open = Very High Cooling (Decisive)
      } else {
          coolingFactor *= 0.55; // Lid closed still traps, but not hermetically
      }
      
      // Convection Fan
      if ((inventory['portable_fan'] || 0) > 0) coolingFactor += 0.05;
      
      const ambientDelta = newParams.temp - ambientTemp;
      const coolingLoss = ambientDelta * coolingFactor;

      // Net change is divided by the large THERMAL_MASS_FACTOR
      const netTempChange = (selfGeneratedHeat - coolingLoss) / (THERMAL_MASS_FACTOR / 10);
      newParams.temp += netTempChange;

      // 3. HUMIDITY PHYSICS
      let moistureLoss = 0.005; 
      if (flags.isLidPropped) {
          moistureLoss = 0.2; // Open lid dries very fast
      } else {
          moistureLoss = 0.001; // Closed lid retains almost everything
      }

      if (newParams.temp > 35) moistureLoss += 0.02; // Sweating
      
      // Humidifier mitigation
      if ((inventory['humidifier'] || 0) > 0 && newParams.humidity < recipe.idealParams.humidity) {
          moistureLoss -= 0.05; 
      }
      
      newParams.humidity = Math.max(0, newParams.humidity - moistureLoss);

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
              targetTemp = recipe.idealParams.temp;
              heatingPower = 2.0; // Incubator active heating
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

      // Airflow and misting only worked inside the koji branch, so a cure like
      // bottarga — which rots above 40% RH — had no counterplay at all in a humid
      // month. The tools now work in the standard model too, which is the whole
      // reason to own them.
      if ((inventory['portable_fan'] || 0) > 0) {
          newParams.humidity = Math.max(0, newParams.humidity - 0.35);
      }
      if ((inventory['humidifier'] || 0) > 0 && newParams.humidity < recipe.idealParams.humidity) {
          newParams.humidity = Math.min(100, newParams.humidity + 0.3);
      }

      // 3. Temperature-Dependent Progress
      if (newParams.temp > 10 && newParams.temp < 65) {
           const tempOptimality = 1 - (Math.abs(newParams.temp - recipe.idealParams.temp) / 50);
           progress += (100 / recipe.baseDurationSeconds) * speedModifier * genSpeedBuff * Math.max(0.1, tempOptimality);
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
          const heatIsCarryingIt = newParams.temp >= 55;
          if (!heatIsCarryingIt) safetyDecay += 2;
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
  } else {
    // Everything else declines past the window: koji sporulates and turns
    // bitter, a lacto pickle softens and over-sours.
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
    stress: Math.max(0, stress),
    disturbanceTimer: disturbanceTimer,
    flags: flags
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
  
  return Math.floor(Math.min(qualityCap, score));
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

  return {
    umami: h.proteinContent * 11 * c * proteolysis,
    funk: h.microbialDiversity * 9 * c,
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
    reputation: number = 0
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
        if (reputation < b.minReputation) return false;
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

  if (buyer.paysIn === 'renown') {
    // Reputation buyers care about the piece, not the poundage — volume gives
    // only a gentle bump so bulk cannot buy prestige.
    const renown = Math.floor(
      (score / 5) * buyer.priceMultiplier * Math.min(1.5, Math.sqrt(yieldMult))
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
    50 * recipe.difficulty * (score / 50) * yieldMult * buyer.priceMultiplier * chefMultiplier * demand * ageMult
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
  ownedVesselIds: string[],
  currentPower: number,
  wages: number
): Overheads => {
  const rent = WEEKLY_BENCH_RENT;
  const billableVessels = Math.max(0, ownedVesselIds.length - FREE_UPKEEP_VESSELS);
  const upkeep = billableVessels * WEEKLY_VESSEL_UPKEEP;
  const utilities = Math.round(currentPower * UTILITY_COST_PER_WATT);
  return { rent, upkeep, utilities, wages, total: rent + upkeep + utilities + wages };
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
            if (batch.params.temp > 30 && batch.params.salinity < 12) {
                 feedback.push("SPOILAGE: Fatty acids oxidized (Rancid). High fat ingredients need >12% Salt if heated.");
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

    if (feedback.length === 0) feedback.push("Chef's Kiss. A perfect specimen.");
    
    return feedback;
}

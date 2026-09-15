import React, { useState, useEffect, useMemo } from 'react';
import GameIcon from './GameIcon';
import PanelMark from './PanelMark';
import { Ingredient, IngredientType, Batch, Vessel, Recipe, LogEntry, FermentType, RecipeMastery } from '../types';
import { VESSELS, MAX_REAGENT_UNITS, HYDRATION_TARGETS, DEFAULT_HYDRATION, MAX_HYDRATION , KOJI_INOCULATION_TEMP } from '../constants';
import VesselArt from './VesselArt';
import { resolveRecipeFromMatrix, generateInitialQuality, getInitialParamsFromTerroir, calculateBatchDynamics, getYieldMultiplier } from '../services/gameLogic';
import { getMastery, getMasteryLadder, xpToNextLevel } from '../services/mastery';
import IngredientIcon from './IngredientIcon';
import { getRecipeKnowledge, describeFormula, getFlavorPotential } from '../services/gameLogic';
import { getBatchEnzymes, describeEnzymes, kojiDevelopment, strainAmylaseBias } from '../services/koji';
import RecipeCard from './RecipeCard';
import MolecularScan, { ScanTarget } from './MolecularScan';
import { Play, Info, Skull, Minus, Scale, Thermometer, ChevronRight, AlertTriangle, Lock, Lightbulb, Activity } from 'lucide-react';
import { SporeClusterIcon, BookIcon, CloseIcon, SearchIcon, PlusIcon, JarOutlineIcon, JarLineIcon, BoltIcon, CheckCircleIcon, WaterDropIcon, SaltCrystalIcon, VesselLineIcon, getIngredientIcon } from './icons';

interface BatchControllerProps {
  onClose: () => void;
  inventory: Record<string, number>;
  onStartBatch: (batch: Batch, cost: Ingredient[], deductionMap?: Record<string, number>) => void;
  ingredients: Ingredient[];
  currentPower: number;
  maxPower: number;
  availableSlots: number;
  logbook: LogEntry[];
  ownedVessels: Record<string, number>;
  analyzedRecipeIds: string[];
  recipeMastery: Record<string, RecipeMastery>;
  unlockedRecipes?: string[];
  ownedBookIds?: string[];
}

type HoveredItem = ScanTarget | null;
type StepTab = 'pantry' | 'bowl' | 'vessel' | 'run';

const BatchController: React.FC<BatchControllerProps> = ({ 
  onClose, 
  inventory, 
  onStartBatch, 
  ingredients, 
  currentPower, 
  maxPower, 
  availableSlots, 
  logbook, 
  ownedVessels, 
  analyzedRecipeIds,
  recipeMastery,
  unlockedRecipes = [],
  ownedBookIds = []
}) => {
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  const [vesselId, setVesselId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<StepTab>('pantry');
  /**
   * Which picker is open over the bench, on anything wider than a phone.
   *
   * Four stations abreast could not work at either end of the range: at 720px
   * tall they were 299px against station 04's 373px of content, and at 1920x1080
   * they became 330px columns stretched to 711px holding about 300px each —
   * strung out rather than cramped, which is why more screen made it worse.
   *
   * The chamber and the seal controls are the work surface and stay put. Drawing
   * reagents and choosing a vessel are things you do once and close, so they are
   * overlays now and get the whole width while they are open.
   */
  const [picker, setPicker] = useState<'pantry' | 'vessel' | null>(null);
  useEffect(() => {
    if (!picker) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicker(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picker]);
  const [pantrySearch, setPantrySearch] = useState('');
  const [pantryCategory, setPantryCategory] = useState<string>('all');
  // Large vessels take dozens of units; adding them one click at a time is absurd.
  const [addStep, setAddStep] = useState<number>(1);

  // UI State
  const [hoveredItem, setHoveredItem] = useState<HoveredItem>(null);
  // Pinning exists so two ingredients can be held side by side. The scan was
  // hover-only and transient, which made comparing anything impossible — and
  // comparison is exactly what the composition data invites.
  const [pinnedItem, setPinnedItem] = useState<HoveredItem>(null);
  const [showVintageLoader, setShowVintageLoader] = useState(false);
  // Guidance lives on the recipe card, not stacked on top of the Seal button.
  const [showCard, setShowCard] = useState(false);

  // Preview State
  const [projectedRecipeName, setProjectedRecipeName] = useState<string>('Empty Vessel');
  const [resolvedRecipe, setResolvedRecipe] = useState<Recipe | null>(null);
  const [isBioSludge, setIsBioSludge] = useState(false);
  const [isUndiscovered, setIsUndiscovered] = useState(false);
  
  // Dynamics State
  const [dynamics, setDynamics] = useState({ yieldVolume: 0, concentration: 0, speedModifier: 1, totalMass: 0 });

  // Inoculation Parameters
  const [temp, setTemp] = useState(20);
  const [humidity, setHumidity] = useState(50);
  const [salinity, setSalinity] = useState(0);
  // Water is titrated as a % of solids mass, exactly as salt is, instead of being
  // dropped in as fixed 1L blocks that silently ate vessel capacity.
  const [hydration, setHydration] = useState(DEFAULT_HYDRATION);
  // Cleared once the player moves the dial, so the recipe's suggested mash never
  // overwrites a deliberate choice.
  const [hydrationTouched, setHydrationTouched] = useState(false);
  // Grams per reagent, keyed by id. Salt and water were already titrated
  // continuously while every other reagent came in fixed 1kg blocks — which made
  // the 2L Glass Jar hold exactly two of anything, and unusable once salt was
  // added on top. Everything is dialable now.
  const [reagentGrams, setReagentGrams] = useState<Record<string, number>>({});

  // Inline Notification
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Derived selected ingredients
  const selectedIngredients = useMemo(() => 
    selectedIngredientIds.map(id => ingredients.find(i => i.id === id)).filter(Boolean) as Ingredient[],
  [selectedIngredientIds, ingredients]);

  const hasSalt = useMemo(() => 
    selectedIngredients.some(i => i.id === 'salt' || i.id === 'trapani_salt'), 
  [selectedIngredients]);

  const baseSalinity = useMemo(() => {
    const sub = selectedIngredients.find(i => i.type === IngredientType.SUBSTRATE) || selectedIngredients[0];
    return sub?.hiddenStats?.nativeSalinity || 0;
  }, [selectedIngredients]);

  /** How many units of each id are drawn. Needed by everything below. */
  const unitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedIngredientIds.forEach(id => { counts[id] = (counts[id] ?? 0) + 1; });
    return counts;
  }, [selectedIngredientIds]);

  /**
   * MASS OF SOLIDS — the aggregate, summed once per ingredient.
   *
   * This reduced over `selectedIngredients`, which holds one entry per unit, and
   * added the whole of `reagentGrams[id]` each time — and `reagentGrams` is an
   * aggregate. Fifty mackerel dialled to 44.6kg therefore reported 2,230kg of
   * solids, and the salinity dial, which takes its basis from here, asked for
   * 412kg of salt to reach 18.5%.
   *
   * Summing per unique id with the aggregate is the whole fix; the per-unit
   * division happens downstream in `customQuantities`.
   */
  const solidsMass = useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    selectedIngredients.forEach(i => {
      if (i.type === IngredientType.ADDITIVE) return;
      if (seen.has(i.id)) return;
      seen.add(i.id);
      const n = Math.max(1, unitCounts[i.id] ?? 1);
      total += reagentGrams[i.id] ?? (i.mass ?? 0) * n;
    });
    return total;
  }, [selectedIngredients, unitCounts, reagentGrams]);

  const hasWater = useMemo(() =>
    selectedIngredients.some(i => i.id === 'water'),
  [selectedIngredients]);

  // Salt mass required based on salinity slider
  const requiredSaltMass = useMemo(() => {
    if (!hasSalt || solidsMass === 0) return 0;
    return solidsMass * (salinity / 100);
  }, [hasSalt, solidsMass, salinity]);

  // Water mass required based on the hydration slider. solidsMass deliberately
  // excludes every ADDITIVE, so neither the salt nor the water we are about to
  // add feeds back into its own basis.
  const requiredWaterMass = useMemo(() => {
    if (!hasWater || solidsMass === 0) return 0;
    return solidsMass * (hydration / 100);
  }, [hasWater, solidsMass, hydration]);

  /**
   * QUANTITIES — PER UNIT, NOT PER INGREDIENT.
   *
   * This is keyed by ingredient id, but `selectedIngredients` holds one entry
   * for every UNIT drawn, and `calculateBatchDynamics` sums `getMass` across all
   * of them. So whatever goes in here is applied once per copy, and everything
   * stored here has to be a per-unit figure.
   *
   * It was not. The salinity dial computed a total and stored it, so ten units
   * of salt titrated to 5% put ten lots of that total into the batch and came
   * out at 25%. The reagent slider stored the aggregate the same way, so
   * dialling 28 anchovies to 46.85kg built a batch of 1,311kg and overflowed a
   * 60L cask by twentyfold. Both were invisible until touched, because the
   * untouched fallback — the ingredient's own unit mass — happened to be the one
   * correct per-unit value in the function.
   */
  const customQuantities = useMemo(() => {
    const quantities: Record<string, number> = {};
    selectedIngredients.forEach(i => {
      const n = Math.max(1, unitCounts[i.id] ?? 1);
      if (i.id === 'salt' || i.id === 'trapani_salt') {
        quantities[i.id] = requiredSaltMass / n;
      } else if (i.id === 'water') {
        quantities[i.id] = requiredWaterMass / n;
      } else {
        // An explicit gram setting is an aggregate — what the player sees on the
        // slider — so it is divided down to what one unit contributes.
        quantities[i.id] = (reagentGrams[i.id] ?? i.mass * n) / n;
      }
    });
    return quantities;
  }, [selectedIngredients, unitCounts, requiredSaltMass, requiredWaterMass, reagentGrams]);

  /**
   * SCALE TO THE VESSEL, KEEPING THE RECIPE
   *
   * Batch value goes as mass^0.62 while ingredients cost linearly, so a
   * half-filled vessel is cheaper per gram but occupies the bench for the same
   * number of weeks — filling it is always right, which made the amount half of
   * the reagent dial a chore rather than a decision. This does the arithmetic:
   * one multiplier applied to every solid, so every ratio the player set is
   * preserved exactly.
   *
   * Salt and water fall out for free, because they are already derived as a
   * percentage of the solids rather than stored as grams. Scale the solids and
   * the salinity and hydration you chose come with them untouched.
   *
   * It scales down as readily as up, which is the answer to an overflowing
   * vessel: same recipe, less of it.
   */
  const scaleToVessel = () => {
    const target = capacityLimitL * 1000;
    const current = dynamics.totalMass;
    if (current <= 0 || target <= 0) return;
    const k = target / current;
    if (Math.abs(k - 1) < 0.005) return;

    const next: Record<string, number> = { ...reagentGrams };
    selectedIngredients.forEach(i => {
      if (i.id === 'salt' || i.id === 'trapani_salt' || i.id === 'water') return;
      const n = Math.max(1, unitCounts[i.id] ?? 1);
      // reagentGrams is the aggregate the slider shows, so the untouched
      // fallback has to be the aggregate as well — unit mass times the count.
      const grams = reagentGrams[i.id] ?? (i.mass ?? 0) * n;
      next[i.id] = Math.max(1, Math.round(grams * k));
    });
    setReagentGrams(next);
    setErrorNotice(null);
  };

  // Aggregated display
  const aggregatedIngredients = useMemo(() => {
    const map = new Map<string, { ing: Ingredient; count: number }>();
    selectedIngredientIds.forEach(id => {
      const ing = ingredients.find(i => i.id === id);
      if (!ing) return;
      if (map.has(id)) {
        map.get(id)!.count += 1;
      } else {
        map.set(id, { ing, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [selectedIngredientIds, ingredients]);

  // The vessel currently in play decides how much you can load. Before one is
  // chosen we allow up to the biggest vessel owned, then validate again on start.
  const capacityLimitL = useMemo(() => {
    if (vesselId) return VESSELS.find(v => v.id === vesselId)?.capacityL ?? 2;
    const owned = VESSELS.filter(v => (ownedVessels[v.id] ?? 0) > 0);
    return owned.length ? Math.max(...owned.map(v => v.capacityL)) : 2;
  }, [vesselId, ownedVessels]);

  // What the resolved ferment family normally wants, for the nudge line.
  const suggestedHydration = resolvedRecipe ? (HYDRATION_TARGETS[resolvedRecipe.type] ?? null) : null;

  const fillL = dynamics.totalMass / 1000;
  const fillPct = capacityLimitL > 0 ? Math.min(100, (fillL / capacityLimitL) * 100) : 0;
  const isFull = fillL >= capacityLimitL;
  // Reagents are capped on the way in, but the hydration dial can push a batch
  // past the vessel afterwards, so overflow needs its own visible state.
  const isOverflowing = fillL > capacityLimitL + 0.0001;

  // Resolve recipe & dynamics effect
  useEffect(() => {
    // Mass does not wait for a vessel. Dynamics used to stay zeroed until one was
    // chosen, so the chamber printed "0.00 / 60 L" and "Vessel fill 0%" directly
    // beside a row reading "Pearl Barley 2x 2.00kg" — the screen contradicting
    // itself. Four columns hid that; a two-column bench puts them side by side.
    //
    // Two things that were written as design and never actually worked come back
    // with it: reagents cap against the largest vessel you own before you pick
    // one (the comment on capacityLimitL says so), and the vessel list greys out
    // anything too small for what is already in the chamber.
    setDynamics(
      selectedIngredientIds.length > 0
        ? calculateBatchDynamics(selectedIngredients, customQuantities)
        : { yieldVolume: 0, concentration: 0, speedModifier: 1, totalMass: 0 }
    );

    if (selectedIngredientIds.length > 0 && vesselId) {
      const recipe = resolveRecipeFromMatrix(selectedIngredients, vesselId);
      setResolvedRecipe(recipe);
      
      // A book makes the name legible before you have ever run it — that is what
      // you paid for. Cooking it is still what reveals the flavour target.
      const isKnown = getRecipeKnowledge(recipe.id, unlockedRecipes, analyzedRecipeIds, ownedBookIds) !== 'unknown'
        || recipe.type === FermentType.FAIL;
      setIsUndiscovered(!isKnown);

      // Suggest the mash this ferment family wants, until the player overrides it.
      if (!hydrationTouched) {
        const target = HYDRATION_TARGETS[recipe.type];
        if (target !== undefined) setHydration(target);
      }

      if (recipe.type === FermentType.FAIL) {
        setProjectedRecipeName('Unstable Bio-Sludge');
      } else {
        setProjectedRecipeName(isKnown ? recipe.name : 'Unknown Reaction ???');
      }
      
      setIsBioSludge(recipe.type === FermentType.FAIL);
    } else {
      setResolvedRecipe(null);
      setProjectedRecipeName('Waiting for Inputs...');
      setIsBioSludge(false);
      setIsUndiscovered(false);
    }
  }, [selectedIngredientIds, vesselId, selectedIngredients, customQuantities, analyzedRecipeIds, unlockedRecipes, ownedBookIds, hydrationTouched]);

  /**
   * Add up to `count` units, stopping at whatever the vessel and the pantry
   * actually allow. Volume is limited by the vessel rather than by an arbitrary
   * reagent count — that flat 4-unit cap was what made every vessel above the
   * Cedar Tray pointless, since a 60L cask could never hold more than a 3L tray.
   */
  const addIngredient = (id: string, count: number = 1) => {
    const incoming = ingredients.find(i => i.id === id);
    if (!incoming) return;

    const unitMass = incoming.mass || 0;
    const inStock = getRemainingInventory(id);
    const roomByUnits = MAX_REAGENT_UNITS - selectedIngredientIds.length;
    const roomByVolume = unitMass > 0
      ? Math.floor(((capacityLimitL * 1000) - dynamics.totalMass) / unitMass)
      : roomByUnits;

    const toAdd = Math.max(0, Math.min(count, inStock, roomByUnits, roomByVolume));

    if (toAdd === 0) {
      if (inStock <= 0) {
        setErrorNotice(`No ${incoming.name} left in the pantry.`);
      } else if (roomByUnits <= 0) {
        setErrorNotice(`A single batch tops out at ${MAX_REAGENT_UNITS} reagent units.`);
      } else {
        setErrorNotice(
          vesselId
            ? `That would overflow the ${VESSELS.find(v => v.id === vesselId)?.name} (${capacityLimitL}L).`
            : `Your largest vessel holds ${capacityLimitL}L.`
        );
      }
      return;
    }

    const wasEmpty = selectedIngredientIds.length === 0;
    setSelectedIngredientIds([...selectedIngredientIds, ...Array(toAdd).fill(id)]);
    setErrorNotice(
      toAdd < count ? `Only room for ${toAdd} more — the rest wouldn't fit.` : null
    );

    // Auto-set initial temp/humidity from the first substrate added
    if (wasEmpty && incoming.type === IngredientType.SUBSTRATE) {
      const terroir = getInitialParamsFromTerroir(incoming);
      setTemp(terroir.temp);
      setHumidity(terroir.humidity);
    }
  };

  const removeOneInstance = (id: string, count: number = 1) => {
    const newIds = [...selectedIngredientIds];
    for (let n = 0; n < count; n++) {
      const index = newIds.indexOf(id);
      if (index === -1) break;
      newIds.splice(index, 1);
    }
    setSelectedIngredientIds(newIds);
    setErrorNotice(null);
  };

  const loadVintage = (entry: LogEntry) => {
    if (!entry.config) return;
    const ids: string[] = entry.config.inputIngredientIds || [];
    if (ids.length === 0) {
      if (entry.config.substrateId) ids.push(entry.config.substrateId);
      if (entry.config.starterId) ids.push(entry.config.starterId);
    }
    
    if ((ownedVessels[entry.config.vesselId] ?? 0) === 0) {
      setErrorNotice("You do not own the required vessel for this vintage recipe!");
      return;
    }
    
    setErrorNotice(null);
    setSelectedIngredientIds(ids);
    setVesselId(entry.config.vesselId);
    setTemp(entry.config.params.temp);
    setHumidity(entry.config.params.humidity);
    setSalinity(entry.config.params.salinity);
    setShowVintageLoader(false);
  };

  const handleStart = () => {
    if (selectedIngredientIds.length === 0 || !vesselId) return;
    
    // Inventory check for salt
    if (hasSalt) {
      const saltIngs = selectedIngredients.filter(i => i.id === 'salt' || i.id === 'trapani_salt');
      for (const saltIng of saltIngs) {
        const needed = requiredSaltMass;
        const currentSaltInv = inventory[saltIng.id] || 0;
        const saltUnitsNeeded = needed / (saltIng.mass || 1);
        if (currentSaltInv < saltUnitsNeeded) {
          setErrorNotice(`Insufficient ${saltIng.name}! Need ${needed.toFixed(1)}g. Have ${currentSaltInv} units.`);
          return;
        }
      }
    }

    // Inventory check for water (titrated, so the unit count depends on the dial)
    if (hasWater) {
      const waterIng = selectedIngredients.find(i => i.id === 'water');
      if (waterIng) {
        const unitsNeeded = requiredWaterMass / (waterIng.mass || 1);
        if ((inventory['water'] || 0) < unitsNeeded) {
          setErrorNotice(
            `Not enough water. ${(requiredWaterMass / 1000).toFixed(2)}L needs ` +
            `${Math.ceil(unitsNeeded)} units; you have ${inventory['water'] || 0}.`
          );
          return;
        }
      }
    }

    // Capacity check
    const vessel = VESSELS.find(v => v.id === vesselId)!;
    const { totalMass } = calculateBatchDynamics(selectedIngredients, customQuantities);
    if ((totalMass / 1000) > vessel.capacityL) {
      setErrorNotice(`Vessel Overflow! Max capacity is ${vessel.capacityL}L.`);
      return;
    }

    setErrorNotice(null);

    const recipe = resolveRecipeFromMatrix(selectedIngredients, vesselId);
    const primarySubstrate = selectedIngredients.find(i => i.type === IngredientType.SUBSTRATE) 
                          || selectedIngredients.find(i => i.type === IngredientType.STARTER && !i.id.includes('spores'))
                          || selectedIngredients[0];

    const starter = selectedIngredients.find(i => i.type === IngredientType.STARTER && i.id.includes('spores'));
    const generation = starter?.generation || 1;
    const { yieldVolume } = calculateBatchDynamics(selectedIngredients, customQuantities);

    const newBatch: Batch = {
      id: `${Date.now()}`,
      recipeId: recipe.id,
      cachedRecipe: recipe,
      substrateId: primarySubstrate.id,
      starterId: starter?.id || null, 
      inputIngredientIds: selectedIngredientIds,
      ingredientQuantities: customQuantities,
      totalMass: totalMass,
      yieldVolume: yieldVolume,
      vesselId: vesselId,
      startTime: Date.now(),
      lastTick: Date.now(),
      progress: 0,
      params: { temp, humidity, salinity },
      quality: generateInitialQuality(selectedIngredients),
      status: 'active',
      messages: ['Matrix Inoculated.', `Vessel: ${vessel.name}`, `Net Mass: ${(totalMass / 1000).toFixed(2)}kg`],
      generation: generation,
      // The strain comes with the spore. Founder stock gets the neutral profile.
      lineage: starter?.lineage ?? {
        generation,
        vigor: 1,
        resilience: 0,
        bias: starter?.strainBias ?? 0.5,
      },
      lineageDamaged: false,
      stress: 0,
      disturbanceTimer: 0,
      flags: { isLidPropped: false },
      // Everything starts sealed, unmisted and unheated. Deciding otherwise is
      // the player's job now, and the incubator defaults to the recipe's target
      // until they touch it.
      controls: (() => {
        // Any vessel that declares a ceiling starts held at what the recipe
        // wants, clamped to what the vessel can actually reach.
        const ceiling = VESSELS.find(v => v.id === vesselId)?.heatedTo;
        return {
          vent: 0,
          mist: 0,
          heat: ceiling === undefined ? null : Math.min(ceiling, recipe.idealParams.temp),
        };
      })(),
      surfaceWater: 0,
    };

    const deductions: Record<string, number> = {};
    selectedIngredients.forEach(ing => {
      if (ing.id === 'salt' || ing.id === 'trapani_salt') {
        deductions[ing.id] = requiredSaltMass / (ing.mass || 1);
      } else if (ing.id === 'water') {
        deductions[ing.id] = requiredWaterMass / (ing.mass || 1);
      } else if (reagentGrams[ing.id] !== undefined) {
        // Charged by the gram actually used, not by whole units.
        deductions[ing.id] = reagentGrams[ing.id] / (ing.mass || 1);
      } else if (deductions[ing.id]) {
        deductions[ing.id] += 1;
      } else {
        deductions[ing.id] = 1;
      }
    });

    onStartBatch(newBatch, selectedIngredients, deductions);
  };

  const getRemainingInventory = (id: string) => {
    const total = inventory[id] || 0;
    const selectedCount = selectedIngredientIds.filter(sid => sid === id).length;
    return total - selectedCount;
  };

  const availableIngredients = useMemo(() => {
    return ingredients
      .filter(i => (inventory[i.id] || 0) > 0)
      .filter(i => {
        if (pantryCategory !== 'all' && i.type !== pantryCategory) return false;
        if (pantrySearch.trim() !== '') {
          return i.name.toLowerCase().includes(pantrySearch.toLowerCase());
        }
        return true;
      })
      .sort((a, b) => {
        const order = { [IngredientType.SUBSTRATE]: 1, [IngredientType.STARTER]: 2, [IngredientType.ADDITIVE]: 3 };
        return (order[a.type] || 4) - (order[b.type] || 4);
      });
  }, [ingredients, inventory, pantryCategory, pantrySearch]);

  const canStart = selectedIngredientIds.length > 0 && !!vesselId && !isOverflowing;
  // The advice ladder replaces the single static hint: rungs you have earned are
  // readable, the next one is shown sealed so the track is visible.
  const mastery = resolvedRecipe ? getMastery(recipeMastery, resolvedRecipe) : null;
  // Identifying a recipe always comes with rung 1. handleEvaluateBatch can mark a
  // recipe analyzed without ever granting mastery (you can analyze a batch and
  // never harvest it), and without this floor that path would leave the bench
  // with no note at all — a regression on the old always-visible hint.
  const handLevel = mastery ? (isUndiscovered ? mastery.level : Math.max(1, mastery.level)) : 0;
  const ladder = resolvedRecipe && mastery ? getMasteryLadder(resolvedRecipe, handLevel, mastery.cooks) : [];
  const earnedRungs = ladder.filter(r => r.earned);
  const nextRung = ladder.find(r => !r.earned) || null;
  // Must read the FLOORED level: a freshly identified recipe sits at raw level 0
  // while displaying as rung 1, and xpToNextLevel(0) returns 0, which made the
  // next rung claim it needed a score of 80 rather than the xp it actually wants.
  const toNext = mastery ? xpToNextLevel({ ...mastery, level: handLevel }) : null;
  // Only worth printing before you have run it; after that the ladder says more.
  // What the chamber is actually bringing: the enzymes on any koji you added,
  // and — if this IS a koji run — which way the current dials will steer it.
  const broughtEnzymes = useMemo(
    () => getBatchEnzymes(selectedIngredients, customQuantities),
    [selectedIngredients, customQuantities]
  );
  const isKojiRun = resolvedRecipe?.type === FermentType.KOJI;
  /**
   * A koji run starts where the steamed grain starts, so the temperature dial is
   * a readout rather than a control.
   *
   * Read off the SELECTION, not off `resolvedRecipe` — which only resolves once
   * a vessel is chosen, so keying on it left the slider live through the whole
   * of the reagent step and then swapped it out underneath the player. A koji
   * spore in the bowl is enough to know.
   */
  const isKojiStart = isKojiRun || selectedIngredients.some(
    i => i.type === IngredientType.STARTER && /koji|oryzae|luchuensis|sake|shoyu/i.test(i.id + i.name)
  );
  useEffect(() => {
    if (isKojiStart && temp !== KOJI_INOCULATION_TEMP) setTemp(KOJI_INOCULATION_TEMP);
  }, [isKojiStart, temp]);

  const kojiSteer = useMemo(() => {
    if (!isKojiRun) return null;
    const sub = selectedIngredients.find(i => i.type === IngredientType.SUBSTRATE);
    const starter = selectedIngredients.find(i => i.type === IngredientType.STARTER);
    return kojiDevelopment(sub, starter, temp, humidity, 0);
  }, [isKojiRun, selectedIngredients, temp, humidity]);

  const ceilings = useMemo(
    () => getFlavorPotential(selectedIngredients, dynamics.concentration || 1, customQuantities),
    [selectedIngredients, dynamics.concentration, customQuantities]
  );

  const benchFormula = resolvedRecipe && !isUndiscovered && !analyzedRecipeIds.includes(resolvedRecipe.id)
    ? describeFormula(resolvedRecipe.id) : null;

  return (
    <div className="modal-overlay" style={{ padding: 0 }}>
      <div className="wood-panel inoc">
        <span className="corner c-tl" />
        <span className="corner c-tr" />

        {/* ---------- HEADER ---------- */}
        {/* The studio head, as on every dark screen: mark in a brass medallion, a
            kicker, a short title. The long instruction line is what the four
            numbered stations already say. */}
        <div className="inoc-head">
          <div className="ttl">
            <span className="sh-medal"><PanelMark name="inoculation" size={34} /></span>
            <div className="sh-title">
              <span className="kicker">Draw · charge · seal</span>
              <h2>Inoculation Bench</h2>
            </div>
          </div>

          <div className="acts">
            {logbook.length > 0 && (
              <button className="protocol-btn" onClick={() => setShowVintageLoader(!showVintageLoader)}>
                <GameIcon name="books" size={13} color="var(--plum)" />
                Proven Protocols ({logbook.filter(l => l.rating >= 4).length})
              </button>
            )}
            <button className="close-stamp" onClick={onClose} aria-label="Close inoculation bench">
              <CloseIcon size={13} />
            </button>
          </div>
        </div>

        {/* ---------- NOTICE ---------- */}
        {errorNotice && (
          <div className="inoc-notice">
            <span className="msg">
              <GameIcon name="alert" size={14} style={{ flexShrink: 0 }} />
              {errorNotice}
            </span>
            <button className="dismiss" onClick={() => setErrorNotice(null)}>Dismiss</button>
          </div>
        )}

        {/* ---------- PROVEN PROTOCOLS ---------- */}
        {showVintageLoader && (
          <div className="protocol-pop">
            <div className="php">
              <h3>Proven Protocols · 4★ and up</h3>
              <button className="close-stamp" style={{ width: 26, height: 26 }} onClick={() => setShowVintageLoader(false)} aria-label="Close protocols">
                <CloseIcon size={11} />
              </button>
            </div>
            <div className="pbody custom-scrollbar">
              {logbook.filter(l => l.rating >= 4 && l.config).length === 0 ? (
                <div className="empty empty-mark"><PanelMark name="books" size={44} faded />Nothing rated 4★ yet. Sell a good batch and it lands here.</div>
              ) : (
                logbook.filter(l => l.rating >= 4 && l.config).map(log => (
                  <button key={log.id} className="vintage" onClick={() => loadVintage(log)}>
                    <span>
                      <span className="n">{log.recipeName}</span>
                      <span className="m">{log.substrateName} · {log.rating}/5</span>
                    </span>
                    <span className="go"><CheckCircleIcon size={15} color="var(--plum)" /></span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ---------- STATION TABS (mobile) ---------- */}
        <div className="station-tabs md:hidden">
          {([
            { id: 'pantry', label: 'Reagents', icon: <GameIcon name="search" size={12} color="currentColor" /> },
            { id: 'bowl', label: 'Chamber', icon: <GameIcon name="warm" size={12} color="currentColor" /> },
            { id: 'vessel', label: 'Vessel', icon: <GameIcon name="vessels" size={12} color="currentColor" /> },
            { id: 'run', label: 'Seal', icon: <GameIcon name="seal" size={12} color="currentColor" /> },
          ] as const).map(tab => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id as StepTab)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ---------- BENCH ---------- */}
        <div className={`inoc-body${picker ? ' picking' : ''}`}>
          {picker && (
            <button
              type="button"
              className="pick-scrim"
              aria-label="Close and go back to the chamber"
              onClick={() => setPicker(null)}
            />
          )}

          {/* === 01 · REAGENTS === */}
          <section className={`station pick-pane${picker === 'pantry' ? ' showing' : ''} ${activeTab === 'pantry' ? '' : 'is-hidden'}`}>
            <div className="station-head">
              <span className="lbl"><span className="num">01</span> Reagents</span>
              <span className="tally">{selectedIngredientIds.length} drawn</span>
              {picker === 'pantry' && (
                <button type="button" className="pane-back" onClick={() => setPicker(null)}>
                  Back to the chamber
                </button>
              )}
            </div>

            <div className="search-box" style={{ width: '100%', marginBottom: 9 }}>
              <GameIcon name="search" size={12} />
              <input
                type="text"
                placeholder="Search the pantry…"
                value={pantrySearch}
                onChange={(e) => setPantrySearch(e.target.value)}
                aria-label="Search the pantry"
              />
            </div>

            <div className="flex items-center gap-1 mb-3 overflow-x-auto custom-scrollbar" style={{ flexShrink: 0, paddingBottom: 2 }}>
              {[
                { id: 'all', label: 'All' },
                { id: IngredientType.SUBSTRATE, label: 'Grains' },
                { id: IngredientType.STARTER, label: 'Spores' },
                { id: IngredientType.ADDITIVE, label: 'Salts' },
              ].map(cat => (
                <button
                  key={cat.id}
                  className={`chip-tab ${pantryCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setPantryCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="step-row">
              <span className="l">Add</span>
              {[1, 5, 10, 25].map(n => (
                <button
                  key={n}
                  className={`q ${addStep === n ? 'active' : ''}`}
                  onClick={() => setAddStep(n)}
                  aria-label={`Add ${n} units at a time`}
                >
                  {n}&times;
                </button>
              ))}
            </div>

            <div className="station-scroll custom-scrollbar">
              {availableIngredients.length === 0 ? (
                <div className="pantry-empty empty-mark"><PanelMark name="supply" size={48} faded />No reagents in stock.</div>
              ) : (
                availableIngredients.map(ing => {
                  const remaining = getRemainingInventory(ing.id);
                  const wouldOverflow = (dynamics.totalMass + (ing.mass || 0)) / 1000 > capacityLimitL;
                  const atCapacity = wouldOverflow || selectedIngredientIds.length >= MAX_REAGENT_UNITS;
                  const IngGlyph = getIngredientIcon(ing);
                  const weightDisplay = ing.mass > 0
                    ? (ing.mass >= 1000 ? `${ing.mass / 1000}kg` : `${ing.mass}${ing.unitDisplay}`)
                    : '1 unit';

                  return (
                    <button
                      key={ing.id}
                      /* THE SAME OBJECT IN A DIFFERENT PLACE. A jar of pearl
                         barley is a labelled thing whether you are buying it or
                         drawing it, so the pantry list takes the same spine the
                         Supply catalogue does — including the type stripe. */
                      className={`reagent ${
                        ing.contraband ? 'illicit'
                          : ing.type === IngredientType.STARTER ? 'kind-starter'
                            : ing.type === IngredientType.ADDITIVE ? 'kind-additive'
                              : 'kind-substrate'}`}
                      onClick={() => addIngredient(ing.id, addStep)}
                      onMouseEnter={() => setHoveredItem({ type: 'ingredient', data: ing })}
                      onMouseLeave={() => setHoveredItem(null)}
                      disabled={remaining <= 0 || atCapacity}
                      aria-label={`Add ${ing.name} — ${remaining} left`}
                    >
                      <span className="left">
                        <span className="glyph art"><IngredientIcon id={ing.id} size={30} fallback={IngGlyph} /></span>
                        <span style={{ minWidth: 0 }}>
                          <span className="n">
                            {ing.name}
                            {ing.isLiving && <span className="living-tag">Live</span>}
                          </span>
                          <span className="meta"><b>{remaining}</b> left · {weightDisplay}</span>
                        </span>
                      </span>
                      {remaining > 0 && !atCapacity && (
                        <span className="add"><PlusIcon size={14} color="currentColor" /></span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* === 02 · CHAMBER === */}
          <section className={`station alt ${activeTab === 'bowl' ? '' : 'is-hidden'}`}>
            <div className="station-head">
              <span className="lbl"><span className="num">02</span> Chamber</span>
              <span className={`tally mass ${isOverflowing ? 'over' : isFull ? 'full' : ''}`}>
                {fillL.toFixed(2)} / {capacityLimitL} L
              </span>
            </div>

            {/* The two pickers, opened on demand. Hidden on the phone, which
                keeps its own step-through through the same four stations. */}
            <div className="pick-row">
              <button type="button" className="pick-btn" onClick={() => setPicker('pantry')}>
                <GameIcon name="search" size={12} color="currentColor" />
                Draw reagents
                <em>{selectedIngredientIds.length}</em>
              </button>
              <button type="button" className="pick-btn" onClick={() => setPicker('vessel')}>
                <GameIcon name="vessels" size={12} color="currentColor" />
                {vesselId ? (VESSELS.find(v => v.id === vesselId)?.name ?? 'Vessel') : 'Choose a vessel'}
                {vesselId && <em>{capacityLimitL}L</em>}
              </button>
            </div>

            {selectedIngredientIds.length === 0 ? (
              <div className="chamber-empty empty-mark">
                <PanelMark name="crock" size={52} faded />
                <span className="t">The chamber is empty.</span>
                <span className="s">Load it up to {capacityLimitL}L from the pantry.</span>
              </div>
            ) : (
              <div className="station-scroll custom-scrollbar">
                {aggregatedIngredients.map(({ ing, count }) => {
                  const ChargeGlyph = getIngredientIcon(ing);
                  let weightDisplay: string;
                  if (ing.id === 'salt' || ing.id === 'trapani_salt') {
                    weightDisplay = `${requiredSaltMass.toFixed(1)}g · titrated`;
                  } else if (ing.id === 'water') {
                    weightDisplay = requiredWaterMass >= 1000
                      ? `${(requiredWaterMass / 1000).toFixed(2)}L · titrated`
                      : `${requiredWaterMass.toFixed(0)}ml · titrated`;
                  } else {
                    // This ignored the dial, so a reagent scaled down still
                    // announced its undialled mass — the row read "50.00kg"
                    // above a slider reading 44.60kg. Same source as the slider.
                    const totalItemMass = reagentGrams[ing.id] ?? (ing.mass || 0) * count;
                    weightDisplay = totalItemMass > 0
                      ? (totalItemMass >= 1000 ? `${(totalItemMass / 1000).toFixed(2)}kg` : `${Math.round(totalItemMass)}${ing.unitDisplay}`)
                      : `${count} unit${count > 1 ? 's' : ''}`;
                  }

                  return (
                    <div key={ing.id} className="charge stacked">
                      <span className="crow">
                      <span className="left">
                        <span className="glyph art"><IngredientIcon id={ing.id} size={26} fallback={ChargeGlyph} /></span>
                        <span style={{ minWidth: 0 }}>
                          <span className="n">
                            {ing.name}
                            {count > 1 && <span className="xn">{count}×</span>}
                          </span>
                          <span className="w">{weightDisplay}</span>
                        </span>
                      </span>
                      <button
                        className="drop"
                        onClick={() => removeOneInstance(ing.id, addStep)}
                        aria-label={`Remove ${addStep} ${ing.name}`}
                        title={`Remove ${addStep}`}
                      >
                        <Minus size={13} />
                      </button>
                      </span>

                      {/* Everything is dialable by the gram now. A 2L jar could
                          only ever hold two 1kg blocks before, and none at all
                          once salt was titrated in on top. */}
                      {ing.id !== 'salt' && ing.id !== 'trapani_salt' && ing.id !== 'water' && (
                        <div className="charge-amt">
                          <input
                            type="range"
                            className="dial-slider"
                            min={Math.round((ing.mass || 100) * 0.1)}
                            max={(ing.mass || 1000) * count}
                            step={Math.max(10, Math.round((ing.mass || 1000) / 20))}
                            value={reagentGrams[ing.id] ?? (ing.mass || 0) * count}
                            onChange={(e) => setReagentGrams(prev => ({ ...prev, [ing.id]: Number(e.target.value) }))}
                            aria-label={`Amount of ${ing.name} in grams`}
                          />
                          <span className="amt">
                            {(() => {
                              const g = reagentGrams[ing.id] ?? (ing.mass || 0) * count;
                              return g >= 1000 ? `${(g / 1000).toFixed(2)}kg` : `${Math.round(g)}g`;
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedIngredientIds.length > 0 && (
              <div className="fill-gauge">
                <div className="fh">
                  <span>Vessel fill</span>
                  <span className={isOverflowing ? 'over' : isFull ? 'full' : ''}>
                    {isOverflowing ? `overflowing by ${(fillL - capacityLimitL).toFixed(2)}L` : `${fillPct.toFixed(0)}%`}
                  </span>
                </div>
                {(fillPct < 98 || isOverflowing) && (
                  <button type="button" className="fill-scale" onClick={scaleToVessel}
                          title="Multiplies every solid by the same factor, so the salinity, hydration and every ratio you set stay exactly as they are — only the amount changes.">
                    {isOverflowing
                      ? `Scale down to ${capacityLimitL}L — same recipe, less of it`
                      : `Fill to ${capacityLimitL}L at these proportions`}
                  </button>
                )}
                <div className="ftrack">
                  <div className={`ffill ${isOverflowing ? 'over' : isFull ? 'full' : ''}`} style={{ width: `${fillPct}%` }} />
                </div>
              </div>
            )}

            {selectedIngredientIds.length > 0 && (
              <div className="bench-block">
                <div className="bh">
                  <span className="l"><GameIcon name="additive" size={12} color="var(--teal)" /> Salinity</span>
                  <span className={`v ${hasSalt ? '' : 'off'}`}>{salinity.toFixed(1)}%</span>
                </div>
                {hasSalt ? (
                  <>
                    <input
                      type="range"
                      className="dial-slider"
                      min="0"
                      max="25"
                      step="0.5"
                      value={salinity}
                      onChange={(e) => setSalinity(Number(e.target.value))}
                      aria-label="Salinity as a percentage of solids"
                    />
                    <div className="kv">
                      <span className="k">Salt to weigh out</span>
                      <span className="n">{requiredSaltMass.toFixed(1)}g</span>
                    </div>
                  </>
                ) : (
                  <div className="note">Add salt to the chamber to titrate.</div>
                )}
              </div>
            )}

            {selectedIngredientIds.length > 0 && (
              <div className="bench-block">
                <div className="bh">
                  <span className="l"><GameIcon name="droplet" size={12} color="var(--teal)" /> Hydration</span>
                  <span className={`v ${hasWater ? '' : 'off'}`}>{hydration.toFixed(0)}%</span>
                </div>
                {hasWater ? (
                  <>
                    <input
                      type="range"
                      className="dial-slider"
                      min="0"
                      max={MAX_HYDRATION}
                      step="5"
                      value={hydration}
                      onChange={(e) => { setHydration(Number(e.target.value)); setHydrationTouched(true); }}
                      aria-label="Hydration as a percentage of solids"
                    />
                    <div className="kv">
                      <span className="k">Water to measure</span>
                      <span className="n">
                        {requiredWaterMass >= 1000
                          ? `${(requiredWaterMass / 1000).toFixed(2)}L`
                          : `${requiredWaterMass.toFixed(0)}ml`}
                      </span>
                    </div>
                    <div className="kv">
                      <span className="k" title="Water dilutes the mash. Thinner batches fill the vessel but taste of less.">
                        Mash strength
                      </span>
                      <span className={`n ${dynamics.concentration < 0.45 ? '' : 'moss'}`}>
                        {(dynamics.concentration * 100).toFixed(0)}%
                      </span>
                    </div>
                    {suggestedHydration !== null && Math.abs(hydration - suggestedHydration) > 15 && (
                      <div className="note" style={{ marginTop: 7 }}>
                        This ferment usually sits nearer {suggestedHydration}%.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="note">Add water to the chamber to set the mash.</div>
                )}
              </div>
            )}

            <button className="btn btn-ghost step-next" onClick={() => { setActiveTab('vessel'); setPicker('vessel'); }}>
              Choose a vessel <ChevronRight size={14} />
            </button>
          </section>

          {/* === 03 · VESSEL === */}
          <section className={`station pick-pane${picker === 'vessel' ? ' showing' : ''} ${activeTab === 'vessel' ? '' : 'is-hidden'}`}>
            <div className="station-head">
              <span className="lbl"><span className="num">03</span> Vessel</span>
              <span className="tally">{availableSlots} slots free</span>
              {picker === 'vessel' && (
                <button type="button" className="pane-back" onClick={() => setPicker(null)}>
                  Back to the chamber
                </button>
              )}
            </div>

            <div className="station-scroll custom-scrollbar">
              {VESSELS.filter(v => !v.builtIn).map(v => {
                const notOwned = (ownedVessels[v.id] ?? 0) === 0;
                const notEnoughSpace = v.slotsRequired > availableSlots;
                const notEnoughPower = (currentPower + v.powerDraw) > maxPower;
                const notEnoughCapacity = (dynamics.totalMass / 1000) > v.capacityL;
                const disabled = notEnoughSpace || notEnoughPower || notOwned;

                return (
                  <button
                    key={v.id}
                    className={`vessel-pick ${vesselId === v.id ? 'on' : ''}`}
                    onClick={() => !disabled && setVesselId(v.id)}
                    onMouseEnter={() => setHoveredItem({ type: 'vessel', data: v })}
                    onMouseLeave={() => setHoveredItem(null)}
                    disabled={disabled}
                    aria-label={`${v.name}${notOwned ? ' — not owned' : ''}`}
                  >
                    <span className="art">
                      {notOwned ? <GameIcon name="lock" size={14} /> : <VesselArt vesselId={v.id} height={30} />}
                    </span>
                    <span className="body">
                      <span className="row1">
                        <span className="n">{v.name}</span>
                        {notEnoughCapacity && !disabled && (
                          <GameIcon name="alert" size={12} color="var(--brick)" label="Mass exceeds capacity" />
                        )}
                      </span>
                      <span className="specs">
                        <span className="spec">{v.slotsRequired} slot{v.slotsRequired > 1 ? 's' : ''}</span>
                        <span className={`spec ${notEnoughPower ? 'bad' : 'pw'}`}>{v.powerDraw}W</span>
                        <span className={`spec ${notEnoughCapacity ? 'bad' : ''}`}>{v.capacityL}L</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedIngredientIds.length > 0 && (
              <div className="bench-block">
                <div className="bh">
                  <span className="l"><GameIcon name="scales" size={12} color="var(--brass)" /> Predicted physics</span>
                </div>
                <div className="kv">
                  <span className="k">Batch volume</span>
                  <span className="n">{dynamics.yieldVolume.toFixed(1)}× standard</span>
                </div>
                <div className="kv">
                  <span className="k" title="Volume pays sublinearly — bulk trades margin for throughput.">
                    Market value
                  </span>
                  <span className="n moss">{getYieldMultiplier(dynamics.yieldVolume).toFixed(1)}×</span>
                </div>
                <div className="kv">
                  <span className="k">Concentration</span>
                  <span className="n">{(dynamics.concentration * 100).toFixed(0)}%</span>
                </div>
                <div className="kv">
                  <span className="k">Kinetics</span>
                  <span className="n plum">{dynamics.speedModifier.toFixed(2)}×</span>
                </div>

                {(broughtEnzymes.amylase > 1 || broughtEnzymes.protease > 1) && (
                  <>
                    <div className="kv" style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--line)' }}>
                      <span className="k" title="Protease frees amino acids from protein. That is umami.">Protease</span>
                      <span className="n moss">{broughtEnzymes.protease.toFixed(0)}</span>
                    </div>
                    <div className="kv">
                      <span className="k" title="Amylase converts starch into sugar.">Amylase</span>
                      <span className="n">{broughtEnzymes.amylase.toFixed(0)}</span>
                    </div>
                    <div className="kv">
                      <span className="k">Reachable umami</span>
                      <span className="n moss">{ceilings.umami.toFixed(0)}</span>
                    </div>
                    <div className="kv">
                      <span className="k">Reachable sweetness</span>
                      <span className="n">{ceilings.sweetness.toFixed(0)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <button className="btn btn-ghost step-next" onClick={() => { setActiveTab('run'); setPicker(null); }}>
              Set the chamber <ChevronRight size={14} />
            </button>
          </section>

          {/* === 04 · CONTROLS === */}
          <section className={`station ${activeTab === 'run' ? '' : 'is-hidden'}`}>
            <div className="station-head">
              <span className="lbl"><span className="num">04</span> Seal &amp; Set</span>
            </div>

            <div
              className={`compound ${isBioSludge ? 'sludge' : isUndiscovered ? 'unknown' : ''}`}
              onMouseEnter={() => resolvedRecipe && !isUndiscovered && setHoveredItem({ type: 'recipe', data: resolvedRecipe, masteryLevel: handLevel })}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <div className="ch">
                <span className="l">What this becomes</span>
                <GameIcon name="help" size={12} color="var(--text-lo)" />
              </div>
              <span className="nm">
                {isBioSludge && <GameIcon name="cracked_seal" size={15} />}
                {projectedRecipeName}
              </span>
              {isUndiscovered && !isBioSludge && (
                <span className="flag">Uncharted ferment</span>
              )}
            </div>

            {/* CONTROLS BEFORE COMMENTARY.
                Temperature and moisture are the two things you actually SET on
                this screen, and they sat underneath the recipe-card strip and
                the koji steering readout. On a koji batch — the one that adds
                the extra block — that pushed them below the fold of a scrolling
                column with a sticky button pinned across the bottom, and people
                reported being unable to set them at all. This file has been
                warned twice that anything added to station 04 pushes the point
                of the screen out of reach; controls belong above anything that
                is merely advice.
                CLAUDE.md: "Re-measure the bench after adding anything to
                station 04." */}
            <div className="dial-block">
              {/* KOJI IS INOCULATED HOT, AND THAT IS NOT A CHOICE.
                  The substrate goes in straight off the steamer, so the starting
                  temperature is a fact of the process rather than a setting —
                  offering a 10-70C slider invited a decision that does not exist
                  at inoculation. Where it goes from there IS a choice, and that
                  belongs to the vessel: a tray follows the room, a muro holds up
                  to 35C. */}
              {isKojiStart ? (
                <div className="dial-ctl fixed">
                  <div className="dh">
                    <span className="l"><GameIcon name="thermometer" size={12} color="var(--brick)" /> Temperature</span>
                    <span className="v">{KOJI_INOCULATION_TEMP}°C</span>
                  </div>
                  <p className="dial-fixed-note">
                    Set by the substrate — it goes in warm from the steamer.
                    Holding it afterwards is what the vessel is for.
                  </p>
                </div>
              ) : (
                <div className="dial-ctl">
                  <div className="dh">
                    <span className="l"><GameIcon name="thermometer" size={12} color="var(--brick)" /> Temperature</span>
                    <span className="v">{temp}°C</span>
                  </div>
                  <input
                    type="range"
                    className="dial-slider"
                    min="10"
                    max="70"
                    value={temp}
                    onChange={(e) => setTemp(Number(e.target.value))}
                    aria-label="Inoculation temperature in Celsius"
                  />
                </div>
              )}

              <div className="dial-ctl">
                <div className="dh">
                  <span className="l"><GameIcon name="droplet" size={12} color="var(--teal)" /> Moisture</span>
                  <span className="v">{humidity}%</span>
                </div>
                <input
                  type="range"
                  className="dial-slider"
                  min="0"
                  max="100"
                  value={humidity}
                  onChange={(e) => setHumidity(Number(e.target.value))}
                  aria-label="Chamber moisture percentage"
                />
              </div>
            </div>

            {earnedRungs.length > 0 && !isUndiscovered && (
              <button className="hand-strip" onClick={() => setShowCard(true)}>
                <span className="hs-l">
                  <GameIcon name="lamp" size={12} color="var(--brass)" /> The hand
                  <b>{handLevel}/5</b>
                </span>
                <span className="hs-r">Read the card <ChevronRight size={12} /></span>
              </button>
            )}

            {kojiSteer && (
              <div className="steer">
                <div className="sh">
                  <span className="l">This bed will grow</span>
                  <span className="v">{describeEnzymes({ amylase: kojiSteer.amylaseShare * 100, protease: (1 - kojiSteer.amylaseShare) * 100 }).label}</span>
                </div>
                <div className="strack">
                  <div className="sfill" style={{ width: `${kojiSteer.amylaseShare * 100}%` }} />
                </div>
                <div className="sends">
                  <span>savoury · protease</span>
                  <span>sweet · amylase</span>
                </div>
                <p className="snote">
                  Warmer and wetter pushes it sweet; cooler and drier pushes it savoury.
                  The strain you inoculated with decides where the middle sits.
                </p>
              </div>
            )}


            {/* A BUTTON THAT NAMES A STEP MUST TAKE YOU TO IT.
                This read "Draw your reagents" or "Choose a vessel" while
                `disabled`, so the primary action of the screen was an
                instruction you could not act on — you click it and nothing
                happens. It opens the picker it is naming instead. Overflow stays
                disabled, because that is an error to correct rather than a step
                to go to. */}
            <button
              className="btn btn-amber inoc-go"
              onClick={
                selectedIngredientIds.length === 0 ? () => { setActiveTab('pantry'); setPicker('pantry'); }
                : !vesselId ? () => { setActiveTab('vessel'); setPicker('vessel'); }
                : isOverflowing ? scaleToVessel
                : handleStart
              }
            >
              {selectedIngredientIds.length === 0
                ? <>Draw your reagents <ChevronRight size={14} /></>
                : !vesselId
                  ? <>Choose a vessel <ChevronRight size={14} /></>
                  : isOverflowing
                    ? <>Scale it to fit {capacityLimitL}L <ChevronRight size={14} /></>
                    : <><Play size={14} style={{ fill: 'currentColor' }} /> Seal &amp; Inoculate</>}
            </button>
            {isOverflowing && (
              <p className="inoc-overflow-note">
                Every solid drops by the same factor, so the salinity, the hydration
                and every ratio you set stay exactly where you put them — there is
                simply less of it. You are only charged for what goes in; the rest
                stays on the shelf.
              </p>
            )}
          </section>
        </div>

        {showCard && resolvedRecipe && (
          <RecipeCard
            recipe={resolvedRecipe}
            knowledge={getRecipeKnowledge(resolvedRecipe.id, unlockedRecipes, analyzedRecipeIds, ownedBookIds)}
            mastery={mastery!}
            ownedBookIds={ownedBookIds}
            onClose={() => setShowCard(false)}
          />
        )}

        {/* ---------- SPECTROMETER DOCK ---------- */}
        <div className={`scan-dock${pinnedItem ? ' split' : ''}`}>
          {pinnedItem && (
            <MolecularScan
              key="scan-pinned"
              target={pinnedItem}
              embedded
              pinned
              onTogglePin={() => setPinnedItem(null)}
            />
          )}
          {(hoveredItem || pinnedItem) ? (
            hoveredItem ? (
              <MolecularScan
                key="scan-active"
                target={hoveredItem}
                embedded
                pinned={false}
                onTogglePin={() => setPinnedItem(hoveredItem)}
              />
            ) : null
          ) : (
            <div key="scan-idle" className="scan-idle">
              <span className="puck"><GameIcon name="pulse" size={14} color="var(--text-lo)" /></span>
              <span className="t">Spectrometer idle</span>
              <span className="s">Hover a reagent, starter or vessel to read its profile</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchController;

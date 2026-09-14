
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CREST } from './components/titleArt';
import { GameState, Batch, Ingredient, IngredientType, LogEntry, Buyer, StaffRoleType, WeatherState, WeatherType, Vessel, FermentType, Book, Lineage, ChamberControls, CrewMember } from './types';
import { BUYERS, INGREDIENTS, INITIAL_MONEY, RECIPES, VESSELS, INITIAL_MAX_POWER, DAY_DURATION_MS, STAFF_ROLES, DEMAND_FLOOR, BANKRUPTCY_STRIKES, BOOKS, SUPPLIERS, CELLAR_CAPACITY, CELLAR_TICK_DIVISOR,
  RAID_HEAT_THRESHOLD, RAID_CHANCE_PER_DAY, HEAT_DECAY_PER_TICK, HEAT_DECAY_AFTER_BUST,
  HEAT_DECAY_FROM_CLEANLINESS, HEAT_PER_ILLEGAL_BATCH, HEAT_FROM_FILTH, HYGIENE_NEGLECT_FLOOR,
  HYGIENE_IDLE_RECOVERY,
  GREASE_RENOWN_COST, GREASE_HEAT_RELIEF, getUndergroundTierFromXp } from './constants';
import { inSeason, nextInSeason, MONTH_NAMES } from './constants.forage';
import { ageingBehaviour, describeMaturity, processBatchTick, getAmbientConditions, applyBatchIntervention, calculateBatchDynamics, getRecipeForBatch, calculateCriticScore, getInterestedBuyers, getBestOffer, getDemandHitForSale, recoverDemand, calculateOverheads, getLineage, getControls, sporeYield, sporeValue, cultureSalePrice, cultureDemandAfter, CULTURE_DEMAND_KEY, isContrabandBatch } from './services/gameLogic';
import { propagateLineage, lineageStrainKey, lineageStrainLabel, describeLineage , sporePotency } from './services/koji';
import { rollCrewPool, advanceCrew, crewWages, crewToStaffFlags, crewEffect } from './services/crew';
import LabView from './components/LabView';
import SupplyPanel from './components/SupplyPanel';
import SpeedControl from './components/SpeedControl';
import InkDefs from './components/InkDefs';
import ToolRack from './components/ToolRack';
import CellarView from './components/CellarView';
import BatchController from './components/BatchController';
import BatchInspector from './components/BatchInspector';
import StaffManager from './components/StaffManager';
import WelcomeScreen from './components/WelcomeScreen';
import LogbookModal from './components/LogbookModal';
import HarvestReport from './components/HarvestReport';
import OrderBook from './components/OrderBook';
import PressRoom from './components/PressRoom';
import MolecularScan, { ScanTarget } from './components/MolecularScan';
import { saveGame, loadGame, getSaveMeta, clearSave } from './services/persistence';
import { grantMastery, diagnoseBatch, FAULT_LABELS } from './services/mastery';
import { MAX_ACTIVE_CONTRACTS, getStanding, standingFromSale, decayStanding, batchFitsContract, unitsFromBatch, makeContractOffer, overdueContracts, newlyUnlockedVendors, canOfferContract } from './services/vendors';
import { mintKojiProduct, describeEnzymes, isKojiRecipe } from './services/koji';
import { keeperRound, mintSporeHarvest, kojiStockKg, KOJI_ROOM_VESSEL } from './services/kojiRoom';
import KojiRoomView from './components/KojiRoomView';
import { KOJI_ROOM_COST, KOJI_ROOM_CAPACITY, KOJI_ROOM_TEMP, KOJI_ROOM_DEFAULT_TARGET_KG, KOJI_ROOM_TARGET_MAX_KG } from './constants';
import DevPanel from './components/DevPanel';
import PanelMark from './components/PanelMark';
import GameIcon from './components/GameIcon';
import FirstCulture from './components/FirstCulture';
import { TrendingUp, BookOpen, AlertCircle, SprayCan, Star, Zap, Flame, Calendar, Users, CloudSun, Clock, Activity, CloudRain, Sun, CloudSnow, Wind, CloudFog, FastForward, Play, PauseCircle, Wrench, Handshake, ShoppingBasket, ArrowDownToLine } from 'lucide-react';
import { SealGlyphIcon, AlmanacIcon, GaugeRing, WrenchIcon, StaffGroupIcon, BookIcon, GrainSprigIcon, SaltCrystalIcon, WaterDropIcon, SporeClusterIcon, VesselLineIcon, ArrowRightIcon, BagIcon, CloseIcon } from './components/icons';

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    money: INITIAL_MONEY,
    reputation: 0,
    xp: 0,
    renown: 0,
    day: 1, // Start Day 1
    week: 1,
    month: 2, // Start in March (Spring)
    year: 1,
    hygiene: 100,
    heat: 0,
    power: 0,
    maxPower: INITIAL_MAX_POWER,
    inventory: { 'koji_spores': 2, 'salt': 10, 'barley': 5, 'water': 50 },
    batches: [],
    logbook: [],
    unlockedRecipes: [],   // formulas known; filled by books and by cooking
    ownedBookIds: [],
    discoveredRecipeIds: [],
    analyzedRecipeIds: [], // Start with empty discovery
    equipmentSlots: 8,
    ownedVessels: { mason_jar: 2, koji_tray: 1 },   // you start with a couple of jars and a tray
    // Derived, so a supplier added to SUPPLIERS cannot be missing from a new game.
    supplierRelationships: Object.fromEntries(SUPPLIERS.map(s => [s.id, { level: 1, xp: 0 }])),
    customIngredients: [],
    staff: {
        cleaner: false,
        tech: false,
        chef: false,
        rd: false,
        toji: false
    },
    // Vendors remember you now: standing accumulates, contracts are signed
    // against it, and some of the roster has to be earned rather than reached.
    vendorStanding: {},
    contracts: [],
    unlockedVendorIds: [],
    // Hires are people now rather than four switches. The pool rotates, so who
    // is going at any moment is part of the situation.
    crew: [],
    crewPool: rollCrewPool(1),
    weather: { type: 'Cloudy', tempModifier: 0, humidityModifier: 0, description: 'Overcast' },
    marketDemand: Object.values(FermentType).reduce((acc, t) => ({ ...acc, [t]: 1 }), {} as Record<string, number>),
    insolvencyStrikes: 0,
    gameOver: false,
    recipeMastery: {},
    undergroundBusts: 0,
    onboardingDone: false,
    kojiRoomOwned: false,
    kojiTargetKg: KOJI_ROOM_DEFAULT_TARGET_KG,
  });

  // Any run left behind by a previous session, read once so the welcome screen
  // can offer to resume it.
  const [savedRun] = useState(() => getSaveMeta());

  // Game Speed State (0 = Paused, 1x, 2x, 4x, 8x)
  /**
   * SPEED AND PAUSE ARE TWO THINGS, NOT ONE.
   *
   * `gameSpeed` used to carry 0 to mean paused, which meant pausing ERASED the
   * speed selection: none of the 1x/2x/4x/8x chips was marked, so a paused game
   * could not tell you what it would resume at, and the pause button and the
   * speed chips were one control wearing two hats. Fiddling with speed read as
   * the UI glitching because the selection kept vanishing.
   *
   * `gameSpeed` is now always 1, 2, 4 or 8 — the chosen speed, always shown —
   * and `paused` is separate. The loop reads both.
   */
  const [showCellar, setShowCellar] = useState<boolean>(false);
  const [showKojiRoom, setShowKojiRoom] = useState(false);
  /**
   * WHICH RAIL A PHONE IS SHOWING.
   *
   * On a wide window both rails are visible and this does nothing. Below the
   * two-column breakpoint they become one pane at a time — stacking them instead
   * would put the room on top of two thousand pixels of scrolling panels, which
   * is the "it stacks" non-answer to mobile.
   */
  const [railPane, setRailPane] = useState<'bench' | 'stock'>('bench');
  const [showHardware, setShowHardware] = useState<boolean>(false);
  /** An ingredient opened deliberately, as opposed to one merely hovered. */
  const [openIngredient, setOpenIngredient] = useState<Ingredient | null>(null);
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [paused, setPaused] = useState<boolean>(false);
  const lastActiveSpeed = useRef<number>(1);
  // Counts sim ticks, so the cellar can run on a slower cadence than the bench.
  const tickCount = useRef<number>(0);

  // Lab Event / Alert Notification
  // A queue, not a slot. There are 29 places that raise a notice — payroll,
  // weather, raids, level-ups, mastery, purchases — and with a single slot on a
  // 5s timer they overwrote each other, so the ones that mattered were routinely
  // eaten by the ones that did not.
  type Notice = { id: number; text: string; type: 'info' | 'warn' | 'alert' };
  const [notices, setNotices] = useState<Notice[]>([]);
  // Callers pass Date.now() as an id, which was fine for a single slot but
  // collides in a queue when several notices fire in the same millisecond —
  // React then sees duplicate keys. The id is assigned here instead.
  const noticeSeq = useRef(0);
  const setLabNotification = React.useCallback((n: Notice | null) => {
    if (!n) { setNotices([]); return; }
    const id = ++noticeSeq.current;
    setNotices(prev => {
      // Drop an identical message already on screen rather than stacking it.
      if (prev.some(p => p.text === n.text)) return prev;
      return [...prev, { ...n, id }].slice(-3);
    });
    const ttl = n.type === 'alert' ? 9000 : n.type === 'warn' ? 7000 : 5000;
    setTimeout(() => setNotices(prev => prev.filter(p => p.id !== id)), ttl);
  }, []);

  // SAY WHAT CAME IN. A supplier levelling up used to open stock in silence, and
  // a month turning is the same event: the forager's van changes with it, and a
  // shelf that changes without saying so looks as if it never does. An effect,
  // not the tick's updater — StrictMode runs updaters twice — and only for a
  // single step forward, so loading a save made in another month announces
  // nothing.
  const lastSeasonMonth = useRef(gameState.month);
  useEffect(() => {
    const prev = lastSeasonMonth.current;
    const now = gameState.month;
    lastSeasonMonth.current = now;
    if (now !== (prev + 1) % 12) return;
    const picked = INGREDIENTS.filter(i => i.season && i.season.length < 12 && !i.legitCounterpartId);
    const arrived = picked.filter(i => inSeason(i, now) && !inSeason(i, prev)).map(i => i.name);
    const going = picked.filter(i => inSeason(i, now) && !inSeason(i, (now + 1) % 12)).map(i => i.name);
    if (arrived.length === 0 && going.length === 0) return;
    const list = (xs: string[]) => xs.length <= 4 ? xs.join(', ') : `${xs.slice(0, 4).join(', ')} and ${xs.length - 4} more`;
    setLabNotification({
      id: Date.now(),
      text: [
        arrived.length ? `${MONTH_NAMES[now]} — in season: ${list(arrived)}.` : `${MONTH_NAMES[now]}.`,
        going.length ? `Last month for ${list(going)}.` : '',
      ].filter(Boolean).join(' '),
      type: 'info',
    });
  }, [gameState.month, setLabNotification]);

  // Spacebar to pause / unpause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setPaused(p => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- DEV TOOLS ---
  // Backtick (`), the DEV chip in the header, or ?dev in the query string.
  const [showDev, setShowDev] = useState<boolean>(() => {
    try { return new URLSearchParams(window.location.search).has('dev'); } catch { return false; }
  });
  const [godMode, setGodMode] = useState<boolean>(() => {
    try { return new URLSearchParams(window.location.search).has('god'); } catch { return false; }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Backtick, because Cmd/Ctrl+Shift+D is claimed by the browser itself
      // (Chrome binds it to "Bookmark all tabs"), so the page never saw it.
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (!typing && (e.key === '`' || e.key === '~')) {
        e.preventDefault();
        setShowDev(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // God mode restores the balance every tick rather than patching every spend
  // site, so nothing in the game logic has to know it exists.
  const GOD_FLOOR = 1_000_000;
  useEffect(() => {
    if (!godMode) return;
    if (gameState.money < GOD_FLOOR) {
      setGameState(prev => ({ ...prev, money: GOD_FLOOR, insolvencyStrikes: 0, gameOver: false }));
    }
  }, [godMode, gameState.money]);

  // Drawer State
  const [activeDrawer, setActiveDrawer] = useState<'hardware' | 'marketplace' | null>(null);

  // Exclusive Drawer Toggle
  const toggleDrawer = (drawer: 'hardware' | 'marketplace') => {
    setActiveDrawer(prev => prev === drawer ? null : drawer);
  };

  const [uiState, setUiState] = useState<{
    modalOpen: boolean;
    activeBatchId: string | null;
    showLogbook: boolean;
    inspectorRaid: boolean; 
    showStaff: boolean;
    showWelcome: boolean;
    hoveredInventoryItem: Ingredient | null;
  }>({
    modalOpen: false,
    activeBatchId: null,
    showLogbook: false,
    inspectorRaid: false,
    showStaff: false,
    showWelcome: true,
    hoveredInventoryItem: null
  });

  // Derived Active Batch
  const activeBatchForTest = useMemo(() => 
    gameState.batches.find(b => b.id === uiState.activeBatchId) || null, 
  [gameState.batches, uiState.activeBatchId]);

  // --- MARKET ROTATION LOGIC (For Marketplace Only) ---
  const activeIngredients = useMemo(() => {
     // Merge Base Ingredients + Custom Ingredients (Player Spores)
     const base = INGREDIENTS.filter(ing => {
        if (!ing.variantGroup) return true;
        const groupItems = INGREDIENTS.filter(i => i.variantGroup === ing.variantGroup);
        const selectedIndex = (gameState.week - 1) % groupItems.length;
        return groupItems[selectedIndex].id === ing.id;
     });
     return [...base, ...gameState.customIngredients];
  }, [gameState.week, gameState.customIngredients]);

  // --- ALL INGREDIENTS (For Batch Controller Logic) ---
  // Fixes bug where out-of-season items in inventory weren't visible in BatchController
  const allIngredients = useMemo(() => {
      return [...INGREDIENTS, ...gameState.customIngredients];
  }, [gameState.customIngredients]);

  // Filter Tools for Hardware Store
  const toolIngredients = useMemo(() => {
      return allIngredients.filter(i => i.type === IngredientType.TOOL);
  }, [allIngredients]);

  // Calculate dynamic resource usage
  // A cellared batch is out of the way — it does not hold a bench slot or draw
  // power, which is the whole point of moving it there.
  const usedSlots = gameState.batches.reduce((acc, b) => {
     if (b.cellared || b.kojiRoom) return acc;
     const v = VESSELS.find(v => v.id === b.vesselId);
     return acc + (v?.slotsRequired || 1);
  }, 0);
  
  const currentPower = gameState.batches.reduce((acc, b) => {
     if (b.cellared || b.kojiRoom) return acc;
     const v = VESSELS.find(v => v.id === b.vesselId);
     return acc + (v?.powerDraw || 0);
  }, 0);

  // Helper to get Season Name
  const getSeason = (m: number) => {
      if (m >= 2 && m <= 4) return "Spring";
      if (m >= 5 && m <= 7) return "Summer";
      if (m >= 8 && m <= 10) return "Autumn";
      return "Winter";
  };
  const getMonthName = (m: number) => {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return months[m];
  }

  // --- WEATHER GENERATOR ---
  const generateWeather = (month: number): WeatherState => {
      const season = getSeason(month);
      const rand = Math.random();
      
      if (season === "Summer") {
          if (rand < 0.2) return { type: 'Heatwave', tempModifier: 8, humidityModifier: -20, description: 'Extreme Heat' };
          if (rand < 0.5) return { type: 'Sunny', tempModifier: 3, humidityModifier: -5, description: 'Clear Skies' };
          if (rand < 0.8) return { type: 'Rainy', tempModifier: -2, humidityModifier: 20, description: 'Summer Storms' };
          return { type: 'Cloudy', tempModifier: 0, humidityModifier: 10, description: 'Humid' };
      }
      if (season === "Winter") {
          if (rand < 0.3) return { type: 'Snowy', tempModifier: -8, humidityModifier: -10, description: 'Blizzard' };
          if (rand < 0.6) return { type: 'Cloudy', tempModifier: -2, humidityModifier: 0, description: 'Overcast' };
          return { type: 'Sunny', tempModifier: -4, humidityModifier: -15, description: 'Cold Front' };
      }
      if (season === "Spring") {
          if (rand < 0.5) return { type: 'Rainy', tempModifier: -1, humidityModifier: 25, description: 'Heavy Rain' };
          if (rand < 0.8) return { type: 'Sunny', tempModifier: 2, humidityModifier: 5, description: 'Mild' };
          return { type: 'Foggy', tempModifier: -2, humidityModifier: 30, description: 'Dense Fog' };
      }
      // Autumn
      if (rand < 0.4) return { type: 'Stormy', tempModifier: -3, humidityModifier: 15, description: 'Gale Winds' };
      if (rand < 0.7) return { type: 'Sunny', tempModifier: 1, humidityModifier: -5, description: 'Crisp' };
      return { type: 'Rainy', tempModifier: -2, humidityModifier: 10, description: 'Drizzle' };
  };

  const getWeatherIcon = (type: WeatherType) => {
      switch(type) {
          case 'Sunny': return <GameIcon name="sunny" size={15} className="wx-sun" />;
          case 'Heatwave': return <GameIcon name="heatwave" size={15} className="wx-heat" />;
          case 'Rainy': return <GameIcon name="rain" size={15} className="wx-rain" />;
          case 'Stormy': return <GameIcon name="storm" size={15} className="wx-storm" />;
          case 'Snowy': return <GameIcon name="snow" size={15} className="wx-snow" />;
          case 'Foggy': return <GameIcon name="fog" size={15} className="wx-fog" />;
          default: return <GameIcon name="cloudy" size={15} className="wx-fog" />;
      }
  };

  // --- Game Loop ---
  useEffect(() => {
    if (uiState.inspectorRaid || uiState.showWelcome) return; 
    if (paused) return; // Fully paused state
    if (gameState.gameOver) return; // Lab is closed — the clock stops

    // Adjust rate based on gameSpeed
    const tickRate = 1000 / gameSpeed;
    
    // 1. BATCH SIMULATION LOOP (Runs every tickRate)
    const interval = setInterval(() => {
        tickCount.current += 1;
      setGameState((prev) => {
        const isPowerAvailable = prev.power <= prev.maxPower;
        
        // Process Batches
        const updatedBatches = prev.batches.map(batch => {
          // A MATURING BATCH MUST KEEP TICKING PAST 'ready'.
          //
          // This gate read `=== 'active'`, so a batch froze the instant it hit
          // 100 — which meant `getMaturity` (progress minus peakWindowEnd) was
          // permanently zero and the whole ageing system was dead code. A
          // colatura sat at 100% reporting "young, just past ready" forever, and
          // AGEING_MAX_PROGRESS = 500, the log maturity curve, describeMaturity,
          // the flavour gains past the window and the value bonus had never once
          // executed. The ferments that are DEFINED by age were the ones that
          // could not age.
          //
          // Spoiled and analyzed batches still stop, and the types that peak and
          // decline still stop at 'ready' — they are finished, and holding them
          // is what the cellar is for.
          const stillDeveloping = batch.status === 'active'
            || (batch.status === 'ready' && (() => {
                 const r = getRecipeForBatch(batch);
                 // Maturing types keep improving. Koji keeps RUNNING — a bed left
                 // past its peak goes to spore, which is the only way to take a
                 // strain off it. Freezing at 100 made SPORULATION_START
                 // unreachable, so the lineage system had no entrance.
                 return ageingBehaviour(r) === 'matures' || r.type === FermentType.KOJI;
               })());
          if (stillDeveloping) {
            const recipe = getRecipeForBatch(batch);
            const substrate = [...INGREDIENTS, ...prev.customIngredients].find(i => i.id === batch.substrateId);
            
            let batchIngredients: Ingredient[] = [];
            if (batch.inputIngredientIds) {
                batchIngredients = batch.inputIngredientIds.map(id => 
                    [...INGREDIENTS, ...prev.customIngredients].find(i => i.id === id)!
                ).filter(Boolean);
            }

            if (recipe && substrate && batchIngredients.length > 0) {
              // Pass current weather and power availability to simulation
              // The cellar is cool, dark and undisturbed: batches there tick at a
              // fraction of the rate and are not exposed to bench hygiene.
              // The koji room is warm, clean and the beds' own: full rate, out of reach of bench hygiene.
              if (batch.kojiRoom) {
                return processBatchTick(batch, recipe, 100, substrate, batchIngredients, prev.staff, prev.inventory, prev.month, prev.weather, true, prev.crew ?? []);
              }
              if (batch.cellared) {
                if (tickCount.current % CELLAR_TICK_DIVISOR !== 0) return batch;
                return processBatchTick(batch, recipe, 100, substrate, batchIngredients, prev.staff, prev.inventory, prev.month, prev.weather, true, prev.crew ?? []);
              }
              return processBatchTick(batch, recipe, prev.hygiene, substrate, batchIngredients, prev.staff, prev.inventory, prev.month, prev.weather, isPowerAvailable, prev.crew ?? []);
            }
          }
          return batch;
        });
        
        // Antagonist Logic (Entropy)
        // REBALANCE: hygiene decay now scales with concurrent active batches, so
        // running a full bench is genuinely harder to keep sanitary than tending
        // one jar — previously the decay rate was flat no matter how much load
        // you carried, so scaling up had no real management cost.
        const activeBatchCount = prev.batches.filter(b => b.status === 'active' && !b.kojiRoom).length;

        // AN EMPTY BENCH DOES NOT GET DIRTY. IT AIRS OUT.
        //
        // The decay was `1 + count * 0.18`, so a bench with NOTHING on it still
        // lost hygiene at the full base rate, all the way down to the neglect
        // floor of 25. And 25 is below the 40 that filth starts at — so the floor
        // did not prevent filth heat, it GUARANTEED it: 0.0375 a tick, forever,
        // on an empty room. Under the reduced post-bust decay of 0.0175 that is a
        // net climb, so one bust and the heat ratcheted to 100 and the inspector
        // called on a bench with no batches at all. Which is exactly what was
        // reported, three fixes running.
        //
        // Load drives it from zero now, and an idle bench recovers. That bounds
        // neglect: you can always stop, let the room settle, and the heat drains.
        // The only thing that can hold heat up indefinitely is contraband, which
        // is something you are actively doing.
        const hygieneFloor = prev.staff['cleaner'] ? 50 : HYGIENE_NEGLECT_FLOOR;
        const hygieneDelta = activeBatchCount === 0
            ? HYGIENE_IDLE_RECOVERY
            : -(prev.staff['cleaner'] ? 0.03 : 0.06) * (activeBatchCount * 0.18 + 0.55);
        const newHygiene = Math.min(100, Math.max(hygieneFloor, prev.hygiene + hygieneDelta));
        
        let heatChange = 0;
        // Scaled by how filthy, not a cliff at 40. A bench at 39 is not the same
        // as one at 5, and treating them alike is what let neglect alone ratchet
        // heat to the ceiling and hold it there.
        if (newHygiene < 40) {
            heatChange += HEAT_FROM_FILTH * ((40 - newHygiene) / 40);
        }
        // Contraband is now flagged on the batch itself. It used to be inferred
        // from "substrate was bought with renown", which stopped meaning anything
        // once the underground started charging money.
        const illegalBatches = prev.batches.filter(b => b.contraband).length;
        if (illegalBatches > 0) heatChange += illegalBatches * HEAT_PER_ILLEGAL_BATCH;

        // Once you have conceded a raid you are on a list, and heat no longer
        // cools on its own — the only way down is to spend renown greasing it.
        // Being on a list makes heat harder to shed; it used to make it
        // impossible, so a single bust meant heat could only ever climb and the
        // inspector kept calling however clean you were afterwards.
        let decay = prev.undergroundBusts > 0
            ? HEAT_DECAY_PER_TICK * HEAT_DECAY_AFTER_BUST
            : HEAT_DECAY_PER_TICK;
        // A spotless bench actively cools their interest. Good hygiene should
        // do something, not merely fail to make things worse.
        if (newHygiene > 85) decay += HEAT_DECAY_FROM_CLEANLINESS;
        const newHeat = Math.min(100, Math.max(0, prev.heat + heatChange - decay));

        // Re-calculate power internally to avoid dependency loop in useEffect
        const newCurrentPower = updatedBatches.reduce((acc, b) => {
            const v = VESSELS.find(v => v.id === b.vesselId);
            return acc + (v?.powerDraw || 0);
        }, 0);

        if (prev.power <= prev.maxPower && newCurrentPower > prev.maxPower) {
            setLabNotification({
                id: Date.now(),
                text: `Grid Overload: Drawing ${newCurrentPower}W on ${prev.maxPower}W breaker! Heating offline.`,
                type: 'warn'
            });
        }

        return {
          ...prev,
          batches: updatedBatches,
          hygiene: newHygiene,
          heat: newHeat,
          power: newCurrentPower
        };
      });
    }, tickRate);
    
    // 2. TIME & ECONOMY LOOP (Runs Daily)
    const dayRate = DAY_DURATION_MS / gameSpeed;

    const dayInterval = setInterval(() => {
        setGameState(prev => {
            let newDay = prev.day + 1;
            let newWeek = prev.week;
            let newMonth = prev.month;
            let newYear = prev.year;
            let newMoney = prev.money;
            let newStaff = { ...prev.staff };
            let newWeather = prev.weather;
            let newMarketDemand = prev.marketDemand;
            let newStrikes = prev.insolvencyStrikes;
            let newGameOver = prev.gameOver;

            let newStanding = prev.vendorStanding ?? {};
            let newContracts = prev.contracts ?? [];
            let newUnlockedVendorIds = prev.unlockedVendorIds ?? [];
            let newCrew = prev.crew ?? [];
            let newCrewPool = prev.crewPool ?? [];

            // Start of a New Week
            if (newDay > 7) {
                newDay = 1;
                newWeek += 1;

                // --- WEEKLY BILLS ---
                // The bench used to cost nothing to keep open, so there was no
                // floor to beat and no reason not to sprawl. Rent, per-vessel
                // upkeep and metered power give every week a number to clear.
                // Payroll is the crew's actual wages. The old flat per-role figure could not
                // express a cheap junior or an expensive veteran, which is most of what
                // makes hiring a decision.
                const totalWages = crewWages(prev.crew ?? []);
                const drawnWatts = prev.batches.reduce((acc, b) => acc + (VESSELS.find(v => v.id === b.vesselId)?.powerDraw || 0), 0);
                const bills = calculateOverheads(prev.ownedVessels, drawnWatts, totalWages);

                newMoney -= bills.total;

                if (newMoney < 0) {
                    // Staff walk first — they are the largest and most optional cost.
                    if (totalWages > 0) {
                        // People leave when they are not paid. They do not
                        // become false; they go, and the pool does not hold
                        // them for you.
                        newCrew = [];
                        newStaff = { cleaner: false, tech: false, chef: false, rd: false };
                    }
                    newStrikes = prev.insolvencyStrikes + 1;

                    if (newStrikes >= BANKRUPTCY_STRIKES) {
                        newGameOver = true;
                        setLabNotification({
                            id: Date.now(),
                            text: `The lease is up. ${BANKRUPTCY_STRIKES} weeks in the red and the atelier is closed.`,
                            type: 'alert'
                        });
                    } else {
                        setLabNotification({
                            id: Date.now(),
                            text: `In the red by $${Math.abs(Math.round(newMoney))} — bills were $${bills.total}. Strike ${newStrikes} of ${BANKRUPTCY_STRIKES}.${totalWages > 0 ? ' Your staff have walked.' : ''}`,
                            type: 'alert'
                        });
                    }
                } else {
                    if (newStrikes > 0) {
                        setLabNotification({
                            id: Date.now(),
                            text: `Back in the black. Bills settled: $${bills.total}.`,
                            type: 'info'
                        });
                    } else if (bills.total > 0) {
                        setLabNotification({
                            id: Date.now(),
                            text: `Weekly bills: $${bills.rent} rent · $${bills.upkeep} upkeep · $${bills.utilities} power${bills.wages > 0 ? ` · $${bills.wages} wages` : ''}.`,
                            type: 'info'
                        });
                    }
                    newStrikes = 0;
                }

                // The crew get better at the job, and ask for more when they do.
                // The pool refreshes monthly — who is looking for work is part of
                // the situation, not a permanent shop.
                newCrew = advanceCrew(prev.crew ?? []);
                if (newWeek % 4 === 1 || newCrewPool.length === 0) newCrewPool = rollCrewPool(newWeek, prev.kojiRoomOwned);

                // Appetite for every ferment type drifts back toward normal.
                newMarketDemand = recoverDemand(prev.marketDemand);

                // --- VENDOR RELATIONSHIPS AND CONTRACTS ---
                // Relationships cool if you stop showing up, promises come due,
                // and vendors who think well of you offer work.
                newStanding = decayStanding(prev.vendorStanding ?? {}, []);

                const late = overdueContracts(prev.contracts, newWeek);
                if (late.length > 0) {
                    newContracts = newContracts.map(c => {
                        if (!late.some(l => l.id === c.id)) return c;
                        newMoney -= c.cashPenalty;
                        newStanding[c.buyerId] = Math.max(0, (newStanding[c.buyerId] ?? 0) - c.standingPenalty);
                        return { ...c, status: 'failed' as const };
                    });
                    const worst = late[0];
                    setLabNotification({
                        id: Date.now() + 3,
                        text: `Contract failed — ${worst.buyerName} went without. $${worst.cashPenalty} forfeited, and they will not forget.`,
                        type: 'alert',
                    });
                }

                // A vendor whose condition has just been met is latched and
                // announced, so meeting someone is an event rather than a row
                // quietly appearing in a list you might never open.
                const probeUnlock: GameState = { ...prev, week: newWeek, vendorStanding: newStanding, contracts: newContracts };
                const fresh = newlyUnlockedVendors(probeUnlock);
                if (fresh.length > 0) {
                    newUnlockedVendorIds = [...newUnlockedVendorIds, ...fresh.map(b => b.id)];
                    setLabNotification({
                        id: Date.now() + 5,
                        text: `${fresh[0].name} will deal with you now. ${fresh[0].dialogue.intro}`,
                        type: 'info',
                    });
                }

                // One offer at a time, from whichever vendor is most minded to
                // make one. More than that and the screen becomes a queue.
                const liveCount = newContracts.filter(c => c.status === 'offered' || c.status === 'active').length;
                if (liveCount < MAX_ACTIVE_CONTRACTS && newWeek % 2 === 0) {
                    const probe: GameState = { ...prev, week: newWeek, vendorStanding: newStanding, contracts: newContracts };
                    const willing = BUYERS.filter(b => canOfferContract(b, probe))
                        .sort((a, b) => (newStanding[b.id] ?? 0) - (newStanding[a.id] ?? 0));
                    if (willing.length > 0) {
                        const offer = makeContractOffer(willing[0], probe, newWeek * 7 + willing.length);
                        if (offer) {
                            newContracts = [offer, ...newContracts];
                            setLabNotification({
                                id: Date.now() + 4,
                                text: `${offer.buyerName} has work for you. Check the order book.`,
                                type: 'info',
                            });
                        }
                    }
                }

                // --- MONTHLY CYCLE (Every 4 weeks) ---
                if (newWeek > 1 && (newWeek - 1) % 4 === 0) {
                    newMonth += 1;
                    if (newMonth > 11) {
                        newMonth = 0;
                        newYear++;
                    }
                }

                // --- WEEKLY WEATHER UPDATE ---
                newWeather = generateWeather(newMonth);
                setLabNotification({
                    id: Date.now() + 1,
                    text: `Seasonal Shift: Current weather is now ${newWeather.type} (${newWeather.description}).`,
                    type: 'info'
                });
            }

            return { 
                ...prev, 
                day: newDay,
                week: newWeek,
                month: newMonth,
                year: newYear,
                money: newMoney,
                weather: newWeather,
                marketDemand: newMarketDemand,
                insolvencyStrikes: newStrikes,
                gameOver: newGameOver,
                vendorStanding: newStanding,
                contracts: newContracts,
                unlockedVendorIds: newUnlockedVendorIds,
                crew: newCrew,
                crewPool: newCrewPool,
                // The boolean roles stay as the derived summary, so everything
                // that already reads gameState.staff keeps working. A crew that
                // walked out leaves every flag false, which is exactly right.
                staff: newCrew.length > 0 ? crewToStaffFlags(newCrew) : newStaff,
            };
        });
    }, dayRate);

    return () => {
        clearInterval(interval);
        clearInterval(dayInterval);
    };
  }, [uiState.inspectorRaid, uiState.showWelcome, gameSpeed, paused, gameState.gameOver]); 

  const handleGreaseTheFile = () => {
    if (gameState.renown < GREASE_RENOWN_COST) {
      setLabNotification({ id: Date.now(), text: `Not enough standing to make this go away.`, type: 'warn' });
      return;
    }
    setGameState(prev => ({
      ...prev,
      renown: prev.renown - GREASE_RENOWN_COST,
      heat: Math.max(0, prev.heat - GREASE_HEAT_RELIEF),
    }));
    setLabNotification({ id: Date.now(), text: `A word in the right ear. Heat down ${GREASE_HEAT_RELIEF}.`, type: 'info' });
  };

  const handleCellarBatch = (batch: Batch) => {
    const recipe = getRecipeForBatch(batch);
    if (ageingBehaviour(recipe) !== 'matures') {
      setLabNotification({ id: Date.now(), text: `${recipe.name} does not improve with age. Take it now.`, type: 'warn' });
      return;
    }
    const inCellar = gameState.batches.filter(b => b.cellared).length;
    if (inCellar >= CELLAR_CAPACITY) {
      setLabNotification({ id: Date.now(), text: `The cellar is full — ${CELLAR_CAPACITY} vessels is all it holds.`, type: 'warn' });
      return;
    }
    setGameState(prev => ({
      ...prev,
      batches: prev.batches.map(b => b.id === batch.id ? { ...b, cellared: true } : b),
    }));
    setUiState(prev => ({ ...prev, activeBatchId: null }));
    setLabNotification({
      id: Date.now(),
      text: `${recipe.name} moved to the cellar. It will keep developing, slowly, and the bench slot is yours again.`,
      type: 'info'
    });
  };

  const handleUncellarBatch = (batch: Batch) => {
    setGameState(prev => ({
      ...prev,
      batches: prev.batches.map(b => b.id === batch.id ? { ...b, cellared: false } : b),
    }));
    setLabNotification({ id: Date.now(), text: `Brought up from the cellar.`, type: 'info' });
  };

  /* THE KOJI ROOM. What the keeper does lives in services/kojiRoom.ts. */
  const handleBuyKojiRoom = () => {
    if (gameState.kojiRoomOwned) return;
    if (!gameState.crew.some(c => c.role === 'rd')) {
      setLabNotification({ id: Date.now(), text: 'The koji room is a Head of R&D\'s project. Hire one first.', type: 'warn' });
      return;
    }
    if (gameState.money < KOJI_ROOM_COST) {
      setLabNotification({ id: Date.now(), text: `The room costs $${KOJI_ROOM_COST.toLocaleString()}.`, type: 'warn' });
      return;
    }
    setGameState(prev => ({
      ...prev,
      money: prev.money - KOJI_ROOM_COST,
      kojiRoomOwned: true,
      // Someone who can keep it turns up now, rather than at the next monthly roll.
      crewPool: [...prev.crewPool.filter(c => c.role !== 'toji'), ...rollCrewPool(prev.week, true).filter(c => c.role === 'toji')],
    }));
    setLabNotification({ id: Date.now(), text: 'The koji room is built. Carry koji beds in from the bench, and hire a koji keeper in Staff to run it.', type: 'info' });
  };

  const handleToKojiRoom = (batch: Batch) => {
    const recipe = getRecipeForBatch(batch);
    if (!gameState.kojiRoomOwned || !isKojiRecipe(recipe)) return;
    if (batch.status === 'spoiled') {
      setLabNotification({ id: Date.now(), text: 'A spoiled bed stays out of the warm room.', type: 'warn' });
      return;
    }
    if (gameState.batches.filter(b => b.kojiRoom).length >= KOJI_ROOM_CAPACITY) {
      setLabNotification({ id: Date.now(), text: `The koji room is full — ${KOJI_ROOM_CAPACITY} beds.`, type: 'warn' });
      return;
    }
    setGameState(prev => ({
      ...prev,
      batches: prev.batches.map(b => b.id === batch.id
        ? { ...b, kojiRoom: true, cellared: false, vesselId: KOJI_ROOM_VESSEL, controls: { ...(b.controls ?? { vent: 0, mist: 0, heat: null }), heat: KOJI_ROOM_TEMP } }
        : b),
    }));
    setUiState(prev => ({ ...prev, activeBatchId: null }));
    setLabNotification({ id: Date.now(), text: `${recipe.name} carried to the koji room. The bench slot is yours again.`, type: 'info' });
  };

  const handleFromKojiRoom = (batch: Batch) => {
    if (usedSlots + 1 > gameState.equipmentSlots) {
      setLabNotification({ id: Date.now(), text: 'No bench slot free to bring it back to.', type: 'warn' });
      return;
    }
    setGameState(prev => ({
      ...prev,
      batches: prev.batches.map(b => b.id === batch.id
        ? { ...b, kojiRoom: false, kojiReserve: false, vesselId: 'koji_tray', controls: { ...(b.controls ?? { vent: 0, mist: 0, heat: null }), heat: null } }
        : b),
    }));
    setLabNotification({ id: Date.now(), text: 'Back on the bench, in a cedar tray.', type: 'info' });
  };

  const handleKojiTarget = (delta: number) => setGameState(prev => ({
    ...prev,
    kojiTargetKg: Math.max(0, Math.min(KOJI_ROOM_TARGET_MAX_KG, (prev.kojiTargetKg ?? KOJI_ROOM_DEFAULT_TARGET_KG) + delta)),
  }));

  // THE KEEPER'S ROUND, once a game day. In an effect keyed on the date, never in
  // the tick's updater with a side effect: the round itself is pure, so running
  // it inside setGameState (which StrictMode calls twice) is safe, and the notice
  // is posted once, out here.
  const keeperDayKey = `${gameState.year}-${gameState.month}-${gameState.week}-${gameState.day}`;
  const keeperLastDay = useRef<string | null>(null);
  useEffect(() => {
    if (keeperLastDay.current === keeperDayKey) return;
    const firstLook = keeperLastDay.current === null;
    keeperLastDay.current = keeperDayKey;
    if (firstLook || !gameState.kojiRoomOwned || gameState.gameOver) return;
    const { report, acted } = keeperRound(gameState, keeperDayKey);
    if (!acted) return;
    setGameState(prev => keeperRound(prev, keeperDayKey).state);
    const bits: string[] = [];
    if (report.harvested) bits.push(`${report.kg} kg of koji to the pantry`);
    if (report.spores) bits.push(`${report.spores} packets of house spore`);
    if (report.laid) bits.push(`${report.laid} new bed${report.laid > 1 ? 's' : ''} laid`);
    if (report.bought) bits.push(`${report.bought} packet${report.bought > 1 ? 's' : ''} of founder spore bought ($${report.spent})`);
    if (report.spoiled) bits.push(`${report.spoiled} spoiled bed${report.spoiled > 1 ? 's' : ''} cleared`);
    if (report.short === 'grain') bits.push('out of grain to lay more');
    if (report.short === 'spores') bits.push('out of spores to lay more');
    if (bits.length) setLabNotification({ id: Date.now(), text: `Koji keeper: ${bits.join(' · ')}.`, type: report.short ? 'warn' : 'info' });
  }, [keeperDayKey]);

  const handleBuyBook = (book: Book) => {
    if (gameState.ownedBookIds.includes(book.id)) return;
    if (gameState.money < book.price) {
      setLabNotification({ id: Date.now(), text: `Not enough for ${book.title} ($${book.price}).`, type: 'warn' });
      return;
    }
    if (gameState.xp < book.xpRequired) {
      setLabNotification({ id: Date.now(), text: `${book.title} is not sold to a bench this green.`, type: 'warn' });
      return;
    }
    if (book.gatedBy) {
      const rel = gameState.supplierRelationships[book.gatedBy.supplierId];
      if (!rel || rel.level < book.gatedBy.level) {
        setLabNotification({ id: Date.now(), text: `${book.title} is kept behind the counter for regulars.`, type: 'warn' });
        return;
      }
    }

    setGameState(prev => ({
      ...prev,
      money: prev.money - book.price,
      heat: Math.min(100, prev.heat + (book.heatOnPurchase ?? 0)),
      ownedBookIds: [...prev.ownedBookIds, book.id],
      unlockedRecipes: Array.from(new Set([...prev.unlockedRecipes, ...book.teaches])),
    }));

    setLabNotification({
      id: Date.now(),
      text: `${book.title} shelved — ${book.teaches.length} formula${book.teaches.length === 1 ? '' : 's'} legible.`,
      type: 'info'
    });
  };

  // --- PERSISTENCE ---
  // Mirror progress to localStorage once per in-game day rather than on every
  // tick — a full serialize at the physics tick rate is wasted work.
  useEffect(() => {
    if (uiState.showWelcome) return;
    saveGame(gameState);
  }, [gameState.day, gameState.week, gameState.year, uiState.showWelcome]);

  // Also save on the way out, so a mid-day close keeps the last few seconds.
  useEffect(() => {
    const flush = () => { if (!uiState.showWelcome) saveGame(gameState); };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [gameState, uiState.showWelcome]);

  const handleContinueRun = () => {
    const loaded = loadGame();
    if (loaded) setGameState(loaded);
    setUiState(prev => ({ ...prev, showWelcome: false }));
  };

  const handleNewRun = () => {
    clearSave();
    setUiState(prev => ({ ...prev, showWelcome: false }));
  };

  // --- Inspector Actions ---
  const handleRaidOutcome = (action: 'bribe' | 'pay' | 'confiscate') => {
      if (action === 'bribe') {
          if (gameState.renown >= 50) {
              setGameState(prev => ({ ...prev, renown: prev.renown - 50, heat: 0 }));
              setUiState(u => ({ ...u, inspectorRaid: false }));
          }
      } else if (action === 'pay') {
          if (gameState.money >= 500) {
              setGameState(prev => ({ ...prev, money: prev.money - 500, heat: 20 }));
              setUiState(u => ({ ...u, inspectorRaid: false }));
          }
      } else {
          // THIS TOOK NOTHING.
          //
          // It kept every batch whose substrate was not bought with renown —
          // the ORIGINAL contraband test, which stopped meaning anything the
          // moment the underground started charging money. CLAUDE.md records
          // that the heat tick was moved onto `batch.contraband` for exactly
          // this reason; the confiscation was missed. So "let them take the
          // illegal stock" politely took nothing, paid a fine, and left you on
          // a list. It also only searched INGREDIENTS, so a batch built on a
          // cultured spore was invisible to it either way.
          //
          // A health inspector condemns what has actually gone off as well as
          // what is illegal, and the button says "let them take it" — so they
          // take it.
          const seized = gameState.batches.filter(
            b => isContrabandBatch(b) || b.status === 'spoiled'
          );
          const legalBatches = gameState.batches.filter(
            b => !isContrabandBatch(b) && b.status !== 'spoiled'
          );
          // Conceding puts you on a list: the fine scales with priors and heat
          // stops cooling on its own from here.
          setGameState(prev => ({
            ...prev,
            batches: legalBatches,
            heat: 50,
            undergroundBusts: prev.undergroundBusts + 1,
            money: prev.money - (200 + prev.undergroundBusts * 250),
          }));
          setUiState(u => ({ ...u, inspectorRaid: false }));
          setLabNotification({
            id: Date.now(),
            text: seized.length
              ? `They took ${seized.length} ${seized.length === 1 ? 'vessel' : 'vessels'} off the bench.`
              : 'They found nothing to take, and fined you anyway.',
            type: seized.length ? 'warn' : 'info',
          });
      }
  };


  // --- Standard Actions ---

  const handleBuyIngredient = (ingredient: Ingredient, quantity: number = 1) => {
    if (ingredient.supplierId === 'in_house' || quantity <= 0) return;

    const supplierId = ingredient.supplierId;
    const rel = gameState.supplierRelationships[supplierId] || { level: 1, xp: 0 };
    const discount = Math.min(0.25, (rel.level - 1) * 0.05);
    const isRenown = ingredient.currency === 'renown';

    // The underground charges money like everyone else now. It used to take
    // renown — and that branch never awarded supplier XP while the shelf gated on
    // supplier LEVEL, so black_market was pinned at level 1 forever and its tier-2
    // and tier-5 goods were permanently unbuyable. Access is bench xp now.
    if (ingredient.supplierId === 'black_market') {
        const tier = getUndergroundTierFromXp(gameState.xp);
        if ((ingredient.undergroundTier ?? 1) > tier) {
            setLabNotification({ id: Date.now(), text: `They don't deal that to a bench your size yet.`, type: 'warn' });
            return;
        }
        const totalCost = ingredient.baseCost * quantity;
        if (gameState.money < totalCost) {
            setLabNotification({ id: Date.now(), text: `Not enough cash — ${ingredient.name} runs $${totalCost}.`, type: 'warn' });
            return;
        }
        const heatGain = (ingredient.heatPerUnit ?? 8) * quantity;
        setGameState(prev => ({
            ...prev,
            money: prev.money - totalCost,
            heat: Math.min(100, prev.heat + heatGain),
            inventory: { ...prev.inventory, [ingredient.id]: (prev.inventory[ingredient.id] || 0) + quantity },
        }));
        setLabNotification({
            id: Date.now(),
            text: `${quantity}x ${ingredient.name} — no receipt. Heat +${heatGain}.`,
            type: 'warn'
        });
        return;
    }

    // The shelf greys both of these out, but the shelf is not the only thing that
    // can call this — gate the purchase itself, the same lesson as the vendor
    // unlock routes.
    if (!inSeason(ingredient, gameState.month)) {
        const back = nextInSeason(ingredient, gameState.month);
        setLabNotification({
            id: Date.now(),
            text: `${ingredient.name} is out of season${back !== null ? ` — back in ${MONTH_NAMES[back]}` : ''}.`,
            type: 'warn'
        });
        return;
    }
    if (rel.level < ingredient.tierRequired) {
        const supplierName = SUPPLIERS.find(x => x.id === supplierId)?.name ?? 'The supplier';
        setLabNotification({
            id: Date.now(),
            text: `${supplierName} keeps ${ingredient.name} for regulars — level ${ingredient.tierRequired}.`,
            type: 'warn'
        });
        return;
    }

    if (isRenown) {
        const totalRenown = ingredient.baseCost * quantity;
        if (gameState.renown >= totalRenown) {
            setGameState(prev => ({
                ...prev,
                renown: prev.renown - totalRenown,
                inventory: { ...prev.inventory, [ingredient.id]: (prev.inventory[ingredient.id] || 0) + quantity },
            }));
        }
    } else {
        const unitCost = Math.floor(ingredient.baseCost * (1 - discount));
        const totalCost = unitCost * quantity;
        if (gameState.money >= totalCost) {
            const totalXpGain = Math.ceil(ingredient.baseCost * 0.5 * quantity);
            let newXp = rel.xp + totalXpGain;
            let newLevel = rel.level;
            while (newXp >= newLevel * 100) { 
              newXp -= newLevel * 100; 
              newLevel++; 
            }
      
            setGameState(prev => ({
              ...prev,
              money: prev.money - totalCost,
              inventory: { ...prev.inventory, [ingredient.id]: (prev.inventory[ingredient.id] || 0) + quantity },
              supplierRelationships: { ...prev.supplierRelationships, [supplierId]: { level: newLevel, xp: newXp } }
            }));

            // Levelling a supplier used to happen in total silence, so the stock
            // it opened was easy to miss entirely — the system worked and looked
            // like it did not. Say what it opened.
            if (newLevel > rel.level) {
              const supplierName = SUPPLIERS.find(x => x.id === supplierId)?.name ?? 'Supplier';
              const opened = INGREDIENTS
                .filter(i => i.supplierId === supplierId && i.tierRequired > rel.level && i.tierRequired <= newLevel)
                .map(i => i.name);
              setLabNotification({
                id: Date.now(),
                text: opened.length
                  ? `${supplierName} now deals with you at level ${newLevel} — ${opened.join(', ')} on the shelf.`
                  : `${supplierName} now deals with you at level ${newLevel}.`,
                type: 'info'
              });
            }
        }
    }
  };

  const handleBuyVessel = (vessel: Vessel) => {
      // Buy as many as you like — the limit is bench slots and money, which is
      // how a real bench is limited.
      if (gameState.money >= vessel.cost) {
          setGameState(prev => ({
              ...prev,
              money: prev.money - vessel.cost,
              ownedVessels: { ...prev.ownedVessels, [vessel.id]: (prev.ownedVessels[vessel.id] ?? 0) + 1 }
          }));
          setLabNotification({
            id: Date.now(),
            text: `${vessel.name} acquired — you now have ${(gameState.ownedVessels[vessel.id] ?? 0) + 1}.`,
            type: 'info'
          });
      }
  };

  const handleUpgradePower = (additionalPower: number, cost: number) => {
      if (gameState.money >= cost) {
          setGameState(prev => ({
              ...prev,
              money: prev.money - cost,
              maxPower: prev.maxPower + additionalPower
          }));
          setLabNotification({
              id: Date.now(),
              text: `Power Grid Upgraded: +${additionalPower}W capacity added. Total capacity: ${gameState.maxPower + additionalPower}W!`,
              type: 'info'
          });
      }
  };

  const handleStartBatch = (newBatch: Batch, usedIngredients: Ingredient[], deductionMap?: Record<string, number>) => {
    const starter = usedIngredients.find(i => i.type === IngredientType.STARTER);
    if (starter) {
        newBatch.generation = starter.generation || 1;
        if (starter.lineage) newBatch.lineage = starter.lineage;
    }

    // Initialize New Physics State
    newBatch.stress = 0;
    newBatch.disturbanceTimer = 0;
    newBatch.flags = { isLidPropped: false };
    newBatch.surfaceWater = newBatch.surfaceWater ?? 0;

    setGameState(prev => {
        const newInventory = { ...prev.inventory };
        
        // ONCE PER UNIQUE ID, NOT ONCE PER UNIT.
        //
        // `usedIngredients` holds one entry for every unit drawn, and
        // `deductionMap` already holds the AGGREGATE to remove — so iterating it
        // directly charged the total once per copy. Ten anchovies at ten units
        // deducted a hundred, `Math.max(0, ...)` swallowed the overshoot, and the
        // whole stock vanished from the pantry the moment you used any of it.
        //
        // This is the third layer of the same per-unit trap (see CLAUDE.md on
        // ingredientQuantities and solidsMass). Anything that reduces over
        // `selectedIngredients` must ask whether it wants units or ingredients.
        const charged = new Set<string>();
        usedIngredients.forEach(ing => {
            if (ing.type === IngredientType.TOOL || charged.has(ing.id)) return;
            charged.add(ing.id);
            const held = newInventory[ing.id] || 0;
            if (held <= 0) return;
            const amountToDeduct = deductionMap && deductionMap[ing.id] !== undefined
                ? deductionMap[ing.id]
                : 1;
            newInventory[ing.id] = Math.max(0, held - amountToDeduct);
        });

        return {
            ...prev,
            inventory: newInventory,
            batches: [...prev.batches, newBatch],
            hygiene: Math.max(0, prev.hygiene - 5)
        };
    });
    setUiState(prev => ({ ...prev, modalOpen: false }));
  };

  const handleIntervention = (batch: Batch, action: string) => {
    // New Logic: Delegate to Game Logic service
    const currentAmbient = getAmbientConditions(gameState.month, gameState.weather).ambientTemp;

    setGameState(prev => ({
        ...prev,
        batches: prev.batches.map(b => {
            if (b.id !== batch.id) return b;
            return applyBatchIntervention(b, action, currentAmbient, getRecipeForBatch(b), gameState.inventory);
        }),
        // Small hygiene hit for interactions
        hygiene: Math.max(0, prev.hygiene - 1) 
    }));
  };

  /**
   * Hold an appliance at a new setting. Unlike an intervention this is not a
   * one-off poke — it changes what the tick does from here to the end of the
   * run, so there is no disturbance penalty and no hygiene cost. The cost is
   * that it keeps applying whether or not you were still paying attention.
   */
  /**
   * Take someone on. The hiring cost is up front; the wage is what actually
   * matters, and it recurs whether or not the bench is busy.
   */
  const handleHire = (candidate: CrewMember) => {
    if (candidate.role === 'toji' && !gameState.kojiRoomOwned) {
      setLabNotification({ id: Date.now(), text: 'There is no koji room for a keeper to keep yet.', type: 'warn' });
      return;
    }
    if (gameState.money < candidate.hiringCost) {
      setLabNotification({ id: Date.now(), text: `Not enough to take ${candidate.name} on.`, type: 'warn' });
      return;
    }
    setGameState(prev => {
      const crew = [...prev.crew, { ...candidate, hiredWeek: prev.week }];
      return {
        ...prev,
        money: prev.money - candidate.hiringCost,
        crew,
        crewPool: prev.crewPool.filter(c => c.id !== candidate.id),
        staff: crewToStaffFlags(crew),
      };
    });
    setLabNotification({ id: Date.now(), text: `${candidate.name} starts Monday. $${candidate.weeklyWage}/week.`, type: 'info' });
  };

  const handleLetGo = (id: string) => {
    setGameState(prev => {
      const leaving = prev.crew.find(c => c.id === id);
      const crew = prev.crew.filter(c => c.id !== id);
      if (leaving) {
        setLabNotification({ id: Date.now(), text: `${leaving.name} has gone. That is ${leaving.weeksWorked} weeks of knowing your benches walking out.`, type: 'warn' });
      }
      return { ...prev, crew, staff: crewToStaffFlags(crew) };
    });
  };

  const handleSetControl = (batch: Batch, patch: Partial<ChamberControls>) => {
    setGameState(prev => ({
      ...prev,
      batches: prev.batches.map(b =>
        b.id === batch.id
          ? { ...b, controls: { ...getControls(b), ...patch } }
          : b
      ),
    }));
  };

  // The report shown immediately after a harvest. It is the LogEntry itself, so
  // what pops up and what the archive keeps are guaranteed to be the same thing.
  const [harvestReport, setHarvestReport] = useState<LogEntry | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [openTool, setOpenTool] = useState<string | null>(null);

  const handleStopBatch = (batch: Batch) => {
    setGameState(prev => ({
      ...prev,
      batches: prev.batches.map(b => b.id === batch.id ? { ...b, status: 'ready' } : b)
    }));
  };

  const handleContinueFermenting = (batch: Batch) => {
     setGameState(prev => ({
      ...prev,
      batches: prev.batches.map(b => b.id === batch.id ? { ...b, status: 'active' } : b)
    }));
    setUiState(prev => ({ ...prev, activeBatchId: null }));
  };

  const handleDeepClean = () => {
    if (gameState.money >= 50) {
      setGameState(prev => ({
        ...prev,
        money: prev.money - 50,
        hygiene: 100,
        heat: Math.max(0, prev.heat - 20) 
      }));
    }
  };

  const handleSlotClick = (batch: Batch | null) => {
    if (!batch) {
      if (usedSlots < gameState.equipmentSlots) {
        setUiState(prev => ({ ...prev, modalOpen: true }));
      }
    } else {
      setUiState(prev => ({ ...prev, activeBatchId: batch.id }));
    }
  };

  const handleEvaluateBatch = (score: number, renown: number) => {
      const batch = activeBatchForTest;
      if (!batch) return;
      
      // DISCOVERY LOGIC: Permanently unlock the recipe ID
      setGameState(prev => ({
          ...prev,
          analyzedRecipeIds: prev.analyzedRecipeIds.includes(batch.recipeId) 
              ? prev.analyzedRecipeIds 
              : [...prev.analyzedRecipeIds, batch.recipeId],
          unlockedRecipes: prev.unlockedRecipes.includes(batch.recipeId)
              ? prev.unlockedRecipes
              : [...prev.unlockedRecipes, batch.recipeId],
          // If you produced it without having read it first, you found it yourself.
          discoveredRecipeIds: prev.unlockedRecipes.includes(batch.recipeId) || prev.discoveredRecipeIds.includes(batch.recipeId)
              ? prev.discoveredRecipeIds
              : [...prev.discoveredRecipeIds, batch.recipeId],
          batches: prev.batches.map(b => b.id === batch.id ? { ...b, status: 'analyzed', evaluationScore: score } : b)
      }));
  };

  // --- PROCESSING LOGIC ---
  const handleProcessBatch = (action: 'press' | 'filter', targetBatch?: Batch) => {
      // The press screen passes the batch directly. Setting activeBatchId and
      // then calling this in the same tick would read the OLD id, because React
      // state has not committed yet — the batch would be the previously
      // selected one, or none at all.
      const batch = targetBatch || activeBatchForTest;
      if (!batch) return;

      // RESOLVE INGREDIENTS TO CHECK WATER CONTENT
      const batchIngredients = batch.inputIngredientIds.map(id => 
          [...INGREDIENTS, ...gameState.customIngredients].find(i => i.id === id)
      ).filter(Boolean) as Ingredient[];

      const { waterRatio, totalMass } = calculateBatchDynamics(batchIngredients, batch.ingredientQuantities);
      const recipe = getRecipeForBatch(batch);

      setGameState(prev => {
          let updatedBatches = prev.batches;
          let updatedInventory = { ...prev.inventory };
          let newMessages: string[] = [];

          if (action === 'press') {
              // LOGIC: If Wet Mash (>50% water), SPLIT into Sauce + Paste
              if (waterRatio > 0.5) {
                  // Pressing a moromi is not an optional yield tweak, it is the
                  // last step of making soy sauce: the mash goes into cloth, the
                  // liquid that runs out is shoyu and what stays behind is cake.
                  // A press is the only way to get it out, which is why the tool
                  // exists.
                  const isMoromi = recipe?.type === FermentType.SHOYU;
                  // A moromi gives up its liquid more completely than a loose
                  // mash — it has been breaking down for months.
                  const efficiency = isMoromi ? 0.92 : 0.8;
                  const liquidMass = totalMass * waterRatio * efficiency;
                  const liquidUnits = Math.floor(liquidMass / 1000);
                  
                  if (liquidUnits > 0) {
                      updatedInventory['amino_sauce'] = (updatedInventory['amino_sauce'] || 0) + liquidUnits;
                      newMessages.push(isMoromi
                        ? `Pressed ${liquidUnits}L of raw shoyu. The cake keeps — it is still food.`
                        : `Extracted ${liquidUnits}L Amino Sauce`);
                  }

                  updatedBatches = prev.batches.map(b => {
                      if (b.id !== batch.id) return b;
                      return {
                          ...b,
                          isPressed: true,
                          yieldVolume: (b.yieldVolume || 1) * (1 - waterRatio), // Volume reduces to solids only
                          messages: [...b.messages, ...newMessages, "Solids Separated"],
                          // Force re-analysis
                          status: b.status === 'analyzed' ? 'ready' : b.status 
                      };
                  });

              } else {
                  // Standard Dry Press (just increases yield slightly by compacting)
                  updatedBatches = prev.batches.map(b => {
                      if (b.id !== batch.id) return b;
                      return {
                          ...b,
                          isPressed: true,
                          yieldVolume: (b.yieldVolume || 1) * 1.25,
                          messages: [...b.messages, "Hydro-Pressed (+Yield)"],
                          status: b.status === 'analyzed' ? 'ready' : b.status 
                      };
                  });
              }
          } else if (action === 'filter') {
              // Centrifuge Logic (Clarification)
              updatedBatches = prev.batches.map(b => {
                  if (b.id !== batch.id) return b;
                  return {
                      ...b,
                      isFiltered: true,
                      yieldVolume: (b.yieldVolume || 1) * 0.9, // 10% loss
                      messages: [...b.messages, "Centrifuged (Clarified)"],
                      status: b.status === 'analyzed' ? 'ready' : b.status 
                  };
              });
          }

          return {
              ...prev,
              batches: updatedBatches,
              inventory: updatedInventory
          };
      });
  };

  // --- HARVEST LOGIC ---
  const handleQuickHarvest = (batch: Batch) => {
    const recipe = getRecipeForBatch(batch);
    if (!recipe) return;

    const score = calculateCriticScore(batch, recipe, gameState.staff);

    // Single source of truth for offers — this used to be a fourth copy of the
    // price formula and could drift from the numbers on the buyer cards.
    const { money: bestPrice, renown: bestRenown, buyerName: bestBuyerName } = getBestOffer(
      batch,
      recipe,
      { score, activeStaff: gameState.staff, marketDemand: gameState.marketDemand, vendorStanding: gameState.vendorStanding },
      gameState.renown
    );

    processHarvest(batch, bestPrice, bestRenown, 0, false, bestBuyerName);
    setLabNotification({
      id: Date.now(),
      text: `⚡ Quick Harvest: ${recipe.name} sold to ${bestBuyerName} for $${bestPrice}${bestRenown > 0 ? ` & +${bestRenown} Renown` : ''}!`,
      type: 'info'
    });
  };

  /**
   * The other half of a quick harvest: take it off the bench and keep it, rather
   * than taking the best price going. Selling was the only one-click ending a
   * batch could have, which quietly meant every run was for sale — no way to
   * bank a good one for a recipe that needs it, or to hold stock for a better
   * market, without opening the inspector and hunting for the button.
   */
  const handleQuickKeep = (batch: Batch) => {
    handleStore(batch);
  };

  /**
   * Deliver a finished batch against a signed contract.
   *
   * The price was fixed when the contract was signed, so this deliberately does
   * NOT consult the market — that is the whole reason to sign one. Contracted
   * goods also do not glut the market, because they were spoken for before they
   * existed, which is what makes a contract a genuine alternative to spot
   * selling rather than a slightly better version of it.
   */
  const handleDeliver = (contractId: string) => {
    const batch = activeBatchForTest;
    if (!batch) return;
    const contract = gameState.contracts.find(c => c.id === contractId);
    if (!contract || contract.status !== 'active') return;

    const recipe = getRecipeForBatch(batch);
    const score = calculateCriticScore(batch, recipe, gameState.staff);
    if (!batchFitsContract(contract, recipe, score)) {
      setLabNotification({ id: Date.now(), text: `That batch does not meet the terms.`, type: 'warn' });
      return;
    }

    const units = Math.min(unitsFromBatch(batch), contract.unitsRequired - contract.unitsDelivered);
    const payment = units * contract.pricePerUnit;
    const delivered = contract.unitsDelivered + units;
    const finished = delivered >= contract.unitsRequired;

    setGameState(prev => ({
      ...prev,
      contracts: prev.contracts.map(c => c.id === contractId
        ? { ...c, unitsDelivered: delivered, status: finished ? 'complete' : 'active' }
        : c),
      vendorStanding: {
        ...prev.vendorStanding,
        [contract.buyerId]: Math.min(100,
          getStanding(prev, contract.buyerId) + (finished ? contract.standingReward : 2)),
      },
    }));

    processHarvest(batch, payment, 0, 0, false, `${contract.buyerName} (contract)`, true);
    setLabNotification({
      id: Date.now(),
      text: finished
        ? `Contract complete — ${contract.buyerName} paid $${payment.toLocaleString()} for the last ${units}. They will remember it.`
        : `Delivered ${units} to ${contract.buyerName} for $${payment.toLocaleString()}. ${contract.unitsRequired - delivered} still owed.`,
      type: 'info',
    });
  };

  const handleAcceptContract = (id: string) => {
    setGameState(prev => ({
      ...prev,
      contracts: prev.contracts.map(c => c.id === id ? { ...c, status: 'active' } : c),
    }));
  };

  const handleDeclineContract = (id: string) => {
    setGameState(prev => ({
      ...prev,
      contracts: prev.contracts.map(c => c.id === id ? { ...c, status: 'declined' } : c),
      // Turning work down is not free, but it is far cheaper than taking it and
      // failing — which is the judgement the player is being asked to make.
      vendorStanding: {
        ...prev.vendorStanding,
        [prev.contracts.find(c => c.id === id)?.buyerId ?? '']:
          Math.max(0, getStanding(prev, prev.contracts.find(c => c.id === id)?.buyerId ?? '') - 2),
      },
    }));
  };

  const handleSell = (buyer: Buyer, price: number, renownGain: number) => {
    const batch = activeBatchForTest;
    if (!batch) return;

    // Dealing with a fence leaves a trace.
    if (buyer.heatPerSale) {
      setGameState(prev => ({ ...prev, heat: Math.min(100, prev.heat + buyer.heatPerSale!) }));
    }
    
    // Process Harvest for a specific buyer
    // The sale itself moves the relationship. Good stock is remembered; poor
    // stock costs you, because a restaurant serves your mistakes to its own
    // customers under its own name.
    const soldScore = calculateCriticScore(batch, getRecipeForBatch(batch), gameState.staff);
    const delta = standingFromSale(soldScore, getStanding(gameState, buyer.id));
    setGameState(prev => ({
      ...prev,
      vendorStanding: {
        ...prev.vendorStanding,
        [buyer.id]: Math.max(0, Math.min(100, getStanding(prev, buyer.id) + delta)),
      },
    }));

    processHarvest(batch, price, renownGain, 0, false, buyer.name);
    setLabNotification({
      id: Date.now(),
      text: `✨ Sold to ${buyer.name} for $${price.toLocaleString()}${renownGain > 0 ? ` & +${renownGain} Renown` : ''}.${delta >= 4 ? ' They were impressed.' : delta < 0 ? ' They were not impressed.' : ''}`,
      type: 'info'
    });
  };

  const handleBackSlop = () => {
    const batch = activeBatchForTest;
    if (!batch) return;
    // Back slop yields no money/renown but returns starter
    processHarvest(batch, 0, 0, 2, false, "Internal Lab");
    setLabNotification({
      id: Date.now(),
      text: `🍄 Inoculant Harvested: +2x Living Culture preserved for back-slopping!`,
      type: 'info'
    });
  };

  /**
   * Selling a strain. A culture you have selected is an asset, and its worth is
   * its STRENGTH — a strong gen-3 is worth more than a weak gen-8, which is the
   * point of tracking potency at all. Generation only buys a little, for being
   * settled and predictable.
   */
  const handleSellCulture = (ingredient: Ingredient, quantity: number) => {
    if (!ingredient.lineage) return;
    const held = gameState.inventory[ingredient.id] || 0;
    const n = Math.max(0, Math.min(held, quantity));
    if (n <= 0) return;
    const gross = cultureSalePrice(ingredient.lineage, gameState.marketDemand, n);
    setGameState(prev => ({
      ...prev,
      money: prev.money + gross,
      inventory: { ...prev.inventory, [ingredient.id]: (prev.inventory[ingredient.id] || 0) - n },
      // Cultures glut like anything else. Same map, same weekly recovery drift.
      marketDemand: {
        ...prev.marketDemand,
        [CULTURE_DEMAND_KEY]: cultureDemandAfter(prev.marketDemand, n),
      },
    }));
    setLabNotification({
      id: Date.now(),
      text: `Sold ${n} packet${n === 1 ? '' : 's'} of ${ingredient.name} for $${gross.toLocaleString()}.`,
      type: 'info',
    });
  };

  const handleSporulate = () => {
    const batch = activeBatchForTest;
    if (!batch) return;
    // What the bed actually fruited, not a flat ten. A bed taken at the first
    // green gives a handful; one left to run gives a proper harvest.
    const packets = sporeYield(batch, getRecipeForBatch(batch));
    if (packets <= 0) return;
    processHarvest(batch, 0, 0, packets, true, "Internal Lab");
    setLabNotification({
      id: Date.now(),
      text: `Lineage advanced — ${packets} packets of Generation ${batch.generation + 1} spore taken. The bed is spent.`,
      type: 'info'
    });
  };

  const processHarvest = (batch: Batch, moneyGain: number, renownGain: number, sporeAmount: number, isSporulation: boolean, buyerName: string, isContracted: boolean = false) => {
    const recipe = getRecipeForBatch(batch);
    const substrate = [...INGREDIENTS, ...gameState.customIngredients].find(i => i.id === batch.substrateId);
    const calculatedScore = batch.evaluationScore || calculateCriticScore(batch, recipe, gameState.staff);

    const logEntry: LogEntry = {
      id: batch.id,
      recipeName: recipe?.name || 'Unknown',
      substrateName: substrate?.name || 'Unknown',
      date: Date.now(),
      rating: Math.min(5, Math.max(1, Math.floor(calculatedScore / 20))), 
      value: moneyGain,
      notes: isSporulation ? 'Sporulated for Lineage' : `Sold to ${buyerName}`,
      // Everything the post-mortem knows, so a run can be read back later and so
      // the harvest report and the archive can share one component.
      record: (() => {
        const hist = batch.history ?? [];
        const temps = hist.map(h => h.temp);
        const ideal = recipe?.idealParams.temp ?? 0;
        const offBand = hist.filter(h => Math.abs(h.temp - ideal) > 5).length;
        return {
          score: Math.round(calculatedScore),
          vesselName: VESSELS.find(v => v.id === batch.vesselId)?.name ?? batch.vesselId,
          massG: Math.round(batch.totalMass || 0),
          buyer: isSporulation ? 'Sporulated' : buyerName,
          renown: renownGain,
          peakPulledAt: Math.round(batch.progress),
          peakWindow: [recipe?.peakWindowStart ?? 0, recipe?.peakWindowEnd ?? 100] as [number, number],
          held: { ...batch.params },
          target: recipe?.idealParams ?? { temp: 0, humidity: 0, salinity: 0 },
          peakTemp: temps.length ? Math.max(...temps) : undefined,
          offTargetPct: hist.length ? Math.round((offBand / hist.length) * 100) : undefined,
          evenness: batch.evenness,
          enzymes: batch.enzymes,
          faults: recipe ? diagnoseBatch(batch, recipe).map(f => FAULT_LABELS[f] ?? f) : [],
          controls: batch.controls,
          lineage: batch.lineage,
          spoiled: batch.status === 'spoiled',
        };
      })(),
      config: {
          recipeId: batch.recipeId,
          substrateId: batch.substrateId,
          starterId: batch.starterId,
          inputIngredientIds: batch.inputIngredientIds,
          vesselId: batch.vesselId,
          params: { ...batch.params }
      }
    };

    let newInventory = { ...gameState.inventory };
    let newCustomIngredients = [...gameState.customIngredients];

    // HANDLE SPORES (Lineage Logic)
    //
    // The spores you take off a bed inherit what that bed selected for, so the
    // conditions held during the run — not the generation counter — decide what
    // comes out. Three strains are kept per generation (proteolytic, balanced,
    // amylolytic) so the drift is a thing you can pick up and use rather than a
    // hidden number.
    if (sporeAmount > 0) {
        // Shared with the koji keeper (services/kojiRoom.ts), so a strain taken by
        // hand and a strain taken by the keeper are the same strain.
        const minted = mintSporeHarvest(batch, sporeAmount, newInventory, newCustomIngredients);
        newInventory = minted.inventory;
        newCustomIngredients = minted.customIngredients;
    }

    // Selling floods the market for that ferment type. Bulk floods it harder,
    // so dumping cask after cask of one product stops paying.
    const soldType = recipe?.type;
    // Contracted goods were sold before they existed, so they do not glut the
    // open market. This is the mechanical heart of the contract system: it is
    // the way out of the saturation spiral that spot selling cannot escape.
    const demandHit = (isSporulation || isContracted) ? 0 : getDemandHitForSale(batch);

    // Cooking a recipe is how you learn it. Weighted by the critic score, so a
    // good run teaches disproportionately more and a failure teaches nothing.
    const mastery = grantMastery(gameState.recipeMastery, recipe, calculatedScore, batch);
    if (mastery.leveledTo) {
      setLabNotification({
        id: Date.now() + 2,
        text: `Hand steadied — ${recipe.name}, note ${mastery.leveledTo} of 5 unsealed.`,
        type: 'info'
      });
    }

    setGameState(prev => ({
      ...prev,
      recipeMastery: mastery.next,
      marketDemand: soldType && demandHit > 0
        ? { ...prev.marketDemand, [soldType]: Math.max(DEMAND_FLOOR, (prev.marketDemand[soldType] ?? 1) - demandHit) }
        : prev.marketDemand,
      money: prev.money + moneyGain,
      renown: prev.renown + renownGain, // ADD RENOWN HERE
      batches: prev.batches.filter(b => b.id !== batch.id),
      reputation: prev.reputation + (batch.quality.safety > 80 ? 2 : -5), // Small rep gain for safe sales
      xp: prev.xp + mastery.gained,
      hygiene: Math.max(0, prev.hygiene - 5),
      logbook: [logEntry, ...prev.logbook],
      inventory: newInventory,
      customIngredients: newCustomIngredients,
      // Ensure discovered recipe stays discovered on harvest
      analyzedRecipeIds: prev.analyzedRecipeIds.includes(batch.recipeId) 
          ? prev.analyzedRecipeIds 
          : [...prev.analyzedRecipeIds, batch.recipeId],
      unlockedRecipes: prev.unlockedRecipes.includes(batch.recipeId)
          ? prev.unlockedRecipes
          : [...prev.unlockedRecipes, batch.recipeId],
      // If you produced it without having read it first, you found it yourself.
      discoveredRecipeIds: prev.unlockedRecipes.includes(batch.recipeId) || prev.discoveredRecipeIds.includes(batch.recipeId)
          ? prev.discoveredRecipeIds
          : [...prev.discoveredRecipeIds, batch.recipeId],
    }));
    setUiState(prev => ({ ...prev, activeBatchId: null }));
    // Show what actually came out. Sporulation is not a harvest in this sense —
    // there is no product to report on, only spores — so it skips the report.
    if (!isSporulation) setHarvestReport(logEntry);
  };
  
  const handleStore = (targetBatch?: Batch) => {
    const batch = targetBatch || activeBatchForTest;
    if (!batch) return;

    const recipe = getRecipeForBatch(batch);
    if (!recipe) return;

    // Yield applies to inventory count
    const amount = Math.max(1, Math.floor(1 * (batch.yieldVolume || 1)));
    const outputId = recipe.outputIngredientId || `vintage_${recipe.id}`;
    let newCustomIngredients = [...gameState.customIngredients];

    // Ensure ingredient exists in registry so it renders cleanly in inventory
    const existing = [...INGREDIENTS, ...newCustomIngredients].find(i => i.id === outputId);
    if (!existing) {
      const vintageItem: Ingredient = {
        id: outputId,
        name: `${recipe.name} (Vintage Jar)`,
        type: recipe.type === FermentType.KOJI ? IngredientType.STARTER : IngredientType.ADDITIVE,
        baseCost: 60 * recipe.difficulty,
        currency: 'money',
        quality: Math.round(batch.quality.safety),
        description: `Cellar-aged ${recipe.name}. Umami: ${batch.quality.umami.toFixed(0)}, Acidity: ${batch.quality.acidity.toFixed(0)}.`,
        idealFor: [recipe.type],
        supplierId: 'in_house',
        tierRequired: 0,
        hiddenStats: {
          starchContent: 0,   // already converted by the ferment that made it
          sugarContent: batch.quality.sweetness / 10,
          nativeSalinity: batch.params.salinity,
          microbialDiversity: 5,
          fatContent: 0,
          proteinContent: batch.quality.umami / 10
        },
        mass: 500,
        unitDisplay: 'g'
      };
      newCustomIngredients.push(vintageItem);
    }

    const currentScore = batch.evaluationScore || calculateCriticScore(batch, recipe, gameState.staff);
    // Cellaring a batch is still a completed run, so it teaches the same as a sale.
    const storeMastery = grantMastery(gameState.recipeMastery, recipe, currentScore, batch);
    if (storeMastery.leveledTo) {
      setLabNotification({
        id: Date.now() + 2,
        text: `Hand steadied — ${recipe.name}, note ${storeMastery.leveledTo} of 5 unsealed.`,
        type: 'info'
      });
    }
    const logEntry: LogEntry = {
      id: batch.id,
      recipeName: recipe.name,
      substrateName: [...INGREDIENTS, ...newCustomIngredients].find(i => i.id === batch.substrateId)?.name || 'Unknown',
      date: Date.now(),
      rating: Math.min(5, Math.max(1, Math.floor(currentScore / 20))),
      value: 0,
      notes: `Cellared in Laboratory Storage (${amount} units)`
    };

    // A finished koji is not a jar of sauce — it is a tool, and which tool it is
    // depends on how you grew it. Mint it carrying the enzyme profile the bed
    // actually developed, so it can be spent on the next batch.
    if (isKojiRecipe(recipe) && batch.enzymes) {
      const substrate = [...INGREDIENTS, ...newCustomIngredients].find(i => i.id === batch.substrateId);
      const product = mintKojiProduct(batch, recipe, substrate);
      const already = [...INGREDIENTS, ...newCustomIngredients].find(i => i.id === product.id);
      if (!already) newCustomIngredients.push(product);

      const read = describeEnzymes(batch.enzymes);
      setGameState(prev => ({
        ...prev,
        batches: prev.batches.filter(b => b.id !== batch.id),
        customIngredients: newCustomIngredients,
        inventory: { ...prev.inventory, [product.id]: (prev.inventory[product.id] || 0) + amount },
        recipeMastery: storeMastery.next,
        xp: prev.xp + storeMastery.gained,
        hygiene: Math.max(0, prev.hygiene - 3),
        logbook: [logEntry, ...prev.logbook],
        analyzedRecipeIds: prev.analyzedRecipeIds.includes(batch.recipeId)
          ? prev.analyzedRecipeIds : [...prev.analyzedRecipeIds, batch.recipeId],
        unlockedRecipes: prev.unlockedRecipes.includes(batch.recipeId)
          ? prev.unlockedRecipes : [...prev.unlockedRecipes, batch.recipeId],
      }));
      setUiState(prev => ({ ...prev, activeBatchId: null }));
      setLabNotification({
        id: Date.now(),
        text: `${amount}x ${product.name} — ${Math.round(batch.enzymes.amylase)} amylase / ${Math.round(batch.enzymes.protease)} protease.`,
        type: 'info'
      });
      return;
    }

    setGameState(prev => ({
      ...prev,
      inventory: { ...prev.inventory, [outputId]: (prev.inventory[outputId] || 0) + amount },
      batches: prev.batches.filter(b => b.id !== batch.id),
      customIngredients: newCustomIngredients,
      logbook: [logEntry, ...prev.logbook],
      recipeMastery: storeMastery.next,
      xp: prev.xp + storeMastery.gained,
      hygiene: Math.max(0, prev.hygiene - 3),
      analyzedRecipeIds: prev.analyzedRecipeIds.includes(batch.recipeId) 
        ? prev.analyzedRecipeIds 
        : [...prev.analyzedRecipeIds, batch.recipeId],
    }));

    setUiState(prev => ({ ...prev, activeBatchId: null }));
    setLabNotification({
      id: Date.now(),
      text: `📦 Cellared: Stored ${amount}x ${recipe.name} in Laboratory Storage!`,
      type: 'info'
    });
  };

  const handleDiscard = () => {
    const id = activeBatchForTest?.id;
    if(!id) return;
    setGameState(prev => ({
      ...prev,
      batches: prev.batches.filter(b => b.id !== id),
      hygiene: Math.max(0, prev.hygiene - 5)
    }));
    setUiState(prev => ({ ...prev, activeBatchId: null }));
    setLabNotification({
      id: Date.now(),
      text: `🧹 Batch cleared and vessel sanitized.`,
      type: 'info'
    });
  };

  const handleContinue = () => {
    setUiState(prev => ({ ...prev, activeBatchId: null }));
  };

  /* --------------------------------------------------------------------------
     THE INSPECTOR

     This roll lived inside a setGameState updater, and updaters must be pure —
     React double-invokes them under StrictMode, which this app runs. So
     Math.random() was called twice every game day and the raid fired at roughly
     double the rate its own constant claims, from whichever invocation happened
     to win. That is the "randomly, and far too often" people were reporting.

     It rolls here instead: once per game day, keyed on the date so a re-render
     cannot repeat it, entirely outside any updater.
     -------------------------------------------------------------------------- */
  const lastRaidRollDay = useRef<string>('');
  useEffect(() => {
    const today = `${gameState.year}-${gameState.month}-${gameState.week}-${gameState.day}`;
    if (today === lastRaidRollDay.current) return;
    lastRaidRollDay.current = today;

    if (uiState.inspectorRaid || uiState.showWelcome || gameState.gameOver) return;
    if (gameState.heat <= RAID_HEAT_THRESHOLD) return;

    const over = (gameState.heat - RAID_HEAT_THRESHOLD) / (100 - RAID_HEAT_THRESHOLD);
    if (Math.random() < RAID_CHANCE_PER_DAY * over * over) {
      setUiState(u => ({ ...u, inspectorRaid: true }));
    }
  }, [gameState.day, gameState.week, gameState.month, gameState.year,
      gameState.heat, gameState.gameOver, uiState.inspectorRaid, uiState.showWelcome]);

  // Helper for ambient display
  const currentAmbient = getAmbientConditions(gameState.month, gameState.weather);

  return (
    <div className="min-h-screen font-sans selection:bg-amber-500/30 relative flex flex-col" style={{ background: 'var(--bg-void)', color: 'var(--text-hi)' }}>
      
      {/* Scrim behind the Supply drawer. With the two shop drawers merged the
          whole stack is now scrim(20) < HUD(30) < supply(50) < modals(100),
          which removed the z-25 layer and the class of bug that came with it. */}
      {activeDrawer && (
          <div 
             className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[1px]"
             onClick={() => setActiveDrawer(null)}
          ></div>
      )}

      {/* HARDWARE STORE (Top Drawer) */}


      {/* LAB NOTIFICATIONS — newest at the bottom, each on its own timer */}
      {notices.length > 0 && (
        <div className="toast-stack">
          {notices.map(n => (
            <div key={n.id} className={`toast ${n.type === 'alert' ? 'alert' : n.type === 'warn' ? 'warn' : ''}`}>
              <GameIcon name="sparkle" size={16} className="shrink-0" style={{ color: 'var(--brass)' }} />
              <span style={{ flex: 1 }}>{n.text}</span>
              <button
                className="close"
                onClick={() => setNotices(prev => prev.filter(p => p.id !== n.id))}
                aria-label="Dismiss notification"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* WELCOME SCREEN - Z-INDEX 100 */}
      {uiState.showWelcome && (
          <WelcomeScreen
            onStart={handleNewRun}
            onContinue={savedRun ? handleContinueRun : undefined}
            save={savedRun}
          />
      )}

      {/* TYCOON HUD HEADER - Z-INDEX 30 */}
      {/* Mounted once. Every isometric object in every window inherits the
          same hand from these. */}
      <InkDefs />

      {/* THE STRIP.
          Identity and the clock only. Everything that used to be crammed along
          here — the almanac, three gauge rings, the tickets and the whole nav —
          is in the rails now, where there is room for a label and a number
          instead of a ring the size of a thumbnail. */}
      <header className="hud sticky top-0 z-30">
        <div className="brand" style={{ minWidth: 0 }}>
          <div className="seal crest"><img src={CREST} style={{ width: 38, height: 38 }} alt="" aria-hidden="true" draggable={false} /></div>
          <div className="wordmark hidden sm:flex">
            <span className="title slab">FERMENTA</span>
            <span className="sub">Atelier &amp; Culture House</span>
          </div>
          <div className="divider-line hidden md:block" />
          <SpeedControl
            gameSpeed={gameSpeed}
            paused={paused}
            onSetSpeed={setGameSpeed}
            onTogglePause={() => setPaused(p => !p)}
          />
        </div>
        {/* THE BENCH, ALONG THE TOP.
            Power, hygiene and inspector heat belong here rather than in a rail:
            they describe the whole operation and you want them in the same place
            whichever pane a phone happens to be showing. */}
        <div className="gauges flex">
            <div className="gauge">
              <div className="ring-wrap">
                <GaugeRing percent={(currentPower / gameState.maxPower) * 100} color={currentPower > gameState.maxPower ? 'var(--brick)' : 'var(--amber)'} />
              </div>
              <div className="val mono" style={currentPower > gameState.maxPower ? { color: 'var(--brick)' } : undefined}>{currentPower}W/{gameState.maxPower}W</div>
              <div className="lbl">Power Grid</div>
            </div>
            <button
              type="button"
              className="gauge gauge-action"
              onClick={handleDeepClean}
              title="Deep clean the bench for $50"
              aria-label={`Hygiene ${Math.round(gameState.hygiene)}%. Deep clean the bench for $50.`}
            >
              <div className="ring-wrap">
                <GaugeRing percent={gameState.hygiene} color={gameState.hygiene < 50 ? 'var(--brick)' : 'var(--moss)'} />
              </div>
              <div className="val mono">{gameState.hygiene < 80 ? 'Clean $50' : `${Math.round(gameState.hygiene)}%`}</div>
              <div className="lbl">Hygiene</div>
            </button>
            <button
              type="button"
              className="gauge gauge-action"
              onClick={handleGreaseTheFile}
              disabled={gameState.renown < GREASE_RENOWN_COST || gameState.heat <= 0}
              title={`Spend ${GREASE_RENOWN_COST} renown to lose ${GREASE_HEAT_RELIEF} heat`}
              aria-label={`Inspector heat ${Math.round(gameState.heat)}%. Spend ${GREASE_RENOWN_COST} renown to reduce it.`}
            >
              <div className="ring-wrap">
                <GaugeRing percent={gameState.heat} color={gameState.heat > 50 ? 'var(--brick)' : 'var(--moss)'} />
              </div>
              <div className="val mono">
                {gameState.heat > 0 && gameState.renown >= GREASE_RENOWN_COST
                  ? `Grease ${GREASE_RENOWN_COST}`
                  : `${Math.round(gameState.heat)}%`}
              </div>
              <div className="lbl">Inspector Heat</div>
            </button>
          </div>

        {/* Standing, renown and funds sit with the gauges: they are the other
            three numbers that describe the whole operation, and they were the
            last things still hunting for a home. */}
        <div className="tickets">
          <div className="ticket hidden lg:flex" title="Selling safe, well-made stock opens better restaurants.">
          <span className="lbl">Standing</span>
          <span className="num">{Math.max(0, Math.round(gameState.reputation))}</span>
          </div>
          <div className="ticket renown hidden sm:flex">
          <span className="lbl">Renown</span>
          <span className="num mono">{gameState.renown}</span>
          </div>
          <div className="ticket funds">
          <span className="lbl">Funds</span>
          <span className="num mono">${gameState.money.toLocaleString()}</span>
          </div>
        </div>

        {/* On a phone the rails become one pane at a time, so the switch lives
            here where it is always reachable. */}
        <div className="rail-tabs">
          {(['bench', 'stock'] as const).map(t => (
            <button key={t}
              className={`rail-tab${railPane === t ? ' active' : ''}`}
              onClick={() => setRailPane(t)}>
              {t === 'bench' ? 'Bench' : 'Stock'}
            </button>
          ))}
        </div>
      </header>
      
      {/* THE SPECTROMETER, HOVERED — small and fast, answering "what is this". */}
      {uiState.hoveredInventoryItem && !openIngredient && (
          <MolecularScan 
             target={{ type: 'ingredient', data: uiState.hoveredInventoryItem }} 
             className="bottom-24 left-1/2 -translate-x-1/2" 
          />
      )}

      {/* AND OPENED — big enough to look at, and answering "what do I make with
          it", which a hover panel has no business teaching. */}
      {/* .ing-overlay sits above the other modals: this is opened FROM one — the
          Supply catalogue — so it has to be on top of the screen that launched
          it, or it renders behind and looks like nothing happened. */}
      {openIngredient && (
        <div className="modal-overlay ing-overlay" onClick={() => setOpenIngredient(null)}>
          <div className="ing-modal" onClick={e => e.stopPropagation()}>
            <button className="close-stamp ing-close" onClick={() => setOpenIngredient(null)} aria-label="Close">
              <CloseIcon size={13} />
            </button>
            <MolecularScan
              embedded
              full
              target={{ type: 'ingredient', data: openIngredient }}
              knowledge={{
                unlockedRecipes: gameState.unlockedRecipes,
                analyzedRecipeIds: gameState.analyzedRecipeIds,
                ownedBookIds: gameState.ownedBookIds,
              }}
            />
          </div>
        </div>
      )}

      {/* Main Layout - Modified to allow Sourcing Popup */}
      <div className={`lab-grid pane-${railPane}`}>

        {/* LEFT RAIL — the world, and what you own. */}
        <aside className="rail left">
          <section className="rail-sect">
            <h3>Almanac</h3>
            <div className="alm">
              <div className="season slab">
                {getSeason(gameState.month)} &middot; {getMonthName(gameState.month)} Wk {(gameState.week - 1) % 4 + 1}
              </div>
              <div className="clime mono">
                {currentAmbient.ambientTemp.toFixed(0)}&deg;C / {currentAmbient.ambientHumidity.toFixed(0)}% RH
              </div>
              <div className="wx">{gameState.weather.type} &mdash; {gameState.weather.description}</div>
            </div>
          </section>



          <section className="rail-sect">
            <h3>Go to</h3>
            <div className="tabs-hud">
            {/* A visible way into the dev tools. The keyboard route alone was not
            enough: the original binding (Cmd/Ctrl+Shift+D) is claimed by
            Chrome for "Bookmark all tabs", so the page never saw it. */}
            <button
            className="dev-chip"
            onClick={() => setShowDev(v => !v)}
            title="Dev tools and god mode — or press the backtick key"
            >
            DEV
            </button>
            {/* Supply sits with the other places you go rather than being a
            button of its own — it is one destination among five, and it
            used to be the only one with a drawer sliding over the room. */}
            <button
            onClick={() => toggleDrawer('marketplace')}
            className={`tab-btn-hud${activeDrawer === 'marketplace' ? ' active' : ''}`}
            title="Ingredients, vessels, tools and books"
            >
            <GameIcon name="supply" size={20} />
            <span className="hidden sm:inline">Supply</span>
            </button>
            {/* Hardware is what you OWN and whether it is working. Supply is
            what you can buy. They were the same button for a while, which
            is why neither question had a clear answer. */}
            <button
            onClick={() => setShowHardware(v => !v)}
            className={`tab-btn-hud${showHardware ? ' active' : ''}`}
            title="The hardware you own, and what it is doing"
            >
            <GameIcon name="hardware" size={20} />
            <span className="hidden sm:inline">Hardware</span>
            </button>
            <button
            onClick={() => setUiState(prev => ({ ...prev, showStaff: !prev.showStaff }))}
            className={`tab-btn-hud${uiState.showStaff ? ' active' : ''}`}
            title="Staff Management"
            >
            <GameIcon name="staff" size={20} />
            <span className="hidden sm:inline">Staff</span>
            </button>
            <button
            onClick={() => setUiState(prev => ({ ...prev, showLogbook: !prev.showLogbook }))}
            className={`tab-btn-hud${uiState.showLogbook ? ' active' : ''}`}
            title="Lab Codex & Archives"
            >
            <GameIcon name="codex" size={20} />
            <span className="hidden sm:inline">Codex</span>
            </button>
            {/* The cellar was a drawn door standing against a painted wall and
                never sat in the room. It is a place you go, so it goes where the
                other places are. */}
            <button
            onClick={() => setShowCellar(true)}
            className="tab-btn-hud"
            title="Below the workshop — where things are laid down to age"
            >
            <GameIcon name="cellar" size={20} />
            <span className="hidden sm:inline">Cellar</span>
            <span className="dot mono">{gameState.batches.filter(b => b.cellared).length}/{CELLAR_CAPACITY}</span>
            </button>
            {gameState.kojiRoomOwned && (
            <button
            onClick={() => setShowKojiRoom(true)}
            className="tab-btn-hud"
            title="The warm cedar room where the koji grows"
            >
            <GameIcon name="cultures" size={20} />
            <span className="hidden sm:inline">Koji Room</span>
            <span className="dot mono">{gameState.batches.filter(b => b.kojiRoom).length}/{KOJI_ROOM_CAPACITY}</span>
            </button>
            )}
            <button
            onClick={() => setShowOrders(true)}
            className={`tab-btn-hud${showOrders ? ' active' : ''}${gameState.contracts.some(c => c.status === 'offered') ? ' has-offer' : ''}`}
            title="Vendor standing and contracts"
            >
            <GameIcon name="orders" size={20} />
            <span className="hidden sm:inline">Orders</span>
            {gameState.contracts.some(c => c.status === 'offered') && <span className="pip" />}
            </button>
            </div>
          </section>

          <section className="rail-sect">
            <h3>Pantry</h3>
            {/* The pantry reads better as a list than as a strip along the bottom. */}
            <div className="pantry">

            <div className="pantry-items custom-scrollbar">
            {/* COUNTED BY TYPE, NOT BY A HARDCODED LIST OF IDS.
            Every line here was wrong in its own way. Salt printed the UNIT
            count with a "g" suffix while a unit of salt is 1000g, so a
            10 kg reserve read as "10g", and Trapani salt was not counted at
            all. Grains asked for 'rice', which is not an id — the substrate
            is 'glutinous_rice' — so rice never appeared. Spores asked for
            'koji_spores_gen2', also not an id: the spores you harvest are
            custom ingredients with generated ids, so every strain you ever
            cultured was invisible here.

            A list of ids drifts from the data the moment content is added.
            Reading the type off the ingredient cannot. */}
            {(() => {
            const all = [...INGREDIENTS, ...gameState.customIngredients];
            const held = (pred: (i: Ingredient) => boolean) =>
            Object.entries(gameState.inventory).reduce<number>((acc, [id, n]) => {
            const ing = all.find(x => x.id === id);
            return ing && pred(ing) ? acc + (Number(n) || 0) * (ing.mass || 0) : acc;
            }, 0);

            const saltG = held(i => i.type === IngredientType.ADDITIVE && /salt/i.test(i.id));
            const substrateG = held(i => i.type === IngredientType.SUBSTRATE);
            const waterMl = held(i => i.id === 'water');
            const sporePkts = Object.entries(gameState.inventory).reduce<number>((acc, [id, n]) => {
            const ing = all.find(x => x.id === id);
            return ing && ing.type === IngredientType.STARTER ? acc + (Number(n) || 0) : acc;
            }, 0);
            const kg = (g: number) => g >= 1000 ? `${(g / 1000).toFixed(g >= 10000 ? 0 : 1)}kg` : `${Math.round(g)}g`;

            return (
            <>
            <div className="pantry-item" title="Every salt on the shelf, by weight">
            <GameIcon name="sparkle" size={16} color="var(--text-mid)" /> Salt &nbsp;<span className="n mono">{kg(saltG)}</span>
            </div>
            <div className="pantry-item" title="Every live starter, bought or cultured">
            <GameIcon name="sprout" size={16} color="var(--moss)" /> Spores &nbsp;<span className="n mono">{sporePkts} pkts</span>
            </div>
            <div className="pantry-item" title="Every substrate on the shelf, by weight">
            <GameIcon name="crates" size={16} color="var(--amber)" /> Substrate &nbsp;<span className="n mono">{kg(substrateG)}</span>
            </div>
            <div className="pantry-item" title="Filtered water">
            <GameIcon name="droplet" size={16} color="var(--teal)" /> Water &nbsp;<span className="n mono">{(waterMl / 1000).toFixed(0)}L</span>
            </div>
            </>
            );
            })()}
            <div
            onClick={() => toggleDrawer('marketplace')}
            className="pantry-item"
            style={{ cursor: 'pointer' }}
            title="Click to view & purchase hardware vessels"
            >
            <GameIcon name="flask" size={16} color="var(--brass)" /> Vessels &nbsp;<span className="n mono">{Object.values(gameState.ownedVessels).reduce((a: number, b) => a + (b as number), 0)}</span>
            </div>
            </div>
            </div>
          </section>
        </aside>

        {/* CENTRE — the room, and nothing else. */}
        <main className="stage">
          <div className="flex-1 relative flex flex-col min-h-0">
           <LabView 
             batches={gameState.batches.filter(b => !b.cellared && !b.kojiRoom)} 
             maxSlots={gameState.equipmentSlots} 
             onSelectSlot={handleSlotClick} 
             onIntervention={handleIntervention}
             inventory={gameState.inventory}
             onOpenTool={setOpenTool}
             month={gameState.month}
             weather={gameState.weather}
             onQuickHarvest={handleQuickHarvest}
             onQuickKeep={handleQuickKeep}
             usedSlots={usedSlots}
             gameSpeed={gameSpeed}
             analyzedRecipeIds={gameState.analyzedRecipeIds} // Pass discovery state
           />
        </div>

        </main>

        {/* RIGHT RAIL — money, where you go, what you have. */}
      </div>

      {showHardware && (
        <div className="modal-overlay" onClick={() => setShowHardware(false)}>
          <div className="hw-modal" onClick={e => e.stopPropagation()}>
            <span className="corner c-tl" />
            <span className="corner c-br" />
            <div className="pr-head">
              <PanelMark name="hardware" />
              <div>
                <span className="kicker">What you own</span>
                <h2>Hardware</h2>
              </div>
              <button className="close-stamp" onClick={() => setShowHardware(false)} aria-label="Close">
                <CloseIcon size={13} />
              </button>
            </div>
            <p className="hw-lede">
              A tool changes a coefficient somewhere whether or not you remember
              owning it. This is the list, and which of it is working right now.
            </p>
            <div className="hw-body custom-scrollbar">
              {/* THE KOJI ROOM, as something you own or can build. A later stage:
                  it only goes on sale once a Head of R&D is on the crew. */}
              <div className={`kr-deed${gameState.kojiRoomOwned ? ' owned' : ''}`}>
                <PanelMark name="kojiroom" size={52} />
                <div className="kr-deed-body">
                  <span className="kicker">{gameState.kojiRoomOwned ? 'Yours' : 'A later stage'}</span>
                  <h3>The Koji Room</h3>
                  <p>
                    Twelve cedar beds held at {KOJI_ROOM_TEMP} °C. Beds carried in stop taking bench slots, and a
                    koji keeper runs the room: turning, taking beds at their peak, laying new ones to keep koji
                    at your target, and letting a bed run to spore when the house is low.
                  </p>
                  {gameState.kojiRoomOwned ? (
                    <div className="kr-deed-row">
                      <span className="mono">
                        {gameState.batches.filter(b => b.kojiRoom).length} / {KOJI_ROOM_CAPACITY} beds ·{' '}
                        {gameState.crew.some(c => c.role === 'toji') ? 'keeper on' : 'no keeper yet — hire one in Staff'}
                      </span>
                      <button className="btn btn-amber sm" onClick={() => { setShowHardware(false); setShowKojiRoom(true); }}>Go in</button>
                    </div>
                  ) : !gameState.crew.some(c => c.role === 'rd') ? (
                    <div className="kr-deed-row locked"><GameIcon name="lock" size={14} /> Hire a Head of R&amp;D first — this is their room to plan.</div>
                  ) : (
                    <div className="kr-deed-row">
                      <span className="mono">${KOJI_ROOM_COST.toLocaleString()}</span>
                      <button className="btn btn-amber sm" disabled={gameState.money < KOJI_ROOM_COST} onClick={handleBuyKojiRoom}>Build the room</button>
                    </div>
                  )}
                </div>
              </div>
              <ToolRack
                inventory={gameState.inventory}
                batches={gameState.batches}
                onOpenTool={id => { setShowHardware(false); setOpenTool(id as any); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SUPPLY — one place to spend money, and a modal like every other screen.
          It used to slide up from the bottom edge over the room and keep a 58px
          bar permanently across the foot of the window whether or not anyone
          wanted to shop. */}
      <SupplyPanel
                  isOpen={activeDrawer === 'marketplace'}
                  onToggle={() => toggleDrawer('marketplace')}
                  ingredients={allIngredients}
                  inventory={gameState.inventory}
                  money={gameState.money}
                  playerXp={gameState.xp}
                  undergroundTier={getUndergroundTierFromXp(gameState.xp)}
                  relationships={gameState.supplierRelationships}
                  ownedVessels={gameState.ownedVessels}
                  ownedBookIds={gameState.ownedBookIds}
                  currentPower={currentPower}
                  maxPower={gameState.maxPower}
                  usedSlots={usedSlots}
                  month={gameState.month}
                  onBuy={handleBuyIngredient}
                  onSellCulture={handleSellCulture}
                  onInspect={setOpenIngredient}
                  marketDemand={gameState.marketDemand}
                  onBuyVessel={handleBuyVessel}
                  onBuyTool={handleBuyIngredient}
                  onBuyBook={handleBuyBook}
                  onUpgradePower={handleUpgradePower}
              />

      {/* MODALS - Z-INDEX 100 */}
      {uiState.modalOpen && (
        <BatchController 
           onClose={() => setUiState(prev => ({ ...prev, modalOpen: false }))} 
           inventory={gameState.inventory}
           ingredients={allIngredients} 
           onStartBatch={handleStartBatch}
           currentPower={currentPower}
           maxPower={gameState.maxPower}
           availableSlots={gameState.equipmentSlots - usedSlots}
           logbook={gameState.logbook}
           ownedVessels={gameState.ownedVessels}
           analyzedRecipeIds={gameState.analyzedRecipeIds} // Pass discovery state
           recipeMastery={gameState.recipeMastery}
           unlockedRecipes={gameState.unlockedRecipes}
           ownedBookIds={gameState.ownedBookIds}
        />
      )}

        {/* THE CELLAR. The mechanics were already here — a cellared batch ticks at a
            sixth of the rate and is out of reach of bench hygiene — but the batch
            vanished when you sent it down, so the one room where you deliberately
            do nothing for a year could not be looked at. */}
        {showCellar && (
          <CellarView
            batches={gameState.batches.filter(b => b.cellared)}
            onClose={() => setShowCellar(false)}
            onSelect={b => { setShowCellar(false); setUiState(u => ({ ...u, activeBatchId: b.id })); }}
            onBringUp={b => handleUncellarBatch(b)}
          />
        )}

        {showKojiRoom && gameState.kojiRoomOwned && (
          <KojiRoomView
            batches={gameState.batches.filter(b => b.kojiRoom)}
            keeper={gameState.crew.find(c => c.role === 'toji')}
            stockKg={kojiStockKg(gameState.inventory)}
            targetKg={gameState.kojiTargetKg ?? KOJI_ROOM_DEFAULT_TARGET_KG}
            onTarget={handleKojiTarget}
            onClose={() => setShowKojiRoom(false)}
            onSelect={b => { setShowKojiRoom(false); setUiState(u => ({ ...u, activeBatchId: b.id })); }}
            onCarryOut={b => handleFromKojiRoom(b)}
          />
        )}

      {/* UNIFIED BIOREACTOR INSPECTOR & HARVEST DECK */}
      {activeBatchForTest && (

          <BatchInspector 
             batch={activeBatchForTest} 
             recipe={getRecipeForBatch(activeBatchForTest)}
             gameSpeed={gameSpeed}
             paused={paused}
             onSetSpeed={setGameSpeed}
             onTogglePause={() => setPaused(p => !p)}
             inventory={gameState.inventory}
             activeStaff={gameState.staff}
             playerRenown={gameState.renown}
             marketDemand={gameState.marketDemand}
             vendorStanding={gameState.vendorStanding}
             contracts={gameState.contracts}
             onDeliver={handleDeliver}
             gameState={gameState}
             playerXp={gameState.xp}
             onClose={() => setUiState(prev => ({ ...prev, activeBatchId: null }))}
             onIntervention={(action) => handleIntervention(activeBatchForTest, action)}
             onSetControl={(patch) => handleSetControl(activeBatchForTest, patch)}
             onQuickHarvest={() => handleQuickHarvest(activeBatchForTest)}
             onSell={handleSell}
             onStore={() => handleStore(activeBatchForTest)}
             onCellar={() => handleCellarBatch(activeBatchForTest)}
             canCellar={!activeBatchForTest.cellared && ageingBehaviour(getRecipeForBatch(activeBatchForTest)) === 'matures'}
             onToKojiRoom={() => handleToKojiRoom(activeBatchForTest)}
             canToKojiRoom={gameState.kojiRoomOwned && !activeBatchForTest.kojiRoom && activeBatchForTest.status !== 'spoiled' && isKojiRecipe(getRecipeForBatch(activeBatchForTest))}
             onFromKojiRoom={activeBatchForTest.kojiRoom ? () => handleFromKojiRoom(activeBatchForTest) : undefined}
             maturityNote={describeMaturity(activeBatchForTest, getRecipeForBatch(activeBatchForTest))}
             onDiscard={handleDiscard}
             onBackSlop={handleBackSlop}
             onSporulate={handleSporulate}
             onProcess={handleProcessBatch}
             onEvaluate={handleEvaluateBatch}
             initialTab={activeBatchForTest.status === 'ready' || activeBatchForTest.status === 'analyzed' ? 'harvest' : 'telemetry'}
          />
      )}

      {harvestReport && (
        <HarvestReport entry={harvestReport} onClose={() => setHarvestReport(null)} />
      )}

      {(openTool === 'wooden_press' || openTool === 'centrifuge') && (
        <PressRoom
          tool={openTool as 'wooden_press' | 'centrifuge'}
          batches={gameState.batches}
          customIngredients={gameState.customIngredients}
          onClose={() => setOpenTool(null)}
          onPress={(b) => { const a = openTool === 'centrifuge' ? 'filter' : 'press'; setOpenTool(null); handleProcessBatch(a, b); }}
        />
      )}

      {showOrders && (
        <OrderBook
          gameState={gameState}
          onClose={() => setShowOrders(false)}
          onAccept={handleAcceptContract}
          onDecline={handleDeclineContract}
        />
      )}

      {uiState.showStaff && (
          <StaffManager 
              onClose={() => setUiState(prev => ({ ...prev, showStaff: false }))}
              crew={gameState.crew ?? []}
              pool={gameState.crewPool ?? []}
              money={gameState.money}
              week={gameState.week}
              onHire={handleHire}
              onLetGo={handleLetGo}
          />
      )}

      {uiState.showLogbook && (
          <LogbookModal 
              onClose={() => setUiState(prev => ({ ...prev, showLogbook: false }))}
              logbook={gameState.logbook}
              analyzedRecipeIds={gameState.analyzedRecipeIds}
              recipeMastery={gameState.recipeMastery}
              unlockedRecipes={gameState.unlockedRecipes}
              ownedBookIds={gameState.ownedBookIds}
              discoveredRecipeIds={gameState.discoveredRecipeIds}
          />
      )}

      {!gameState.onboardingDone && !uiState.showWelcome && !gameState.gameOver && (
        <FirstCulture
          gameState={gameState}
          onDismiss={() => setGameState(prev => ({ ...prev, onboardingDone: true }))}
        />
      )}

      {/* Dismissing the guide used to be permanent, which punished closing it
          once to see the screen underneath. */}
      {gameState.onboardingDone && !uiState.showWelcome && !gameState.gameOver && (
        <button
          className="guide-recall"
          onClick={() => setGameState(prev => ({ ...prev, onboardingDone: false }))}
          title="Reopen the first-culture guide"
        >
          Guide
        </button>
      )}

      {showDev && (
        <DevPanel
          gameState={gameState}
          setGameState={setGameState}
          onClose={() => setShowDev(false)}
          godMode={godMode}
          setGodMode={setGodMode}
        />
      )}

      {/* LAB CLOSED — terminal state */}
      {gameState.gameOver && (
          <div className="raid-scrim" style={{ zIndex: 120 }}>
              <div className="raid-card">
                  <span className="corner c-tl" />
                  <span className="corner c-br" />
                  <div className="badge">
                      <GameIcon name="badge" size={28} style={{ color: 'var(--brick)' }} />
                  </div>
                  <h2>The Atelier Is Closed</h2>
                  <p className="quote">
                      Three weeks in the red. The landlord has changed the locks, the cultures
                      have been cleared out, and the bench is bare.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 22, margin: '0 0 24px' }}>
                      <span className="ticket">
                          <span className="lbl">Survived</span>
                          <span className="num">Y{gameState.year} · Wk {gameState.week}</span>
                      </span>
                      <span className="ticket renown">
                          <span className="lbl">Renown</span>
                          <span className="num">{gameState.renown}</span>
                      </span>
                      <span className="ticket">
                          <span className="lbl">Batches logged</span>
                          <span className="num">{gameState.logbook.length}</span>
                      </span>
                  </div>

                  <div className="raid-opts">
                      <button className="raid-opt concede" onClick={() => { clearSave(); window.location.reload(); }}>
                          Start a new culture
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* RAID OVERLAY */}
      {uiState.inspectorRaid && (
          <div className="raid-scrim">
              <div className="raid-card">
                  <span className="corner c-tl" />
                  <span className="corner c-br" />
                  <div className="badge">
                      <GameIcon name="badge" size={28} style={{ color: 'var(--brick)' }} />
                  </div>
                  <h2>Health Inspection</h2>
                  <p className="quote">
                      &ldquo;We&rsquo;ve had reports of dangerous biological activity. We&rsquo;ll need to see your permits &mdash; and sample your stock.&rdquo;
                  </p>

                  <div className="raid-opts">
                      <button className="raid-opt" onClick={() => handleRaidOutcome('pay')} disabled={gameState.money < 500}>
                          <span>Pay the fine</span>
                          <span className="cost">&minus;$500</span>
                      </button>

                      <button className="raid-opt favor" onClick={() => handleRaidOutcome('bribe')} disabled={gameState.renown < 50}>
                          <span>Call in a favour</span>
                          <span className="cost">&minus;50 Renown</span>
                      </button>

                      <button className="raid-opt concede" onClick={() => handleRaidOutcome('confiscate')}>
                          Let them take the illegal stock
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

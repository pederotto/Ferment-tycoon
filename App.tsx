
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GameState, Batch, Ingredient, IngredientType, LogEntry, Buyer, StaffRoleType, WeatherState, WeatherType, Vessel, FermentType, Book, Lineage, ChamberControls, CrewMember } from './types';
import { BUYERS, INGREDIENTS, INITIAL_MONEY, RECIPES, VESSELS, INITIAL_MAX_POWER, DAY_DURATION_MS, STAFF_ROLES, DEMAND_FLOOR, BANKRUPTCY_STRIKES, BOOKS, SUPPLIERS, CELLAR_CAPACITY, CELLAR_TICK_DIVISOR,
  RAID_HEAT_THRESHOLD, RAID_CHANCE_PER_DAY, HEAT_DECAY_PER_TICK, HEAT_DECAY_AFTER_BUST,
  HEAT_DECAY_FROM_CLEANLINESS, HEAT_PER_ILLEGAL_BATCH, HEAT_FROM_FILTH, HYGIENE_NEGLECT_FLOOR,
  GREASE_RENOWN_COST, GREASE_HEAT_RELIEF, getUndergroundTierFromXp } from './constants';
import { ageingBehaviour, describeMaturity, processBatchTick, getAmbientConditions, applyBatchIntervention, calculateBatchDynamics, getRecipeForBatch, calculateCriticScore, getInterestedBuyers, getBestOffer, getDemandHitForSale, recoverDemand, calculateOverheads, getLineage, getControls } from './services/gameLogic';
import { propagateLineage, lineageStrainKey, lineageStrainLabel, describeLineage } from './services/koji';
import { rollCrewPool, advanceCrew, crewWages, crewToStaffFlags, crewEffect } from './services/crew';
import LabView from './components/LabView';
import SupplyPanel from './components/SupplyPanel';
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
import DevPanel from './components/DevPanel';
import FirstCulture from './components/FirstCulture';
import { FlaskConical, TrendingUp, Sparkles, BookOpen, AlertCircle, SprayCan, Star, Zap, Flame, ShieldAlert, Calendar, Users, CloudSun, Clock, Activity, CloudRain, Sun, CloudSnow, Wind, CloudFog, FastForward, Play, PauseCircle, Wrench, Handshake } from 'lucide-react';
import { SealGlyphIcon, AlmanacIcon, GaugeRing, WrenchIcon, StaffGroupIcon, BookIcon, GrainSprigIcon, SaltCrystalIcon, WaterDropIcon, SporeClusterIcon, VesselLineIcon, ArrowRightIcon } from './components/icons';

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
    supplierRelationships: {
      'nordic': { level: 1, xp: 0 },
      'biolab': { level: 1, xp: 0 },
      'prime': { level: 1, xp: 0 },
      'black_market': { level: 1, xp: 0 },
      'in_house': { level: 1, xp: 0 },
      'asia_import': { level: 1, xp: 0 },
      'tech': { level: 1, xp: 0 }
    },
    customIngredients: [],
    staff: {
        cleaner: false,
        tech: false,
        chef: false,
        rd: false
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
    onboardingDone: false
  });

  // Any run left behind by a previous session, read once so the welcome screen
  // can offer to resume it.
  const [savedRun] = useState(() => getSaveMeta());

  // Game Speed State (0 = Paused, 1x, 2x, 4x, 8x)
  const [gameSpeed, setGameSpeed] = useState<number>(1);
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

  // Spacebar to pause / unpause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setGameSpeed(prev => {
          if (prev === 0) {
            return lastActiveSpeed.current || 1;
          } else {
            lastActiveSpeed.current = prev;
            return 0;
          }
        });
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
     if (b.cellared) return acc;
     const v = VESSELS.find(v => v.id === b.vesselId);
     return acc + (v?.slotsRequired || 1);
  }, 0);
  
  const currentPower = gameState.batches.reduce((acc, b) => {
     if (b.cellared) return acc;
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
          case 'Sunny': return <Sun className="w-4 h-4 text-yellow-400" />;
          case 'Heatwave': return <Sun className="w-4 h-4 text-orange-500 animate-pulse" />;
          case 'Rainy': return <CloudRain className="w-4 h-4 text-blue-400" />;
          case 'Stormy': return <Zap className="w-4 h-4 text-purple-400" />;
          case 'Snowy': return <CloudSnow className="w-4 h-4 text-white" />;
          case 'Foggy': return <CloudFog className="w-4 h-4" style={{ color: 'var(--text-mid)' }} />;
          default: return <CloudSun className="w-4 h-4" style={{ color: 'var(--text-mid)' }} />;
      }
  };

  // --- Game Loop ---
  useEffect(() => {
    if (uiState.inspectorRaid || uiState.showWelcome) return; 
    if (gameSpeed === 0) return; // Fully paused state
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
            || (batch.status === 'ready' && ageingBehaviour(getRecipeForBatch(batch)) === 'matures');
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
        const activeBatchCount = prev.batches.filter(b => b.status === 'active').length;
        const loadMultiplier = 1 + activeBatchCount * 0.18;
        const hygieneDecay = (prev.staff['cleaner'] ? 0.03 : 0.06) * loadMultiplier;
        // A working bench gets dirty; it does not become derelict on its own.
        // With no floor, hygiene parked at zero on any busy bench, and since
        // filth added more heat than heat shed, the inspector became permanent —
        // which is what "he turns up as soon as anything is brewing" was.
        const hygieneFloor = prev.staff['cleaner'] ? 50 : HYGIENE_NEGLECT_FLOOR;
        const newHygiene = Math.max(hygieneFloor, prev.hygiene - hygieneDecay);
        
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
                if (newWeek % 4 === 1 || newCrewPool.length === 0) newCrewPool = rollCrewPool(newWeek);

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
  }, [uiState.inspectorRaid, uiState.showWelcome, gameSpeed, gameState.gameOver]); 

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
          // Confiscate illegal batches + fine
          const legalBatches = gameState.batches.filter(b => {
               const sub = INGREDIENTS.find(i => i.id === b.substrateId);
               return sub?.currency !== 'renown';
          });
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

  const handleSporulate = () => {
    const batch = activeBatchForTest;
    if (!batch) return;
    // 0 Value, 10 Spores
    processHarvest(batch, 0, 0, 10, true, "Internal Lab");
    setLabNotification({
      id: Date.now(),
      text: `✨ Lineage Advanced: +10x Generation ${batch.generation + 1} Spores cultivated!`,
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
        const parent = getLineage(batch);
        const child = propagateLineage(parent, batch.history, batch.lineageDamaged);
        const strain = lineageStrainKey(child.bias);
        const nextGen = child.generation;

        const sporeId = `koji_spores_gen${nextGen}_${strain}`;
        const existingIdx = newCustomIngredients.findIndex(i => i.id === sporeId);

        // Re-propagating into a strain you already hold blends the two rather
        // than overwriting: your house culture is the average of what you have
        // been doing to it, which is how selection actually works.
        const merged: Lineage = existingIdx >= 0 && newCustomIngredients[existingIdx].lineage
            ? {
                generation: nextGen,
                vigor: Math.max(newCustomIngredients[existingIdx].lineage!.vigor, child.vigor),
                resilience: Math.max(newCustomIngredients[existingIdx].lineage!.resilience, child.resilience),
                bias: (newCustomIngredients[existingIdx].lineage!.bias + child.bias) / 2,
              }
            : child;

        const spore: Ingredient = {
            id: sporeId,
            name: `Master Spores (Gen ${nextGen} · ${lineageStrainLabel(merged.bias)})`,
            type: IngredientType.STARTER,
            baseCost: 150 + (nextGen * 50),
            currency: 'money',
            quality: 100,
            description: describeLineage(merged),
            idealFor: ['koji'],
            supplierId: 'in_house',
            tierRequired: 0,
            hiddenStats: { starchContent: 0, sugarContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0 },
            mass: 10,
            unitDisplay: 'g',
            isLiving: true,
            generation: nextGen,
            // strainBias is what advanceEnzymes actually reads, so the drift
            // reaches the simulation through the same door a bought spore does.
            strainBias: merged.bias,
            lineage: merged,
        };

        if (existingIdx >= 0) newCustomIngredients[existingIdx] = spore;
        else newCustomIngredients.push(spore);

        newInventory[sporeId] = (newInventory[sporeId] || 0) + sporeAmount;
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
              <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--brass)' }} />
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
      <header className="hud sticky top-0 z-30">
        {/* BRAND, ALMANAC & TIME ENGINE */}
        <div className="brand" style={{ minWidth: 0 }}>
          <div className="seal"><SealGlyphIcon size={22} /></div>
          <div className="wordmark hidden sm:flex">
            <span className="title slab">FERMENTA</span>
            <span className="sub">Atelier &amp; Culture House</span>
          </div>
          <div className="divider-line hidden lg:block" />
          <div className="almanac hidden lg:flex">
            <AlmanacIcon size={18} />
            <div>
              {/* Week is shown as the week WITHIN the month, so it needs the month
                  beside it — otherwise week 5 reads as "Wk 1" and looks like the
                  run has reset. */}
              <div className="season slab">{getSeason(gameState.month)} &middot; {getMonthName(gameState.month)} Wk {(gameState.week - 1) % 4 + 1}, Day {gameState.day}</div>
              <div className="date mono clime">
                {currentAmbient.ambientTemp.toFixed(0)}&deg;C / {currentAmbient.ambientHumidity.toFixed(0)}% RH &middot; {gameState.weather.type}
              </div>
            </div>
          </div>
          <div className="divider-line hidden md:block" />
          {/* GAME SPEED & TIME ENGINE */}
          <div className="hud-speed flex items-center gap-1 rounded-xl p-1 border border-line-strong ml-1 shadow-inner relative z-50" style={{ background: 'rgba(0,0,0,0.25)' }}>
            <button
              onClick={() => {
                if (gameSpeed === 0) {
                  setGameSpeed(lastActiveSpeed.current || 1);
                } else {
                  lastActiveSpeed.current = gameSpeed;
                  setGameSpeed(0);
                }
              }}
              className={`chip-tab${gameSpeed === 0 ? ' active' : ''}`}
              title="Toggle Pause / Resume (Spacebar)"
            >
              {gameSpeed === 0 ? <PauseCircle className="w-3 h-3 inline mr-1" /> : <Play className="w-3 h-3 inline mr-1" />}
              {gameSpeed === 0 ? 'PAUSED' : 'RUN'}
            </button>
            {[1, 2, 4, 8].map(speed => (
              <button
                key={speed}
                onClick={() => { lastActiveSpeed.current = speed; setGameSpeed(speed); }}
                className={`chip-tab${gameSpeed === speed ? ' active' : ''}`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* CENTER: GAUGE RINGS */}
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

        {/* RIGHT: ASSETS, RENOWN & MODAL LAUNCHERS */}
        <div className="flex items-center gap-3">
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
            <button
              onClick={() => toggleDrawer('marketplace')}
              className={`tab-btn-hud${activeDrawer === 'hardware' ? ' active' : ''}`}
              title="Hardware Store & Vessels"
            >
              <WrenchIcon size={14} />
              <span className="hidden sm:inline">Hardware</span>
            </button>
            <button
              onClick={() => setUiState(prev => ({ ...prev, showStaff: !prev.showStaff }))}
              className={`tab-btn-hud${uiState.showStaff ? ' active' : ''}`}
              title="Staff Management"
            >
              <StaffGroupIcon size={14} />
              <span className="hidden sm:inline">Staff</span>
            </button>
            <button
              onClick={() => setUiState(prev => ({ ...prev, showLogbook: !prev.showLogbook }))}
              className={`tab-btn-hud${uiState.showLogbook ? ' active' : ''}`}
              title="Lab Codex & Archives"
            >
              <BookIcon size={14} />
              <span className="hidden sm:inline">Codex</span>
            </button>
            <button
              onClick={() => setShowOrders(true)}
              className={`tab-btn-hud${showOrders ? ' active' : ''}${gameState.contracts.some(c => c.status === 'offered') ? ' has-offer' : ''}`}
              title="Vendor standing and contracts"
            >
              <Handshake size={14} />
              <span className="hidden sm:inline">Orders</span>
              {gameState.contracts.some(c => c.status === 'offered') && <span className="pip" />}
            </button>
          </div>
        </div>
      </header>
      
      {/* MOLECULAR SCAN (GLOBAL) */}
      {uiState.hoveredInventoryItem && (
          <MolecularScan 
             target={{ type: 'ingredient', data: uiState.hoveredInventoryItem }} 
             className="bottom-24 left-1/2 -translate-x-1/2" 
          />
      )}

      {/* Main Layout - Modified to allow Sourcing Popup */}
      <main className="flex-1 relative overflow-hidden flex flex-col z-10 pb-3 px-3">
        {/* Lab View takes main stage */}
        <div className="flex-1 relative h-full flex flex-col min-h-0">
           <LabView 
             batches={gameState.batches} 
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

        {/* FLOATING LAB PANTRY QUICK BAR */}
        <div className="pantry mt-3">
          <div className="pantry-lbl">
            <span className="dot" style={{ color: 'var(--moss)' }} />
            Pantry Stock
          </div>

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
                    <SaltCrystalIcon size={12} color="var(--text-lo)" /> Salt &nbsp;<span className="n mono">{kg(saltG)}</span>
                  </div>
                  <div className="pantry-item" title="Every live starter, bought or cultured">
                    <SporeClusterIcon size={12} color="var(--moss)" /> Spores &nbsp;<span className="n mono">{sporePkts} pkts</span>
                  </div>
                  <div className="pantry-item" title="Every substrate on the shelf, by weight">
                    <GrainSprigIcon size={12} color="var(--amber)" /> Substrate &nbsp;<span className="n mono">{kg(substrateG)}</span>
                  </div>
                  <div className="pantry-item" title="Filtered water">
                    <WaterDropIcon size={12} color="var(--teal)" /> Water &nbsp;<span className="n mono">{(waterMl / 1000).toFixed(0)}L</span>
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
              <VesselLineIcon vesselId={'mason_jar'} size={12} color="var(--brass)" /> Vessels &nbsp;<span className="n mono">{Object.values(gameState.ownedVessels).reduce((a: number, b) => a + (b as number), 0)}</span>
            </div>
          </div>

          <button
            onClick={() => toggleDrawer('marketplace')}
            className="order-btn"
            style={activeDrawer === 'marketplace' ? { background: 'var(--brick)', color: '#fbe7df' } : undefined}
          >
            {activeDrawer === 'marketplace' ? 'Close Supplies ✕' : <>Order Supplies <ArrowRightIcon size={12} color="#1d1206" /></>}
          </button>
        </div>
      </main>

      {/* Sourcing Drawer - Root Level to fix Stacking Context */}
      {/* SUPPLY — one drawer, one place to spend money */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none px-0 md:px-4 h-0 overflow-visible">
          <div className="w-full max-w-[1400px] pointer-events-none absolute bottom-0">
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
                  onBuy={handleBuyIngredient}
                  onBuyVessel={handleBuyVessel}
                  onBuyTool={handleBuyIngredient}
                  onBuyBook={handleBuyBook}
                  onUpgradePower={handleUpgradePower}
              />
          </div>
      </div>

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

      {/* UNIFIED BIOREACTOR INSPECTOR & HARVEST DECK */}
      {activeBatchForTest && (
          <BatchInspector 
             batch={activeBatchForTest} 
             recipe={getRecipeForBatch(activeBatchForTest)}
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
                      <ShieldAlert className="w-7 h-7" style={{ color: 'var(--brick)' }} />
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
                      <ShieldAlert className="w-7 h-7" style={{ color: 'var(--brick)' }} />
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

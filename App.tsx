
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GameState, Batch, Ingredient, IngredientType, LogEntry, Buyer, StaffRoleType, WeatherState, WeatherType, Vessel, FermentType, Book } from './types';
import { INGREDIENTS, INITIAL_MONEY, RECIPES, VESSELS, INITIAL_MAX_POWER, DAY_DURATION_MS, STAFF_ROLES, DEMAND_FLOOR, BANKRUPTCY_STRIKES, BOOKS,
  RAID_HEAT_THRESHOLD, RAID_BASE_CHANCE, HEAT_DECAY_PER_TICK, HEAT_PER_ILLEGAL_BATCH, HEAT_FROM_FILTH,
  GREASE_RENOWN_COST, GREASE_HEAT_RELIEF, getUndergroundTierFromXp } from './constants';
import { processBatchTick, getAmbientConditions, applyBatchIntervention, calculateBatchDynamics, getRecipeForBatch, calculateCriticScore, getInterestedBuyers, getBestOffer, getDemandHitForSale, recoverDemand, calculateOverheads } from './services/gameLogic';
import LabView from './components/LabView';
import Marketplace from './components/Marketplace';
import HardwareStore from './components/HardwareStore';
import BatchController from './components/BatchController';
import BatchInspector from './components/BatchInspector';
import StaffManager from './components/StaffManager';
import WelcomeScreen from './components/WelcomeScreen';
import LogbookModal from './components/LogbookModal';
import MolecularScan, { ScanTarget } from './components/MolecularScan';
import { saveGame, loadGame, getSaveMeta, clearSave } from './services/persistence';
import { grantMastery } from './services/mastery';
import DevPanel from './components/DevPanel';
import { FlaskConical, TrendingUp, Sparkles, BookOpen, AlertCircle, SprayCan, Star, Zap, Flame, ShieldAlert, Calendar, Users, CloudSun, Clock, Activity, CloudRain, Sun, CloudSnow, Wind, CloudFog, FastForward, Play, PauseCircle, Wrench } from 'lucide-react';
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
    analyzedRecipeIds: [], // Start with empty discovery
    equipmentSlots: 8,
    ownedVesselIds: ['mason_jar', 'koji_tray'], // Initial unlocked vessels
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
    weather: { type: 'Cloudy', tempModifier: 0, humidityModifier: 0, description: 'Overcast' },
    marketDemand: Object.values(FermentType).reduce((acc, t) => ({ ...acc, [t]: 1 }), {} as Record<string, number>),
    insolvencyStrikes: 0,
    gameOver: false,
    recipeMastery: {},
    undergroundBusts: 0
  });

  // Any run left behind by a previous session, read once so the welcome screen
  // can offer to resume it.
  const [savedRun] = useState(() => getSaveMeta());

  // Game Speed State (0 = Paused, 1x, 2x, 4x, 8x)
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const lastActiveSpeed = useRef<number>(1);

  // Lab Event / Alert Notification
  const [labNotification, setLabNotification] = useState<{ id: number; text: string; type: 'info' | 'warn' | 'alert' } | null>(null);

  // Auto-dismiss lab notifications
  useEffect(() => {
    if (!labNotification) return;
    const t = setTimeout(() => {
      setLabNotification(null);
    }, 5000);
    return () => clearTimeout(t);
  }, [labNotification?.id]);

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
  // Ctrl/Cmd+Shift+D, or load the page with ?dev in the query string.
  const [showDev, setShowDev] = useState<boolean>(() => {
    try { return new URLSearchParams(window.location.search).has('dev'); } catch { return false; }
  });
  const [godMode, setGodMode] = useState<boolean>(() => {
    try { return new URLSearchParams(window.location.search).has('god'); } catch { return false; }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
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
  const usedSlots = gameState.batches.reduce((acc, b) => {
     const v = VESSELS.find(v => v.id === b.vesselId);
     return acc + (v?.slotsRequired || 1);
  }, 0);
  
  const currentPower = gameState.batches.reduce((acc, b) => {
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
      setGameState((prev) => {
        const isPowerAvailable = prev.power <= prev.maxPower;
        
        // Process Batches
        const updatedBatches = prev.batches.map(batch => {
          if (batch.status === 'active') {
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
              return processBatchTick(batch, recipe, prev.hygiene, substrate, batchIngredients, prev.staff, prev.inventory, prev.month, prev.weather, isPowerAvailable);
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
        const hygieneFloor = prev.staff['cleaner'] ? 50 : 0;
        const newHygiene = Math.max(hygieneFloor, prev.hygiene - hygieneDecay);
        
        let heatChange = 0;
        if (newHygiene < 40) heatChange += HEAT_FROM_FILTH;
        // Contraband is now flagged on the batch itself. It used to be inferred
        // from "substrate was bought with renown", which stopped meaning anything
        // once the underground started charging money.
        const illegalBatches = prev.batches.filter(b => b.contraband).length;
        if (illegalBatches > 0) heatChange += illegalBatches * HEAT_PER_ILLEGAL_BATCH;

        // Once you have conceded a raid you are on a list, and heat no longer
        // cools on its own — the only way down is to spend renown greasing it.
        const decay = prev.undergroundBusts > 0 ? 0 : HEAT_DECAY_PER_TICK;
        const newHeat = Math.min(100, Math.max(0, prev.heat + heatChange - decay));

        // Heat is a risk budget, not a wall: the inspector's odds rise smoothly
        // with how far over the threshold you are sitting, rather than being a
        // flat 1% above 80.
        if (newHeat > RAID_HEAT_THRESHOLD) {
            const over = (newHeat - RAID_HEAT_THRESHOLD) / (100 - RAID_HEAT_THRESHOLD);
            if (Math.random() < RAID_BASE_CHANCE * over * over * 8) {
                setUiState(u => ({ ...u, inspectorRaid: true }));
            }
        }

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

            // Start of a New Week
            if (newDay > 7) {
                newDay = 1;
                newWeek += 1;

                // --- WEEKLY BILLS ---
                // The bench used to cost nothing to keep open, so there was no
                // floor to beat and no reason not to sprawl. Rent, per-vessel
                // upkeep and metered power give every week a number to clear.
                const totalWages = STAFF_ROLES.reduce((acc, role) => prev.staff[role.id] ? acc + role.weeklyWage : acc, 0);
                const drawnWatts = prev.batches.reduce((acc, b) => acc + (VESSELS.find(v => v.id === b.vesselId)?.powerDraw || 0), 0);
                const bills = calculateOverheads(prev.ownedVesselIds, drawnWatts, totalWages);

                newMoney -= bills.total;

                if (newMoney < 0) {
                    // Staff walk first — they are the largest and most optional cost.
                    if (totalWages > 0) {
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

                // Appetite for every ferment type drifts back toward normal.
                newMarketDemand = recoverDemand(prev.marketDemand);

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
                staff: newStaff,
                weather: newWeather,
                marketDemand: newMarketDemand,
                insolvencyStrikes: newStrikes,
                gameOver: newGameOver
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
        }
    }
  };

  const handleBuyVessel = (vessel: Vessel) => {
      if (gameState.money >= vessel.cost && !gameState.ownedVesselIds.includes(vessel.id)) {
          setGameState(prev => ({
              ...prev,
              money: prev.money - vessel.cost,
              ownedVesselIds: [...prev.ownedVesselIds, vessel.id]
          }));
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
    }

    // Initialize New Physics State
    newBatch.stress = 0;
    newBatch.disturbanceTimer = 0;
    newBatch.flags = { isLidPropped: false };

    setGameState(prev => {
        const newInventory = { ...prev.inventory };
        
        usedIngredients.forEach(ing => { 
            if (ing.type !== IngredientType.TOOL && newInventory[ing.id] > 0) {
                // Use deductionMap if available, else default to 1 unit
                const amountToDeduct = deductionMap && deductionMap[ing.id] ? deductionMap[ing.id] : 1;
                newInventory[ing.id] = Math.max(0, newInventory[ing.id] - amountToDeduct);
            }
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
            return applyBatchIntervention(b, action, currentAmbient);
        }),
        // Small hygiene hit for interactions
        hygiene: Math.max(0, prev.hygiene - 1) 
    }));
  };

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
          batches: prev.batches.map(b => b.id === batch.id ? { ...b, status: 'analyzed', evaluationScore: score } : b)
      }));
  };

  // --- PROCESSING LOGIC ---
  const handleProcessBatch = (action: 'press' | 'filter') => {
      const batch = activeBatchForTest;
      if (!batch) return;

      // RESOLVE INGREDIENTS TO CHECK WATER CONTENT
      const batchIngredients = batch.inputIngredientIds.map(id => 
          [...INGREDIENTS, ...gameState.customIngredients].find(i => i.id === id)
      ).filter(Boolean) as Ingredient[];

      const { waterRatio, totalMass } = calculateBatchDynamics(batchIngredients, batch.ingredientQuantities);

      setGameState(prev => {
          let updatedBatches = prev.batches;
          let updatedInventory = { ...prev.inventory };
          let newMessages: string[] = [];

          if (action === 'press') {
              // LOGIC: If Wet Mash (>50% water), SPLIT into Sauce + Paste
              if (waterRatio > 0.5) {
                  // Calculate Yields
                  const liquidMass = totalMass * waterRatio * 0.8; // 80% extraction efficiency
                  const liquidUnits = Math.floor(liquidMass / 1000); // Convert grams to units (approx) for simple inventory
                  
                  if (liquidUnits > 0) {
                      updatedInventory['amino_sauce'] = (updatedInventory['amino_sauce'] || 0) + liquidUnits;
                      newMessages.push(`Extracted ${liquidUnits}L Amino Sauce`);
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
      { score, activeStaff: gameState.staff, marketDemand: gameState.marketDemand },
      gameState.renown
    );

    processHarvest(batch, bestPrice, bestRenown, 0, false, bestBuyerName);
    setLabNotification({
      id: Date.now(),
      text: `⚡ Quick Harvest: ${recipe.name} sold to ${bestBuyerName} for $${bestPrice}${bestRenown > 0 ? ` & +${bestRenown} Renown` : ''}!`,
      type: 'info'
    });
  };

  const handleSell = (buyer: Buyer, price: number, renownGain: number) => {
    const batch = activeBatchForTest;
    if (!batch) return;

    // Dealing with a fence leaves a trace.
    if (buyer.heatPerSale) {
      setGameState(prev => ({ ...prev, heat: Math.min(100, prev.heat + buyer.heatPerSale!) }));
    }
    
    // Process Harvest for a specific buyer
    processHarvest(batch, price, renownGain, 0, false, buyer.name);
    setLabNotification({
      id: Date.now(),
      text: `✨ Transacted: Sold to ${buyer.name} for $${price.toLocaleString()}${renownGain > 0 ? ` & +${renownGain} Renown` : ''}!`,
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

  const processHarvest = (batch: Batch, moneyGain: number, renownGain: number, sporeAmount: number, isSporulation: boolean, buyerName: string) => {
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
    if (sporeAmount > 0) {
        let nextGen = batch.generation + 1;
        if (batch.lineageDamaged) {
            nextGen = Math.max(1, batch.generation - 1);
        }

        const sporeId = `koji_spores_gen${nextGen}`;
        const existingSpore = newCustomIngredients.find(i => i.id === sporeId);
        
        if (!existingSpore) {
            const newSpore: Ingredient = {
                id: sporeId,
                name: `Master Spores (Gen ${nextGen})`,
                type: IngredientType.STARTER,
                baseCost: 150 + (nextGen * 50), 
                currency: 'money', 
                quality: 100,
                description: `Cultivated lineage. Generation ${nextGen}. Enhanced Vigor & Resilience.`,
                idealFor: ['koji'],
                supplierId: 'in_house',
                tierRequired: 0,
                hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0 },
                mass: 10,
                unitDisplay: 'g',
                isLiving: true,
                generation: nextGen,
                lineageBuffs: {
                    speedMultiplier: 1 + (nextGen * 0.05),
                    resilience: nextGen * 5
                }
            };
            newCustomIngredients.push(newSpore);
        }

        newInventory[sporeId] = (newInventory[sporeId] || 0) + sporeAmount;
    }

    // Selling floods the market for that ferment type. Bulk floods it harder,
    // so dumping cask after cask of one product stops paying.
    const soldType = recipe?.type;
    const demandHit = isSporulation ? 0 : getDemandHitForSale(batch);

    // Cooking a recipe is how you learn it. Weighted by the critic score, so a
    // good run teaches disproportionately more and a failure teaches nothing.
    const mastery = grantMastery(gameState.recipeMastery, recipe, calculatedScore);
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
    }));
    setUiState(prev => ({ ...prev, activeBatchId: null }));
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
    const storeMastery = grantMastery(gameState.recipeMastery, recipe, currentScore);
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

  const handleHire = (roleId: StaffRoleType) => {
      const role = STAFF_ROLES.find(r => r.id === roleId);
      if (role && gameState.money >= role.hiringCost) {
          setGameState(prev => ({
              ...prev,
              money: prev.money - role.hiringCost,
              staff: { ...prev.staff, [roleId]: true }
          }));
      }
  };

  const handleFire = (roleId: StaffRoleType) => {
      setGameState(prev => ({
          ...prev,
          staff: { ...prev.staff, [roleId]: false }
      }));
  };

  // Helper for ambient display
  const currentAmbient = getAmbientConditions(gameState.month, gameState.weather);

  return (
    <div className="min-h-screen font-sans selection:bg-amber-500/30 relative flex flex-col" style={{ background: 'var(--bg-void)', color: 'var(--text-hi)' }}>
      
      {/* GLOBAL BACKDROP FOR CLOSING DRAWERS
          Stacking order matters here: scrim (z-20) < hardware drawer (z-25) <
          HUD (z-30) < marketplace drawer (z-50). The scrim has to stay BELOW
          the hardware drawer or it dims and blurs the very panel it is meant to
          set apart, and the hardware drawer has to stay below the HUD so its
          closed grab-tab does not cover the gauge rings. */}
      {activeDrawer && (
          <div 
             className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[1px]"
             onClick={() => setActiveDrawer(null)}
          ></div>
      )}

      {/* HARDWARE STORE (Top Drawer) */}
      <HardwareStore 
        isOpen={activeDrawer === 'hardware'}
        onToggle={() => toggleDrawer('hardware')}
        money={gameState.money}
        ownedVesselIds={gameState.ownedVesselIds}
        tools={toolIngredients}
        inventory={gameState.inventory}
        currentPower={currentPower}
        maxPower={gameState.maxPower}
        onBuyVessel={handleBuyVessel}
        onBuyTool={handleBuyIngredient}
        onUpgradePower={handleUpgradePower}
      />

      {/* LAB NOTIFICATION TOAST */}
      {labNotification && (
          <div className={`toast ${labNotification.type === 'alert' ? 'alert' : labNotification.type === 'warn' ? 'warn' : ''}`}>
              <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--brass)' }} />
              <span style={{ flex: 1 }}>{labNotification.text}</span>
              <button
                className="close"
                onClick={() => setLabNotification(null)}
                aria-label="Dismiss notification"
              >
                &times;
              </button>
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
            <button
              onClick={() => toggleDrawer('hardware')}
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
             onQuickHarvest={handleQuickHarvest}
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
            <div className="pantry-item" title="Salt Reserves (g)">
              <SaltCrystalIcon size={12} color="var(--text-lo)" /> Salt &nbsp;<span className="n mono">{gameState.inventory['salt'] || 0}g</span>
            </div>
            <div className="pantry-item" title="Master Koji Spores">
              <SporeClusterIcon size={12} color="var(--moss)" /> Spores &nbsp;<span className="n mono">
                {(gameState.inventory['koji_spores'] || 0) + (gameState.inventory['koji_spores_gen2'] || 0)} pkts
              </span>
            </div>
            <div className="pantry-item" title="Grains & Substrates">
              <GrainSprigIcon size={12} color="var(--amber)" /> Grains &nbsp;<span className="n mono">
                {(gameState.inventory['barley'] || 0) + (gameState.inventory['soybeans'] || 0) + (gameState.inventory['rice'] || 0)} units
              </span>
            </div>
            <div className="pantry-item" title="Liquid Volume">
              <WaterDropIcon size={12} color="var(--teal)" /> Water &nbsp;<span className="n mono">{gameState.inventory['water'] || 0}L</span>
            </div>
            <div
              onClick={() => toggleDrawer('hardware')}
              className="pantry-item"
              style={{ cursor: 'pointer' }}
              title="Click to view & purchase hardware vessels"
            >
              <VesselLineIcon vesselId={gameState.ownedVesselIds[gameState.ownedVesselIds.length - 1] || 'mason_jar'} size={12} color="var(--brass)" /> Vessels &nbsp;<span className="n mono">{gameState.ownedVesselIds.length} types</span>
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
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none px-0 md:px-4 h-0 overflow-visible">
          <div className="w-full max-w-5xl pointer-events-none absolute bottom-0">
              <Marketplace 
                  isOpen={activeDrawer === 'marketplace'}
                  onToggle={() => toggleDrawer('marketplace')}
                  ingredients={activeIngredients} 
                  inventory={gameState.inventory} 
                  money={gameState.money} 
                  renown={gameState.renown}
                  relationships={gameState.supplierRelationships}
                  onBuy={handleBuyIngredient} 
                  ownedVesselIds={gameState.ownedVesselIds}
                  onBuyVessel={handleBuyVessel}
                  onBuyBook={handleBuyBook}
                  ownedBookIds={gameState.ownedBookIds}
                  playerXp={gameState.xp}
             playerReputation={gameState.reputation}
                  undergroundTier={getUndergroundTierFromXp(gameState.xp)}
                  onOpenHardware={() => toggleDrawer('hardware')}
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
           ownedVesselIds={gameState.ownedVesselIds}
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
             playerXp={gameState.xp}
             onClose={() => setUiState(prev => ({ ...prev, activeBatchId: null }))}
             onIntervention={(action) => handleIntervention(activeBatchForTest, action)}
             onQuickHarvest={() => handleQuickHarvest(activeBatchForTest)}
             onSell={handleSell}
             onStore={() => handleStore(activeBatchForTest)}
             onDiscard={handleDiscard}
             onBackSlop={handleBackSlop}
             onSporulate={handleSporulate}
             onProcess={handleProcessBatch}
             onEvaluate={handleEvaluateBatch}
             initialTab={activeBatchForTest.status === 'ready' || activeBatchForTest.status === 'analyzed' ? 'harvest' : 'telemetry'}
          />
      )}

      {uiState.showStaff && (
          <StaffManager 
              onClose={() => setUiState(prev => ({ ...prev, showStaff: false }))}
              activeStaff={gameState.staff}
              money={gameState.money}
              onHire={handleHire}
              onFire={handleFire}
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
          />
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

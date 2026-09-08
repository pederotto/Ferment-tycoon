import { GameState, FermentType } from '../types';
import { INGREDIENTS } from '../constants';
import { rollCrewPool } from './crew';

/**
 * SAVE / LOAD
 *
 * The game previously kept everything in React state and nothing else, so a
 * refresh — or an accidental tab close — threw away the whole run. Progress is
 * now mirrored into localStorage once per in-game day.
 *
 * Saves are versioned. A save written by an older build is migrated forward when
 * that is safe and discarded when it is not, so a stale shape can never crash
 * the bench on load.
 */

// Three slots rather than one. "Start over" used to destroy the only save that
// existed, irreversibly and without warning.
const SLOT_COUNT = 3;
const slotKey = (slot: number) => `fermenta.save.v1.slot${slot}`;
const LEGACY_KEY = 'fermenta.save.v1';
let activeSlot = 1;

export const getActiveSlot = () => activeSlot;
export const setActiveSlot = (slot: number) => { activeSlot = Math.min(SLOT_COUNT, Math.max(1, slot)); };
export const listSlots = () => Array.from({ length: SLOT_COUNT }, (_, i) => i + 1);

const STORAGE_KEY_LEGACY = LEGACY_KEY;
const SAVE_VERSION = 1;

interface SaveEnvelope {
  version: number;
  savedAt: number;
  state: GameState;
}

const freshDemand = (): Record<string, number> =>
  Object.values(FermentType).reduce((acc, t) => ({ ...acc, [t]: 1 }), {} as Record<string, number>);

/** Fields added after v1 shipped get defaults rather than undefined. */
function migrate(state: Partial<GameState>): GameState {
  return {
    ...(state as GameState),
    marketDemand: state.marketDemand ?? freshDemand(),
    insolvencyStrikes: state.insolvencyStrikes ?? 0,
    gameOver: state.gameOver ?? false,
    // Older saves predate the outcome history; backfill so the card can render.
    recipeMastery: Object.fromEntries(
      Object.entries(state.recipeMastery ?? {}).map(([k, m]) => [k, {
        ...(m as any),
        avgScore: (m as any).avgScore ?? (m as any).bestScore ?? 0,
        recent: (m as any).recent ?? [],
      }])
    ),
    ownedBookIds: state.ownedBookIds ?? [],
    // Vendor relationships postdate most saves. An existing player has clearly
    // been trading, but we cannot reconstruct with whom, so everyone starts
    // level and builds standing from here.
    vendorStanding: state.vendorStanding ?? {},
    // Saves made before the crew existed keep whatever boolean roles they had
    // running for free until the player hires someone real; there is no fair way
    // to invent names and wages for staff they already paid for.
    crew: state.crew ?? [],
    // A save that predates the crew has no pool, and the pool only rolls every
    // fourth week — so without seeding one here the hiring list would be empty
    // for up to a month after loading, which reads as a broken screen.
    crewPool: (state.crewPool && state.crewPool.length > 0)
      ? state.crewPool
      : rollCrewPool(state.week ?? 1),
    contracts: state.contracts ?? [],
    unlockedVendorIds: state.unlockedVendorIds ?? [],
    discoveredRecipeIds: state.discoveredRecipeIds ?? [],
    undergroundBusts: state.undergroundBusts ?? 0,
    // An existing save has clearly got past the opening.
    onboardingDone: state.onboardingDone ?? true,
    // Older saves seeded unlockedRecipes with a bogus id and used it for nothing.
    // It now means "formula known", so it is rebuilt from what has been cooked.
    unlockedRecipes: Array.from(new Set([
      ...(state.unlockedRecipes ?? []).filter(id => id !== 'lacto_plums'),
      ...(state.analyzedRecipeIds ?? []),
    ])),
    customIngredients: state.customIngredients ?? [],
    analyzedRecipeIds: state.analyzedRecipeIds ?? [],
    // Older saves stored a list of ids; each becomes a count of one.
    ownedVessels: state.ownedVessels
      ?? Object.fromEntries((((state as any).ownedVesselIds as string[]) ?? ['mason_jar', 'koji_tray']).map(id => [id, 1])),
    logbook: state.logbook ?? [],
    batches: state.batches ?? [],
  };
}

/** Enough of the shape to trust it before handing it to the reducer. */
function isPlausible(state: unknown): state is Partial<GameState> {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  return typeof s.money === 'number'
    && typeof s.week === 'number'
    && typeof s.day === 'number'
    && typeof s.inventory === 'object'
    && Array.isArray(s.batches);
}

export function saveGame(state: GameState): boolean {
  try {
    const envelope: SaveEnvelope = { version: SAVE_VERSION, savedAt: Date.now(), state };
    localStorage.setItem(slotKey(activeSlot), JSON.stringify(envelope));
    return true;
  } catch {
    // Private browsing, a full quota, or storage blocked outright. Losing the
    // save is not worth interrupting play over.
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    // A save written before slots existed is adopted into slot 1 on first read.
    let raw = localStorage.getItem(slotKey(activeSlot));
    if (!raw && activeSlot === 1) {
      const legacy = localStorage.getItem(STORAGE_KEY_LEGACY);
      if (legacy) { localStorage.setItem(slotKey(1), legacy); localStorage.removeItem(STORAGE_KEY_LEGACY); raw = legacy; }
    }
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SaveEnvelope>;
    if (!parsed || parsed.version !== SAVE_VERSION) return null;
    if (!isPlausible(parsed.state)) return null;

    const migrated = migrate(parsed.state);

    // Timestamps are wall-clock; a batch resumed hours later must not think it
    // sat unattended the whole time. Re-anchor every running batch to now.
    const now = Date.now();
    migrated.batches = migrated.batches.map(b => ({
      ...b,
      lastTick: now,
      startTime: now - (b.progress * 1000),
      // Older saves predate the flag; recover it from what went into the batch.
      contraband: b.contraband ?? (b.inputIngredientIds ?? []).some(
        id => INGREDIENTS.find(i => i.id === id)?.contraband === true
      ),
      // Chamber controls and heritable lineage both postdate a lot of saves.
      // getControls()/getLineage() cope with their absence, but seeding them
      // here means the inspector opens on a real setting rather than a fallback.
      controls: b.controls ?? {
        vent: b.flags?.isLidPropped ? 2 : 0,
        mist: 0,
        heat: b.vesselId === 'incubator' ? null : null,
      },
      surfaceWater: b.surfaceWater ?? 0,
      lineage: b.lineage ?? {
        generation: b.generation ?? 1,
        vigor: 1 + Math.min(10, (b.generation ?? 1) - 1) * 0.05,
        resilience: Math.min(10, (b.generation ?? 1) - 1) * 5,
        bias: 0.5,
      },
    }));

    return migrated;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(slotKey(activeSlot)) !== null || localStorage.getItem(STORAGE_KEY_LEGACY) !== null;
  } catch {
    return false;
  }
}

export function getSaveMeta(): { savedAt: number; week: number; year: number; money: number } | null {
  try {
    const raw = localStorage.getItem(slotKey(activeSlot)) ?? localStorage.getItem(STORAGE_KEY_LEGACY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveEnvelope>;
    if (!parsed?.state || parsed.version !== SAVE_VERSION) return null;
    const { week, year, money } = parsed.state;
    return { savedAt: parsed.savedAt ?? 0, week, year, money };
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(slotKey(activeSlot));
  } catch {
    /* nothing useful to do */
  }
}

/** Metadata for every slot, for a save picker. */
export function getAllSlotMeta(): ({ slot: number; savedAt: number; week: number; year: number; money: number } | null)[] {
  return listSlots().map(slot => {
    try {
      const raw = localStorage.getItem(slotKey(slot)) ?? (slot === 1 ? localStorage.getItem(LEGACY_KEY) : null);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SaveEnvelope>;
      if (!parsed?.state || parsed.version !== SAVE_VERSION) return null;
      const { week, year, money } = parsed.state;
      return { slot, savedAt: parsed.savedAt ?? 0, week, year, money };
    } catch { return null; }
  });
}

/** The whole save as a portable string, so a run can outlive this browser. */
export function exportSave(): string | null {
  try {
    return localStorage.getItem(slotKey(activeSlot));
  } catch { return null; }
}

/** Adopt a pasted save into the active slot. Returns false if it is not one. */
export function importSave(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Partial<SaveEnvelope>;
    if (!parsed?.state || parsed.version !== SAVE_VERSION) return false;
    if (!isPlausible(parsed.state)) return false;
    localStorage.setItem(slotKey(activeSlot), raw);
    return true;
  } catch { return false; }
}

import { GameState, FermentType } from '../types';
import { INGREDIENTS } from '../constants';

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

const STORAGE_KEY = 'fermenta.save.v1';
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
    recipeMastery: state.recipeMastery ?? {},
    ownedBookIds: state.ownedBookIds ?? [],
    undergroundBusts: state.undergroundBusts ?? 0,
    // Older saves seeded unlockedRecipes with a bogus id and used it for nothing.
    // It now means "formula known", so it is rebuilt from what has been cooked.
    unlockedRecipes: Array.from(new Set([
      ...(state.unlockedRecipes ?? []).filter(id => id !== 'lacto_plums'),
      ...(state.analyzedRecipeIds ?? []),
    ])),
    customIngredients: state.customIngredients ?? [],
    analyzedRecipeIds: state.analyzedRecipeIds ?? [],
    ownedVesselIds: state.ownedVesselIds ?? ['mason_jar', 'koji_tray'],
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    // Private browsing, a full quota, or storage blocked outright. Losing the
    // save is not worth interrupting play over.
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    }));

    return migrated;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function getSaveMeta(): { savedAt: number; week: number; year: number; money: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing useful to do */
  }
}

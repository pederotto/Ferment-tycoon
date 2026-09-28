import { GameState, CrewMember, StaffRoleType } from '../types';

/* =============================================================================
   EXPERIENCE: ONE SCALE FOR EVERY HAND, 1 TO 15

   The owner asked for the forager's eye to be the pattern for everything that
   is worked by hand: the player as forager, gardener and fermenter, and every
   hired hand. Experience is EARNED BY DOING THE WORK, never by the calendar, and
   each level is a fraction of the way to a trade's full effect, so a new track
   only has to say what "fully practised" means.

   - `LEVEL_MAX` is 15. `frac(L)` is 0 at level 1 and 1 at level 15, so level 1
     is always exactly the game as it was before the track existed.
   - Thresholds follow `top * ((L - 1) / 14) ^ 1.7`: the first levels come in a
     few sessions, the last take a long career.
   - The crew's older formulas were written for a 1-5 skill; `skill5` maps a
     level onto that scale so their balance did not move.
   ============================================================================= */

export const LEVEL_MAX = 15;
export const levelTable = (top: number): number[] =>
  Array.from({ length: LEVEL_MAX }, (_, i) => Math.round(top * Math.pow(i / (LEVEL_MAX - 1), 1.7)));
export const levelOf = (xp: number, table: number[]): number => table.filter(t => xp >= t).length;
export const frac = (level: number): number => Math.max(0, Math.min(1, (level - 1) / (LEVEL_MAX - 1)));
export const progressOf = (xp: number, table: number[]) => {
  const level = levelOf(xp, table);
  if (level >= LEVEL_MAX) return { level, into: 0, span: 0, max: true };
  return { level, into: Math.round(xp - table[level - 1]), span: table[level] - table[level - 1], max: false };
};

/* --- the player: forager, gardener, fermenter ---------------------------- */
/** A dedicated forager reaches 15 in about two years of weekly outings. */
export const FORAGER_LEVELS = levelTable(12000);
/** About ten hours a week on the estate reaches 15 in a year and a half. */
export const GARDENER_LEVELS = levelTable(8000);
/** Roughly two hundred well-made batches. */
export const FERMENTER_LEVELS = levelTable(6000);

export const gardenerXp = (s: GameState) => s.craft?.gardener ?? 0;
export const fermenterXp = (s: GameState) => s.craft?.fermenter ?? 0;
export const gardenerLevel = (s: GameState) => levelOf(gardenerXp(s), GARDENER_LEVELS);
export const fermenterLevel = (s: GameState) => levelOf(fermenterXp(s), FERMENTER_LEVELS);

/** Add to one of the player's tracks; `up` is a sentence to append when a level turns. */
export const gainCraft = (s: GameState, track: 'gardener' | 'fermenter', n: number): { state: GameState; up: string } => {
  if (!(n > 0)) return { state: s, up: '' };
  const table = track === 'gardener' ? GARDENER_LEVELS : FERMENTER_LEVELS;
  const before = levelOf(s.craft?.[track] ?? 0, table);
  const next = { ...s, craft: { ...(s.craft ?? {}), [track]: (s.craft?.[track] ?? 0) + n } };
  const after = levelOf(next.craft[track] ?? 0, table);
  return { state: next, up: after > before ? ` ${track === 'gardener' ? 'Your hands know the ground better' : 'Your hand at the bench is steadier'}: ${track} level ${after}.` : '' };
};

/** Experience from one finished batch, for whoever worked it: weighted by how good it was. */
export const batchXp = (score: number): number => {
  if (!(score > 0)) return 0;
  if (score < 40) return 3;
  return Math.round(10 + 50 * Math.pow((score - 40) / 60, 1.5));
};

/* --- the fermenter's hand, stamped on the batch when it is sealed ----------- */
/** A practised hand makes fewer mistakes a contaminant can use: the odds of a bloom, x0.55 at 15. */
export const craftRiskMult = (level = 1) => 1 - 0.45 * frac(level);
/** Less spilled, less left in the press, cleaner racking: up to +12% of what the batch yields. */
export const craftYieldMult = (level = 1) => 1 + 0.12 * frac(level);
/** A steady hand disturbs a ferment less when it opens it: up to 60% less. */
export const craftSteadiness = (level = 1) => 0.6 * frac(level);

/* --- the gardener ---------------------------------------------------------- */
/** Grade added to what you pick: +12 at 15. Cut cleanly, handled less, taken at its best. */
export const gardenQualityBonus = (level: number) => Math.round(12 * frac(level));
/** Less left on the plant or bruised in the basket: up to +20% of the kilos. */
export const gardenKgMult = (level: number) => 1 + 0.2 * frac(level);
/** Walking the rows: half the time at 15. */
export const gardenWalkMult = (level: number) => 1 - 0.5 * frac(level);
/** From this level you see what is wrong in a place as you come in, without walking the rows. */
export const GARDEN_SPOT_AT = 7;

/* --- the crew -------------------------------------------------------------- */
/** A hand who works steadily reaches 15 in about sixty weeks. */
export const CREW_LEVELS = levelTable(2400);
export const crewLevel = (c: CrewMember) => Math.max(1, Math.min(LEVEL_MAX, c.skill));
/** The crew's older formulas speak 1-5. */
export const skill5 = (c: CrewMember | undefined) => (c ? 1 + (crewLevel(c) - 1) * 4 / 14 : 1);
/** An old save's 1-5 skill, onto 1-15. */
export const levelFromOldSkill = (s: number) => Math.max(1, Math.min(LEVEL_MAX, Math.round(1 + (s - 1) * 3.5)));
/** What a level-up costs in wages. A forager's rises steeply: what they bring is rare. */
export const raisePerLevel = (role: StaffRoleType) => (role === 'forager' ? 1.09 : 1.03);

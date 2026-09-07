import { Recipe, RecipeMastery, FermentType } from '../types';
import {
  MASTERY_MAX_LEVEL,
  MASTERY_XP_SCORE_FLOOR,
  MASTERY_XP_BASE,
  MASTERY_XP_CURVE,
  MASTERY_XP_DIFFICULTY_STEP,
  MASTERY_L5_MIN_BEST_SCORE,
  MASTERY_THRESHOLDS,
  MASTERY_RUNG_TITLES,
} from '../constants';

/**
 * RECIPE MASTERY — "the Hand"
 *
 * The bench used to give a first-time cook and a fiftieth-time cook exactly the
 * same one-line hint, and the Codex handed over the exact target temperature
 * after a single run. Mastery turns the simulation's hidden numbers into
 * something you earn: five rungs per recipe, from vague direction to the precise
 * figures.
 *
 * Mastery grants INFORMATION ONLY, never a score bonus. A flat bonus would stack
 * with the existing rd/chef/filtered/peak terms and land before the terroir cap
 * in calculateCriticScore, so it would be worth nothing when your ingredients are
 * already good and everything when they are cheap — letting mastery substitute
 * for buying quality and gutting the marketplace as a money sink. Worse, a
 * score-weighted XP system feeding a score bonus is a positive feedback loop.
 * Information has no such loop: it only becomes score through the player's own
 * hands, and it stops compounding the moment it is known.
 */

const EMPTY: RecipeMastery = { xp: 0, level: 0, cooks: 0, bestScore: 0 };

/** Procedural recipes share one track per ferment family; named recipes get their own. */
export const masteryKeyFor = (recipe: Recipe): string =>
  recipe.id.endsWith('_gen') ? `gen_${recipe.type}` : recipe.id;

export const getMastery = (
  all: Record<string, RecipeMastery> | undefined,
  recipe: Recipe
): RecipeMastery => all?.[masteryKeyFor(recipe)] ?? EMPTY;

export const getMasteryLevel = (
  all: Record<string, RecipeMastery> | undefined,
  recipe: Recipe
): number => getMastery(all, recipe).level;

/**
 * XP earned by one completed batch. Convex in score, so the margin over the
 * floor more than pays for itself; below the floor a batch teaches nothing,
 * which is what stops bio-sludge grinding from levelling anything.
 */
export const masteryXpForBatch = (score: number, difficulty: number): number => {
  if (score < MASTERY_XP_SCORE_FLOOR) return 0;
  const t = (score - MASTERY_XP_SCORE_FLOOR) / (100 - MASTERY_XP_SCORE_FLOOR);
  return Math.round(
    MASTERY_XP_BASE *
      Math.pow(t, MASTERY_XP_CURVE) *
      (1 + MASTERY_XP_DIFFICULTY_STEP * (difficulty - 1))
  );
};

export const levelForMastery = (xp: number, bestScore: number): number => {
  let lvl = 1;
  for (let l = 2; l <= MASTERY_MAX_LEVEL; l++) {
    if (xp < MASTERY_THRESHOLDS[l]) break;
    // The top rung additionally demands that you have actually cooked it well
    // once, so it cannot be reached by volume alone.
    if (l === MASTERY_MAX_LEVEL && bestScore < MASTERY_L5_MIN_BEST_SCORE) break;
    lvl = l;
  }
  return lvl;
};

export const xpToNextLevel = (m: RecipeMastery): number | null => {
  if (m.level >= MASTERY_MAX_LEVEL) return null;
  return Math.max(0, MASTERY_THRESHOLDS[m.level + 1] - m.xp);
};

/** Apply one completed batch to the track. Failures return the state untouched. */
export const grantMastery = (
  current: Record<string, RecipeMastery>,
  recipe: Recipe,
  score: number
): { next: Record<string, RecipeMastery>; key: string; gained: number; leveledTo: number | null } => {
  const key = masteryKeyFor(recipe);
  if (recipe.type === FermentType.FAIL || recipe.id === 'bio_sludge') {
    return { next: current, key, gained: 0, leveledTo: null };
  }

  const prev = current[key] ?? EMPTY;
  const gained = masteryXpForBatch(score, recipe.difficulty);
  const xp = prev.xp + gained;
  const bestScore = Math.max(prev.bestScore, score);
  const level = levelForMastery(xp, bestScore);

  return {
    next: { ...current, [key]: { xp, level, cooks: prev.cooks + 1, bestScore } },
    key,
    gained,
    leveledTo: level > prev.level ? level : null,
  };
};

/* ------------------------------------------------------------------------- */
/* THE ADVICE LADDER                                                          */
/* ------------------------------------------------------------------------- */

/**
 * Rung 1 — the authored flavour text. Moved here verbatim from a closure inside
 * BatchController so the Codex can reach it too.
 */
export const rungOne = (id: string, type: FermentType): string => {
  switch (id) {
    case 'bottarga': return 'Requires low humidity to cure properly. High humidity causes rot.';
    case 'bagoong': return 'This paste needs to breathe. Oxidation (Open Lid) is key for color.';
    case 'casu_marzu': return 'Sanitation is the enemy of this living cheese. Keep it dirty.';
    case 'cheong': return 'High sugar prevents spoilage, but wild yeast (low hygiene) creates alcohol.';
    case 'colatura': return 'Wood aging is essential. Patience is the only way.';
    case 'gochujang': return 'Keep cool to preserve sweetness. High heat converts starch to alcohol.';
    case 'scallop_fudge': return 'Dehydration concentrates flavor. Dry heat is needed.';
    case 'black_apple': return 'Needs high humidity to keep the fruit moist during the Maillard reaction.';
    default:
      switch (type) {
        case FermentType.KOJI: return "The 'Engine'. Generates its own heat. Don't let it overheat in insulated vessels.";
        case FermentType.GARUM: return 'Enzymatic Autolysis. Needs high heat (60°C) to break down proteins rapidly.';
        case FermentType.MISO: return 'Anaerobic amino paste. Keep air out to prevent oxidation.';
        case FermentType.LACTO: return 'Simple salinity check. Keep it anaerobic and cool for crisp texture.';
        case FermentType.VINEGAR: return 'Aerobic process. Acetobacter needs oxygen to convert alcohol to acid.';
        default: return 'Balance your parameters.';
      }
  }
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Rung 2 — direction, deliberately without numbers. */
const rungTwo = (recipe: Recipe): string => {
  const { temp, humidity, salinity } = recipe.idealParams;

  const heat =
    temp < 18 ? 'Wants a cold corner.'
    : temp <= 27 ? 'Wants a cool room, no warmer.'
    : temp <= 38 ? 'Wants blood heat — steady, not hot.'
    : 'Wants real heat, and it will not start without it.';

  // Whichever dial sits furthest from the bench's own defaults is the one the
  // player should be thinking about.
  const saltWeight = salinity / 20;
  const humWeight = Math.abs(humidity - 80) / 40;
  const tempWeight = Math.abs(temp - 25) / 20;

  let lever: string;
  if (saltWeight >= humWeight && saltWeight >= tempWeight) {
    lever = 'Salt does the work here. Under-salt it and it turns on you.';
  } else if (humWeight >= tempWeight) {
    lever = 'Moisture is the lever here, not heat.';
  } else {
    lever = 'Heat is the lever here. Everything else follows it.';
  }

  // For the enzyme-driven ferments, name the actual mechanism. This is the part
  // that teaches: a player who learns WHY koji matters can reason about recipes
  // they have never seen, instead of memorising dial positions.
  const mechanism =
    recipe.type === FermentType.KOJI
      ? ' You are not cooking here, you are farming enzymes. Warm and wet grows amylase for sweetness; cool and dry grows protease for savour.'
      : recipe.type === FermentType.GARUM || recipe.type === FermentType.SHOYU
        ? ' This lives or dies on protease. Bring a savoury koji and a protein-rich substrate, or it will taste of nothing.'
        : recipe.type === FermentType.MISO
          ? ' The koji you bring decides this more than the beans do. Protease for a dark, savoury paste; amylase for a sweet pale one.'
          : recipe.type === FermentType.ALCOHOL
            ? ' Yeast cannot eat starch. An amylase koji has to cut it into sugar first.'
            : '';

  return `${heat} ${lever}${mechanism}`;
};

/** Rung 3 — coarse bands. The first time salinity is surfaced anywhere. */
const rungThreeRows = (recipe: Recipe, cooks: number) => {
  const { temp, humidity, salinity } = recipe.idealParams;
  return {
    header: `Ranges off ${cooks} run${cooks === 1 ? '' : 's'}. Close enough to work from.`,
    rows: [
      { k: 'Temp', n: `${temp - 5}–${temp + 5} °C` },
      { k: 'Moisture', n: `${clamp(humidity - 10)}–${clamp(humidity + 10)} %` },
      { k: 'Salt', n: salinity === 0 ? 'none — keep it out' : `${Math.max(0, salinity - 2)}–${salinity + 2} %` },
    ],
  };
};

const INTERVENTION_WORDS: Record<string, string> = {
  Stir: 'a stir',
  Flip: 'turning',
  Skim: 'skimming',
  Clean: 'wiping down',
  Ventilate: 'air',
};

/** Rung 4 — when to pull it. */
const rungFour = (recipe: Recipe): string => {
  const start = recipe.peakWindowStart;
  const width = recipe.peakWindowEnd - recipe.peakWindowStart;

  const timing =
    start >= 90 ? 'It is only right at the very end. Pull it early and you have nothing.'
    : start >= 80 ? 'It comes good late. Leave it alone until the last stretch.'
    : 'It peaks before it looks finished. Watch it from three-quarters on.';

  const window = width <= 10
    ? 'The window is narrow — a few ticks wide.'
    : 'The window is forgiving once you are in it.';

  const parts = [
    timing,
    window,
    `About ${recipe.baseDurationSeconds} seconds of bench time at the right heat, undiluted.`,
  ];

  const word = recipe.activeIntervention ? INTERVENTION_WORDS[recipe.activeIntervention] : undefined;
  if (word) parts.push(`It wants ${word} while it works.`);

  return parts.join(' ');
};

/** Rung 5 — the exact figures, plus what to aim the flavour at. */
const rungFive = (recipe: Recipe): string => {
  const { temp, humidity, salinity } = recipe.idealParams;
  const hold = `Hold ${temp} °C, ${humidity} % moisture, ${salinity} % salt. ` +
    `Pull between ${recipe.peakWindowStart} and ${recipe.peakWindowEnd}.`;

  // safety is excluded — it is not an axis the player aims at.
  const axes = (['umami', 'acidity', 'funk', 'sweetness'] as const)
    .map(k => ({ k, v: recipe.idealFlavorProfile[k] }))
    .sort((a, b) => b.v - a.v);

  const [top, second] = axes;
  const lowest = axes[axes.length - 1];
  const aim = `Aim for ${top.k} ${Math.round(top.v)} and ${second.k} ${Math.round(second.v)}; ` +
    `keep ${lowest.k} under ${Math.round(lowest.v) + 10}.`;

  return `${hold} ${aim}`;
};

export interface MasteryRung {
  level: number;
  title: string;
  body: string;
  rows?: { k: string; n: string }[];
  earned: boolean;
}

export const getMasteryLadder = (recipe: Recipe, level: number, cooks = 0): MasteryRung[] => {
  const three = rungThreeRows(recipe, cooks);
  const bodies: { body: string; rows?: { k: string; n: string }[] }[] = [
    { body: rungOne(recipe.id, recipe.type) },
    { body: rungTwo(recipe) },
    { body: three.header, rows: three.rows },
    { body: rungFour(recipe) },
    { body: rungFive(recipe) },
  ];

  return bodies.map((b, i) => ({
    level: i + 1,
    title: MASTERY_RUNG_TITLES[i + 1],
    body: b.body,
    rows: b.rows,
    earned: level >= i + 1,
  }));
};

/**
 * The gated readouts used by the Codex and the spectrometer. Below rung 3 the
 * bench genuinely does not know; at 3-4 it knows a band; at 5 it knows exactly.
 */
export const masteryReveal = (recipe: Recipe, level: number) => {
  const { temp, humidity, salinity } = recipe.idealParams;
  const band = level >= 3 && level < 5;
  const exact = level >= 5;

  return {
    temp: exact ? `${temp}°` : band ? `${temp - 5}–${temp + 5}°` : '??°',
    humidity: exact ? `${humidity}%` : band ? `${clamp(humidity - 10)}–${clamp(humidity + 10)}%` : '??%',
    salinity: exact ? `${salinity}%` : band
      ? (salinity === 0 ? 'none' : `${Math.max(0, salinity - 2)}–${salinity + 2}%`)
      : '??%',
    duration: level >= 4 ? `${recipe.baseDurationSeconds}s` : '??s',
    window: level >= 4 ? `${recipe.peakWindowStart}–${recipe.peakWindowEnd}` : '??',
  };
};

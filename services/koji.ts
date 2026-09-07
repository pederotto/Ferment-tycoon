import { Batch, Ingredient, Recipe, EnzymeProfile, IngredientType, FermentType, TelemetrySample, Lineage } from '../types';

/**
 * KOJI ENZYMOLOGY
 *
 * Aspergillus is not a timer. It is an enzyme factory, and which enzymes it
 * makes is something you steer.
 *
 * Three families matter. AMYLASES cut starch into fermentable sugar — they are
 * what makes amazake sweet and what feeds an alcoholic brew. PROTEASES cut
 * protein into free amino acids, glutamate above all, which is umami — they are
 * what makes a garum or a shoyu taste of anything. LIPASES cut fat into free
 * fatty acids — butyric, caproic, caprylic — which is where the sharp, pungent,
 * aged-dairy character of a ricotta forte or a casu marzu comes from.
 *
 * Lipase is not steered like the other two. It tracks the culture's general
 * vigour and the fat actually present, because a mould cannot make much lipase
 * out of a substrate with no fat in it.
 *
 * Four things decide the ratio, and all four are real practice:
 *
 *   STRAIN      A sake koji is bred for amylase, a shoyu koji for protease.
 *   SUBSTRATE   Enzyme secretion is substrate-induced. Grown on rice the mould
 *               makes amylase because that is what there is to eat; grown on
 *               soy or barley it makes more protease.
 *   TEMPERATURE Warm and fast (35-38 C) pushes amylase. Cool and slow (28-30 C)
 *               pushes protease. This is why sake koji is run hot and short and
 *               shoyu koji cool and long.
 *   MOISTURE    A wetter bed favours amylase; a drier one drives the mycelium
 *               deeper and favours protease.
 *
 * The result is carried on the finished koji and consumed by whatever you make
 * next, so "which koji did I grow, and how" becomes the decision the rest of
 * the game hangs off.
 */

/** Enzyme activity a well-run batch develops in total, before it is split. */
const PEAK_ACTIVITY = 100;

/** Ambient koji activity assumed when a recipe needs koji but none is present. */
export const NO_ENZYMES: EnzymeProfile = { amylase: 0, protease: 0, lipase: 0 };

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Warm pushes amylase, cool pushes protease. The band tops out at 36 C rather
 * than 38 deliberately: the bed starts accumulating heat stress in the high
 * thirties, so a window that only paid out at 38 would have asked the player to
 * cook their own koji to reach it.
 */
export const tempAmylaseBias = (temp: number): number => clamp01((temp - 28) / 8);

/** A wet bed favours amylase; a dry one drives the mycelium deeper for protease. */
export const moistureAmylaseBias = (humidity: number): number => clamp01((humidity - 45) / 45);

/** Secretion is substrate-induced: it makes the enzyme that unlocks its food. */
export const substrateAmylaseBias = (ing: Ingredient | undefined): number => {
  if (!ing) return 0.5;
  const starch = ing.hiddenStats.starchContent;
  const protein = ing.hiddenStats.proteinContent;
  if (starch + protein <= 0) return 0.5;
  return clamp01(starch / (starch + protein));
};

/** Where the spore itself is bred to sit. */
export const strainAmylaseBias = (starter: Ingredient | undefined): number =>
  starter?.strainBias ?? 0.5;

/**
 * How the bed is developing right now. Returns the amylase share (0-1) and how
 * much total activity the conditions are worth per tick.
 */
export const kojiDevelopment = (
  substrate: Ingredient | undefined,
  starter: Ingredient | undefined,
  temp: number,
  humidity: number,
  stress: number
) => {
  // Strain and substrate are fixed at inoculation; heat and moisture are the two
  // dials the player actually holds, so they carry the most weight between them.
  // The strain carries the most weight — it is the thing you deliberately bought,
  // and a shoyu koji should still come out savoury even if you run it warm.
  // Heat is the strongest lever you hold in the moment; substrate induction and
  // moisture trim the result.
  const share = clamp01(
    strainAmylaseBias(starter) * 0.42 +
    tempAmylaseBias(temp) * 0.28 +
    substrateAmylaseBias(substrate) * 0.20 +
    moistureAmylaseBias(humidity) * 0.10
  );

  // Enzymes are proteins. The mould has to be alive and comfortable to secrete
  // them, so a stressed or scorched bed makes less of everything — but mild
  // stress is normal in a working bed and should not gut the yield.
  const vigour = Math.max(0.15, 1 - stress / 140);

  // Growth stalls outside the mould's range whatever the ratio says.
  const inRange = temp > 22 && temp < 42 && humidity > 35;
  const rate = inRange ? vigour : vigour * 0.15;

  return { amylaseShare: share, rate };
};

/** One tick of enzyme accumulation on a koji bed. */
export const advanceEnzymes = (
  current: EnzymeProfile | undefined,
  substrate: Ingredient | undefined,
  starter: Ingredient | undefined,
  temp: number,
  humidity: number,
  stress: number,
  progressFraction: number
): EnzymeProfile => {
  const e = current ?? { amylase: 0, protease: 0 };
  const { amylaseShare, rate } = kojiDevelopment(substrate, starter, temp, humidity, stress);

  // Secretion follows the growth curve: almost nothing during the lag phase,
  // most of it through the log phase, tailing off as the bed sporulates.
  const phase = progressFraction < 0.2
    ? 0.25
    : progressFraction < 0.85 ? 1 : 0.4;

  // Calibrated so a well-run bed develops roughly 110 units of total activity
  // over a full run. A strongly-biased strain therefore lands near 90/20 and a
  // balanced one near 55/55 — both meaningful, neither pinned to the cap.
  const step = PEAK_ACTIVITY * 0.027 * rate * phase;

  // Lipase is induced by fat rather than steered between the other two, so it
  // rides on overall vigour and on what there is to work on.
  const fat = substrate?.hiddenStats.fatContent ?? 0;
  const lipaseStep = step * 0.45 * Math.min(1, fat / 6);

  return {
    amylase: Math.min(100, e.amylase + step * amylaseShare),
    protease: Math.min(100, e.protease + step * (1 - amylaseShare)),
    lipase: Math.min(100, (e.lipase ?? 0) + lipaseStep),
  };
};

/** Plain-language read of a profile, used everywhere it is displayed. */
export const describeEnzymes = (e: EnzymeProfile): { label: string; detail: string } => {
  const total = e.amylase + e.protease;
  if (total < 12) return { label: 'Barely working', detail: 'Too little activity to convert much of anything.' };
  if ((e.lipase ?? 0) > Math.max(e.amylase, e.protease) * 0.8) {
    return { label: 'Fatty / lipase', detail: 'Works on fat, freeing the sharp acids behind aged dairy and cured roe.' };
  }
  const share = e.amylase / total;
  if (share > 0.66) return { label: 'Sweet / amylase', detail: 'Converts starch to sugar. For amazake, sweet miso and brewing.' };
  if (share < 0.34) return { label: 'Savoury / protease', detail: 'Frees amino acids from protein. For garum, shoyu and dark miso.' };
  return { label: 'Balanced', detail: 'Works on starch and protein alike. A general-purpose koji.' };
};

/**
 * The enzyme activity a batch's inputs bring to the table, weighted by how much
 * koji is in the mix. A pinch of koji in a barrel does very little; a third of
 * the mass by weight does a great deal.
 */
export const getBatchEnzymes = (
  ingredients: Ingredient[],
  quantities?: Record<string, number>
): EnzymeProfile => {
  const massOf = (i: Ingredient) =>
    quantities && quantities[i.id] !== undefined ? quantities[i.id] : i.mass;

  const totalMass = ingredients.reduce((a, i) => a + massOf(i), 0);
  if (totalMass <= 0) return { ...NO_ENZYMES };

  let amylase = 0;
  let protease = 0;
  let lipase = 0;
  for (const i of ingredients) {
    if (!i.enzymes) continue;
    // A koji at 20% of the mass is roughly the classic miso ratio and should
    // count as full strength; past that there are diminishing returns.
    const share = Math.min(1, (massOf(i) / totalMass) / 0.2);
    amylase += i.enzymes.amylase * share;
    protease += i.enzymes.protease * share;
    lipase += (i.enzymes.lipase ?? 0) * share;
  }
  return {
    amylase: Math.min(120, amylase),
    protease: Math.min(120, protease),
    lipase: Math.min(120, lipase),
  };
};

/** Citric-acid protection carried by black koji, which shields a warm ferment. */
export const getAcidProtection = (ingredients: Ingredient[]): number =>
  ingredients.reduce((a, i) => a + (i.acidProtection ?? 0), 0);

/**
 * Mint the ingredient a finished koji cultivation becomes, carrying the enzyme
 * profile it actually developed. This is the hand-off that makes the koji loop
 * matter: what you grew decides what you can make next.
 */
export const mintKojiProduct = (
  batch: Batch,
  recipe: Recipe,
  substrate: Ingredient | undefined
): Ingredient => {
  const e = batch.enzymes ?? { amylase: 0, protease: 0 };
  const desc = describeEnzymes(e);
  const base = substrate?.name.split(' ').pop() ?? 'Grain';
  const stamp = `${Math.round(e.amylase)}/${Math.round(e.protease)}`;

  return {
    id: `koji_${substrate?.id ?? 'grain'}_a${Math.round(e.amylase / 10)}_p${Math.round(e.protease / 10)}`,
    name: `${base} Koji · ${desc.label}`,
    type: IngredientType.SUBSTRATE,
    baseCost: Math.round(20 + (e.amylase + e.protease) * 0.5),
    currency: 'money',
    quality: Math.round(Math.min(100, 55 + (e.amylase + e.protease) * 0.3)),
    description: `Your own bed, ${stamp} amylase/protease. ${desc.detail}`,
    idealFor: ['miso', 'garum', 'shoyu'],
    supplierId: 'in_house',
    tierRequired: 0,
    hiddenStats: {
      starchContent: Math.max(0, (substrate?.hiddenStats.starchContent ?? 6) - 3),
      sugarContent: (substrate?.hiddenStats.sugarContent ?? 4) + 2,
      nativeSalinity: 0,
      microbialDiversity: 8,
      fatContent: substrate?.hiddenStats.fatContent ?? 0,
      proteinContent: substrate?.hiddenStats.proteinContent ?? 3,
    },
    mass: 1000,
    unitDisplay: 'g',
    enzymes: { amylase: Math.round(e.amylase), protease: Math.round(e.protease), lipase: Math.round(e.lipase ?? 0) },
  };
};

export const isKojiRecipe = (recipe: Recipe): boolean => recipe.type === FermentType.KOJI;


/* =========================================================================
   PAIRING — what to put this with, and in what proportion
   ========================================================================= */

/**
 * The scan could say what an ingredient IS but never what to do with it. These
 * are the classic working ratios, which are remarkably consistent across the
 * traditions: koji sits around a fifth of the mass of a paste, salt is a few
 * percent for a lacto and a fifth for a Roman cure, and a starch base wants an
 * amylase koji while a protein base wants a protease one.
 */
export interface Pairing {
  headline: string;
  partners: { what: string; ratio: string; why: string }[];
}

export const suggestPairing = (i: Ingredient): Pairing | null => {
  const h = i.hiddenStats;

  // A koji: say what it is FOR and at what proportion.
  if (i.enzymes) {
    const total = i.enzymes.amylase + i.enzymes.protease;
    const share = total > 0 ? i.enzymes.amylase / total : 0.5;
    if (share > 0.6) {
      return {
        headline: 'An amylase koji. Pair it with starch.',
        partners: [
          { what: 'Rice or barley', ratio: '1 part koji : 1 part grain', why: 'amazake and sweet pale misos' },
          { what: 'Water, held at 55-60 °C', ratio: '1 : 1 by weight', why: 'amylase works fastest just below where it dies' },
          { what: 'Salt', ratio: '4–6% of the total', why: 'a short, sweet miso — more salt and it turns savoury' },
        ],
      };
    }
    if (share < 0.4) {
      return {
        headline: 'A protease koji. Pair it with protein.',
        partners: [
          { what: 'Soybeans, fish or lean meat', ratio: '1 part koji : 4 parts substrate', why: 'the classic paste ratio' },
          { what: 'Salt', ratio: '10–13% for a dark miso, 20% for a cure', why: 'the more salt, the slower and the longer it keeps' },
          { what: 'Water, held at 60 °C', ratio: '1 : 1 with the substrate', why: 'the modern garum route — heat replaces most of the salt' },
        ],
      };
    }
    return {
      headline: 'A balanced koji. It will work on either.',
      partners: [
        { what: 'Soy plus a grain', ratio: '1 koji : 2 soy : 1 grain', why: 'a red miso — savour with some sweetness under it' },
        { what: 'Salt', ratio: '8–10% of the total', why: 'a year-scale paste' },
      ],
    };
  }

  // A spore: what to grow it on. Three cases, not two — a balanced strain should
  // not be handed the protease advice by default.
  if (i.strainBias !== undefined) {
    if (i.strainBias > 0.4 && i.strainBias < 0.6) {
      return {
        headline: 'An even-handed strain. What you grow it on decides what it becomes.',
        partners: [
          { what: 'Rice or barley, held 34–38 °C', ratio: 'a pinch per kilo', why: 'starch and warmth bias it toward amylase — the sweet koji' },
          { what: 'Soybeans, held 28–30 °C', ratio: 'a pinch per kilo', why: 'protein and cool bias it toward protease — the savoury koji' },
          { what: 'Either, at 32 °C', ratio: '—', why: 'a general-purpose bed if you have not decided yet' },
        ],
      };
    }
    const amyl = i.strainBias >= 0.6;
    return {
      headline: amyl ? 'Grow this on starch, warm.' : 'Grow this on protein, cool.',
      partners: amyl
        ? [
            { what: 'Polished rice or pearl barley', ratio: 'a pinch per kilo of grain', why: 'starch induces the amylase you bought it for' },
            { what: 'Hold 34–38 °C, 85% RH', ratio: '—', why: 'warm and wet pushes the ratio toward amylase' },
          ]
        : [
            { what: 'Soybeans or a protein-rich grain', ratio: 'a pinch per kilo', why: 'protein induces protease' },
            { what: 'Hold 28–30 °C, 60% RH', ratio: '—', why: 'cool and dry pushes the ratio toward protease' },
          ],
    };
  }

  const protein = h.proteinContent, starch = h.starchContent, fat = h.fatContent;

  if (protein >= 7 && starch <= 2) {
    return {
      headline: 'Protein with no starch. This wants a protease koji.',
      partners: [
        { what: 'A savoury koji', ratio: '1 part koji : 4 parts this', why: 'protease is what turns protein into umami' },
        { what: 'Salt', ratio: '20% for the Roman route, 12% if held at 60 °C', why: 'salt and heat are alternatives, not both required' },
        { what: 'An amylase koji', ratio: 'avoid', why: 'there is no starch here for it to work on' },
      ],
    };
  }
  if (starch >= 7 && protein <= 4) {
    return {
      headline: 'Starch with little protein. This wants an amylase koji.',
      partners: [
        { what: 'A sweet koji', ratio: '1 : 1 by weight', why: 'amylase converts the starch to sugar' },
        { what: 'Water at 55–60 °C', ratio: '1 : 1', why: 'amazake — thermal saccharification, no salt at all' },
        { what: 'Salt', ratio: 'keep under 6%', why: 'salt slows amylase and buries the sweetness' },
      ],
    };
  }
  if (fat >= 7) {
    return {
      headline: 'Mostly fat. This is lipase territory.',
      partners: [
        { what: 'A koji with lipase activity', ratio: '1 part koji : 5 parts this', why: 'free fatty acids are where aged pungency comes from' },
        { what: 'Salt', ratio: '8% or more', why: 'fat above 4 turns rancid with heat and no salt' },
        { what: 'Cool and slow', ratio: '12–20 °C', why: 'heat on fat gives rancidity rather than character' },
      ],
    };
  }
  if (h.microbialDiversity >= 7) {
    return {
      headline: 'Carries plenty of its own wild life.',
      partners: [
        { what: 'Salt only', ratio: '2–3% of the weight', why: 'a lacto ferment — the organisms are already on it' },
        { what: 'Anaerobic vessel', ratio: '—', why: 'keep it under its own liquid or the surface spoils' },
      ],
    };
  }
  if (protein >= 5 && starch >= 5) {
    return {
      headline: 'Protein and starch together. Either koji suits it.',
      partners: [
        { what: 'A balanced koji', ratio: '1 part koji : 3 parts this', why: 'savour and sweetness in the same paste' },
        { what: 'Salt', ratio: '8–10%', why: 'a paste meant to age for a year' },
      ],
    };
  }
  return null;
};

/* =============================================================================
   LINEAGE
   Propagating your own spores is not just a cheaper starter. The bed you take
   them from has been living under conditions you chose, and the spores that
   survive to sporulate are the ones those conditions suited. Run beds warm and
   damp for a few generations and you end up holding an amylolytic house strain;
   run them cool and dry and you end up with a protease strain. That drift is the
   whole point of the system — the numbers going up is the boring half.

   Direction matches kojiDevelopment() deliberately: warm and wet favours
   amylase there, so warm and wet must select for amylase here, or the player
   would be taught two contradictory rules.
   ============================================================================= */

/** Mean temperature and humidity across the log phase, where selection happens. */
const logPhaseConditions = (history: TelemetrySample[] | undefined) => {
  const log = (history ?? []).filter(s => s.p >= 20 && s.p <= 80);
  if (log.length === 0) return null;
  const mean = (pick: (s: TelemetrySample) => number) =>
    log.reduce((a, s) => a + pick(s), 0) / log.length;
  return { temp: mean(s => s.temp), humidity: mean(s => s.hum) };
};

/**
 * The strain profile the next generation inherits.
 *
 * `damaged` is a real setback rather than cosmetic: a bed you cooked loses
 * vigour and resilience outright, and its bias slides back toward the middle
 * because you have killed off whatever you had been selecting for.
 */
export const propagateLineage = (
  parent: Lineage,
  history: TelemetrySample[] | undefined,
  damaged: boolean
): Lineage => {
  const cond = logPhaseConditions(history);

  if (damaged) {
    return {
      generation: Math.max(1, parent.generation - 1),
      vigor: Math.max(1, parent.vigor - 0.05),
      resilience: Math.max(0, parent.resilience - 5),
      bias: parent.bias + (0.5 - parent.bias) * 0.5,
    };
  }

  // How far the conditions pulled, and which way. Selection is slow on purpose:
  // a house strain should take several generations to become properly yours.
  let bias = parent.bias;
  if (cond) {
    const pull = clamp01(
      tempAmylaseBias(cond.temp) * 0.65 + moistureAmylaseBias(cond.humidity) * 0.35
    );
    bias = clamp01(parent.bias + (pull - parent.bias) * 0.28);
  }

  const generation = parent.generation + 1;
  return {
    generation,
    // Vigour and resilience still climb, but they saturate — the interesting
    // axis is bias, and an endlessly compounding speed buff would drown it.
    vigor: Math.min(1.55, parent.vigor + 0.05),
    resilience: Math.min(50, parent.resilience + 5),
    bias,
  };
};

/** Three readable strains per generation, so drift is visible as a real object. */
export const lineageStrainKey = (bias: number): 'protease' | 'balanced' | 'amylase' =>
  bias >= 0.62 ? 'amylase' : bias <= 0.38 ? 'protease' : 'balanced';

export const lineageStrainLabel = (bias: number): string => {
  const k = lineageStrainKey(bias);
  return k === 'amylase' ? 'Amylolytic' : k === 'protease' ? 'Proteolytic' : 'Balanced';
};

/** What the player is told the strain has become, and why. */
export const describeLineage = (l: Lineage): string => {
  const k = lineageStrainKey(l.bias);
  const lean =
    k === 'amylase'
      ? 'Selected toward amylase — your warm, damp beds have bred a strain that makes sugar.'
      : k === 'protease'
        ? 'Selected toward protease — your cool, dry beds have bred a strain that makes umami.'
        : 'Still even-handed. Hold your beds consistently warm and damp, or cool and dry, to push it.';
  return `Generation ${l.generation}. ${lean}`;
};

import { CrewMember, CrewTrait, StaffRoleType, GameState } from '../types';
import { STAFF_ROLES } from '../constants';
import { SOIL_KINDS } from './soil';
import { CREW_LEVELS, levelOf, skill5, levelFromOldSkill, raisePerLevel, LEVEL_MAX } from './skills';

/* =============================================================================
   HIRING PEOPLE

   The four staff booleans were a shop, not a crew: a fixed menu at a fixed
   price, bought once and never thought about again. What is here instead is a
   rotating pool of individuals, each with a wage they negotiated, a skill that
   grows while they work for you, and a trait that makes them genuinely better
   at one thing and worse at another.

   The point is that hiring becomes a judgement. A cheap raw technician who will
   be good in six months is a different bet from an expensive one who is good
   now, and the pool does not wait for you.
   ============================================================================= */

export const CREW_TRAITS: CrewTrait[] = [
  {
    id: 'methodical',
    label: 'Methodical',
    blurb: 'Turns every vessel on a schedule and writes down when. Slow, but nothing stratifies on their watch.',
    effects: { upkeep: 0.7, wage: 1.1 },
  },
  {
    id: 'meticulous',
    label: 'Meticulous',
    blurb: 'Sterilises things that were already sterile. Exhausting to work beside, and nothing ever gets infected.',
    effects: { hygiene: 0.6, wage: 1.15 },
  },
  {
    id: 'green',
    label: 'Green',
    blurb: 'Has read everything and done none of it. Cheap now, and will not be cheap for long.',
    effects: { upkeep: 1.2, hygiene: 1.15, wage: 0.6 },
  },
  {
    id: 'palate',
    label: 'Good palate',
    blurb: 'Tastes a batch and tells you what it needs before the instruments agree.',
    effects: { quality: 1.08, wage: 1.2 },
  },
  {
    id: 'tireless',
    label: 'Tireless',
    blurb: 'Works the benches like they are being paid by the vessel. Which, in fairness, they nearly are.',
    effects: { upkeep: 0.62, wage: 1.3 },
  },
  {
    id: 'stubborn',
    label: 'Stubborn',
    blurb: 'Has one way of doing things and it is usually right. Usually.',
    effects: { upkeep: 0.85, quality: 1.04, hygiene: 1.1, wage: 0.9 },
  },
];

export const getTrait = (id: string): CrewTrait =>
  CREW_TRAITS.find(t => t.id === id) ?? CREW_TRAITS[0];

/* --------------------------------------------------------------------------
   NAMES

   A crew needs to sound like a real kitchen: a mix of somewhere, not a theme.
   -------------------------------------------------------------------------- */
const FIRST = [
  'Mira', 'Tomas', 'Yuki', 'Ade', 'Rosa', 'Jonas', 'Nadia', 'Kwame', 'Elin',
  'Rafa', 'Ingrid', 'Bao', 'Soraya', 'Petr', 'Aiko', 'Marek', 'Lena', 'Idris',
];
const LAST = [
  'Halvorsen', 'Okafor', 'Tanaka', 'Duarte', 'Novak', 'Bergqvist', 'Rahman',
  'Costa', 'Mbeki', 'Lindqvist', 'Ferrer', 'Aziz', 'Sørensen', 'Nakamura',
];

const LINES: Record<StaffRoleType, string[]> = {
  cleaner: [
    'I have seen what happens to a bench nobody wipes down. I would rather not see it again.',
    'You make the ferments. I make sure nothing else does.',
  ],
  tech: [
    'Give me the setpoints and I will hold them. Give me a cask and I will turn it.',
    'Most of this job is noticing something two hours before it matters.',
  ],
  chef: [
    'I can tell you what it needs. Whether you listen is your business.',
    'I have cooked with worse and sold it for more. Let us not do that here.',
  ],
  toji: [
    'A bed tells you when it wants turning. You only have to be in the room to hear it.',
    'Keep the room warm and the spores honest. The rest is patience.',
  ],
  rd: [
    'Everything you are doing by feel, I can tell you why it works.',
    'I read the literature so you can keep your hands in the mash.',
  ],
  gardener: [
    'Tell me what you want on the table in August and I will tell you what goes in now.',
    'The soil tells you when it wants water. You only have to put your hand in it.',
  ],
  orchardist: [
    'Prune for light and the fruit takes care of itself.',
    'An apple tree remembers a bad year. So do I.',
  ],
  beekeeper: [
    'Move slowly and they forget you are there.',
    'May is the month. Everything else is waiting for May.',
  ],
  poultry: [
    'Six hens is six opinions. I listen to all of them.',
    'Shut the door at dusk. The fox never forgets a door.',
  ],
  soil_tech: [
    'Your waste is somebody’s dinner. Several billion somebodies.',
    'Feed the soil, not the plant. The plant can look after itself.',
  ],
  forager: [
    'I know where the ceps come up. I will not tell you. I will bring you some.',
    'If I am not sure, it stays in the ground. That is the whole rule.',
  ],
};

/**
 * Build one candidate. Deterministic in `seed` so the pool can be regenerated
 * from the week number without needing Math.random, which workflows and saves
 * both dislike.
 */
export const makeCandidate = (role: StaffRoleType, seed: number): CrewMember => {
  const base = STAFF_ROLES.find(r => r.id === role)!;
  const trait = CREW_TRAITS[Math.abs(seed * 7) % CREW_TRAITS.length];
  const old = 1 + (Math.abs(seed * 13) % 4);             // 1-4 on the old scale; the top is only earned
  const skill = levelFromOldSkill(old);                   // 1, 5, 8 or 12 of 15
  const name = `${FIRST[Math.abs(seed * 3) % FIRST.length]} ${LAST[Math.abs(seed * 5) % LAST.length]}`;
  const lines = LINES[role];

  // Wage follows skill and trait. A green hire is genuinely cheap, and a
  // tireless senior technician genuinely is not.
  const skillMult = 0.55 + old * 0.22;
  const weeklyWage = Math.round(base.weeklyWage * skillMult * (trait.effects.wage ?? 1));

  return {
    id: `crew_${role}_${seed}`,
    name,
    role,
    traitId: trait.id,
    skill,
    xp: CREW_LEVELS[skill - 1],
    weeksWorked: 0,
    weeklyWage,
    hiringCost: Math.round(base.hiringCost * skillMult),
    hiredWeek: 0,
    line: lines[Math.abs(seed) % lines.length],
  };
};

/**
 * One candidate per role, refreshed on a schedule. A koji keeper only once there
 * is a room to keep, and the estate's hands only once there is somewhere for
 * them to work — `farmRoles` comes from what the estate owns.
 */
export const rollCrewPool = (week: number, kojiRoom = false, farmRoles: StaffRoleType[] = []): CrewMember[] =>
  ([...(kojiRoom ? ['cleaner', 'tech', 'chef', 'rd', 'toji'] : ['cleaner', 'tech', 'chef', 'rd']), ...farmRoles] as StaffRoleType[])
    .map((role, i) => makeCandidate(role, week * 11 + i * 29));

/**
 * EXPERIENCE IS THE WORK DONE, NOT THE WEEKS SERVED. Skill used to rise with
 * the calendar, so a technician on an empty bench grew exactly as fast as one
 * running eight casks. Now each week pays what there was to do (`weeklyWork`),
 * and bench hands also learn from every batch harvested, weighted by its score
 * (`crewLearnFromBatch`). Levels run 1-15 on CREW_LEVELS; each one costs a raise
 * (`raisePerLevel`), and a forager's raise is the steep one — what they bring
 * is rare, and they know it.
 */
export const addCrewXp = (c: CrewMember, n: number): CrewMember => {
  if (!(n > 0)) return c;
  const xp = (c.xp ?? CREW_LEVELS[Math.max(0, c.skill - 1)]) + n;
  const skill = Math.max(c.skill, Math.min(LEVEL_MAX, levelOf(xp, CREW_LEVELS)));
  const weeklyWage = skill > c.skill ? Math.round(c.weeklyWage * Math.pow(raisePerLevel(c.role), skill - c.skill)) : c.weeklyWage;
  return { ...c, xp, skill, weeklyWage };
};

/** Experience a week of work is worth, by role and by how much there was to do. */
export const weeklyWork = (c: CrewMember, g: GameState): number => {
  const est = g.estate;
  const fac = est?.facilities ?? {};
  const bench = (g.batches ?? []).filter(b => !b.cellared && !b.kojiRoom && b.status !== 'spoiled').length;
  const beds = (g.batches ?? []).filter(b => b.kojiRoom).length;
  const plots = ['walled_garden', 'polytunnel', 'top_field'].reduce((a, id) => a + ((fac as any)[id]?.plots ?? []).filter((p: any) => p.planting).length, 0);
  const trees = ['orchard', 'orangery'].reduce((a, id) => a + ((fac as any)[id]?.trees ?? []).length, 0);
  const hives = ((fac as any).hives?.hives ?? []).filter((h: any) => h.alive).length;
  const hens = (fac as any).hen_run?.hens?.hens ?? 0;
  const soil = (g.batches ?? []).filter(b => !!SOIL_KINDS[b.recipeId]).length + ((fac as any).worm_shed ? 2 : 0);
  // Everyone learns a little from being there; the rest is the workload.
  const load: Record<StaffRoleType, number> = {
    cleaner: bench * 4, tech: bench * 5, chef: bench * 2, rd: bench * 2, toji: beds * 3,
    gardener: plots * 4, orchardist: trees * 5, beekeeper: hives * 8, poultry: hens * 2.5, soil_tech: soil * 6,
    forager: 0, // a forager learns out on the ground: services/wild.ts
  };
  return Math.round(4 + Math.min(60, load[c.role] ?? 0));
};

/** A batch finished on the bench teaches the people who worked it, by how good it was. */
export const BENCH_ROLES: StaffRoleType[] = ['cleaner', 'tech', 'chef', 'rd'];
export const crewLearnFromBatch = (crew: CrewMember[], xp: number): CrewMember[] =>
  crew.map(c => (BENCH_ROLES.includes(c.role) ? addCrewXp(c, Math.round(xp * 0.6)) : c));

export const advanceCrew = (crew: CrewMember[], g?: GameState): CrewMember[] =>
  crew.map(c => {
    const weeksWorked = c.weeksWorked + 1;
    return addCrewXp({ ...c, weeksWorked }, g ? weeklyWork(c, g) : 4);
  });

export const crewWages = (crew: CrewMember[]): number =>
  crew.reduce((a, c) => a + c.weeklyWage, 0);

/**
 * The combined multiplier the crew applies to one axis.
 *
 * Multiplicative rather than additive so two technicians are worth having but
 * not twice as good — the second person on a bench is always worth less than
 * the first, which is why real kitchens are not infinitely staffed.
 */
export const crewEffect = (
  crew: CrewMember[],
  axis: keyof CrewTrait['effects'],
  roles: StaffRoleType[]
): number => {
  const relevant = crew.filter(c => roles.includes(c.role));
  let mult = 1;
  relevant.forEach((c, i) => {
    const raw = getTrait(c.traitId).effects[axis] ?? 1;
    if (raw === 1) return;
    const skillFactor = Math.min(1, 0.45 + skill5(c) * 0.11);
    // Skill has to cut both ways round the right way. For a trait that helps
    // (raw below 1) experience delivers more of it. For one that hurts — a
    // green hire is genuinely clumsy — experience delivers LESS of it, because
    // people grow out of being green. Scaling both by the same factor made a
    // green technician get steadily worse the longer they worked for you, which
    // is the opposite of the whole point of employing anyone.
    const scaled = raw < 1
      ? 1 + (raw - 1) * skillFactor
      : 1 + (raw - 1) * Math.max(0, 1 - skillFactor * 0.85);
    // Diminishing returns on additional bodies doing the same job.
    const damped = 1 + (scaled - 1) / (1 + i * 0.9);
    mult *= damped;
  });
  return mult;
};

/** The boolean summary the rest of the game still reads. */
export const ALL_ROLES: StaffRoleType[] = ['cleaner', 'tech', 'chef', 'rd', 'toji', 'gardener', 'orchardist', 'beekeeper', 'poultry', 'soil_tech', 'forager'];

export const noStaff = (): Record<StaffRoleType, boolean> =>
  Object.fromEntries(ALL_ROLES.map(r => [r, false])) as Record<StaffRoleType, boolean>;

export const crewToStaffFlags = (crew: CrewMember[]): Record<StaffRoleType, boolean> =>
  Object.fromEntries(ALL_ROLES.map(r => [r, crew.some(c => c.role === r)])) as Record<StaffRoleType, boolean>;

export const describeCrewMember = (c: CrewMember): string => {
  const t = getTrait(c.traitId);
  const seniority =
    c.skill >= 15 ? 'Runs the place as well as you do' :
    c.skill >= 11 ? 'Knows the work' :
    c.skill >= 7 ? 'Competent' :
    c.skill >= 3 ? 'Finding their feet' : 'Learning';
  return `${seniority}. ${t.blurb}`;
};

/** Total weekly payroll against income, for the roster's warning line. */
export const payrollPressure = (g: GameState): 'fine' | 'heavy' | 'ruinous' => {
  const wages = crewWages(g.crew ?? []);
  if (wages === 0) return 'fine';
  if (wages > 900) return 'ruinous';
  if (wages > 450) return 'heavy';
  return 'fine';
};

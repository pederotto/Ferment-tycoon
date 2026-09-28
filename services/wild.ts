import { GameState, CrewMember } from '../types';
import { GroundId, WildVisit, WildState, WildPatch, FieldGuideEntry, PieceState, WildPiece, VisitEntry } from '../types.farm';
import { WILD, LOOKALIKES, GROUNDS, GROUND_ORDER, signalsFor, Signal, SignalCtx } from '../constants.wild';
import { INGREDIENTS } from '../constants';
import { ActionResult, storeProduce } from './estate';
import { roll, CalendarDate, DayWeather, absoluteDay } from './climate';
import { FORAGER_LEVELS, levelOf, progressOf, frac, skill5, crewLevel } from './skills';
import { addCrewXp } from './crew';

/* =============================================================================
   THE WILD: going out, looking, telling things apart, and picking well

   Ported from the Understory prototype onto the world clock. Everything costs
   minutes: the walk out, each thing you stop to look at, each test under the
   hand lens, each piece you cut. Most signs are nothing — knowing what to
   ignore is the skill — and a patch remembers how you picked it: take the
   young and the past along with the prime and it comes back weaker next year.

   Pure, like the rest of the estate: every roll is seeded on the day.
   ============================================================================= */

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const fail = (state: GameState, message: string): ActionResult => ({ state, minutes: 0, message, ok: false });

export const LOOK_MINUTES = 15;
export const TEST_MINUTES = 10;
/** Minutes a piece takes to take, by kind: a berry is fiddly, a fish is a cast. */
export const PIECE_MINUTES: Record<string, number> = { mushroom: 3, fruit: 4, tips: 2, nut: 3, fish: 10, shrimp: 6 };

const seasonOf = (m: number) => (m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter');
export const inSeason = (sp: string, m: number) => WILD[sp]?.season.includes(m) ?? false;
const nextBack = (m: number, months: number[]) => {
  const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  for (let n = 1; n <= 12; n++) { const k = (m + n) % 12; if (months.includes(k)) return NAMES[k]; }
  return null;
};
const nameOf = (id: string) => INGREDIENTS.find(i => i.id === id)?.name ?? id;
const baseQ = (id: string) => INGREDIENTS.find(i => i.id === id)?.quality ?? 70;

export const wildOf = (s: GameState): WildState => s.estate.wild ?? {};
export const patchOf = (s: GameState, sp: string): WildPatch => s.estate.patches[sp] ?? { vigour: sp === 'king_stropharia' ? 0 : 1 };
export const guideOf = (s: GameState, sp: string): FieldGuideEntry => s.estate.guide[sp] ?? { found: false, tells: [], months: [] };
export const lowTide = (day: number) => roll('tide', day) < 0.55;
export const signalCtx = (date: CalendarDate, wx: DayWeather): SignalCtx => ({ month: date.month, season: seasonOf(date.month), frost: wx.frost, lowTide: lowTide(absoluteDay(date)) });
/** The weather as the wild reads it. */
const wxKind = (wx: DayWeather, wetStreak: number): 'frost' | 'rain' | 'dry' => (wx.frost ? 'frost' : wx.rainMm > 2 || wetStreak > 0 ? 'rain' : 'dry');
/** Walking out to a ground: the moss is a long way up until you know the path. */
export const walkTo = (s: GameState, g: GroundId) => GROUNDS[g].walk + (g === 'bog' && !wildOf(s).bogFound ? 60 : 0);

const withWild = (s: GameState, w: WildState): GameState => ({ ...s, estate: { ...s.estate, wild: w } });

/* -----------------------------------------------------------------------------
   THE FORAGER'S EYE: experience, and what it buys
   The owner found the wild gave almost nothing back for something tedious:
   measured, a player who only went where something was in season earned about
   $9 a game hour, against ~$20 for the kitchen garden by hand. Experience is
   earned by doing the work — every look, clue, find, test, right call and kilo
   picked — and pays out in four ways, each a thing a practised forager really
   does better:
   - a better GRADE: you cut cleaner, handle less, and take them at their best;
   - MORE per find: you see the rest of the flush, and more of it is prime;
   - a flush on less: you know the wet week it will come;
   - you SPOT what is nothing: decoys, then out-of-season and worked-out finds,
     are known at a glance and need no look, and a look is quicker.
   Level 1 is exactly the old game. The balance claim is measured: see
   CLAUDE.md, "The forager's eye".
   --------------------------------------------------------------------------- */
/** The scale is 1-15 like every hand (services/skills.ts); level 1 is the old game. */
export const forageXp = (s: GameState) => wildOf(s).xp ?? 0;
export const forageLevel = (s: GameState) => levelOf(forageXp(s), FORAGER_LEVELS);
/** Where you are within the current level, for the progress bar. */
export const forageProgress = (s: GameState) => progressOf(forageXp(s), FORAGER_LEVELS);
/** Grade added to anything you pick: 0 at level 1, +16 at 15. */
export const forageQualityBonus = (L: number) => Math.round(16 * frac(L));
/** Pieces a find carries, as a multiple: 1 at level 1, 1.6 at 15. */
export const foragePieceMult = (L: number) => 1 + 0.6 * frac(L);
/** Minutes a look takes: 15 at level 1, 7 at 15. */
export const lookMinutes = (L: number) => Math.round(LOOK_MINUTES - 8 * frac(L));
/** The levels at which you know a sign for nothing without looking. */
export const SPOT_DECOYS_AT = 4;
export const SPOT_EMPTY_AT = 9;
/** Add experience; a new level is announced in the action's message. */
const gainXp = (s: GameState, n: number): { state: GameState; up: string } => {
  if (n <= 0) return { state: s, up: '' };
  const before = forageLevel(s);
  const next = withWild(s, { ...wildOf(s), xp: forageXp(s) + n });
  const after = forageLevel(next);
  return { state: next, up: after > before ? ` Your eye for the wild is sharper: forager level ${after}.` : '' };
};
/** Would you know this sign for nothing today, at your level, without stopping? */
export const knownNothing = (s: GameState, g: GroundId, sg: Signal, date: CalendarDate): boolean => {
  const L = forageLevel(s);
  if (sg.clue) return false;
  if (!sg.kind) return L >= SPOT_DECOYS_AT;
  if (L < SPOT_EMPTY_AT || sg.kind !== 'find' || !sg.species) return false;
  // The things only a look can tell you — a hedge flowering, a tide, the moss — stay worth a look.
  if (sg.flowerSignal || sg.tide !== undefined || sg.discovery || sg.nuts || sg.timing) return false;
  const pt = patchOf(s, sg.species);
  return !inSeason(sg.species, date.month) || pt.vigour < 0.3 || (pt.restUntil ?? -1) > absoluteDay(date);
};
const withVisit = (s: GameState, v: WildVisit): GameState => withWild(s, { ...wildOf(s), visit: v });
const learn = (s: GameState, sp: string, tell: string): GameState => {
  const g = guideOf(s, sp);
  if (g.tells.includes(tell)) return s;
  return { ...s, estate: { ...s.estate, guide: { ...s.estate.guide, [sp]: { ...g, tells: [...g.tells, tell], isNew: true } } } };
};
const markFound = (s: GameState, sp: string, where: string, month: number, kg = 0): GameState => {
  const g = guideOf(s, sp);
  return { ...s, estate: { ...s.estate, guide: { ...s.estate.guide, [sp]: {
    ...g, found: true, isNew: g.isNew || !g.found, where: g.where ?? where,
    months: g.months.includes(month) ? g.months : [...g.months, month].sort((a, b) => a - b),
    best: Math.max(g.best ?? 0, kg),
  } } } };
};
export const knowsTell = (s: GameState, sp: string, tell: string) => guideOf(s, sp).tells.includes(tell);

/** Start (or return to) today's outing on a ground. */
export const arriveAt = (s: GameState, g: GroundId, day: number): GameState => {
  const w = wildOf(s);
  if (w.visit && w.visit.ground === g && w.visit.day === day) return s;
  let next = withVisit(s, { ground: g, day, read: [], log: [], finds: [] });
  // The shrub by the gate is what it is: decided once, the first time anyone looks.
  if (g === 'hedgerow' && wildOf(next).hedgeReal === undefined) next = withWild(next, { ...wildOf(next), hedgeReal: roll('hedge', day) >= LOOKALIKES.haskap.p });
  return next;
};

/* -----------------------------------------------------------------------------
   LOOKING
   --------------------------------------------------------------------------- */
export const lookAt = (s: GameState, sid: string, date: CalendarDate, wx: DayWeather): ActionResult => {
  const v = wildOf(s).visit;
  if (!v) return fail(s, 'You are not out anywhere.');
  if (v.read.includes(sid)) return fail(s, 'You have looked at that.');
  const sg = signalsFor(v.ground, signalCtx(date, wx)).find(x => x.id === sid);
  if (!sg) return fail(s, 'Nothing there.');
  let next: GameState = s;
  let entry: VisitEntry = { label: sg.label, kind: 'decoy', text: sg.text ?? '' };
  if (sg.clue) {
    entry = { ...entry, kind: 'clue' };
    for (const sp of sg.clueFor ?? []) {
      const t = LOOKALIKES[sp]?.tests.find(x => x.id === sg.clue);
      if (t) next = learn(next, sp, sg.clue);
    }
  } else if (sg.kind === 'find') {
    const r = findEntry(next, sg, date, wx);
    next = r.state; entry = r.entry;
  } else if (sg.kind === 'bed') {
    const r = bedEntry(next, sg, date);
    next = r.state; entry = r.entry;
  }
  const v2 = wildOf(next).visit!;
  const L = forageLevel(s);
  next = withVisit(next, { ...v2, read: [...v2.read, sid], log: [...v2.log, entry] });
  // Knowing a decoy is learning too; a find or a tell is worth more.
  const firstFind = entry.kind === 'find' && !!entry.species && !guideOf(s, entry.species).found;
  const g = gainXp(next, entry.kind === 'find' ? 6 + (firstFind ? 20 : 0) : entry.kind === 'clue' ? 5 : 2);
  return { state: g.state, minutes: lookMinutes(L), message: sg.label + g.up, ok: true };
};

const findEntry = (s: GameState, sg: Signal, date: CalendarDate, wx: DayWeather): { state: GameState; entry: VisitEntry } => {
  const sp = sg.species!, m = date.month, day = absoluteDay(date);
  const pt = patchOf(s, sp);
  const kind = wxKind(wx, s.estate.wetStreak ?? 0);
  let next = s, lead = '', text = sg.lead ?? '';
  const info = (t: string) => ({ state: next, entry: { label: sg.label, kind: 'info' as const, text: lead + t } });
  const w = wildOf(next);
  if (sg.discovery && !w.bogFound) { next = withWild(next, { ...w, bogFound: true }); lead = 'Red sphagnum hummocks, and on them a low plant with leaves like a crumpled maple. Cloudberry. The moss is on your map now, and the path up to it. '; }
  if (sg.flowerSignal) {
    const real = wildOf(next).hedgeReal ?? true;
    if ((m === 2 || m === 3) && real) { next = learn(next, 'haskap', 'flower'); return { state: next, entry: { label: sg.label, kind: 'clue', text: 'Pale yellow flowers on bare twigs, and it is not yet April. Back in June for fruit.' } }; }
    if (m === 4 && !real) { next = learn(next, 'haskap', 'flower'); return { state: next, entry: { label: sg.label, kind: 'clue', text: 'Yellow flowers in pairs over red-purple bracts. It flowered late. Back in June for fruit.' } }; }
    if (!inSeason(sp, m)) return info('Leaves and nothing else. Haskap fruits in June and July.');
    text = 'Dark berries on a honeysuckle shrub by the gate. Honeysuckle, so it could be haskap. Most honeysuckles are not.';
  }
  if (sg.timing) {
    if (!inSeason(sp, m)) return info(seasonOf(m) === 'winter' ? 'Stripped bare. The fieldfares finished it in November.' : 'Silver thorns, no fruit. Ready September to November.');
    text = 'Orange berries packed along the thorny twigs.';
  }
  if (sg.nuts) {
    if (m === 9 || m === 10) return info('Empty husks all through the stool. The squirrels were here first. Next year, come in late August.');
    if (!inSeason(sp, m)) return info(m >= 3 && m <= 6 ? 'Leaves, and little nuts forming in their frilled husks. Back in August.' : 'Bare poles. Hazelnuts ripen in late August and September.');
    text = 'Nuts in clusters of two and three in their frilled husks, some already browning.';
  }
  if (sg.tide !== undefined) {
    if (!inSeason(sp, m)) return info('The bar at low water, and nothing moving in the channels. Brown shrimp come in June.');
    if (!sg.tide) return info('The tide is making and the bar is under a foot of water. Shrimping is a low-water job: try another day.');
    text = 'Low water. You push the net along the channel edges and it comes up kicking with brown shrimp.';
  }
  if (!inSeason(sp, m)) return info(`${sg.out ?? ''} Back in ${nextBack(m, WILD[sp].season)}.`);
  if (kind === 'frost' && WILD[sp].kind === 'mushroom' && !['winter_ceps', 'enoki', 'blue_oyster'].includes(sp)) return info('The frost has had them: brown slime where the caps were.');
  if (pt.vigour < 0.3) return info('A few poor ones and nothing worth taking. This was worked too hard; give it a year.');
  if ((pt.restUntil ?? -1) > day) return info('Picked over. Whatever was prime here went in your basket; the young ones want another week.');
  const v = wildOf(next).visit!;
  const idx = v.finds.length;
  next = withVisit(next, { ...v, finds: [...v.finds, { species: sp, sid: sg.id, at: sg.at, done: false }] });
  next = markFound(next, sp, GROUNDS[v.ground].name, m);
  return { state: next, entry: { label: sg.label, kind: 'find', species: sp, text: lead + text, find: idx } };
};

const bedEntry = (s: GameState, sg: Signal, date: CalendarDate): { state: GameState; entry: VisitEntry } => {
  const w = wildOf(s), day = absoluteDay(date);
  const at = w.bedAt;
  if (at === undefined || at === null) return { state: s, entry: { label: sg.label, kind: 'lay', text: 'Bare verge, sun until noon, damp underfoot. The right place for a bed of wood chip and wine-cap spawn.' } };
  const age = (day - at) / 7;
  if (!inSeason('king_stropharia', date.month)) return { state: s, entry: { label: sg.label, kind: 'info', text: 'White threads right through the chip. Nothing fruiting now. Back in May.' } };
  if (age < 8) return { state: s, entry: { label: sg.label, kind: 'info', text: 'White threads through the chip: the mycelium is running. Give it another month.' } };
  if (patchOf(s, 'king_stropharia').vigour < 0.2) return { state: s, entry: { label: sg.label, kind: 'info', text: 'The chip has rotted to soil. Lay a new bed.' } };
  if ((patchOf(s, 'king_stropharia').restUntil ?? -1) > day) return { state: s, entry: { label: sg.label, kind: 'info', text: 'Picked this week. The next flush is coming.' } };
  const v = w.visit!;
  const idx = v.finds.length;
  let next = withVisit(s, { ...v, finds: [...v.finds, { species: 'king_stropharia', sid: sg.id, at: sg.at, done: false }] });
  next = markFound(next, 'king_stropharia', GROUNDS.chip_track.name, date.month);
  return { state: next, entry: { label: sg.label, kind: 'find', species: 'king_stropharia', text: 'Burgundy caps the size of a fist, pushing up through the chip. You laid this.', find: idx } };
};

/** Lay a wine-cap bed on the chip-track verge: chip is free, the spawn is not. */
export const layBed = (s: GameState, day: number): ActionResult => {
  if (s.money < 35) return fail(s, 'A bag of wine-cap spawn is $35.');
  const w = wildOf(s);
  if (w.bedAt !== undefined && w.bedAt !== null) return fail(s, 'There is a bed there already.');
  const next = { ...withWild(s, { ...w, bedAt: day }), money: s.money - 35 };
  return { state: { ...next, estate: { ...next.estate, patches: { ...next.estate.patches, king_stropharia: { vigour: 1 } } } }, minutes: 90, message: 'Barrowed chip onto the verge and scattered the spawn through it. Two months, and it should fruit.', ok: true };
};

/* -----------------------------------------------------------------------------
   TELLING IT APART
   --------------------------------------------------------------------------- */
/** Pick up a find: under the lens if it has a lookalike, straight to picking if not. */
export const examine = (s: GameState, idx: number, date: CalendarDate, wx: DayWeather): ActionResult => {
  const v = wildOf(s).visit;
  const f = v?.finds[idx];
  if (!v || !f || f.done) return fail(s, 'Nothing to pick up.');
  const d = LOOKALIKES[f.species];
  const day = absoluteDay(date);
  if (d) {
    const real = d.stable ? (wildOf(s).hedgeReal ?? true) : roll('id', f.species, day) >= d.p;
    return { state: withVisit(s, { ...v, spec: { find: idx, species: f.species, real, done: [] }, verdict: undefined }), minutes: 0, message: '', ok: true };
  }
  return { state: startPick(s, idx, 'ok', true, date, wx), minutes: 0, message: '', ok: true };
};

export const runTest = (s: GameState, tid: string): ActionResult => {
  const v = wildOf(s).visit;
  const sp = v?.spec;
  if (!v || !sp) return fail(s, 'Nothing in your hand.');
  const t = LOOKALIKES[sp.species].tests.find(x => x.id === tid);
  if (!t || sp.done.includes(tid)) return fail(s, 'Done that.');
  if (t.needs && !knowsTell(s, sp.species, t.needs)) return fail(s, 'You would have had to see it earlier in the year.');
  const g = gainXp(withVisit(s, { ...v, spec: { ...sp, done: [...sp.done, tid] } }), 3);
  return { state: g.state, minutes: TEST_MINUTES, message: t.label + g.up, ok: true };
};

export type Choice = 'real' | 'fake' | 'unnamed' | 'walk';
export const decide = (s: GameState, choice: Choice): ActionResult => {
  const v = wildOf(s).visit;
  const sp = v?.spec;
  if (!v || !sp) return fail(s, 'Nothing in your hand.');
  const d = LOOKALIKES[sp.species];
  let verdict: WildVisit['verdict'];
  // A wrong call on a harmless lookalike still fills the basket, poorly; on a
  // ruinous or deadly one there is nothing to pick — the verdict is the lesson.
  if (choice === 'real') verdict = sp.real ? { tone: 'good', stamp: 'Right', text: d.right, then: 'pick', flag: 'ok' } : { tone: 'bad', stamp: 'Wrong', text: d.wrong, then: d.stake === 'poor' ? 'pick' : 'none', flag: d.stake };
  else if (choice === 'fake') verdict = sp.real ? { tone: 'warn', stamp: 'Left good food', text: d.leftWrong, then: 'none', flag: 'ok' } : { tone: 'good', stamp: 'Right', text: d.leftRight, then: 'none', flag: 'ok' };
  else if (choice === 'unnamed') verdict = { tone: 'warn', stamp: 'Unnamed', text: 'It goes home in a paper bag, unnamed, for the spectrometer on the bench to settle. A day in a bag costs a little quality; a wrong one goes in the bin.', then: 'pick', flag: 'unnamed' };
  else verdict = { tone: 'plain', stamp: 'Walked away', text: 'When in doubt, leave it out.', then: 'none', flag: 'ok' };
  // Every test you ran teaches its tell, whatever you decided.
  let next: GameState = s;
  for (const tid of sp.done) next = learn(next, sp.species, tid);
  if (choice === 'fake' && !sp.real) next = { ...next, estate: { ...next.estate, guide: { ...next.estate.guide, [sp.species]: { ...guideOf(next, sp.species), lookalike: true } } } };
  const v2 = wildOf(next).visit!;
  // A right call is the skill itself; a wrong one still teaches something.
  const right = (choice === 'real' && sp.real) || (choice === 'fake' && !sp.real);
  const g = gainXp(withVisit(next, { ...v2, verdict }), right ? 15 : choice === 'walk' ? 1 : 4);
  return { state: g.state, minutes: 0, message: g.up.trim(), ok: true };
};

/** After the verdict: pick, or put it down and go on. */
export const afterVerdict = (s: GameState, date: CalendarDate, wx: DayWeather): ActionResult => {
  const v = wildOf(s).visit;
  if (!v?.spec || !v.verdict) return fail(s, 'Nothing decided.');
  const { find, real } = v.spec;
  if (v.verdict.then === 'pick') return { state: startPick(s, find, v.verdict.flag, real, date, wx), minutes: 0, message: '', ok: true };
  const finds = v.finds.map((f, i) => (i === find ? { ...f, done: true } : f));
  return { state: withVisit(s, { ...v, finds, spec: undefined, verdict: undefined }), minutes: 0, message: '', ok: true };
};

/* -----------------------------------------------------------------------------
   PICKING
   --------------------------------------------------------------------------- */
const position = (months: number[], m: number) => { const i = months.indexOf(m); return months.length <= 1 ? 0.5 : clamp(i / (months.length - 1), 0, 1); };
export const pieceKg = (k: number, st: PieceState) => (st === 'young' ? k * 0.35 : st === 'past' ? k * 0.8 : k);
export const pieceQ = (q: number, st: PieceState) => (st === 'young' ? q - 8 : st === 'past' ? q - 26 : q);

const startPick = (s: GameState, idx: number, flag: NonNullable<WildVisit['pick']>['flag'], real: boolean, date: CalendarDate, wx: DayWeather): GameState => {
  const v = wildOf(s).visit!;
  const sp = v.finds[idx].species;
  const W = WILD[sp], pt = patchOf(s, sp), day = absoluteDay(date), m = date.month;
  const r = (k: number) => roll('pick', sp, day, k);
  const kind = wxKind(wx, s.estate.wetStreak ?? 0);
  const pos = position(W.season, m), wet = kind === 'rain', frost = kind === 'frost';
  const L = forageLevel(s);
  let n = Math.round((W.n[0] + r(0) * (W.n[1] - W.n[0])) * clamp(pt.vigour, 0.3, 1.5) * foragePieceMult(L));
  const flush = (W.kind === 'mushroom' && wet && pos > 0.2 && pos < 0.8 && pt.vigour >= 1.15 - (L - 1) * 0.03) || (sp === 'sea_buckthorn' && frost && m === 9) || (W.kind === 'fish' && v.read.includes('gannets') && pt.vigour >= 1.1);
  if (flush) n = Math.round(n * 1.6);
  n = clamp(n, 1, 20);
  let pY = clamp(0.45 - pos * 0.38 - (wet ? 0.08 : 0), 0.04, 0.6), pP = clamp(0.08 + pos * 0.42 + (frost && W.kind === 'mushroom' ? 0.1 : 0), 0.04, 0.65);
  if (W.kind === 'fish') { pY = 0.18; pP = 0.12 + (sp === 'herring' ? 0.2 : 0); }
  if (W.kind === 'shrimp') { pY = 0.22; pP = 0.2; }
  if (sp === 'hazelnuts') { pY = m === 7 ? 0.5 : 0.15; pP = m === 8 ? 0.35 : 0.05; }
  // A practised hand times it better: fewer young and past pieces in a find.
  const timing = 1 - (L - 1) * 0.035;
  pY *= timing; pP *= timing;
  let q = baseQ(sp) + forageQualityBonus(L) + (wet && W.kind === 'mushroom' ? 3 : 0) + ((sp === 'winter_ceps' || sp === 'sea_buckthorn') && frost ? 4 : 0) - (kind === 'dry' && W.kind === 'mushroom' ? 6 : 0);
  if (!real && flag !== 'unnamed') q = LOOKALIKES[sp]?.fakeQ ?? 0;
  q = Math.min(100, q);
  const pieces: WildPiece[] = [];
  for (let i = 0; i < n; i++) {
    const x = r(10 + i);
    let st: PieceState = x < pY ? 'young' : x < pY + pP ? 'past' : 'prime';
    if (sp === 'sea_buckthorn' && !frost && st === 'prime' && r(40 + i) < 0.6) st = 'past';
    pieces.push({ st, kg: pieceKg(W.piece, st), q: pieceQ(q, st), picked: false });
  }
  return withVisit(s, { ...v, spec: undefined, verdict: undefined, pick: { find: idx, species: sp, flag, real, pieces, flush } });
};

export const togglePiece = (s: GameState, i: number): GameState => {
  const v = wildOf(s).visit;
  if (!v?.pick) return s;
  const pieces = v.pick.pieces.map((p, k) => (k === i ? { ...p, picked: !p.picked } : p));
  return withVisit(s, { ...v, pick: { ...v.pick, pieces } });
};
export const pickAllPrime = (s: GameState): GameState => {
  const v = wildOf(s).visit;
  if (!v?.pick) return s;
  return withVisit(s, { ...v, pick: { ...v.pick, pieces: v.pick.pieces.map(p => ({ ...p, picked: p.st === 'prime' })) } });
};

/** What this pick will do to the patch next year: take only the prime and it thrives. */
export const pickOutcome = (s: GameState) => {
  const p = wildOf(s).visit?.pick;
  if (!p) return null;
  const c: Record<PieceState, [number, number]> = { young: [0, 0], prime: [0, 0], past: [0, 0] };
  let kg = 0, qs = 0;
  for (const x of p.pieces) { c[x.st][1]++; if (x.picked) { c[x.st][0]++; kg += x.kg; qs += x.kg * x.q; } }
  const share = (st: PieceState) => (c[st][1] ? c[st][0] / c[st][1] : 0);
  const k = WILD[p.species].kind;
  let f: number;
  if (k === 'fish' || k === 'shrimp') f = 1.2 - 0.2 * share('prime') - 0.7 * share('young') - 0.7 * share('past');
  else if (k === 'fruit' || k === 'nut') f = 1.15 - 0.2 * share('prime') - 0.3 * share('young') - 0.1 * share('past');
  else if (k === 'tips') f = 1.15 - 0.3 * share('prime') - 0.8 * share('young');
  else f = 1.25 - 0.25 * share('prime') - 0.6 * share('young') - 0.35 * share('past');
  if (p.species === 'king_stropharia') f = 0.55;
  const now = patchOf(s, p.species);
  const base = now.next ?? now.vigour;
  const pieces = c.young[0] + c.prime[0] + c.past[0];
  return { kg, q: kg ? Math.round(qs / kg) : 0, next: clamp(base * f, 0.2, 1.5), now: now.vigour, counts: c, minutes: pieces * (PIECE_MINUTES[k] ?? 3) };
};

/** Take the picked pieces home, into the pantry, and let the patch remember. */
export const finishPick = (s: GameState, date: CalendarDate): ActionResult => {
  const v = wildOf(s).visit;
  const p = v?.pick;
  const o = pickOutcome(s);
  if (!v || !p || !o) return fail(s, 'Nothing picked.');
  const day = absoluteDay(date);
  let next: GameState = s;
  let message: string;
  const name = nameOf(p.species);
  if (o.kg <= 0) message = 'Left it all where it was.';
  else if (p.flag === 'ok') { next = storeProduce(next, p.species, o.kg, o.q); next = markFound(next, p.species, GROUNDS[v.ground].name, date.month, o.kg); message = `${o.kg.toFixed(1)} kg of ${name.toLowerCase()} into the basket.`; }
  else if (p.flag === 'poor') { next = storeProduce(next, p.species, o.kg, o.q); message = `${o.kg.toFixed(1)} kg of ${LOOKALIKES[p.species].fake.toLowerCase()} in the basket. It will pass for ${name.toLowerCase()}, poorly.`; }
  else if (p.flag === 'unnamed') {
    if (p.real) { next = storeProduce(next, p.species, o.kg, o.q - 10); next = markFound(next, p.species, GROUNDS[v.ground].name, date.month, o.kg); message = `Named at the bench: ${name.toLowerCase()}. ${o.kg.toFixed(1)} kg into the pantry, a little tired from the bag.`; }
    else message = `Named at the bench: ${LOOKALIKES[p.species].fake.toLowerCase()}. It went in the bin, and nothing else was touched.`;
  } else message = p.flag === 'deadly' ? `${LOOKALIKES[p.species].fake} (${LOOKALIKES[p.species].latin}). It goes on the fire, and so does the knife.` : `${LOOKALIKES[p.species].fake}. Not worth carrying home; it goes on the heap.`;
  // The patch: what this picking earns it, settled at the turn of the year, and a week's rest.
  const pt = patchOf(next, p.species);
  const patches = { ...next.estate.patches, [p.species]: { ...pt, next: o.kg > 0 && p.flag !== 'unnamed' ? o.next : pt.next, lastPicked: day, restUntil: o.kg > 0 ? day + 7 : pt.restUntil } };
  next = { ...next, estate: { ...next.estate, patches } };
  const v2 = wildOf(next).visit!;
  const finds = v2.finds.map((f, i) => (i === p.find ? { ...f, done: true } : f));
  next = withVisit(next, { ...v2, finds, pick: undefined });
  const g = gainXp(next, o.kg > 0 && p.flag !== 'ruin' && p.flag !== 'deadly' ? 4 + Math.round(o.kg * 5) : 0);
  return { state: g.state, minutes: o.minutes, message: message + g.up, ok: true };
};

export const dropPick = (s: GameState): GameState => {
  const v = wildOf(s).visit;
  if (!v?.pick) return s;
  const finds = v.finds.map((f, i) => (i === v.pick!.find ? { ...f, done: true } : f));
  return withVisit(s, { ...v, finds, pick: undefined });
};

/* -----------------------------------------------------------------------------
   THE YEAR, AND THE FORAGER'S APPRENTICE
   --------------------------------------------------------------------------- */
/** Once a day, from the estate round: the year settles the patches, and on a
    Monday the apprentice does the rounds. Pure. */
export const wildDay = (s: GameState, date: CalendarDate, wx: DayWeather): { state: GameState; notes: string[] } => {
  let next = s;
  const notes: string[] = [];
  const w = wildOf(next);
  // The new year: a patch becomes what last year's picking made it; one left alone recovers.
  if (date.month === 0 && (w.settledYear ?? 0) < date.year) {
    const patches: Record<string, WildPatch> = {};
    for (const [sp, pt] of Object.entries(next.estate.patches)) {
      if (sp === 'king_stropharia') { const h = w.bedAt !== undefined && w.bedAt !== null ? pt.vigour * 0.55 : 0; patches[sp] = { vigour: h }; continue; }
      patches[sp] = { vigour: clamp(pt.next ?? pt.vigour * 1.15, 0.2, 1.5) };
    }
    next = { ...next, estate: { ...next.estate, patches, wild: { ...w, settledYear: date.year, bedAt: w.bedAt !== undefined && w.bedAt !== null && (patches.king_stropharia?.vigour ?? 0) < 0.2 ? null : w.bedAt } } };
  }
  if (date.day !== 1) return { state: next, notes };
  const hand = ((next.crew ?? []) as CrewMember[]).filter(c => c.role === 'forager').sort((a, b) => b.skill - a.skill)[0];
  if (!hand) return { state: next, notes };
  // The apprentice walks ONE ground a week (two once they know the valley),
  // the one with the most in season that you have found. They go only where
  // you have found something, take only the prime, and will not pick what you
  // cannot yet tell from its lookalike. Walking all ten every Monday — the
  // first version — brought in 2.5 times the wage for nothing.
  const day = absoluteDay(date);
  const took: string[] = [];
  let gotKg = 0;
  const HL = crewLevel(hand), hf = frac(HL);
  const pickable = (g: GroundId, sp: string) => {
    const guide = guideOf(next, sp), pt = patchOf(next, sp);
    if (!guide.found || !inSeason(sp, date.month) || pt.vigour < 0.3 || (pt.restUntil ?? -1) > day) return false;
    if (g === 'bog' && !wildOf(next).bogFound) return false;
    if (sp === 'king_stropharia' && (wildOf(next).bedAt === undefined || wildOf(next).bedAt === null)) return false;
    if (WILD[sp].kind === 'mushroom' && wx.frost && !['winter_ceps', 'enoki', 'blue_oyster'].includes(sp)) return false;
    return !(LOOKALIKES[sp] && guide.tells.length < 2);
  };
  const expected = (sp: string) => { const W = WILD[sp]; const i = INGREDIENTS.find(x => x.id === sp); return (W.n[0] + W.n[1]) / 2 * clamp(patchOf(next, sp).vigour, 0.3, 1.5) * 0.45 * W.piece * ((i?.baseCost ?? 0) / ((i?.mass ?? 1000) / 1000)); };
  const ranked = GROUND_ORDER.map(g => ({ g, v: GROUNDS[g].grows.filter(sp => pickable(g, sp)).reduce((a, sp) => a + expected(sp), 0) }))
    .filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 1 + (HL >= 8 ? 1 : 0) + (HL >= 13 ? 1 : 0));
  for (const { g } of ranked) for (const sp of GROUNDS[g].grows) {
    if (!pickable(g, sp)) continue;
    const pt = patchOf(next, sp);
    if (roll('forager', sp, day) < clamp(0.3 - skill5(hand) * 0.05, 0.05, 0.3)) continue;
    const W = WILD[sp];
    const n = (W.n[0] + W.n[1]) / 2 * clamp(pt.vigour, 0.3, 1.5);
    // A practised hand sees more of the flush and picks it better, as the player does.
    const kg = n * 0.45 * W.piece * (1 + 0.5 * hf);
    if (kg < 0.05) continue;
    next = storeProduce(next, sp, kg, Math.min(100, baseQ(sp) - 2 + Math.round(12 * hf)));
    gotKg += kg;
    // Prime only, so the patch does better than it would left alone.
    next = { ...next, estate: { ...next.estate, patches: { ...next.estate.patches, [sp]: { ...pt, next: clamp((pt.next ?? pt.vigour) * 1.02, 0.2, 1.5), lastPicked: day, restUntil: day + 7 } } } };
    took.push(`${kg.toFixed(1)} kg ${nameOf(sp).toLowerCase()}`);
  }
  // A forager learns on the ground: each walk and each kilo brought home.
  if (ranked.length) {
    const before = crewLevel(hand);
    const grown = addCrewXp(hand, ranked.length * 12 + Math.round(gotKg * 8));
    next = { ...next, crew: (next.crew as CrewMember[]).map(c => (c.id === hand.id ? grown : c)) };
    if (grown.skill > before) notes.push(`${hand.name} knows the valley better: forager level ${grown.skill}. Their wage is now $${grown.weeklyWage} a week.`);
  }
  if (took.length) notes.push(`${hand.name} came back from the wild: ${took.join(', ')}.`);
  return { state: next, notes };
};

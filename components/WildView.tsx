import React from 'react';
import { GameState } from '../types';
import { GroundId } from '../types.farm';
import { WILD, WILD_ORDER, LOOKALIKES, GROUNDS, GROUND_ORDER, STATE_WORDS, signalsFor, MAP_PINS } from '../constants.wild';
import { INGREDIENTS } from '../constants';
import { ActionResult } from '../services/estate';
import {
  wildOf, patchOf, guideOf, inSeason, walkTo, lookAt, examine, runTest, decide, afterVerdict, togglePiece, pickAllPrime,
  pickOutcome, finishPick, dropPick, layBed, knowsTell, signalCtx, LOOK_MINUTES, TEST_MINUTES,
} from '../services/wild';
import { CalendarDate, DayWeather, formatDuration, absoluteDay } from '../services/climate';
import { MONTH_NAMES } from '../constants.forage';
import { WILD_TILES, tileRect, wildMapPainted } from './EstateScene';
import { FACILITIES } from '../constants.farm';

/* =============================================================================
   THE WILD, IN THE LEDGER

   The map of grounds with what is likely in season, the field guide, and on a
   ground: what you have seen, the find under the hand lens, and the basket.
   Paper for what would be paper (the guide's cards, the journal), dark for the
   instruments (the patch's vigour).
   ============================================================================= */

type Act = (fn: (s: GameState) => ActionResult, opts?: { dark?: boolean }) => void;
const nameOf = (id: string) => INGREDIENTS.find(i => i.id === id)?.name ?? id;
const quiet = (fn: (s: GameState) => GameState) => (s: GameState): ActionResult => ({ state: fn(s), minutes: 0, message: '', ok: true });
const monthsLabel = (m: number[]) => (m.length ? (m.length === 1 ? MONTH_NAMES[m[0]].slice(0, 3) : `${MONTH_NAMES[m[0]].slice(0, 3)}–${MONTH_NAMES[m[m.length - 1]].slice(0, 3)}`) : 'all year');

/* --- the overlay: pins on a ground, postcards on the map --- */
export const WildHits: React.FC<{ state: GameState; place: GroundId | 'wild_map'; date: CalendarDate; wx: DayWeather; size: [number, number]; onGo: (p: any) => void; act: Act; owned: Record<string, boolean>; onSign?: (at: [number, number]) => void }> = ({ state, place, date, wx, size, onGo, act, owned, onSign }) => {
  const [W, H] = size;
  if (place === 'wild_map' && wildMapPainted()) {
    // Pins on the painted map: every ground, the salt pans, and the way home.
    const r = 9;
    const pins = [...GROUND_ORDER.map(g => ({ id: g as string, label: `${GROUNDS[g].name} · ${formatDuration(walkTo(state, g))}`, name: g === 'bog' && !wildOf(state).bogFound ? 'The Moss ?' : GROUNDS[g].name, locked: false })),
      { id: 'salt_pans', label: FACILITIES.salt_pans.name + (owned.salt_pans ? '' : ' (buy it from the farm ledger)'), name: 'The Salt Pans', locked: !owned.salt_pans },
      { id: 'farm_map', label: 'Home to the farm', name: 'The Farm', locked: false }];
    return (
      <svg className="estate-hits" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {pins.map(pn => {
          const at = MAP_PINS[pn.id === 'farm_map' ? 'farm' : pn.id];
          if (!at) return null;
          const go = () => !pn.locked && onGo(pn.id);
          const right = at[0] > W - 90;
          return (
            <g key={pn.id} role="button" tabIndex={pn.locked ? -1 : 0} aria-label={pn.label} className={`wild-pin map${pn.locked ? ' read' : ''}`}
              onClick={go} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !pn.locked) { e.preventDefault(); go(); } }}>
              <title>{pn.label}</title>
              <circle cx={at[0]} cy={at[1]} r={r * 1.8} className="hit" />
              <circle cx={at[0]} cy={at[1]} r={r} className="ring" />
              <circle cx={at[0]} cy={at[1]} r={r * 0.32} className="dot" />
              <text x={right ? at[0] - r - 3 : at[0] + r + 3} y={at[1] + 3} textAnchor={right ? 'end' : 'start'} className="wild-map-label">{pn.name}</text>
            </g>
          );
        })}
      </svg>
    );
  }
  if (place === 'wild_map') {
    return (
      <svg className="estate-hits" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {WILD_TILES.map((g, i) => {
          const R = tileRect(i);
          const isPans = g === 'salt_pans';
          const locked = isPans && !owned.salt_pans;
          const label = isPans ? `${FACILITIES.salt_pans.name}${locked ? ' (buy it from the farm ledger)' : ''}` : `${GROUNDS[g as GroundId].name} · ${formatDuration(walkTo(state, g as GroundId))}`;
          return (
            <g key={g} role="button" tabIndex={locked ? -1 : 0} aria-label={label} className={`estate-hit wild-tile${locked ? ' unowned' : ''}`}
              onClick={() => !locked && onGo(g)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !locked) { e.preventDefault(); onGo(g); } }}>
              <title>{label}</title>
              <polygon points={`${R[0]},${R[1]} ${R[2]},${R[1]} ${R[2]},${R[3]} ${R[0]},${R[3]}`} />
              <text x={R[0] + 5} y={R[3] - 4} className="wild-tile-label">{isPans ? 'The Salt Pans' : GROUNDS[g as GroundId].name}</text>
            </g>
          );
        })}
      </svg>
    );
  }
  const v = wildOf(state).visit;
  const signals = signalsFor(place, signalCtx(date, wx));
  return (
    <svg className="estate-hits" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {signals.map(sg => {
        const read = !!v?.read.includes(sg.id);
        const fi = v?.finds.findIndex(f => f.sid === sg.id) ?? -1;
        const open = fi >= 0 && !v!.finds[fi].done;
        const r = W > 400 ? 9 : 7;
        // `onSign` puts the answer beside the sign: the card opens on a seen sign
        // too, so its entry can be read again without the journal.
        const onPick = () => { onSign?.([sg.at[0] / W, sg.at[1] / H]); return open ? act(s => examine(s, fi, date, wx)) : !read ? act(s => lookAt(s, sg.id, date, wx)) : undefined; };
        const label = `${sg.label}${read ? (open ? ' — pick it up' : ' — seen') : ` — look · ${LOOK_MINUTES} min`}`;
        return (
          <g key={sg.id} role="button" tabIndex={0} aria-label={label}
            className={`wild-pin${read ? ' read' : ''}${open ? ' open' : ''}`}
            onClick={onPick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }}>
            <title>{label}</title>
            <circle cx={sg.at[0]} cy={sg.at[1]} r={r * 1.8} className="hit" />
            <circle cx={sg.at[0]} cy={sg.at[1]} r={r} className="ring" />
            <circle cx={sg.at[0]} cy={sg.at[1]} r={r * 0.32} className="dot" />
          </g>
        );
      })}
    </svg>
  );
};

/* --- the map's ledger: where to go, and the field guide --- */
export const WildMapLedger: React.FC<{ state: GameState; date: CalendarDate; onGo: (p: any) => void }> = ({ state, date, onGo }) => {
  const m = date.month;
  const hands = (state.crew ?? []).filter((c: any) => c.role === 'forager');
  return (
    <>
      <section className="el-sect">
        <h3>The grounds <span className="sub">a morning’s walk, or a day’s</span></h3>
        <ul className="wild-grounds">
          {GROUND_ORDER.map(g => {
            const G = GROUNDS[g];
            const known = G.grows.filter(sp => guideOf(state, sp).found);
            const now = known.filter(sp => inSeason(sp, m));
            const maybe = G.grows.some(sp => !guideOf(state, sp).found && inSeason(sp, m));
            const vig = G.grows.reduce((a, sp) => a + patchOf(state, sp).vigour, 0) / G.grows.length;
            const bogHidden = g === 'bog' && !wildOf(state).bogFound;
            return (
              <li key={g} className="label-plate wg">
                <div className="top"><span className="name">{G.name}</span><span className="walk mono">{formatDuration(walkTo(state, g))}</span></div>
                <p className="where">{bogHidden ? 'High moor, a long way up. Someone in the village says there is fruit on it in July.' : G.where}</p>
                <p className="now">
                  {now.length ? <>In season: <b>{now.map(nameOf).join(', ')}</b></> : maybe ? <i>Something may be in season. You will not know until you look.</i> : <span className="faint">Nothing you know of this month.</span>}
                </p>
                <div className="row">
                  <span className="vig" title={`Patches ${Math.round(vig * 100)}%`}><i style={{ width: `${Math.min(100, vig / 1.5 * 100)}%` }} /></span>
                  <button className="mini-btn gold" onClick={() => onGo(g)}>Go</button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="el-note">{hands.length ? `${hands[0].name} goes out on Mondays to what you have found, takes only the prime, and leaves anything with a lookalike you cannot yet tell apart.` : 'A forager’s apprentice (Staff) would do the rounds of what you have found, every Monday.'}</p>
      </section>
      <FieldGuide state={state} month={m} />
    </>
  );
};

const FieldGuide: React.FC<{ state: GameState; month: number }> = ({ state, month }) => {
  const found = WILD_ORDER.filter(sp => guideOf(state, sp).found).length;
  return (
    <section className="el-sect">
      <h3>The field guide <span className="sub">{found} of {WILD_ORDER.length} found</span></h3>
      <ul className="wild-guide">
        {WILD_ORDER.map(sp => {
          const g = guideOf(state, sp), W = WILD[sp], L = LOOKALIKES[sp];
          const where = GROUND_ORDER.find(gid => GROUNDS[gid].grows.includes(sp));
          return (
            <li key={sp} className={`label-plate wcard${g.found ? '' : ' unknown'}`}>
              <div className="top">
                <span className="name">{g.found ? nameOf(sp) : '?'}</span>
                <span className={`when${inSeason(sp, month) ? ' now' : ''}`}>{g.found ? monthsLabel(W.season) : ''}</span>
              </div>
              {g.found ? (
                <>
                  <p className="where">{where ? GROUNDS[where].name : ''}{g.best ? ` · best haul ${g.best.toFixed(1)} kg` : ''} · patch {Math.round(patchOf(state, sp).vigour * 100)}%</p>
                  {L && (
                    <p className="tells">
                      <b>Not {L.fake}</b> <i>({L.latin})</i>{L.stake === 'deadly' ? ' — deadly' : L.stake === 'ruin' ? ' — ruins a vessel' : ''}.{' '}
                      {g.tells.length ? L.tests.filter(t => g.tells.includes(t.id)).map(t => t.meaning).join(' ') : 'You know no way yet to tell them apart.'}
                    </p>
                  )}
                </>
              ) : <p className="where faint">{where && !(where === 'bog' && !wildOf(state).bogFound) ? `Somewhere at ${GROUNDS[where].name}.` : 'Not yet found.'}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/* --- on a ground --- */
export const GroundLedger: React.FC<{ state: GameState; ground: GroundId; date: CalendarDate; wx: DayWeather; act: Act }> = ({ state, ground, date, wx, act }) => {
  const G = GROUNDS[ground];
  const v = wildOf(state).visit;
  const visit = v && v.ground === ground && v.day === absoluteDay(date) ? v : undefined;
  const signals = signalsFor(ground, signalCtx(date, wx));
  const unread = signals.filter(sg => !visit?.read.includes(sg.id)).length;
  return (
    <>
      {visit?.pick && <PickPanel state={state} date={date} act={act} />}
      {visit?.spec && !visit.pick && <ExaminePanel state={state} date={date} wx={wx} act={act} />}
      <section className="el-sect">
        <h3>{G.name} <span className="sub">{G.where}</span></h3>
        <p className="el-note">{G.hint}</p>
        <p className="el-note">{unread ? `${unread} thing${unread > 1 ? 's' : ''} you have not looked at. Each look is ${LOOK_MINUTES} minutes: most of them are nothing, which is the skill.` : 'You have looked at everything here today.'}</p>
      </section>
      {visit && visit.log.length > 0 && (
        <section className="el-sect">
          <h3>What you have seen</h3>
          <ol className="wild-journal">
            {[...visit.log].reverse().map((e, i) => <JournalEntry key={i} state={state} visit={visit} e={e} date={date} wx={wx} act={act} />)}
          </ol>
        </section>
      )}
    </>
  );
};

/* One line of the day's journal, with whatever it lets you do next. */
const JournalEntry: React.FC<{ state: GameState; visit: NonNullable<ReturnType<typeof wildOf>['visit']>; e: NonNullable<ReturnType<typeof wildOf>['visit']>['log'][number]; date: CalendarDate; wx: DayWeather; act: Act }> = ({ state, visit, e, date, wx, act }) => {
  const f = e.find !== undefined ? visit.finds[e.find] : undefined;
  return (
    <li className={`wj ${e.kind}`}>
      <b>{e.label}</b>
      <p>{e.text}</p>
      {f && !f.done && !visit.spec && !visit.pick && <button className="mini-btn gold" onClick={() => act(s => examine(s, e.find!, date, wx))}>Pick it up</button>}
      {e.kind === 'lay' && (wildOf(state).bedAt === undefined || wildOf(state).bedAt === null) && <button className="mini-btn gold" onClick={() => act(s => layBed(s, absoluteDay(date)))}>Lay a wine-cap bed · $35 · 1 h 30</button>}
    </li>
  );
};

/* THE ANSWER BESIDE THE SIGN. A look opened the whole journal as a panel down
   one side, which covered a third of the ground and the signs under it. This
   is the one thing the click asked about: the picking or the examining if one
   is under way, otherwise the newest entry in the journal. */
export const SignCallout: React.FC<{ state: GameState; ground: GroundId; date: CalendarDate; wx: DayWeather; act: Act }> = ({ state, ground, date, wx, act }) => {
  const v = wildOf(state).visit;
  const visit = v && v.ground === ground && v.day === absoluteDay(date) ? v : undefined;
  if (!visit) return null;
  if (visit.pick) return <PickPanel state={state} date={date} act={act} />;
  if (visit.spec) return <ExaminePanel state={state} date={date} wx={wx} act={act} />;
  const e = visit.log[visit.log.length - 1];
  return e ? <ol className="wild-journal"><JournalEntry state={state} visit={visit} e={e} date={date} wx={wx} act={act} /></ol> : null;
};

const ExaminePanel: React.FC<{ state: GameState; date: CalendarDate; wx: DayWeather; act: Act }> = ({ state, date, wx, act }) => {
  const v = wildOf(state).visit!;
  const sp = v.spec!;
  const d = LOOKALIKES[sp.species];
  const name = nameOf(sp.species);
  return (
    <section className="el-sect wild-exam label-plate">
      <h3>{name}, or {d.fake}?</h3>
      <p className="base">{d.base}</p>
      <ul className="tests">
        {d.tests.map(t => {
          const done = sp.done.includes(t.id);
          const locked = !!t.needs && !knowsTell(state, sp.species, t.needs);
          return (
            <li key={t.id}>
              {done ? (
                <><b>{t.label}.</b> {sp.real ? t.real : t.fake}{knowsTell(state, sp.species, t.id) && <em> {t.meaning}</em>}</>
              ) : (
                <button className="mini-btn" disabled={locked || !!v.verdict} onClick={() => act(s => runTest(s, t.id))} title={locked ? 'You would have had to see it earlier in the year' : ''}>
                  {t.label} · {TEST_MINUTES} min
                </button>
              )}
              {locked && !done && <span className="faint"> — you would need to have seen it earlier in the year</span>}
            </li>
          );
        })}
      </ul>
      {!v.verdict ? (
        <div className="row decide">
          <button className="mini-btn gold" onClick={() => act(s => decide(s, 'real'))}>It is {name.toLowerCase()}</button>
          <button className="mini-btn" onClick={() => act(s => decide(s, 'fake'))}>It is {d.fake.toLowerCase()}: leave it</button>
          <button className="mini-btn" onClick={() => act(s => decide(s, 'unnamed'))}>Take it home unnamed</button>
          <button className="mini-btn" onClick={() => act(s => decide(s, 'walk'))}>Walk away</button>
        </div>
      ) : (
        <div className={`verdict ${v.verdict.tone}`}>
          <span className="stamp">{v.verdict.stamp}</span>
          <p>{v.verdict.text}</p>
          <button className="mini-btn gold" onClick={() => act(s => afterVerdict(s, date, wx))}>{v.verdict.then === 'pick' ? 'Pick' : 'Go on'}</button>
        </div>
      )}
    </section>
  );
};

const PickPanel: React.FC<{ state: GameState; date: CalendarDate; act: Act }> = ({ state, date, act }) => {
  const p = wildOf(state).visit!.pick!;
  const o = pickOutcome(state)!;
  const words = STATE_WORDS[WILD[p.species].kind];
  const fakeName = p.flag === 'poor' ? LOOKALIKES[p.species]?.fake : null;
  return (
    <section className="el-sect wild-pick">
      <h3>{fakeName ?? nameOf(p.species)} {p.flush && <span className="flush">a flush</span>}</h3>
      <p className="el-note">{words.help}</p>
      <div className="pieces">
        {p.pieces.map((x, i) => (
          <button key={i} className={`piece ${x.st}${x.picked ? ' on' : ''}`} onClick={() => act(quiet(s => togglePiece(s, i)))} aria-pressed={x.picked}>
            <span className="st">{words[x.st]}</span><span className="kg mono">{x.kg < 1 ? `${Math.round(x.kg * 1000)} g` : `${x.kg.toFixed(1)} kg`}</span>
          </button>
        ))}
      </div>
      <div className="outcome">
        <span className="mono">{o.kg.toFixed(2)} kg · grade {o.q || '–'} · {formatDuration(o.minutes)}</span>
        {p.flag !== 'unnamed' && (
          <span className="patch">
            <span className="l">Patch next year</span>
            <span className="vig"><i className={o.next < o.now ? 'down' : 'up'} style={{ width: `${Math.min(100, o.next / 1.5 * 100)}%` }} /></span>
            <span className="mono">{Math.round(o.now * 100)}% → {Math.round(o.next * 100)}%</span>
          </span>
        )}
      </div>
      <div className="row">
        <button className="mini-btn" onClick={() => act(quiet(pickAllPrime))}>Only the {words.prime}</button>
        <button className="mini-btn gold" disabled={o.kg <= 0} onClick={() => act(s => finishPick(s, date))}>Into the basket</button>
        <button className="mini-btn" onClick={() => act(quiet(dropPick))}>Leave it all</button>
      </div>
    </section>
  );
};

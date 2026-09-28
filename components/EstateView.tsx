import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameState, CrewMember } from '../types';
import { FacilityId, FacilityState, Plot, Tree, StandingOrders, Hive } from '../types.farm';
import {
  FACILITIES, FACILITY_ORDER, CROPS, FAMILIES, TREE_SPECS, PROBLEMS, FARM_TOOLS, PRODUCE_CLASS, produceClassOf, BIO_CONVERSION_DAYS, SPRAYABLE,
} from '../constants.farm';
import {
  ActionResult, walkRows, groupedProblems, fixProblem, waterPlots, plantPlots, clearPlots, coverPlots, trainPlots,
  applyToPlots, pickHere, contractHarvest, pruneTrees, thinTrees, hiveAction, henAction, isBio, panAction, shedAction, PULLET_COST, RUN_CAPACITY, henFeedStock, henBinDays, HEN_SACK_KG, STRAW_BALE, FLY_FIRST,
  stoveAction, saveSeed, buyFacility, buyTool, setOrder, sellToVan, vanUnitPrice, isEstateProduce, baseOfProduce,
  plotQualityNow, treeQualityNow, baseIngredient, ROLE_FOR, farmRolesFor,
  pantryOf, pantryKg, soilLots, doseKg, treatmentName, bioBlocker, treeIsBiodynamic, sprayPlots, sprayCost,
} from '../services/estate';
import { hiveNeeds, YOLKS_PER_UNIT, HEN_FEED, WORM_FOOD, WORM_REFUSE, BSF_FOOD, WORM_COLONY_KG, castingsGradeOf, eggGrade } from '../services/livestock';
import { HenFeed } from '../types.farm';
import { FARM_ICONS } from './farmIconSheet';
import Portrait from './Portrait';
import { SOIL_EFFECTS, SOIL_PRODUCT_INGREDIENTS, WASTE_IDS, WASTE_INGREDIENTS } from '../constants.soil';

const soilName = (base: string) => SOIL_PRODUCT_INGREDIENTS.find(i => i.id === base)?.name ?? base;
import { stageLabel } from '../services/growth';
import {
  CalendarDate, dayOfYear, absoluteDay, dayWeather, sunTimes, formatClock, formatDuration, lightLeft,
} from '../services/climate';
import { MONTH_NAMES, seasonLabel } from '../constants.forage';
import EstateScene, { ScenePlace, sceneSize, asQuad, treeGeom, potGeom, isGround } from './EstateScene';
import { WildHits, WildMapLedger, GroundLedger } from './WildView';
import { GROUNDS } from '../constants.wild';
import { ESTATE_GEOM, ESTATE_PLATES, CROP_SPRITES } from './estatePlates';
import { CloseIcon } from './icons';

/* =============================================================================
   THE ESTATE

   A place you go, like the cellar: a studio head, the scene, and a ledger.
   Out here the clock moves with what you do — every button says how long it
   takes, the head says how much light is left — and the bench keeps
   fermenting on the same clock behind you.

   The ledger is PAPER (beds are labels, the van is a docket) and the gauges
   are INSTRUMENTS (water, feed and health are dark readouts), which is the
   one-line rule that decides every surface in this game.

   Doing a thing once, not per plant: walking the rows shows every problem in a
   place at once, problems are grouped by kind so one action deals with every
   bed that has it, beds can be selected together, and standing orders hand the
   daily round to whoever works here.
   ============================================================================= */

export interface EstateViewProps {
  state: GameState;
  place: ScenePlace;
  onGo: (place: ScenePlace) => void;
  act: (fn: (s: GameState) => ActionResult, opts?: { dark?: boolean }) => void;
  onWait: (minutes: number) => void;
  onClose: () => void;
  onOpenStaff: () => void;
  log: { at: string; text: string }[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Object.entries with the value type kept. */
const entriesOf = <T,>(o: Record<string, T>) => Object.entries(o) as [string, T][];

const dateOf = (s: GameState): CalendarDate => ({ year: s.year, month: s.month, week: s.week, day: s.day });
const nameOf = (id: string) => baseIngredient(id)?.name ?? id;
const kg = (v: number) => (v >= 100 ? `${Math.round(v)} kg` : v >= 10 ? `${v.toFixed(0)} kg` : `${v.toFixed(1)} kg`);

/** A dark instrument bar, 0-100. */
/** A cell off the owner's farm tool or unit sheet, at a whole-pixel scale. */
const FarmIcon: React.FC<{ id: string; scale?: number }> = ({ id, scale = 1 }) => {
  const ic = FARM_ICONS[id];
  if (!ic) return null;
  return <img className="farm-icon" src={ic.src} width={Math.round(ic.w * scale)} height={Math.round(ic.h * scale)} alt="" aria-hidden="true" />;
};

const Gauge: React.FC<{ label: string; v: number; warnBelow?: number; warnAbove?: number }> = ({ label, v, warnBelow = 30, warnAbove }) => {
  const bad = v < warnBelow || (warnAbove !== undefined && v > warnAbove);
  return (
    <span className={`eg-gauge${bad ? ' bad' : ''}`} title={`${label} ${Math.round(v)}%`}>
      <span className="l">{label}</span>
      <span className="bar"><span style={{ width: `${Math.max(2, Math.min(100, v))}%` }} /></span>
    </span>
  );
};

const Sprite: React.FC<{ id: string; size?: 'small' | 'tiny' }> = ({ id, size = 'small' }) => {
  const s = CROP_SPRITES[baseOfProduce(id)];
  if (!s) return <span className="es-dot" />;
  return <img className={`es-sprite ${size}`} src={s[size]} alt="" />;
};

const EstateView: React.FC<EstateViewProps> = ({ state, place, onGo, act, onWait, onClose, onOpenStaff, log }) => {
  const date = dateOf(state);
  const doy = dayOfYear(date);
  const day = absoluteDay(date);
  const wx = dayWeather(date, state.weather);
  const sun = sunTimes(doy);
  const left = lightLeft(doy, state.minute);
  const dark = state.minute < sun.sunrise || state.minute >= sun.sunset;
  const est = state.estate;
  const wild = place === 'wild_map' || isGround(place);
  const f = !wild && place !== 'farm_map' ? est.facilities[place as FacilityId] : undefined;
  const [sel, setSel] = useState<string[]>([]);
  const [planting, setPlanting] = useState(false);
  const [feeding, setFeeding] = useState(false);
  const [showKit, setShowKit] = useState(false);

  const body = useRef<HTMLDivElement>(null);
  // A new place starts at the top: its picture, not halfway down the last one's ledger.
  useEffect(() => {
    setSel([]); setPlanting(false); setFeeding(false);
    body.current?.scrollTo(0, 0);
    body.current?.querySelectorAll('.estate-ledger, .estate-stage').forEach(e => e.scrollTo(0, 0));
  }, [place]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (isGround(place)) onGo('wild_map'); else if (place !== 'farm_map') onGo('farm_map'); else onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [place, onGo, onClose]);

  const owned = useMemo(() => Object.fromEntries(Object.keys(est.facilities).map(k => [k, true])) as Partial<Record<FacilityId, boolean>>, [est.facilities]);
  const title = place === 'farm_map' ? 'The Farm' : place === 'wild_map' ? 'The Wild' : isGround(place) ? GROUNDS[place].name : FACILITIES[place as FacilityId].name;
  const kicker = place === 'farm_map' || place === 'wild_map' ? 'The estate' : isGround(place) ? 'In the wild' : FACILITIES[place as FacilityId].map === 'wild' ? 'On the coast' : 'The estate';

  const toggle = (id: string) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  return (
    <div className="modal-overlay estate-overlay">
      <div className="estate" role="dialog" aria-label={title}>
        <div className="studio-head estate-head">
          <span className="sh-medal estate-medal" aria-hidden="true">
            <span className="estate-medal-img" style={{ backgroundImage: `url(${ESTATE_PLATES['farm_map:summer']})` }} />
          </span>
          <div className="sh-title">
            <span className="kicker">{kicker}</span>
            <h2>{title}</h2>
          </div>
          <div className="sh-plates">
            <span className="sh-plate"><span className="l">{DAYS[state.day - 1]}</span><span className="v">{MONTH_NAMES[state.month].slice(0, 3)} <small>wk {((state.week - 1) % 4) + 1}</small></span></span>
            <span className="sh-plate estate-clock"><span className="l">{dark ? 'Dark' : 'Clock'}</span><span className="v">{formatClock(state.minute)}</span></span>
            <span className={`sh-plate${left < 60 && !dark ? ' low' : ''}`}><span className="l">{dark ? 'Sunrise' : 'Light left'}</span><span className="v">{dark ? formatClock(sun.sunrise) : formatDuration(left)}</span></span>
            <span className="sh-plate"><span className="l">Purse</span><span className="v">${Math.round(state.money).toLocaleString()}</span></span>
          </div>
          <button className="close-stamp" onClick={onClose} aria-label="Walk home to the workshop" title="Walk home to the workshop">
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="estate-body" ref={body}>
          <div className="estate-stage">
            <div className="estate-scene">
              <EstateScene
                place={place} estate={est} month={state.month} doy={doy} day={day} minute={state.minute}
                wx={wx} weekType={state.weather.type} owned={owned} selected={sel}
              />
              {wild
                ? <WildHits state={state} place={place as any} date={date} wx={wx} size={sceneSize(place)} onGo={onGo} act={act} owned={owned as Record<string, boolean>} />
                : <HitAreas place={place} f={f} owned={owned} sel={sel} onPick={id => {
                  if (place === 'farm_map') return onGo(id as FacilityId);
                  if (place === 'worm_shed' || place === 'hives' || place === 'salt_pans') {
                    setSel([id]);
                    document.querySelector(`[data-unit="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    return;
                  }
                  toggle(id);
                }} />}
            </div>
            <div className="estate-daybar">
              <span className="wx">
                <b>{wx.label}</b> · {Math.round(wx.tMin)}–{Math.round(wx.tMax)} °C{wx.rainMm > 0.5 ? ` · ${wx.rainMm.toFixed(0)} mm` : ''} · {state.weather.description}
              </span>
              <span className="sun mono">☀ {formatClock(sun.sunrise)}–{formatClock(sun.sunset)}</span>
              {place === 'farm_map' && <button className="mini-btn" onClick={() => onGo('wild_map')}>The wild →</button>}
              {place === 'wild_map' && <button className="mini-btn" onClick={() => onGo('farm_map')}>← The farm</button>}
              {isGround(place) && <button className="mini-btn" onClick={() => onGo('wild_map')}>← The wild</button>}
              {!wild && place !== 'farm_map' && <button className="mini-btn" onClick={() => onGo(FACILITIES[place as FacilityId].map === 'wild' ? 'wild_map' : 'farm_map')}>{FACILITIES[place as FacilityId].map === 'wild' ? '← The wild' : '← The farm'}</button>}
              {dark
                ? <button className="mini-btn gold" onClick={() => onWait(((sun.sunrise - state.minute) + 1440) % 1440)}>Wait for the light ({formatClock(sun.sunrise)})</button>
                : <button className="mini-btn" onClick={() => onWait(60)} title="Let an hour pass: the bench works on">Wait an hour</button>}
            </div>
            {log.length > 0 && (
              <ol className="estate-log mono" aria-label="Today">
                {log.slice(-5).map((l, i) => <li key={i}><span>{l.at}</span> {l.text}</li>)}
              </ol>
            )}
          </div>

          <div className="estate-ledger">
            {place === 'farm_map'
              ? <MapLedger state={state} onGo={onGo} act={act} onOpenStaff={onOpenStaff} />
              : place === 'wild_map'
              ? <WildMapLedger state={state} date={date} onGo={onGo} />
              : isGround(place)
              ? <GroundLedger state={state} ground={place} date={date} wx={wx} act={act} />
              : f && (
                <PlaceLedger
                  state={state} f={f} day={day} date={date} sel={sel} setSel={setSel} toggle={toggle} act={act}
                  planting={planting} setPlanting={setPlanting} feeding={feeding} setFeeding={setFeeding}
                  showKit={showKit} setShowKit={setShowKit} onOpenStaff={onOpenStaff}
                />
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------------------------------------------------------
   HIT AREAS OVER THE SCENE: every bed, tree and place is a button
   --------------------------------------------------------------------------- */
const HitAreas: React.FC<{ place: ScenePlace; f?: FacilityState; owned: Partial<Record<FacilityId, boolean>>; sel: string[]; onPick: (id: string) => void }> = ({ place, f, owned, sel, onPick }) => {
  // Every shape is a polygon on the plate's own grid: beds and strips are
  // quads in perspective, a tree is its canopy and its pot.
  const shapes: { id: string; polys: number[][][]; label: string }[] = [];
  const g = ESTATE_GEOM[place];
  const [W, H] = sceneSize(place);
  const ellipse = (c: number[], below = 10): number[][] => Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return [c[0] + Math.cos(a) * c[2], c[1] + Math.sin(a) * (Math.sin(a) > 0 ? c[3] + below : c[3])];
  });
  if (place === 'farm_map') {
    for (const [id, r] of Object.entries(g?.places ?? {}) as [FacilityId, number[]][]) shapes.push({ id, polys: [asQuad(r)], label: `${FACILITIES[id]?.name ?? id}${owned[id] ? '' : ' (for sale)'}` });
  } else if (f) {
    if (place === 'walled_garden') { let bed = 0; f.plots.forEach(p => { const r = p.id === 'roses' ? g.rose : g.beds[bed++]; if (r) shapes.push({ id: p.id, polys: [asQuad(r)], label: p.label }); }); }
    if (place === 'top_field') f.plots.forEach((p, i) => { const r = g.strips[i]; if (r) shapes.push({ id: p.id, polys: [asQuad(r)], label: p.label }); });
    if (place === 'polytunnel') f.plots.forEach((p, i) => {
      if (g.hits?.[i]) { shapes.push({ id: p.id, polys: [g.hits[i]], label: p.label }); return; }
      const pts: number[][] = g.beds[i] ?? [];
      if (!pts.length) return;
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      shapes.push({ id: p.id, polys: [asQuad([Math.min(...xs) - 8, Math.min(...ys) - 40 * Math.max(...pts.map(q => q[2])), Math.max(...xs) + 8, Math.max(...ys) + 4])], label: p.label });
    });
    // Things in a painted place that are not beds: a click finds their card below.
    if (place === 'worm_shed' && g) {
      (g.worms ?? []).forEach((r: number[]) => shapes.push({ id: 'worms', polys: [asQuad(r)], label: 'The worm towers' }));
      (g.bsf ?? []).forEach((r: number[]) => shapes.push({ id: 'bsf', polys: [asQuad(r)], label: 'The soldier fly bins' }));
    }
    if (place === 'hives' && g && f.hives) f.hives.forEach((h, i) => {
      const at = g.hives?.[i];
      if (at?.length >= 4) shapes.push({ id: h.id, polys: [asQuad([at[0] - at[3] / 2, at[2], at[0] + at[3] / 2, at[1]])], label: `Hive ${i + 1}` });
    });
    if (place === 'salt_pans' && g && f.pans) f.pans.forEach((pan, i) => {
      const q = g.pans?.[i];
      if (q && Array.isArray(q[0])) shapes.push({ id: pan.id, polys: [q], label: `Pan ${i + 1}` });
    });
    if (place === 'orchard' || place === 'orangery') f.trees.forEach(t => {
      const c = treeGeom(place, t.id);
      if (!c) return;
      const pot = potGeom(place, t.id);
      shapes.push({ id: t.id, polys: pot ? [ellipse(c, 0), asQuad(pot)] : [ellipse(c)], label: t.label });
    });
  }
  // Far things first, so a near tree or bed takes the click where two overlap.
  shapes.sort((a, b) => Math.max(...a.polys.flat().map(q => q[1])) - Math.max(...b.polys.flat().map(q => q[1])));
  return (
    <svg className="estate-hits" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {shapes.map(b => (
        <g
          key={b.id}
          role="button"
          tabIndex={0}
          className={`estate-hit${sel.includes(b.id) ? ' on' : ''}${place === 'farm_map' && !owned[b.id as FacilityId] ? ' unowned' : ''}`}
          aria-label={b.label}
          onClick={() => onPick(b.id)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(b.id); } }}
        >
          <title>{b.label}</title>
          {b.polys.map((poly, i) => <polygon key={i} points={poly.map(q => q.join(',')).join(' ')} />)}
        </g>
      ))}
    </svg>
  );
};

/* -----------------------------------------------------------------------------
   THE FARM MAP: the places, the gate, who works here
   --------------------------------------------------------------------------- */
const facilitySummary = (f: FacilityState, month: number, day: number): { line: string; urgent: boolean } => {
  const bits: string[] = [];
  let urgent = false;
  const ripe = f.plots.reduce((a, p) => a + (p.planting?.ripeKg ?? 0), 0) + f.trees.reduce((a, t) => a + t.ripeKg, 0);
  if (ripe > 0.3) { bits.push(`${kg(ripe)} ripe`); urgent = true; }
  const seen = groupedProblems(f).filter(g => g.seen);
  if (seen.length) { bits.push(seen.map(g => PROBLEMS[g.id]?.label.toLowerCase()).join(', ')); urgent = true; }
  const dry = f.id !== 'top_field' && !f.kit.drip ? f.plots.filter(p => p.planting && p.water < 30).length : 0;
  if (dry) { bits.push(`${dry} dry`); urgent = true; }
  const growing = f.plots.filter(p => p.planting && p.planting.stage !== 'spent' && p.planting.stage !== 'dead').length;
  const empty = f.plots.filter(p => !p.planting || p.planting.stage === 'spent' || p.planting.stage === 'dead').length;
  if (f.plots.length && !bits.length) bits.push(`${growing} growing${empty ? `, ${empty} free` : ''}`);
  if (f.hives) { const needs = new Set(f.hives.flatMap(h => hiveNeeds(h, month))); if (needs.size) { bits.push([...needs].join(', ')); urgent = true; } else bits.push(`${f.hives.filter(h => h.alive).length} colonies`); }
  if (f.hens) { bits.push(`${f.hens.eggs} eggs waiting`); if (f.hens.eggs > f.hens.hens * 2) urgent = true; }
  if (f.pans) { const c = f.pans.reduce((a, p) => a + p.crustKg, 0), fl = f.pans.reduce((a, p) => a + p.florKg, 0); bits.push(c + fl > 0.3 ? `${kg(c)} salt${fl > 0.05 ? `, ${fl.toFixed(1)} kg flor` : ''}` : f.pans.every(p => p.brineMm < 2) ? 'pans empty' : 'evaporating'); }
  if (f.shed) bits.push(`${kg(f.shed.castingsKg)} castings · ${kg(f.shed.frassKg)} frass`);
  if (f.trees.length && !ripe) bits.push(`${f.trees.length} trees`);
  if (f.walkedDay !== day && (f.plots.some(p => p.planting) || f.trees.length)) bits.push('rows not walked today');
  return { line: bits.join(' · '), urgent };
};

const MapLedger: React.FC<{ state: GameState; onGo: (p: ScenePlace) => void; act: EstateViewProps['act']; onOpenStaff: () => void }> = ({ state, onGo, act, onOpenStaff }) => {
  const est = state.estate;
  const day = absoluteDay(dateOf(state));
  const produce = entriesOf<number>(state.inventory).filter(([id, n]) => isEstateProduce(id) && n > 0)
    .map(([id, n]) => ({ id, n, item: state.customIngredients.find(i => i.id === id) }))
    .sort((a, b) => (a.item?.name ?? '').localeCompare(b.item?.name ?? ''));
  const crew = state.crew as CrewMember[];
  const roles = farmRolesFor(est);
  const pan = pantryOf(state);
  const store = soilLots(pan);
  const waste = WASTE_IDS.map(k => [k, pantryKg(pan, k)] as [string, number]).filter(([, v]) => v > 0.2);
  return (
    <>
      <section className="el-sect">
        <h3>The places</h3>
        <ul className="el-places">
          {FACILITY_ORDER.map(id => {
            const spec = FACILITIES[id];
            const f = est.facilities[id];
            const s = f ? facilitySummary(f, state.month, day) : null;
            return (
              <li key={id} className={`el-place label-plate${f ? '' : ' for-sale'}`}>
                <div className="nm">
                  <span className="name">{spec.name}</span>
                  {f ? <span className={`st${s?.urgent ? ' urgent' : ''}`}>{s?.line}</span> : <span className="about">{spec.about}</span>}
                </div>
                {f
                  ? <button className="btn btn-amber sm" onClick={() => onGo(id)}>Go · {spec.walk} min</button>
                  : <button className="btn sm" disabled={state.money < spec.cost} onClick={() => act(s2 => buyFacility(s2, id, day))}>Buy ${spec.cost.toLocaleString()}</button>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="el-sect">
        <h3>At the gate <span className="sub">the forager’s van buys what you grow</span></h3>
        {produce.length === 0
          ? <p className="el-empty">Nothing of yours in the pantry to sell. What you pick goes there first — the bench gets first call on it.</p>
          : (
            <ul className="el-van">
              {produce.map(({ id, n, item }) => {
                const base = baseIngredient(baseOfProduce(id));
                const price = vanUnitPrice(state, id);
                const cls = produceClassOf(baseOfProduce(id));
                const demand = est.vanDemand[cls] ?? 1;
                return (
                  <li key={id}>
                    <Sprite id={id} size="tiny" />
                    <span className="nm">{base?.name}{isBio(id) && <span className="mk bio">biodynamic</span>}<small> · graded {item?.quality}</small></span>
                    <span className="n mono">{n}×{base ? base.unitDisplay === 'kg' || base.mass >= 1000 ? `${base.mass / 1000} kg` : `${base.mass} g` : ''}</span>
                    <span className={`pr${demand < 0.6 ? ' glut' : ''}`} title={demand < 0.6 ? `The van has had its fill of ${PRODUCE_CLASS[cls]?.label.toLowerCase()} this week.` : ''}>${price.toFixed(2)}</span>
                    <button className="mini-btn" onClick={() => act(s2 => { const r = sellToVan(s2, id, 1); return { state: r.state, minutes: 2, ok: r.paid > 0, message: `Sold one to the van for $${r.paid.toFixed(2)}.` }; })}>Sell 1</button>
                    <button className="mini-btn" onClick={() => act(s2 => { const r = sellToVan(s2, id, n); return { state: r.state, minutes: 5, ok: r.paid > 0, message: `Sold ${n} to the van for $${r.paid.toFixed(2)}.` }; })}>All</button>
                  </li>
                );
              })}
            </ul>
          )}
        <p className="el-note">The van pays a wholesale share and fills up fast: each kilo of one kind sold this week lowers what the next one fetches. It forgets by the week after. The bench is where a glut becomes money.</p>
      </section>

      <section className="el-sect">
        <h3>Hands</h3>
        {roles.length === 0
          ? <p className="el-empty">Nobody to hire until there is somewhere for them to work.</p>
          : (
            <ul className="el-hands">
              {roles.map(r => {
                const c = crew.find(x => x.role === r);
                const where = (Object.keys(ROLE_FOR) as FacilityId[]).filter(k => ROLE_FOR[k] === r && est.facilities[k]).map(k => FACILITIES[k].name.replace('The ', ''));
                return <li key={r}><span className="r">{ROLE_LABEL[r]}</span><span className="w">{c && <Portrait seed={c.id} size={26} className="el-face" role={c.role} />}{c ? `${c.name}, skill ${c.skill}` : 'nobody'}</span><span className="p">{where.join(', ') || 'the wild'}</span></li>;
              })}
            </ul>
          )}
        <button className="mini-btn" onClick={onOpenStaff}>Staff…</button>
      </section>

      {(store.length > 0 || waste.length > 0) && (
        <section className="el-sect">
          <h3>Soil products and waste <span className="sub">in the pantry</span></h3>
          {store.length > 0 && <p className="el-kv">{store.map(l => <span key={l.id}><b>{soilName(l.base)}</b> {kg(l.kg)} · {l.grade}</span>)}</p>}
          {waste.length > 0 && <p className="el-kv faint">{waste.map(([k, v]) => <span key={k}>{WASTE_INGREDIENTS.find(i => i.id === k)?.name ?? k} {kg(v)}</span>)}</p>}
        </section>
      )}
    </>
  );
};

export const ROLE_LABEL: Record<string, string> = {
  gardener: 'Gardener', orchardist: 'Orchardist', beekeeper: 'Beekeeper', poultry: 'Poultry keeper', soil_tech: 'Soil technician', forager: 'Forager’s apprentice',
};

/* -----------------------------------------------------------------------------
   A PLACE: what to see to, the beds, the orders, the kit
   --------------------------------------------------------------------------- */
interface PlaceProps {
  state: GameState; f: FacilityState; day: number; date: CalendarDate; sel: string[];
  setSel: (s: string[]) => void; toggle: (id: string) => void; act: EstateViewProps['act'];
  planting: boolean; setPlanting: (b: boolean) => void; feeding: boolean; setFeeding: (b: boolean) => void;
  showKit: boolean; setShowKit: (b: boolean) => void; onOpenStaff: () => void;
}

const ORDER_WORDS: Partial<Record<keyof StandingOrders, string>> = {
  water: 'Water beds that are drying out', weed: 'Hoe and weed on sight', pests: 'Deal with pests and disease as they are seen',
  pick: 'Pick whatever is ripe', protect: 'Fleece against frost; keep the stove in', feed: 'Feed a bed that runs low',
  train: 'Pinch out tomatoes; prune and thin the trees', bees: 'Inspect, feed, treat and take the honey', hens: 'Eggs, feed, the coop door, the mites',
  spray: 'Spray pests and weeds instead — quick and cheap, and no biodynamic label for a year',
};
const ORDERS_FOR: Record<FacilityId, (keyof StandingOrders)[]> = {
  walled_garden: ['water', 'weed', 'pests', 'pick', 'protect', 'feed', 'spray'],
  polytunnel: ['water', 'weed', 'pests', 'pick', 'train', 'protect', 'feed', 'spray'],
  top_field: ['weed', 'pests', 'pick', 'protect', 'feed', 'spray'],
  orchard: ['pests', 'pick', 'train', 'spray'],
  orangery: ['pests', 'pick', 'protect', 'spray'],
  hives: ['bees'], hen_run: ['hens'], worm_shed: ['feed'], salt_pans: [],
};

const PlaceLedger: React.FC<PlaceProps> = (p) => {
  const { state, f, day, date, sel, setSel, act } = p;
  const spec = FACILITIES[f.id];
  const groups = groupedProblems(f);
  const walkedToday = f.walkedDay === day;
  const hand = (state.crew as CrewMember[]).find(c => c.role === ROLE_FOR[f.id]);

  const selectedPlots = f.plots.filter(x => sel.includes(x.id));
  const selectedTrees = f.trees.filter(x => sel.includes(x.id));
  const focus = selectedPlots[0] ?? null;
  const emptySel = selectedPlots.filter(x => !x.planting || x.planting.stage === 'spent' || x.planting.stage === 'dead');
  const dry = f.plots.filter(x => x.planting && x.planting.stage !== 'spent' && x.water < 45).map(x => x.id);
  const ripeIds = [...f.plots.filter(x => (x.planting?.ripeKg ?? 0) > 0.05).map(x => x.id), ...f.trees.filter(t => t.ripeKg > 0.05).map(t => t.id)];
  const grainRipe = f.id === 'top_field' ? f.plots.filter(x => x.planting && ['wintergrain', 'springgrain'].includes(CROPS[x.planting.cropId].family) && x.planting.ripeKg > 0.05) : [];

  return (
    <>
      <section className="el-sect">
        <h3>To see to</h3>
        <div className="el-todo">
          {!walkedToday && (f.plots.some(x => x.planting) || f.trees.length > 0) && (
            <button className="el-do primary" onClick={() => act(s => walkRows(s, f.id, day))}>
              <span className="what">Walk the rows</span><span className="why">see every problem here at once</span><span className="t mono">{spec.walkRows} min</span>
            </button>
          )}
          {groups.filter(g => g.seen || walkedToday).map(g => {
            const ps = PROBLEMS[g.id];
            const n = g.plots.length + g.trees.length;
            const passive = !ps || ps.minutes === 0 || g.id === 'birds_grain';
            return (
              <div key={g.id} className="el-prob">
                <span className="what"><b>{ps?.label ?? g.id}</b> · {n} {n > 1 ? 'places' : 'place'}</span>
                <span className="why">{ps?.is}</span>
                {!passive && <button className="mini-btn" onClick={() => act(s => fixProblem(s, f.id, g.id))}>{ps.fix}{ps.cost ? ` · $${ps.cost}` : ''}</button>}
                {g.id === 'birds_grain' && <span className="why">Cut it.</span>}
              </div>
            );
          })}
          {groups.some(g => !g.seen) && !walkedToday && <p className="el-note">Something may be wrong that you have not seen yet.</p>}
          {dry.length > 0 && f.id !== 'top_field' && !f.kit.drip && (
            <button className="el-do" onClick={() => act(s => waterPlots(s, f.id, dry))}>
              <span className="what">Water {dry.length} bed{dry.length > 1 ? 's' : ''}</span><span className="why">{f.kit.hose ? 'with the hose' : 'by can'}</span>
            </button>
          )}
          {ripeIds.length > 0 && f.id !== 'top_field' && (
            <button className="el-do" onClick={() => act(s => pickHere(s, f.id, ripeIds))}>
              <span className="what">Pick everything ripe</span><span className="why">{kg(f.plots.reduce((a, x) => a + (x.planting?.ripeKg ?? 0), 0) + f.trees.reduce((a, t) => a + t.ripeKg, 0))}</span>
            </button>
          )}
          {grainRipe.map(x => (
            <div key={x.id} className="el-prob">
              <span className="what"><b>{nameOf(x.planting!.cropId)}</b> is ripe on the {x.label.toLowerCase()} · {kg(x.planting!.ripeKg)}</span>
              <button className="mini-btn" disabled={!f.kit.scythe} title={f.kit.scythe ? '' : 'You need a scythe and flail'} onClick={() => act(s => pickHere(s, 'top_field', [x.id]))}>Cut it by hand · a long day</button>
              <button className="mini-btn gold" onClick={() => act(s => contractHarvest(s, x.id))}>Call the contractor · $60</button>
            </div>
          ))}
        </div>
      </section>

      {f.plots.length > 0 && (
        <section className="el-sect">
          <h3>
            {f.id === 'top_field' ? 'Strips' : f.id === 'polytunnel' ? 'Bays' : 'Beds'}
            {sel.length > 0 && <button className="linkish" onClick={() => setSel([])}>clear selection</button>}
          </h3>
          <ul className="el-beds">
            {f.plots.map(plot => <BedCard key={plot.id} plot={plot} f={f} day={day} on={sel.includes(plot.id)} onToggle={() => p.toggle(plot.id)} />)}
          </ul>
          {selectedPlots.length > 0 && (
            <BedActions {...p} plots={selectedPlots} empty={emptySel} focus={focus} />
          )}
        </section>
      )}

      {f.trees.length > 0 && (
        <section className="el-sect">
          <h3>{f.id === 'orangery' ? 'The pots' : 'The trees'}{sel.length > 0 && <button className="linkish" onClick={() => setSel([])}>clear selection</button>}</h3>
          <ul className="el-beds">
            {f.trees.map(t => <TreeCard key={t.id} tree={t} f={f} day={day} on={sel.includes(t.id)} onToggle={() => p.toggle(t.id)} />)}
          </ul>
          {selectedTrees.length > 0 && <TreeActions {...p} trees={selectedTrees} />}
          {f.id === 'orangery' && (
            <div className="el-row">
              <span className="k">The stove</span>
              <span className="v">{f.stoveLit ? 'in' : 'out'} · {Math.round(f.fuelKg ?? 0)} kg of wood</span>
              <button className="mini-btn" onClick={() => act(s => stoveAction(s, !f.stoveLit))}>{f.stoveLit ? 'Let it go out' : 'Light it'}</button>
            </div>
          )}
        </section>
      )}

      {f.hives && <HivePanel {...p} hives={f.hives} />}
      {f.hens && <HenPanel {...p} />}
      {f.pans && <PanPanel {...p} />}
      {f.shed && <ShedPanel {...p} />}

      <section className="el-sect">
        <h3>{hand && <Portrait seed={hand.id} size={30} className="el-face" role={hand.role} />}Standing orders <span className="sub">{hand ? `${hand.name} does these, every day` : ORDERS_FOR[f.id].length ? 'nobody works here to do them' : ''}</span></h3>
        {ORDERS_FOR[f.id].length === 0
          ? <p className="el-note">The pans are minded by the forager’s apprentice, or by you.</p>
          : (
            <ul className="el-orders">
              {ORDERS_FOR[f.id].map(k => (
                <li key={k}>
                  <label className={hand ? '' : 'off'}>
                    <input type="checkbox" id={`order-${f.id}-${k}`} checked={!!f.orders[k]} disabled={!hand} onChange={e => act(s => ({ state: setOrder(s, f.id, k, e.target.checked), minutes: 0, ok: true, message: e.target.checked ? `Standing order: ${ORDER_WORDS[k]?.toLowerCase()}.` : 'Order withdrawn.' }))} />
                    {ORDER_WORDS[k]}
                  </label>
                </li>
              ))}
            </ul>
          )}
        {!hand && ORDERS_FOR[f.id].length > 0 && <button className="mini-btn" onClick={p.onOpenStaff}>Hire {/^[aeiou]/i.test(ROLE_LABEL[ROLE_FOR[f.id]]) ? 'an' : 'a'} {ROLE_LABEL[ROLE_FOR[f.id]].toLowerCase()}…</button>}
        {f.kit.drip && <p className="el-note">The drip line waters every bed here on its own.</p>}
      </section>

      <section className="el-sect">
        <h3>
          The kit
          <button className="linkish" onClick={() => p.setShowKit(!p.showKit)}>{p.showKit ? 'hide the catalogue' : 'buy more'}</button>
        </h3>
        <p className="el-kv">{FARM_TOOLS.filter(t => f.kit[t.id]).map(t => <span key={t.id} className="kit-owned"><FarmIcon id={t.id} scale={0.6} />{t.name}</span>)}{!FARM_TOOLS.some(t => f.kit[t.id]) && <span className="faint">Bare hands and a bucket.</span>}</p>
        {p.showKit && (
          <ul className="el-kit">
            {FARM_TOOLS.filter(t => !f.kit[t.id] && (!t.where || t.where.includes(f.id))).map(t => (
              <li key={t.id}>
                <span className="nm">{FARM_ICONS[t.id] && <FarmIcon id={t.id} scale={0.6} />}{t.name}</span><span className="ab">{t.about}</span>
                <button className="btn sm" disabled={state.money < t.cost} onClick={() => act(s => buyTool(s, f.id, t.id))}>${t.cost}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};

/* --- a bed as a label --- */
const BedCard: React.FC<{ plot: Plot; f: FacilityState; day: number; on: boolean; onToggle: () => void }> = ({ plot, f, day, on, onToggle }) => {
  const pl = plot.planting;
  const q = pl && pl.stage !== 'dead' ? plotQualityNow(pl) : 0;
  const base = pl ? baseIngredient(pl.cropId) : undefined;
  const spec = pl ? CROPS[pl.cropId] : undefined;
  const pctRipe = pl && spec ? Math.min(100, (pl.gdd / spec.gddToRipe) * 100) : 0;
  return (
    <li className={`el-bed label-plate${on ? ' on' : ''}${pl?.stage === 'dead' ? ' stamped spoiled' : ''}`}>
      <button className="el-bed-hit" onClick={onToggle} aria-pressed={on} aria-label={`${plot.label}${pl ? `, ${base?.name}` : ', empty'}`} />
      <div className="top">
        {pl ? <Sprite id={pl.cropId} size="tiny" /> : <span className="es-dot" />}
        <span className="name">{pl ? base?.name : 'Empty'}</span>
        <span className="where">{plot.label}</span>
      </div>
      {pl ? (
        <>
          <div className="stage">
            <span>{pl.stage === 'dead' ? `lost${pl.deathCause ? ` — ${PROBLEMS[pl.deathCause]?.label.toLowerCase() ?? pl.deathCause}` : ''}` : stageLabel(pl.cropId, pl.stage)}</span>
            {pl.stage !== 'ripe' && pl.stage !== 'over' && pl.stage !== 'spent' && pl.stage !== 'dead' && <span className="prog"><span style={{ width: `${pctRipe}%` }} /></span>}
            {pl.ripeKg > 0.05 && <span className="ripe">{kg(pl.ripeKg)} ripe · grade {q}</span>}
            {pl.pickedKg > 0.05 && <span className="faint">{kg(pl.pickedKg)} picked</span>}
          </div>
          <div className="gauges">
            {f.id !== 'top_field' || true ? <Gauge label="Water" v={plot.water} warnBelow={30} warnAbove={95} /> : null}
            <Gauge label="Feed" v={plot.fertility} warnBelow={30} warnAbove={90} />
            <Gauge label="Health" v={pl.health} warnBelow={60} />
          </div>
          <div className="marks">
            {pl.cover.mulch && <span className="mk">mulched</span>}
            {pl.cover.net && <span className="mk">netted</span>}
            {pl.cover.fleece && <span className="mk">fleece</span>}
            {(pl.trainedUntil ?? -1) >= day && <span className="mk">trained</span>}
            <BioMark plot={plot} f={f} day={day} />
            {(pl.treated.chem ?? -1) >= day && <span className="mk bad">sprayed</span>}
            {entriesOf<number>(pl.treated).filter(([k, until]) => until >= day && k !== 'chem').map(([k]) => <span key={k} className="mk">{treatmentName(k)}</span>)}
            {(pl.line ?? 0) > 0 && <span className="mk">seed line {pl.line}</span>}
            {pl.problems.filter(x => x.seen).map(x => <span key={x.id} className="mk bad">{PROBLEMS[x.id]?.label}</span>)}
          </div>
        </>
      ) : (
        <div className="gauges">
          <Gauge label="Water" v={plot.water} warnBelow={20} />
          <Gauge label="Feed" v={plot.fertility} warnBelow={30} />
          <Gauge label="Life" v={plot.life} warnBelow={25} />
          <span className="marks"><BioMark plot={plot} f={f} day={day} /></span>
          {plot.history[0] && <span className="faint hist">last: {FAMILIES[plot.history[0] as keyof typeof FAMILIES]?.label.toLowerCase() ?? plot.history[0]}</span>}
        </div>
      )}
    </li>
  );
};

/* --- what can be done to the selected beds --- */
const BedActions: React.FC<PlaceProps & { plots: Plot[]; empty: Plot[]; focus: Plot | null }> = (p) => {
  const { state, f, day, date, act, plots, empty, focus } = p;
  const ids = plots.map(x => x.id);
  const growing = plots.filter(x => x.planting && x.planting.stage !== 'dead' && x.planting.stage !== 'spent');
  const tomatoes = growing.filter(x => CROPS[x.planting!.cropId].family === 'tomato');
  const finished = plots.filter(x => x.planting && (x.planting.stage === 'spent' || x.planting.stage === 'dead'));
  const sameAsFocus = focus?.planting ? f.plots.filter(x => x.planting?.cropId === focus.planting!.cropId).map(x => x.id) : [];
  const store = soilLots(pantryOf(state));
  const canSeed = focus?.planting && ['ripe', 'over', 'spent'].includes(focus.planting.stage) && !focus.planting.seedKept;
  const month = state.month;
  return (
    <div className="el-actions">
      {sameAsFocus.length > 1 && sameAsFocus.some(id => !ids.includes(id)) && (
        <button className="linkish" onClick={() => p.setSel(sameAsFocus)}>Select every bed of {nameOf(focus!.planting!.cropId)}</button>
      )}
      <div className="row">
        {f.id !== 'top_field' && <button className="mini-btn" onClick={() => act(s => waterPlots(s, f.id, ids))}>Water</button>}
        {growing.some(x => x.planting!.ripeKg > 0.05) && f.id !== 'top_field' && <button className="mini-btn gold" onClick={() => act(s => pickHere(s, f.id, ids))}>Pick</button>}
        {growing.length > 0 && f.id !== 'top_field' && <button className="mini-btn" onClick={() => act(s => coverPlots(s, f.id, growing.map(x => x.id), 'mulch'))}>{growing.every(x => x.planting!.cover.mulch) ? 'Lift mulch' : 'Mulch'}</button>}
        {growing.length > 0 && f.kit.netting && <button className="mini-btn" onClick={() => act(s => coverPlots(s, f.id, growing.map(x => x.id), 'net'))}>{growing.every(x => x.planting!.cover.net) ? 'Take nets off' : 'Net'}</button>}
        {growing.length > 0 && f.kit.fleece && <button className="mini-btn" onClick={() => act(s => coverPlots(s, f.id, growing.map(x => x.id), 'fleece'))}>{growing.every(x => x.planting!.cover.fleece) ? 'Fold fleece' : 'Fleece'}</button>}
        {tomatoes.length > 0 && <button className="mini-btn" onClick={() => act(s => trainPlots(s, f.id, tomatoes.map(x => x.id), day))}>Pinch out and tie in</button>}
        <button className="mini-btn" onClick={() => p.setFeeding(!p.feeding)}>Feed…</button>
        {growing.some(x => x.planting!.problems.some(q => SPRAYABLE.has(q.id))) && (
          <button className="mini-btn warn" title="Clears pests, fungus and weeds at once and keeps them off a fortnight. The bed starts its biodynamic year again."
            onClick={() => act(s => sprayPlots(s, f.id, growing.map(x => x.id), day))}>Spray · ${growing.reduce((a, x) => a + sprayCost(x.areaM2), 0)} · loses the label</button>
        )}
        {finished.length > 0 && <button className="mini-btn" onClick={() => act(s => clearPlots(s, f.id, finished.map(x => x.id)))}>Clear</button>}
        {canSeed && <button className="mini-btn" onClick={() => act(s => saveSeed(s, f.id, focus!.id))}>Save seed</button>}
        {empty.length > 0 && <button className="mini-btn gold" onClick={() => p.setPlanting(!p.planting)}>Plant…</button>}
      </div>
      {p.feeding && (
        <div className="el-pick">
          {store.length === 0 && <p className="el-note">Nothing for the soil in the pantry. The soil lab and the worm shed make it; until then a feed means bought manure (the gardener’s standing order does that).</p>}
          {store.map(l => {
            const need = plots.reduce((a, x) => a + doseKg(l, x.areaM2), 0);
            return (
              <button key={l.id} className="el-option" disabled={l.kg < need - 1e-6} onClick={() => { act(s => applyToPlots(s, f.id, ids, l.id, day)); p.setFeeding(false); }}>
                <span className="nm">{soilName(l.base)} · {l.grade}</span><span className="ab">{SOIL_EFFECTS[l.base].about}</span><span className="t mono">{kg(need)} of {kg(l.kg)}</span>
              </button>
            );
          })}
        </div>
      )}
      {p.planting && empty.length > 0 && (
        <div className="el-pick">
          {Object.values(CROPS).filter(c => c.where.includes(f.id) && (empty.some(x => x.id === 'roses') ? c.id === 'rose_petals' : c.id !== 'rose_petals')).map(c => {
            const ok = c.plant.includes(month);
            const cost = Math.round(empty.reduce((a, x) => a + x.areaM2 * c.costM2, 0));
            const line = state.estate.seedLines[c.id] ?? 0;
            return (
              <button key={c.id} className={`el-option${ok ? '' : ' off'}`} disabled={!ok || state.money < cost} onClick={() => { act(s => plantPlots(s, f.id, empty.map(x => x.id), c.id, day, month)); p.setPlanting(false); }}>
                <Sprite id={c.id} size="tiny" />
                <span className="nm">{nameOf(c.id)}{line > 0 && <small> · your line, gen {line}</small>}</span>
                <span className="ab">{ok ? c.note : `Goes in ${seasonLabel(c.plant)}.`}</span>
                <span className="t mono">{ok ? `$${cost}` : ''}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* --- a tree as a label --- */
/** The label, or what stands between this bed and it. */
const BioMark: React.FC<{ plot: Plot; f: FacilityState; day: number }> = ({ plot, f, day }) => {
  const why = bioBlocker(plot, day, f.boughtDay);
  return why ? <span className="mk faint" title="Biodynamic needs a year with no synthetic spray and no bought feed, and soil life of 60">not biodynamic: {why}</span> : <span className="mk bio" title="No synthetic sprays, no bought feed, a living soil, heirloom seed">biodynamic</span>;
};

const TreeCard: React.FC<{ tree: Tree; f: FacilityState; day: number; on: boolean; onToggle: () => void }> = ({ tree, f, day, on, onToggle }) => {
  const spec = TREE_SPECS[tree.cropId];
  const base = baseIngredient(tree.cropId);
  const hanging = tree.fruitKg + tree.ripeKg;
  const stage = tree.ripeKg > 0.05 ? 'ripe' : tree.fruitKg > 0.05 ? 'fruit swelling' : tree.bloom > 0 && tree.gdd < spec.gddBloom + 90 ? 'in blossom' : tree.gdd < spec.gddBloom ? (spec.evergreen ? 'resting' : 'dormant') : tree.pickedKg > 0 ? 'picked' : 'in leaf';
  return (
    <li className={`el-bed label-plate${on ? ' on' : ''}`}>
      <button className="el-bed-hit" onClick={onToggle} aria-pressed={on} aria-label={tree.label} />
      <div className="top"><Sprite id={tree.cropId} size="tiny" /><span className="name">{tree.label}</span><span className="where">{base?.name} · {tree.age} yrs</span></div>
      <div className="stage">
        <span>{stage}</span>
        {hanging > 0.05 && <span>{kg(hanging)} on the tree</span>}
        {tree.ripeKg > 0.05 && <span className="ripe">{kg(tree.ripeKg)} ripe · grade {treeQualityNow(tree)}</span>}
        {tree.pickedKg > 0.05 && <span className="faint">{kg(tree.pickedKg)} picked</span>}
      </div>
      <div className="gauges"><Gauge label="Health" v={tree.health} warnBelow={60} /></div>
      <div className="marks">
        {tree.prunedYear !== undefined && <span className="mk">pruned {tree.prunedYear === undefined ? '' : ''}</span>}
        {tree.thinnedYear !== undefined && <span className="mk">thinned</span>}
        {treeIsBiodynamic(tree, day, f.boughtDay) ? <span className="mk bio">biodynamic</span> : <span className="mk faint">in conversion, {BIO_CONVERSION_DAYS - (day - (tree.sprayedDay ?? f.boughtDay))} days to go</span>}
        {(tree.treated.chem ?? -1) >= day && <span className="mk bad">sprayed</span>}
        {tree.problems.filter(x => x.seen).map(x => <span key={x.id} className="mk bad">{PROBLEMS[x.id]?.label}</span>)}
      </div>
    </li>
  );
};

const TreeActions: React.FC<PlaceProps & { trees: Tree[] }> = (p) => {
  const { f, date, act, trees, state, day } = p;
  const ids = trees.map(t => t.id);
  const winter = date.month === 11 || date.month <= 1;
  const store = soilLots(pantryOf(state)).filter(l => SOIL_EFFECTS[l.base].lasts);
  return (
    <div className="el-actions">
      <div className="row">
        {trees.some(t => t.ripeKg > 0.05) && <button className="mini-btn gold" onClick={() => act(s => pickHere(s, f.id, ids))}>Pick</button>}
        <button className="mini-btn" disabled={!winter} title={winter ? '' : 'December to February, while the sap is down'} onClick={() => act(s => pruneTrees(s, f.id, ids, date))}>Winter prune</button>
        {date.month >= 5 && date.month <= 7 && <button className="mini-btn" onClick={() => act(s => pruneTrees(s, f.id, ids, date, true))}>Summer prune</button>}
        {date.month >= 4 && date.month <= 6 && trees.some(t => t.fruitKg > 0) && <button className="mini-btn" onClick={() => act(s => thinTrees(s, f.id, ids, date))}>Thin the fruit</button>}
        {trees.some(t => t.problems.some(q => SPRAYABLE.has(q.id))) && <button className="mini-btn warn" title="Clears pests and fungus at once. The tree starts its biodynamic year again." onClick={() => act(s => sprayPlots(s, f.id, ids, day))}>Spray · ${trees.length * sprayCost(10)} · loses the label</button>}
        {store.map(l => <button key={l.id} className="mini-btn" onClick={() => act(s => applyToPlots(s, f.id, ids, l.id, day))}>{soilName(l.base)} · {l.grade}</button>)}
      </div>
    </div>
  );
};

/* --- the apiary --- */
const HivePanel: React.FC<PlaceProps & { hives: Hive[] }> = ({ hives, state, date, day, act, f, sel }) => {
  const needs = new Set(hives.flatMap(h => hiveNeeds(h, date.month)));
  const surplus = hives.reduce((a, h) => a + (h.alive ? h.surplus : 0), 0);
  return (
    <section className="el-sect">
      <h3>The colonies</h3>
      <ul className="el-beds">
        {hives.map((h, i) => (
          <li key={h.id} data-unit={h.id} className={`el-bed label-plate${h.alive ? '' : ' stamped spoiled'}${sel.includes(h.id) ? ' on' : ''}`}>
            <div className="top"><FarmIcon id={h.alive && h.strength > 0.8 ? 'hive_busy' : 'hive'} scale={0.5} /><span className="name">Hive {i + 1}</span><span className="where">{h.alive ? `queen ${h.queenAge} yr${h.queenAge === 1 ? '' : 's'}` : 'dead'}</span></div>
            {h.alive && (
              <>
                <div className="gauges">
                  <Gauge label="Bees" v={h.strength / 1.4 * 100} warnBelow={40} />
                  <Gauge label="Stores" v={h.stores / 22 * 100} warnBelow={date.month >= 7 || date.month <= 2 ? 70 : 25} />
                  <Gauge label="Mites" v={100 - h.varroa} warnBelow={50} />
                </div>
                <div className="stage"><span>{h.stores.toFixed(1)} kg stores</span>{h.surplus > 0.3 && <span className="ripe">{h.surplus.toFixed(1)} kg capped</span>}</div>
                <div className="marks">{hiveNeeds(h, date.month).filter(n => n !== 'honey').map(n => <span key={n} className="mk bad">{n === 'feed' ? 'light' : n === 'swarm' ? 'queen cells likely' : 'varroa high'}</span>)}</div>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="el-actions"><div className="row">
        <button className={`mini-btn${needs.has('swarm') ? ' gold' : ''}`} onClick={() => act(s => hiveAction(s, 'inspect', date, day))}>Inspect all · break down queen cells</button>
        <button className={`mini-btn${needs.has('feed') ? ' gold' : ''}`} onClick={() => act(s => hiveAction(s, 'feed', date, day))}>{date.month >= 10 || date.month <= 2 ? 'Fondant for the light ones' : 'Syrup for the light ones'}</button>
        {date.month >= 6 && date.month <= 9 && <button className={`mini-btn${needs.has('varroa') ? ' gold' : ''}`} onClick={() => act(s => hiveAction(s, 'varroa', date, day))}>Treat for varroa · $15 a hive</button>}
        <button className="mini-btn gold" disabled={surplus < 1} onClick={() => act(s => hiveAction(s, 'honey', date, day))}>Take the honey{surplus >= 1 ? ` · ${surplus.toFixed(0)} kg` : ''}</button>
      </div></div>
      <p className="el-note">Acacia flows in May, chestnut and lime in June, ivy in October. Leave a colony 18 kg of its own for the winter.</p>
    </section>
  );
};

/* --- the hens --- */
const HEN_BINS: HenFeed[] = ['grain', 'corn', 'pulses', 'greens', 'mash', 'worms', 'shells'];
const HenPanel: React.FC<PlaceProps> = ({ f, act, state }) => {
  const r = f.hens!;
  const shed = state.estate.facilities.worm_shed?.shed;
  const shedLarvae = shed?.prepupaeKg ?? 0;
  const spareWorms = shed ? shed.wormsKg - WORM_COLONY_KG : 0;
  const stock = henFeedStock(pantryOf(state));
  const d = r.diet;
  const days = henBinDays(r);
  const inBin = [
    ...(r.feedKg > 0.05 ? [`${r.feedKg.toFixed(0)} kg pellets`] : []),
    ...(r.larvaeKg > 0.05 ? [`${r.larvaeKg.toFixed(1)} kg larvae`] : []),
    ...HEN_BINS.filter(k => (r.bin?.[k] ?? 0) > 0.05).map(k => `${(r.bin![k]!).toFixed(1)} kg ${HEN_FEED[k].label.toLowerCase()}`),
  ];
  return (
    <section className="el-sect">
      <h3><FarmIcon id="feeder" scale={0.5} />The hens <span className="sub">{r.hens} in the run</span></h3>
      <div className="gauges wide">
        <Gauge label="Health" v={r.health} warnBelow={60} />
        <Gauge label="Mites" v={100 - r.mites} warnBelow={45} />
        <Gauge label="Feed" v={Math.min(100, days / 7 * 100)} warnBelow={30} />
      </div>
      <p className="el-kv"><span><b>{r.eggs}</b> eggs in the nest box{r.eggs > 0 && r.eggQ ? `, grade ${Math.round(r.eggQ)}` : ''}</span><span>{Math.round(r.laidTotal / YOLKS_PER_UNIT)} × ½ kg of yolks laid so far</span></p>
      {d && r.hens > 0 && (
        <div className="hen-diet">
          <span className="section-lbl">Yesterday’s diet</span>
          <dl>
            <div className={d.fed < 0.9 ? 'bad' : ''}><dt>Fed</dt><dd className="mono">{Math.round(Math.min(1.5, d.fed) * 100)}%</dd></div>
            <div className={d.protein < 0.15 ? 'bad' : ''}><dt>Protein</dt><dd className="mono">{(d.protein * 100).toFixed(0)}%</dd></div>
            <div className={d.calcium < 0.55 ? 'bad' : ''}><dt>Shell</dt><dd className="mono">{d.calcium >= 0.8 ? 'sound' : d.calcium >= 0.55 ? 'thin' : 'breaking'}</dd></div>
            <div><dt>Yolk</dt><dd className="mono">{d.yolk >= 0.65 ? 'deep orange' : d.yolk >= 0.4 ? 'golden' : 'pale'}</dd></div>
            <div><dt>Eggs grade</dt><dd className="mono">{eggGrade(d, r.health)}</dd></div>
          </dl>
          <p className="el-note">
            {d.fed < 0.9 ? 'Hungry hens stop laying. ' : ''}
            {d.protein < 0.15 ? 'Short of protein: pulses, larvae or worms bring the lay back. ' : ''}
            {d.calcium < 0.55 ? 'Short of calcium: give them their shells back, or pellets. ' : ''}
            {d.yolk < 0.4 ? 'Greens and maize deepen the yolk, which the lab pays for.' : ''}
          </p>
        </div>
      )}
      <p className="el-kv"><span>In the bin: {inBin.length ? inBin.join(' · ') : 'nothing'}</span><span>{days >= 99 ? '' : `about ${Math.floor(days)} day${Math.floor(days) === 1 ? '' : 's'} of food`}</span></p>
      <div className="el-actions"><div className="row">
        <button className="mini-btn gold" disabled={r.eggs === 0} onClick={() => act(s => henAction(s, 'eggs'))}><FarmIcon id="egg_basket" scale={0.35} />Collect the eggs</button>
        {!f.kit.auto_door && <button className="mini-btn" onClick={() => act(s => henAction(s, 'shut'), { dark: true })}>Shut them in for the night</button>}
        {r.mites > 30 && <button className="mini-btn" onClick={() => act(s => henAction(s, 'clean'))}>Muck out</button>}
        {r.hens < RUN_CAPACITY && <button className={`mini-btn${r.hens === 0 ? ' gold' : ''}`} onClick={() => act(s => henAction(s, 'pullets'))}>{RUN_CAPACITY - r.hens >= 2 ? 'Two pullets' : 'A pullet'} · ${Math.min(2, RUN_CAPACITY - r.hens) * PULLET_COST}</button>}
      </div>
      <div className="row">
        <button className="mini-btn" onClick={() => act(s => henAction(s, 'feed'))}>A sack of pellets · $18</button>
        {(['grain', 'corn', 'pulses', 'greens', 'mash', 'shells'] as HenFeed[]).map(k => {
          const kg = stock[k]?.kg ?? 0;
          if (kg < 0.05) return null;
          return <button key={k} className="mini-btn" onClick={() => act(s => henAction(s, k))}>{HEN_FEED[k].label} · {Math.min(HEN_SACK_KG[k], kg).toFixed(Math.min(HEN_SACK_KG[k], kg) < 10 ? 1 : 0)} kg</button>;
        })}
        {shedLarvae > 0.4 && <button className="mini-btn gold" onClick={() => act(s => henAction(s, 'larvae'))}>Larvae from the shed · {shedLarvae.toFixed(1)} kg</button>}
        {spareWorms > 0.2 && <button className="mini-btn" onClick={() => act(s => henAction(s, 'worms'))}>Spare worms · {spareWorms.toFixed(1)} kg</button>}
      </div></div>
      <p className="el-note">What they eat is in the egg. Pellets are complete but plain; your own grain feeds them, pulses (cooked — raw beans make a hen ill) and fly larvae bring the protein, greens and maize colour the yolk, and their own shells, roasted and crushed, keep the next shell sound.</p>
      {!f.kit.auto_door && <p className="el-note">A fox tries the door every night. Shut it at dusk, or buy the automatic door, or hire a keeper.</p>}
    </section>
  );
};

/* --- the pans --- */
const PanPanel: React.FC<PlaceProps> = ({ f, act, state, sel }) => {
  const pans = f.pans!;
  const crust = pans.reduce((a, x) => a + x.crustKg, 0), flor = pans.reduce((a, x) => a + x.florKg, 0);
  return (
    <section className="el-sect">
      <h3>The pans</h3>
      <ul className="el-beds">
        {pans.map((x, i) => (
          <li key={x.id} data-unit={x.id} className={`el-bed label-plate${sel.includes(x.id) ? ' on' : ''}`}>
            <div className="top"><Sprite id="salt" size="tiny" /><span className="name">Pan {i + 1}</span><span className="where">{x.covered ? 'covered' : 'open'}</span></div>
            <div className="stage">
              <span>{x.brineMm > 1 ? `${x.brineMm.toFixed(0)} mm of brine at ${Math.round(x.gPerL)} g/l` : 'dry'}</span>
              {x.crustKg > 0.1 && <span className="ripe">{x.crustKg.toFixed(1)} kg salt</span>}
              {x.florKg > 0.02 && <span className="ripe">{x.florKg.toFixed(2)} kg flor</span>}
            </div>
            <div className="gauges"><Gauge label="Brine" v={Math.min(100, x.brineMm / 40 * 100)} warnBelow={-1} /><Gauge label="Strength" v={Math.min(100, x.gPerL / 300 * 100)} warnBelow={-1} /></div>
          </li>
        ))}
      </ul>
      <div className="el-actions"><div className="row">
        <button className="mini-btn" onClick={() => act(s => panAction(s, 'fill'))}>Let the sea in</button>
        <button className="mini-btn" onClick={() => act(s => panAction(s, 'cover'))}>{pans.every(x => x.covered) ? 'Uncover' : 'Cover against rain'}</button>
        <button className="mini-btn gold" disabled={crust < 0.5} onClick={() => act(s => panAction(s, 'rake'))}>Rake the salt{crust >= 0.5 ? ` · ${crust.toFixed(0)} kg` : ''}</button>
        <button className="mini-btn gold" disabled={flor < 0.1} onClick={() => act(s => panAction(s, 'flor'))}>Skim the flor{flor >= 0.1 ? ` · ${flor.toFixed(1)} kg` : ''}</button>
      </div></div>
      <p className="el-note">A hot still bright week does the work. Rain on an open pan puts the salt back in the sea.</p>
    </section>
  );
};

/* --- the shed --- */
const names = (ids: string[]) => ids.map(id => baseIngredient(id)?.name?.toLowerCase() ?? WASTE_NAME[id] ?? id.replace(/_/g, ' '));
const WASTE_NAME: Record<string, string> = { veg_waste: 'vegetable waste', green_waste: 'green waste', spent_grain: 'spent grain', fish_waste: 'fish waste', press_cake: 'press cake', windfalls: 'windfalls', straw: 'straw', eggshells: 'eggshells', green_tips: 'green tips' };
const ShedPanel: React.FC<PlaceProps> = ({ f, act, state, sel }) => {
  const s = f.shed!;
  const pan = pantryOf(state);
  const wormWet = Object.entries(WORM_FOOD).filter(([k, r]) => r !== 'carbon' && r !== 'grit' && k !== 'green_tips' && !(s.bsfLarvaeKg >= 0.05 && FLY_FIRST.includes(k))).reduce((a, [k]) => a + pantryKg(pan, k), 0);
  const flyOwn = FLY_FIRST.reduce((a, k) => a + pantryKg(pan, k), 0);
  const flyWet = flyOwn >= 0.2 ? flyOwn : Object.keys(BSF_FOOD).filter(k => k !== 'green_tips').reduce((a, k) => a + pantryKg(pan, k), 0);
  const straw = pantryKg(pan, 'straw');
  const q = s.wormFeedQ;
  const conv = s.bsfConv;
  const cg = Math.round(s.castingsGrade ?? castingsGradeOf(q ?? 0.6));
  return (
    <section className="el-sect">
      <h3>The bins</h3>
      <ul className="el-beds">
        <li data-unit="worms" className={`el-bed label-plate${sel.includes('worms') ? ' on' : ''}`}>
          <div className="top"><FarmIcon id={s.castingsKg > 2 ? 'worm_tray' : 'worm_tower'} scale={0.5} /><span className="name">Worm towers</span><span className="where">{s.wormsKg.toFixed(1)} kg of worms</span></div>
          <div className="stage">
            <span>{s.wormFeedKg.toFixed(1)} kg waiting{q !== undefined && s.wormFeedKg > 0.2 ? ` · ${q >= 0.8 ? 'well bedded' : q >= 0.55 ? 'short of bedding' : 'wet and sour'}` : ''}</span>
            {s.castingsKg > 0.2 && <span className="ripe"><FarmIcon id="sack_castings" scale={0.4} />{s.castingsKg.toFixed(1)} kg castings, grade {cg}</span>}
          </div>
        </li>
        <li data-unit="bsf" className={`el-bed label-plate${s.bsfLarvaeKg < 0.05 ? ' faint' : ''}${sel.includes('bsf') ? ' on' : ''}`}>
          <div className="top"><FarmIcon id={s.bsfLarvaeKg < 0.05 ? 'fly_bin' : s.prepupaeKg > 0.5 ? 'fly_bin_full' : s.bsfFeedKg > 0.2 ? 'fly_bin_busy' : 'fly_bin'} scale={0.5} /><span className="name">Soldier fly bins</span><span className="where">{s.bsfLarvaeKg < 0.05 ? 'no colony' : `${s.bsfLarvaeKg.toFixed(1)} kg of larvae`}</span></div>
          <div className="stage">
            <span>{s.bsfFeedKg.toFixed(1)} kg waiting{conv !== undefined && s.bsfFeedKg > 0.2 ? ` · ${conv >= 0.16 ? 'rich feed' : conv >= 0.1 ? 'fair feed' : 'thin feed'}` : ''}</span>
            {s.frassKg > 0.2 && <span className="ripe"><FarmIcon id="sack_frass" scale={0.4} />{s.frassKg.toFixed(1)} kg frass</span>}
            {s.prepupaeKg > 0.1 && <span className="ripe">{s.prepupaeKg.toFixed(1)} kg prepupae for the hens</span>}
          </div>
        </li>
      </ul>
      <div className="el-actions"><div className="row">
        <button className="mini-btn gold" disabled={wormWet < 0.2} onClick={() => act(st => shedAction(st, 'worms'))}>Feed the worms{wormWet >= 0.2 ? ` · ${wormWet.toFixed(0)} kg${straw > 0.5 ? ' + straw' : ''}` : ''}</button>
        {s.bsfLarvaeKg >= 0.05 && <button className="mini-btn gold" disabled={flyWet < 0.2} onClick={() => act(st => shedAction(st, 'flies'))}>Feed the flies{flyWet >= 0.2 ? ` · ${flyWet.toFixed(0)} kg` : ''}</button>}
        {straw < wormWet * 0.43 && <button className="mini-btn" onClick={() => act(st => shedAction(st, 'straw'))}>A bale of straw · ${STRAW_BALE.cost}</button>}
        <button className="mini-btn" disabled={s.castingsKg + s.frassKg < 0.5} onClick={() => act(st => shedAction(st, 'harvest'))}>Castings and frass to the pantry</button>
        {s.bsfLarvaeKg < 0.05 && <button className="mini-btn" onClick={() => act(st => shedAction(st, 'restock'))}>Restock the flies · $30</button>}
      </div></div>
      <p className="el-note"><b>Worms</b> eat {names(Object.keys(WORM_FOOD).filter(k => WORM_FOOD[k] === 'green')).join(', ')} and a little windfall fruit, bedded in straw at about a third of the weight, with crushed shell against the acid. Never {Object.entries(WORM_REFUSE).map(([k, why]) => `${names([k])[0]} (${why})`).join('; ')}.</p>
      <p className="el-note"><b>Soldier flies</b> eat anything wet and rich, fish and salty press cake included, and turn the best of it — fish, spent grain — into a fifth of its weight in fat, 40%-protein larvae for the hens; green waste barely feeds them. They want it above eighteen degrees: April to October here. Worms work all year and slow in the cold.</p>
    </section>
  );
};

export default EstateView;

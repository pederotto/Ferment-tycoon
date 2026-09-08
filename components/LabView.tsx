import React, { useState } from 'react';
import { Batch, Recipe, FermentType, WeatherState } from '../types';
import { RECIPES, VESSELS } from '../constants';
import { isAgitatedFerment } from '../services/gameLogic';
import IsoVessel, { isoScaleFor, isoPlacement } from './IsoVessel';
import IsoAppliance, { ApplianceId } from './IsoAppliance';
import IsoWindow from './IsoWindow';
import IsoDoor from './IsoDoor';

/**
 * THE BENCH, AS A ROOM
 *
 * This was eight cards in a scrolling shelf. Every vessel drew at the same size,
 * so the only thing distinguishing a 2 L jar from a 60 L cask was the text on
 * its badge — while the upkeep bill, the market value and the entire question of
 * whether to scale up are functions of a volume the player was never shown.
 *
 * The layout follows how a workshop is actually arranged rather than how a grid
 * is. Big vessels stand on the FLOOR behind the bench, because nobody lifts a
 * 60 L cask onto a workbench, and that leaves the table for the scatter of jars
 * and trays which is what a fermentation bench really looks like. It solves the
 * packing problem at the same time: four-slot vessels stop competing with
 * everything else for table space.
 *
 * Everything stays DOM. Each vessel is an SVG group with a role and a tabindex,
 * so click, hover and keyboard focus work as they did; the actions that used to
 * live on each card now appear once, for whichever vessel has focus.
 */

interface LabViewProps {
  batches: Batch[];
  maxSlots: number;
  onSelectSlot: (batch: Batch | null) => void;
  onIntervention: (batch: Batch, action: string) => void;
  onQuickHarvest?: (batch: Batch) => void;
  onQuickKeep?: (batch: Batch) => void;
  usedSlots: number;
  gameSpeed: number;
  analyzedRecipeIds: string[]; // For Discovery Fog
  /** What hardware is owned, so the room shows it. */
  inventory?: Record<string, number>;
  /** Opens a tool's own screen — the press, the centrifuge. */
  onOpenTool?: (toolId: string) => void;
  /** So the window can show the actual season and weather. */
  month?: number;
  weather?: WeatherState;
  /** The door in the back wall, and what is behind it. */
  cellarUsed?: number;
  cellarCapacity?: number;
  onOpenCellar?: () => void;
}

/* The room, in SVG units. The bench is a rhombus; the floor sits behind it. */
const W = 900;
const H = 470;
const BACK_Y = 250, FRONT_Y = 404, LEFT_X = 62, RIGHT_X = 838, MID_X = W / 2;
const MID_Y = (BACK_Y + FRONT_Y) / 2;
const ROW_Y = { floor: 250, back: 322, front: 374 };

/**
 * Where each piece of hardware stands. Hand-placed rather than laid out, because
 * a workshop is arranged by habit — the press by the wall, the fan clipped to
 * the bench edge, the mister on the floor where it can be filled.
 */
const HARDWARE: { id: ApplianceId; x: number; y: number; scale: number; label: string; opens?: boolean }[] = [
  { id: 'wooden_press', x: 786, y: 232, scale: 1,    label: 'Wooden Press', opens: true },
  { id: 'centrifuge',   x: 122, y: 250, scale: 0.95, label: 'Centrifuge',   opens: true },
  { id: 'humidifier',   x: 830, y: 330, scale: 0.9,  label: 'Ultrasonic Mister' },
  { id: 'portable_fan', x: 706, y: 392, scale: 0.85, label: 'Clip-on Fan' },
  { id: 'agitator',     x: 176, y: 214, scale: 0.9,  label: 'Geared Agitator' },
  { id: 'mash_paddle',  x: 108, y: 386, scale: 0.9,  label: 'Mash Paddle' },
];

/** Spread n items across a band, centred, with a sane gap when there are few. */
const spread = (n: number, from: number, to: number): number[] => {
  if (n <= 0) return [];
  if (n === 1) return [(from + to) / 2];
  const step = Math.min((to - from) / (n - 1), 190);
  const start = (from + to) / 2 - (step * (n - 1)) / 2;
  return Array.from({ length: n }, (_, i) => start + i * step);
};

const LabView: React.FC<LabViewProps> = ({
  batches, maxSlots, onSelectSlot, onIntervention,
  onQuickHarvest, onQuickKeep, usedSlots, gameSpeed, analyzedRecipeIds,
  inventory = {}, onOpenTool, month = 0, weather,
  cellarUsed = 0, cellarCapacity = 0, onOpenCellar,
}) => {
  const [focused, setFocused] = useState<string | null>(null);

  const getRecipe = (batch: Batch): Recipe =>
    batch.cachedRecipe
      ?? RECIPES.find(r => r.id === batch.recipeId)
      ?? RECIPES.find(r => r.id === 'bio_sludge')!;

  const getVessel = (id: string) => VESSELS.find(v => v.id === id) ?? VESSELS[0];

  /** Everything the scene needs to know about one batch. */
  const read = (batch: Batch) => {
    const recipe = getRecipe(batch);
    const vessel = getVessel(batch.vesselId);
    const spoiled = batch.status === 'spoiled';
    const peak = !spoiled && batch.progress >= recipe.peakWindowStart && batch.progress <= recipe.peakWindowEnd;
    const overPeak = !spoiled && batch.progress > recipe.peakWindowEnd;
    const ready = batch.status === 'ready' || peak || overPeak;
    const tempDiff = Math.abs(batch.params.temp - recipe.idealParams.temp);
    const needsAir = recipe.activeIntervention === 'Ventilate' && batch.params.temp > recipe.idealParams.temp + 2;
    const stress = batch.stress || 0;
    const warn = !spoiled && !peak && (tempDiff > 6 || stress > 65 || needsAir);
    const discovered = analyzedRecipeIds.includes(recipe.id) || recipe.type === FermentType.FAIL;
    return {
      batch, recipe, vessel, spoiled, peak, ready, warn, needsAir, discovered,
      name: discovered ? recipe.name : 'Unidentified Reaction',
      // A bed well above target is visibly cooking itself.
      hot: !spoiled && (tempDiff > 5 || stress > 45),
      lidOpen: !!batch.flags?.isLidPropped,
      heated: batch.vesselId === 'incubator' && (batch.controls?.heat ?? null) !== null,
      agitated: isAgitatedFerment(recipe),
      placement: isoPlacement(vessel.slotsRequired),
      s: isoScaleFor(vessel.capacityL),
    };
  };

  const seen = batches.map(read);

  // A tool is "running" when a batch is actually calling on it this tick, so the
  // fan turns while something is vented and the mister plumes while it mists.
  const anyVenting = seen.some(v => (v.batch.controls?.vent ?? 0) >= 3);
  const anyMisting = seen.some(v => (v.batch.controls?.mist ?? 0) > 0);
  const anyAgitated = seen.some(v => v.agitated);
  const floorRow = seen.filter(v => v.placement === 'floor');
  const backRow = seen.filter(v => v.placement === 'back');
  const frontRow = seen.filter(v => v.placement === 'front');

  const floorX = spread(floorRow.length, 200, 700);
  const backX = spread(backRow.length, 255, 645);
  const frontX = spread(frontRow.length, 200, 700);

  const emptyCount = Math.max(0, maxSlots - usedSlots);
  const emptyX = spread(Math.min(emptyCount, 4), 320, 600);

  const Slot: React.FC<{ v: ReturnType<typeof read>; x: number; y: number }> = ({ v, x, y }) => {
    const { batch, recipe, vessel, s } = v;
    const tone = v.spoiled ? 'var(--brick)' : (v.peak || v.warn) ? 'var(--amber)' : 'var(--moss)';
    const status = v.spoiled ? 'Spoiled'
      : v.peak ? 'Peak'
      : v.warn ? (v.needsAir ? 'Overheat' : 'Stress')
      : `${Math.round(batch.progress)}%`;

    return (
      <g
        className={`iso-slot${focused === batch.id ? ' open' : ''}`}
        transform={`translate(${x},${y})`}
        tabIndex={0}
        role="button"
        aria-label={`${v.name} in a ${vessel.name}, ${vessel.capacityL} litres, ${status}. Open the ledger.`}
        onMouseEnter={() => setFocused(batch.id)}
        onMouseLeave={() => setFocused(f => (f === batch.id ? null : f))}
        onFocus={() => setFocused(batch.id)}
        onClick={() => onSelectSlot(batch)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSlot(batch); } }}
      >
        <ellipse className="iso-shadow" cx="0" cy="8" rx={30 * s} ry={10 * s} />
        <ellipse className="iso-ring" cx="0" cy="6" rx={36 * s} ry={13 * s}
                 fill="none" stroke={tone} strokeWidth="1.6" />
        <g className="iso-lift">
          <IsoVessel
            vesselId={batch.vesselId}
            scale={s}
            state={{
              fill: Math.max(0.15, Math.min(1, batch.progress / 100)),
              lidOpen: v.lidOpen, hot: v.hot, spoiled: v.spoiled,
              agitated: v.agitated, heated: v.heated,
              mist: (batch.controls?.mist ?? 0) as 0 | 1 | 2,
            }}
          />
        </g>

        {/* Always-on pip, so the bench reads at a glance without hovering. */}
        <circle className="iso-pip" cx="0" cy={-74 * s} r="3.4" fill={tone} />

        <g className="iso-card" transform={`translate(-86,${-134 * s})`}>
          <rect width="172" height="58" rx="3" fill="#241b10" stroke={tone} strokeWidth="1" />
          <text className="iso-t" x="9" y="17">{v.name}</text>
          <text className="iso-s" x="9" y="30" fill="var(--text-lo)">
            {vessel.name} · {vessel.capacityL}L
          </text>
          <text className="iso-s" x="9" y="43" fill={tone}>
            {status} · {batch.params.temp.toFixed(1)}° · safety {Math.round(batch.quality.safety)}
          </text>
          <rect x="9" y="48" width="154" height="3" rx="1.5" fill="rgba(0,0,0,0.45)" />
          <rect x="9" y="48" width={154 * Math.min(1, batch.progress / 100)} height="3" rx="1.5" fill={tone} />
        </g>
      </g>
    );
  };

  const active = seen.find(v => v.batch.id === focused);

  return (
    <div className="bench-wrap">
      <div className="bench-head">
        <h1 className="slab">
          The Fermentation Bench
          <span className="count mono">{batches.length} In Flight</span>
        </h1>
        <div className="slot-pill">Bench: <b>{usedSlots}</b> / {maxSlots} slots</div>
      </div>

      <div className="iso-room">
        <svg viewBox={`0 0 ${W} ${H}`} className="iso-svg" role="group" aria-label="The fermentation bench">
          <defs>
            <linearGradient id="isoBenchTop" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7a5631" /><stop offset="100%" stopColor="#5c3f22" />
            </linearGradient>
            <radialGradient id="isoLamp" cx="50%" cy="0%" r="72%">
              <stop offset="0%" stopColor="#e08a3c" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#e08a3c" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx={MID_X} cy="80" rx="430" ry="200" fill="url(#isoLamp)" />

          {/* The window is the only place the season is a picture rather than a
              word in the header — and month and weather are what set the ambient
              temperature and humidity every batch is fighting. */}
          {weather && <IsoWindow month={month} weather={weather} x={716} y={112} scale={0.94} />}

          {/* The way out of this room. Drawn into the wall opposite the window,
              before the floor row, so anything standing in front of it overlaps
              it — there is no z-index in SVG and paint order is depth order. */}
          {onOpenCellar && (
            <IsoDoor x={128} y={196} scale={0.92}
                     occupied={cellarUsed} capacity={cellarCapacity}
                     onOpen={onOpenCellar} />
          )}

          <g stroke="rgba(243,233,216,0.05)" strokeWidth="1" fill="none">
            <path d={`M30 300 L${MID_X} 132 L870 300 L${MID_X} 468z`} />
            <path d="M180 216 L660 456 M660 216 L180 456" />
          </g>

          {/* HARDWARE — the tools you own, standing where they would stand.
              Decorative in the strict sense: the simulation reads the inventory,
              not these. But a tool you can see is a tool you remember you have,
              and a room with a press and a centrifuge in it is visibly a
              different operation from one with a clip-on fan. */}
          {HARDWARE.filter(h => (inventory[h.id] ?? 0) > 0).map(h => (
            <g key={h.id}
               className={`iso-hw${h.opens ? ' clickable' : ''}`}
               transform={`translate(${h.x},${h.y})`}
               tabIndex={h.opens ? 0 : undefined}
               role={h.opens ? 'button' : undefined}
               aria-label={h.opens ? `Open the ${h.label}` : undefined}
               onClick={h.opens ? () => onOpenTool?.(h.id) : undefined}
               onKeyDown={h.opens ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenTool?.(h.id); } }) : undefined}>
              <IsoAppliance
                id={h.id}
                scale={h.scale}
                title={h.label}
                running={h.id === 'portable_fan' ? anyVenting
                  : h.id === 'humidifier' ? anyMisting
                  : h.id === 'agitator' ? anyAgitated
                  : false}
              />
            </g>
          ))}

          {/* FLOOR — drawn first, so the bench overlaps their feet and they
              genuinely read as standing behind it. */}
          {floorRow.map((v, i) => <Slot key={v.batch.id} v={v} x={floorX[i]} y={ROW_Y.floor} />)}

          {/* THE BENCH */}
          <path d={`M${MID_X} ${BACK_Y} L${RIGHT_X} ${MID_Y} L${MID_X} ${FRONT_Y} L${LEFT_X} ${MID_Y}z`} fill="url(#isoBenchTop)" />
          <path d={`M${LEFT_X} ${MID_Y} L${MID_X} ${FRONT_Y} v22 L${LEFT_X} ${MID_Y + 22}z`} fill="var(--oak-deep, #4a3018)" />
          <path d={`M${RIGHT_X} ${MID_Y} L${MID_X} ${FRONT_Y} v22 L${RIGHT_X} ${MID_Y + 22}z`} fill="var(--oak-dark, #33200f)" />
          <path d={`M${MID_X} ${BACK_Y} L${RIGHT_X} ${MID_Y} L${MID_X} ${FRONT_Y} L${LEFT_X} ${MID_Y}z`}
                fill="none" stroke="rgba(243,233,216,0.16)" strokeWidth="1.2" />

          {backRow.map((v, i) => <Slot key={v.batch.id} v={v} x={backX[i]} y={ROW_Y.back} />)}

          {/* An open place is a footprint on the bench, not an empty card. */}
          {emptyX.map((x, i) => (
            <g key={`empty-${i}`} className="iso-empty" transform={`translate(${x},${ROW_Y.front - 4})`}
               tabIndex={0} role="button"
               aria-label={`Open bench slot ${usedSlots + i + 1}. Inoculate a culture.`}
               onClick={() => onSelectSlot(null)}
               onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSlot(null); } }}>
              <path d="M0 -12 L28 2 L0 16 L-28 2z" fill="rgba(243,233,216,0.03)"
                    stroke="rgba(243,233,216,0.22)" strokeWidth="1" strokeDasharray="4 4" />
              <path d="M-6 2 h12 M0 -4 v12" stroke="rgba(243,233,216,0.42)" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          ))}

          {/* FRONT ROW — nearest the viewer, so drawn last. */}
          {frontRow.map((v, i) => <Slot key={v.batch.id} v={v} x={frontX[i]} y={ROW_Y.front} />)}
        </svg>

      </div>

      {/* Actions sit in their own band under the scene rather than floating over
          it — positioned inside the room they covered the front row of vessels,
          which is the row you are most likely to be reaching for. */}
      <div className="iso-bar">
        {active ? (
          <div className="iso-actions"
               onMouseEnter={() => setFocused(active.batch.id)}
               onMouseLeave={() => setFocused(null)}>
            <span className="who">{active.name}</span>
            {active.spoiled ? (
              <button className="mini-btn salvage" onClick={() => onSelectSlot(active.batch)}>Salvage</button>
            ) : active.needsAir ? (
              <button className="mini-btn salvage" onClick={() => onIntervention(active.batch, 'Ventilate')}>Ventilate</button>
            ) : active.ready ? (
              <>
                <button className="mini-btn harvest"
                        onClick={() => (onQuickHarvest ? onQuickHarvest(active.batch) : onSelectSlot(active.batch))}>Sell</button>
                <button className="mini-btn keep"
                        onClick={() => (onQuickKeep ? onQuickKeep(active.batch) : onSelectSlot(active.batch))}>Keep</button>
              </>
            ) : active.agitated ? (
              <button className="mini-btn keep" onClick={() => onIntervention(active.batch, 'Mix')}>Turn</button>
            ) : null}
            <button className="mini-btn inspect" onClick={() => onSelectSlot(active.batch)}>Inspect</button>
          </div>
        ) : (
          <div className="iso-hint">
            {batches.length === 0
              ? 'The bench is empty. Click a footprint to inoculate a culture.'
              : 'Hover a vessel, or tab through them'}
          </div>
        )}
      </div>
    </div>
  );
};

export default LabView;

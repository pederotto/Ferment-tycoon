import React, { useState } from 'react';
import { Batch, Recipe, FermentType, WeatherState, WeatherType } from '../types';
import { RECIPES, VESSELS } from '../constants';
import { isAgitatedFerment } from '../services/gameLogic';
import IsoVessel, { isoScaleFor, isoPlacement } from './IsoVessel';
import IsoAppliance, { ApplianceId } from './IsoAppliance';
import IsoWindow, { seasonOf } from './IsoWindow';
import { LAB_PLATE } from './labPlate';
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

/* THE ROOM IS A PAINTING NOW, and the viewBox is its pixel grid — so a spot is
   placed by looking at the picture rather than by converting between two
   coordinate systems and being a few percent out. */
const W = 1344;
const H = 800;

/**
 * WHERE THINGS STAND, READ OFF THE PLATE.
 *
 * The table is the bench and it is generous, so the small vessels live on it —
 * two rows, the back one drawn smaller because it is further away. Casks and
 * barrels stand on the flagstones either side, which is where they would stand
 * and which keeps them from swamping the table.
 *
 * The shelves carry the hardware. They are high and narrow in this projection,
 * so a jar on them would be too small to read or click; a press or a fan is a
 * silhouette and survives the distance.
 */
type Spot = { x: number; y: number; s: number };

/* On the table. Back row first — filling back to front means a new batch lands
   at the front where you can see it, and nothing already there has to move. */
const TABLE_SPOTS: Spot[] = [
  { x: 590, y: 472, s: 0.80 },
  { x: 675, y: 472, s: 0.80 },
  { x: 760, y: 472, s: 0.80 },
  { x: 490, y: 536, s: 0.96 },
  { x: 615, y: 540, s: 0.99 },
  { x: 740, y: 540, s: 0.99 },
  { x: 865, y: 536, s: 0.96 },
];

/* On the floor, either side of the table. */
const FLOOR_SPOTS: Spot[] = [
  { x: 330, y: 660, s: 0.95 },
  { x: 1020, y: 660, s: 0.95 },
  { x: 245, y: 745, s: 1.05 },
  { x: 1105, y: 745, s: 1.05 },
];

/* The window in the back wall. The plate has a painted sky inside it; the game
   draws its own over the top, because that view is the month and the weather. */
/* Measured off the plate: the black opening runs x593-727, y218-388. The first
   guess was 15px out horizontally and 33 too tall, which is why the view sat off
   to one side of its own hole. */
const WINDOW = { x: 660, y: 303, w: 134, h: 170 };

/* A jar at isoScaleFor(2) is ~30 units wide in this grid. Measured against the
   painted table, ~60 is what sits on it without looking like a bead. */
const ROOM_SCALE = 2.1;

/**
 * THE LIGHT THROUGH THE WINDOW.
 *
 * The plate has a hard sunbeam painted across the table and floor, which means
 * the room is a bright July noon whatever the game says — snow outside, sunshine
 * inside. It is also the loudest thing in the picture, so it cannot simply be
 * ignored.
 *
 * Two layers fix it. A cool wash MULTIPLIED over the whole room knocks the baked
 * beam back toward the ambient when the weather is dull, and a beam of our own
 * is drawn from the window opening on top, at the strength and colour the day
 * actually has. On a bright summer day the two agree and the painted beam does
 * the work; on a February afternoon the wash flattens it and almost nothing is
 * added, which is what a north-facing cellar window in winter looks like.
 *
 * This is the same rule as everything else in the room: what changes cannot be
 * painted.
 */
const DAYLIGHT: Record<WeatherType, number> = {
  Heatwave: 1.00,
  Sunny:    0.92,
  Cloudy:   0.40,
  Snowy:    0.34,   // bright, but flat and shadowless
  Foggy:    0.26,
  Rainy:    0.20,
  Stormy:   0.08,
};

/* Winter light is blue and low even when the sun is out; high summer is amber.
   The month moves the colour, the weather moves the amount. */
const LIGHT_TINT: Record<string, string> = {
  winter: '#9fb6c4',
  spring: '#e2d3a8',
  summer: '#f2c274',
  autumn: '#e0a154',
};

/* What hardware exists, and which of it opens a screen of its own. No
   coordinates: these are shown in a rack under the room rather than standing in
   it, because the sheet draws each tool from one angle and the room recedes to a
   vanishing point — half of them faced out of the room and none of them looked
   like they were standing on anything. */
const HARDWARE: { id: ApplianceId; label: string; opens?: boolean }[] = [
  { id: 'wooden_press', label: 'Wooden Press', opens: true },
  { id: 'centrifuge',   label: 'Centrifuge',   opens: true },
  { id: 'humidifier',   label: 'Ultrasonic Mister' },
  { id: 'portable_fan', label: 'Clip-on Fan' },
  { id: 'agitator',     label: 'Geared Agitator' },
  { id: 'mash_paddle',  label: 'Mash Paddle' },
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
  // Big vessels to the flagstones, small ones to the table — the rule the cellar
  // uses too, and the reason nobody stands a 60L cask on a workbench. Filling
  // back to front means a new batch lands where you can see it and nothing
  // already there has to move.
  const onFloor = seen.filter(v => v.vessel.capacityL >= 20);
  const onTable = seen.filter(v => v.vessel.capacityL < 20);
  const emptyCount = Math.max(0, Math.min(TABLE_SPOTS.length - onTable.length, maxSlots - usedSlots));

  /* One vessel, standing on a spot. The spot carries its own scale, because the
     back of the table is further away than the front and a row drawn at one size
     reads as a sticker sheet rather than as a room. */
  const Slot: React.FC<{ v: ReturnType<typeof read>; spot: Spot }> = ({ v, spot }) => {
    const { batch, vessel } = v;
    const tone = v.spoiled ? 'var(--brick)' : (v.peak || v.warn) ? 'var(--amber)' : 'var(--moss)';
    const status = v.spoiled ? 'Spoiled'
      : v.peak ? 'Peak'
      : v.warn ? (v.needsAir ? 'Overheat' : 'Stress')
      : `${Math.round(batch.progress)}%`;
    const s = v.s * ROOM_SCALE * spot.s;

    return (
      <g
        className={`iso-slot${focused === batch.id ? ' open' : ''}`}
        transform={`translate(${spot.x},${spot.y})`}
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
        {/* Always on, so the bench reads at a glance without hovering. */}
        <circle className="iso-pip" cx="0" cy={-74 * s} r={3.4 * Math.max(0.8, spot.s)} fill={tone} />
      </g>
    );
  };

  const ownedTools = HARDWARE.filter(h => (inventory[h.id] ?? 0) > 0);

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
            <radialGradient id="labVignette" cx="50%" cy="44%" r="74%">
              <stop offset="0%" stopColor="#000" stopOpacity="0" />
              <stop offset="70%" stopColor="#000" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
            </radialGradient>
            {/* Light has no edge. A solid ellipse screened over the room drew a
                visible disc on the wall — the same mistake as the hover ring,
                one scale up. Both the glow and the shaft fade out. */}
            <radialGradient id="labGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="45%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="labShaft" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="28%" stopColor="#fff" stopOpacity="0.62" />
              <stop offset="70%" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            {/* The glow is centred on the opening, and the shaft leaves through
                the WHOLE of it rather than off the sill. Starting the polygon at
                the bottom edge made a string of light hanging under the window
                instead of a room lit through a hole in the wall. */}
            <mask id="labGlowMask">
              <ellipse cx={WINDOW.x} cy={WINDOW.y}
                       rx={WINDOW.w * 2.1} ry={WINDOW.h * 1.5} fill="url(#labGlow)" />
            </mask>
            <mask id="labShaftMask">
              <path d={`M${WINDOW.x - WINDOW.w / 2} ${WINDOW.y - WINDOW.h / 2} L${WINDOW.x + WINDOW.w / 2} ${WINDOW.y - WINDOW.h / 2} L${WINDOW.x + 380} ${H} L${WINDOW.x - 470} ${H}z`}
                    fill="url(#labShaft)" />
            </mask>
            <clipPath id="labWindowClip">
              <rect x={WINDOW.x - WINDOW.w / 2} y={WINDOW.y - WINDOW.h / 2}
                    width={WINDOW.w} height={WINDOW.h} />
            </clipPath>
          </defs>

          {/* THE PLATE. Everything below is the live room standing in it. */}
          <image href={LAB_PLATE} x="0" y="0" width={W} height={H} preserveAspectRatio="none" />
          {/* THE LIGHT.
              This plate is lit flat and ambient with NO beam baked into it,
              which is the whole reason for asking for a second one. The first
              had a hard July sunbeam painted across the floor, so the code spent
              a multiply layer arguing the room back down before it could add
              anything, and a bright day was a dimmed room rather than a lit one.
              Here the weather simply lights it: warm it on a good day, cool and
              dim it on a bad one, and lay a shaft from the window only when there
              is actually sun to cast one. */}
          {weather && (() => {
            const lit = DAYLIGHT[weather.type] ?? 0.5;
            const tint = LIGHT_TINT[seasonOf(month)] ?? '#e2d3a8';
            const wx = WINDOW.x, wy = WINDOW.y + WINDOW.h / 2;
            return (
              <>
                <rect x="0" y="0" width={W} height={H} fill="#26303a"
                      style={{ mixBlendMode: 'multiply' }} opacity={0.34 * (1 - lit)} />
                <rect x="0" y="0" width={W} height={H} fill={tint}
                      style={{ mixBlendMode: 'soft-light' }} opacity={0.34 * lit} />
                {lit > 0.15 && (
                  <>
                    <rect x="0" y="0" width={W} height={H} fill={tint}
                          mask="url(#labShaftMask)" opacity={0.20 * lit}
                          style={{ mixBlendMode: 'screen' }} />
                    <rect x="0" y="0" width={W} height={H} fill={tint}
                          mask="url(#labGlowMask)" opacity={0.26 * lit}
                          style={{ mixBlendMode: 'screen' }} />
                  </>
                )}
              </>
            );
          })()}
          <rect x="0" y="0" width={W} height={H} fill="url(#labVignette)" />

          {/* THE WINDOW, DRAWN OVER THE PAINTED ONE.
              The plate has a summer afternoon in it. This view is the actual
              month and the actual weather — a bare tree under snow is telling
              you why the koji is running cold — so it cannot be scenery. Clipped
              to the painted opening so it sits in the wall rather than on it. */}
          {weather && (
            <g clipPath="url(#labWindowClip)">
              <rect x={WINDOW.x - WINDOW.w / 2} y={WINDOW.y - WINDOW.h / 2}
                    width={WINDOW.w} height={WINDOW.h} fill="#171109" />
              {/* COVER, NOT FIT.
                  The view is drawn 104x96 and the opening is 134x170, so scaling
                  it to fit left black bands above and below — letterboxing, the
                  same as a 16:9 film in a 4:3 frame. Scaling to the LARGER ratio
                  fills the opening and the clip takes the overflow, which is
                  what `background-size: cover` does and what the eye expects of
                  a view through a hole. */}
              <IsoWindow month={month} weather={weather} bare
                         x={WINDOW.x} y={WINDOW.y + 16}
                         scale={Math.max(WINDOW.w / 100, WINDOW.h / 92)} />
            </g>
          )}

          {/* The cellar stair. The plate has no door, so it stands against the
              left wall where one would be. */}
          {onOpenCellar && (
            <IsoDoor x={100} y={492} scale={1.12}
                     occupied={cellarUsed} capacity={cellarCapacity}
                     onOpen={onOpenCellar} />
          )}

          {/* Floor before table: no z-index in SVG, so paint order is depth. */}
          {onFloor.map((v, i) => FLOOR_SPOTS[i] && <Slot key={v.batch.id} v={v} spot={FLOOR_SPOTS[i]} />)}

          {/* An open place is a footprint on the table, not an empty card. */}
          {Array.from({ length: emptyCount }).map((_, i) => {
            const spot = TABLE_SPOTS[onTable.length + i];
            if (!spot) return null;
            return (
              <g key={`empty-${i}`} className="iso-empty"
                 transform={`translate(${spot.x},${spot.y}) scale(${spot.s})`}
                 tabIndex={0} role="button"
                 aria-label={`Open bench slot ${usedSlots + i + 1}. Inoculate a culture.`}
                 onClick={() => onSelectSlot(null)}
                 onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSlot(null); } }}>
                <path d="M0 -17 L40 3 L0 23 L-40 3z" fill="rgba(243,233,216,0.07)"
                      stroke="rgba(243,233,216,0.42)" strokeWidth="1.8" strokeDasharray="6 5" />
                <path d="M-9 3 h18 M0 -6 v18" stroke="rgba(243,233,216,0.62)" strokeWidth="2.2" strokeLinecap="round" />
              </g>
            );
          })}

          {onTable.map((v, i) => TABLE_SPOTS[i] && <Slot key={v.batch.id} v={v} spot={TABLE_SPOTS[i]} />)}
        </svg>

      </div>

      {/* Actions sit in their own band under the scene rather than floating over
          it — positioned inside the room they covered the front row of vessels,
          which is the row you are most likely to be reaching for. */}
      {/* THE RACK.
          The tools used to stand in the room, and it never worked: the sheet
          draws each from one angle while the room recedes to a vanishing point,
          so half of them faced the wrong way and all of them read as stuck on
          rather than standing. A rack sidesteps the whole problem — the picture
          is a picture, shown flat, at a size you can actually see it — and it
          answers the question the room could not: what do I own, and is any of
          it working right now.

          Only what you own appears. An empty rack is a true statement. */}
      {ownedTools.length > 0 && (
        <div className="tool-rack">
          {ownedTools.map(h => {
            const on = h.id === 'portable_fan' ? anyVenting
              : h.id === 'humidifier' ? anyMisting
              : h.id === 'agitator' ? anyAgitated
              : false;
            const Tag = h.opens ? 'button' : 'div';
            return (
              <Tag
                key={h.id}
                className={`tool-card${on ? ' running' : ''}${h.opens ? ' opens' : ''}`}
                {...(h.opens ? { onClick: () => onOpenTool?.(h.id), type: 'button' as const } : {})}
                title={h.opens ? `Open the ${h.label}` : h.label}
              >
                <svg viewBox="-80 -80 160 160" className="tc-art" aria-hidden="true">
                  <IsoAppliance id={h.id} scale={0.85} running={on} />
                </svg>
                <span className="tc-name">{h.label}</span>
                <span className="tc-state">
                  {on ? 'running' : h.opens ? 'open it' : 'idle'}
                </span>
              </Tag>
            );
          })}
        </div>
      )}

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

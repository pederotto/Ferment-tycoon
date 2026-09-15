import PanelMark from './PanelMark';
import React, { useState } from 'react';
import { Batch, Recipe } from '../types';
import { VESSELS } from '../constants';
import { getRecipeForBatch, getMaturity, describeMaturity } from '../services/gameLogic';
import { AGEING_MAX_PROGRESS, CELLAR_TICK_DIVISOR, CELLAR_CAPACITY } from '../constants';
import IsoVessel, { isoScaleFor } from './IsoVessel';
import { VESSEL_ART } from './vesselSheet';
import { CloseIcon } from './icons';
import { CELLAR_PLATE } from './cellarPlate';

/**
 * THE CELLAR
 *
 * The mechanics were already here and had nowhere to be: a cellared batch ticks
 * at a sixth of the rate, is out of reach of bench hygiene, and frees its slot.
 * But it also vanished — sent down, a batch left the bench and could not be seen
 * again, which made the one place in the game where you deliberately do nothing
 * for a year completely invisible.
 *
 * Drawn as a room rather than a list for the same reason the bench is: the
 * quantity that matters is what is standing there and how far along it is. It is
 * the opposite room to the workshop in every way that counts — no window, no
 * weather, no hardware, no hygiene. Just stone, a lamp, and time.
 */

interface CellarViewProps {
  batches: Batch[];
  onClose: () => void;
  onSelect: (batch: Batch) => void;
  onBringUp: (batch: Batch) => void;
}

/* The viewBox IS the plate's pixel grid, 1344x800. Working in the painting's own
   coordinates means a shelf is placed by reading the picture, not by converting
   between two systems and being a few percent out every time. */
const W = 1344;
const H = 800;

/**
 * WHERE THINGS STAND, READ OFF THE PAINTING.
 *
 * The room is drawn in one-point perspective, so a shelf board is not a
 * horizontal line — it climbs as it recedes, and anything standing further back
 * has to be drawn smaller or it punches through the wall. Both are properties of
 * this particular picture, so both are measured from it rather than computed:
 * each spot is a point on a real board with the scale that suits that depth.
 *
 * An explicit table beats a spread function here. Six places against fifteen
 * hand-placed spots means the room is never crowded, and a spot that looks wrong
 * is fixed by moving a number rather than by re-deriving a layout.
 */
type Spot = { x: number; y: number; s: number };

/* Casks and barrels stand on the flagstones. Ordered BACK TO FRONT, because
   that is the order they fill: the first thing you lay down goes deepest and the
   newest arrival sits nearest the stair, which is how anyone stacks a cellar and
   means nothing ever has to be moved to get at what is ready. */
const FLOOR_SPOTS: Spot[] = [
  { x: 560, y: 585, s: 1.00 },   // back of the floor, before the arch
  { x: 784, y: 585, s: 1.00 },
  { x: 430, y: 695, s: 1.22 },   // front row, nearest the stair
  { x: 914, y: 695, s: 1.22 },
  { x: 672, y: 712, s: 1.28 },   // over the drain, at the foot of the stair
];

/* Jars and trays go on the boards. Also back to front, and alternating left and
   right within each depth so a half-full cellar looks kept rather than lopsided.
   The last spots are the near ends of the bottom boards — the ones you could
   actually reach without a stool. */
const SHELF_SPOTS: Spot[] = [
  { x: 300,  y: 378, s: 0.70 },   // left, middle board, far
  { x: 1044, y: 378, s: 0.70 },   // right, middle board, far
  { x: 290,  y: 484, s: 0.74 },   // left, bottom board, far
  { x: 1054, y: 484, s: 0.74 },   // right, bottom board, far
  { x: 150,  y: 236, s: 0.76 },   // left, top board, near
  { x: 1194, y: 236, s: 0.76 },   // right, top board, near
  { x: 150,  y: 374, s: 0.81 },   // left, middle board, near
  { x: 1194, y: 374, s: 0.81 },   // right, middle board, near
  { x: 150,  y: 508, s: 0.86 },   // left, bottom board, near — easiest to reach
  { x: 1194, y: 508, s: 0.86 },   // right, bottom board, near
];

/* A jar drawn at isoScaleFor(2) is ~30 units wide in this grid, and the room is
   1344 across — measured against the painting, ~50 units is what sits properly
   on those boards. */
const ROOM_SCALE = 2.0;

const CellarView: React.FC<CellarViewProps> = ({ batches, onClose, onSelect, onBringUp }) => {
  const [focused, setFocused] = useState<string | null>(null);

  const read = (batch: Batch) => {
    const recipe: Recipe = getRecipeForBatch(batch);
    const vessel = VESSELS.find(v => v.id === batch.vesselId) ?? VESSELS[0];
    return {
      batch, recipe, vessel,
      /* The plate's own grid is 1340 wide against the bench room's 900, so the
         same vessel drew at 2.8% of the room here and 7.7% there — correct in
         absolute units and far too small against painted furniture. Measured
         against the picture: a 2L jar wants ~65 units to sit alongside the jars
         on the painted shelf, and a 60L cask lands near the amphorae at ~120. */
      s: isoScaleFor(vessel.capacityL) * ROOM_SCALE,
      maturity: getMaturity(batch, recipe),
      note: describeMaturity(batch, recipe),
    };
  };

  // ORDERED BY AGE, OLDEST DEEPEST.
  //
  // A cellar is stacked by when things went in: the first thing you laid down is
  // at the back, and what arrived this week is by the stair. Nothing shuffles as
  // it matures — a jar that has been down there three years does not walk itself
  // to a better shelf — so sorting on start time is both the truthful rule and
  // the stable one. Filling in arrival order against back-to-front spots gives
  // that for free.
  const seen = batches
    .map(read)
    .sort((a, b) => (a.batch.startTime ?? 0) - (b.batch.startTime ?? 0));

  // Big vessels to the flagstones, small ones to the boards — the rule the bench
  // uses, and the rule a real cellar uses, because nobody lifts a cask onto a
  // shelf.
  const onFloor = seen.filter(v => v.vessel.capacityL >= 20);
  const onShelf = seen.filter(v => v.vessel.capacityL < 20);

  const active = seen.find(v => v.batch.id === focused);

  const Vessel: React.FC<{ v: ReturnType<typeof read>; spot: Spot }> = ({ v, spot }) => {
    const s = v.s * spot.s;
    return (
    <g
      className={`iso-slot${focused === v.batch.id ? ' open' : ''}`}
      transform={`translate(${spot.x},${spot.y})`}
      tabIndex={0}
      role="button"
      aria-label={`${v.recipe.name} in a ${v.vessel.name}, ${(v.maturity * 100).toFixed(0)}% mature. Open the ledger.`}
      onMouseEnter={() => setFocused(v.batch.id)}
      onMouseLeave={() => setFocused(f => (f === v.batch.id ? null : f))}
      onFocus={() => setFocused(v.batch.id)}
      onClick={() => onSelect(v.batch)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(v.batch); } }}
    >
      <ellipse className="iso-shadow" cx="0" cy="8" rx={30 * s} ry={10 * s} />
      <g className={`iso-lift${VESSEL_ART[v.batch.vesselId] ? ' painted' : ''}`}>
        <IsoVessel
          vesselId={v.batch.vesselId}
          scale={s}
          state={{ fill: 0.85, lidOpen: false, hot: false, spoiled: false, agitated: false, heated: false, mist: 0 }}
        />
      </g>
      <circle className="iso-pip" cx="0" cy={-74 * s} r="3.2" fill="var(--brass)" opacity={0.4 + v.maturity * 0.6} />
    </g>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cellar" onClick={e => e.stopPropagation()}>
        <span className="corner c-tl" />
        <span className="corner c-br" />

        <div className="pr-head">
          <PanelMark name="cellar" />
          <div>
            <span className="kicker">Below the workshop</span>
            <h2>The Cellar</h2>
          </div>
          <button className="close-stamp" onClick={onClose} aria-label="Back up to the bench">
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="cellar-clime mono">
          <span>Stable · no weather, no hygiene</span>
          <span>Ages at <b>1/{CELLAR_TICK_DIVISOR}</b> bench rate</span>
          <span><b>{batches.length}</b> / {CELLAR_CAPACITY} places</span>
        </div>

        <div className="iso-room cellar-room">
          <svg viewBox={`0 0 ${W} ${H}`} className="iso-svg" role="group" aria-label="The cellar">
            <defs>
              {/* A cellar is dark at the edges and lit where the lamps are. The
                  plate already has that, so this only deepens the corners enough
                  that a pale vessel standing in them still separates. */}
              <radialGradient id="cellarVignette" cx="50%" cy="46%" r="72%">
                <stop offset="0%" stopColor="#000" stopOpacity="0" />
                <stop offset="72%" stopColor="#000" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#000" stopOpacity="0.44" />
              </radialGradient>
              {/* The floor the vessels stand on is the busiest part of the
                  picture. Knocking it back a little is what lets a real jar read
                  as being IN the room rather than pasted onto it. */}
              <linearGradient id="cellarFloorHaze" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a120a" stopOpacity="0" />
                <stop offset="100%" stopColor="#1a120a" stopOpacity="0.34" />
              </linearGradient>
            </defs>

            {/* THE PLATE. Painted, supplied, embedded — not drawn. Everything
                below is the live room standing in it. */}
            <image href={CELLAR_PLATE} x="0" y="0" width={W} height={H}
                   preserveAspectRatio="xMidYMid slice" />
            {/* The restored vault is painted warm already (terracotta brick, pale
                plaster), so only a light warm multiply is left: the old plate was
                cool blue-grey stone and needed 0.34 plus an orange overlay to sit
                in the game's palette. */}
            <rect x="0" y="0" width={W} height={H} fill="#6b4a29"
                  style={{ mixBlendMode: 'multiply' }} opacity="0.12" />
            <rect x="0" y={H * 0.62} width={W} height={H * 0.38} fill="url(#cellarFloorHaze)" />
            <rect x="0" y="0" width={W} height={H} fill="url(#cellarVignette)" />

            {/* Back rack, then front, so depth reads correctly. */}
            {/* Shelves first, then the floor — the floor row is nearest the
                viewer and there is no z-index in SVG, so paint order is depth. */}
            {onShelf.map((v, i) => SHELF_SPOTS[i] && <Vessel key={v.batch.id} v={v} spot={SHELF_SPOTS[i]} />)}
            {onFloor.map((v, i) => FLOOR_SPOTS[i] && <Vessel key={v.batch.id} v={v} spot={FLOOR_SPOTS[i]} />)}
          </svg>
        </div>

        <div className="iso-bar">
          {active ? (
            <div className="iso-actions">
              <span className="who">{active.recipe.name}</span>
              <span className="cellar-note">
                {(active.maturity * 100).toFixed(0)}% mature · {Math.round(active.batch.progress)} of {AGEING_MAX_PROGRESS}
                {active.note ? ` — ${active.note}` : ''}
              </span>
              <button className="mini-btn" onClick={() => onSelect(active.batch)}>Ledger</button>
              <button className="mini-btn salvage" onClick={() => onBringUp(active.batch)}>Bring up</button>
            </div>
          ) : (
            <p className={`iso-hint${batches.length === 0 ? ' empty-mark' : ''}`}>
              {batches.length === 0 && <PanelMark name="door" size={60} faded />}
              {batches.length === 0
                ? 'Nothing down here yet. Send a miso, a shoyu, a garum or a vinegar down and it will keep developing while the bench slot goes back to work.'
                : 'Nothing down here is being managed. It is being waited for — that is the whole point of the room.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CellarView;

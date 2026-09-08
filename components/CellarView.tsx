import React, { useState } from 'react';
import { Batch, Recipe } from '../types';
import { VESSELS } from '../constants';
import { getRecipeForBatch, getMaturity, describeMaturity } from '../services/gameLogic';
import { AGEING_MAX_PROGRESS, CELLAR_TICK_DIVISOR, CELLAR_CAPACITY } from '../constants';
import IsoVessel, { isoScaleFor } from './IsoVessel';
import { CloseIcon } from './icons';

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

const W = 900;
const H = 430;
const SHELF_Y = [214, 306];   // two racks, back and front

const CellarView: React.FC<CellarViewProps> = ({ batches, onClose, onSelect, onBringUp }) => {
  const [focused, setFocused] = useState<string | null>(null);

  const read = (batch: Batch) => {
    const recipe: Recipe = getRecipeForBatch(batch);
    const vessel = VESSELS.find(v => v.id === batch.vesselId) ?? VESSELS[0];
    return {
      batch, recipe, vessel,
      s: isoScaleFor(vessel.capacityL),
      maturity: getMaturity(batch, recipe),
      note: describeMaturity(batch, recipe),
    };
  };

  const seen = batches.map(read);
  // Back rack takes the big vessels; a cask goes on the floor of a cellar and a
  // demijohn goes on a shelf, which is also how they pack.
  const back = seen.filter(v => v.vessel.capacityL >= 20);
  const front = seen.filter(v => v.vessel.capacityL < 20);
  const spread = (n: number) =>
    Array.from({ length: n }, (_, i) => 150 + ((W - 300) / Math.max(1, n - 1 || 1)) * (n === 1 ? 0.5 * (n - 1) : i));
  const backX = back.length === 1 ? [W / 2] : spread(back.length);
  const frontX = front.length === 1 ? [W / 2] : spread(front.length);

  const active = seen.find(v => v.batch.id === focused);

  const Vessel: React.FC<{ v: ReturnType<typeof read>; x: number; y: number }> = ({ v, x, y }) => (
    <g
      className={`iso-slot${focused === v.batch.id ? ' open' : ''}`}
      transform={`translate(${x},${y})`}
      tabIndex={0}
      role="button"
      aria-label={`${v.recipe.name} in a ${v.vessel.name}, ${(v.maturity * 100).toFixed(0)}% mature. Open the ledger.`}
      onMouseEnter={() => setFocused(v.batch.id)}
      onMouseLeave={() => setFocused(f => (f === v.batch.id ? null : f))}
      onFocus={() => setFocused(v.batch.id)}
      onClick={() => onSelect(v.batch)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(v.batch); } }}
    >
      <ellipse className="iso-shadow" cx="0" cy="8" rx={30 * v.s} ry={10 * v.s} />
      <g className="iso-lift">
        <IsoVessel
          vesselId={v.batch.vesselId}
          scale={v.s}
          state={{ fill: 0.85, lidOpen: false, hot: false, spoiled: false, agitated: false, heated: false, mist: 0 }}
        />
      </g>
      {/* How far along, as a ring rather than a number — you are not managing
          these, you are waiting for them. */}
      <ellipse cx="0" cy="6" rx={36 * v.s} ry={13 * v.s} fill="none"
               stroke="var(--brass)" strokeWidth="1.4" opacity={0.25 + v.maturity * 0.6} />
      <circle className="iso-pip" cx="0" cy={-74 * v.s} r="3.2" fill="var(--brass)" opacity={0.4 + v.maturity * 0.6} />
    </g>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cellar" onClick={e => e.stopPropagation()}>
        <span className="corner c-tl" />
        <span className="corner c-br" />

        <div className="pr-head">
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
              <radialGradient id="cellarLamp" cx="50%" cy="4%" r="80%">
                <stop offset="0%" stopColor="#d9a441" stopOpacity="0.13" />
                <stop offset="100%" stopColor="#d9a441" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="cellarStone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#241f1a" /><stop offset="100%" stopColor="#15110c" />
              </linearGradient>
            </defs>

            <rect x="0" y="0" width={W} height={H} fill="url(#cellarStone)" />
            <ellipse cx={W / 2} cy="40" rx="400" ry="180" fill="url(#cellarLamp)" />

            {/* The vault. A cellar is arched because that is how you hold a
                building up over a hole, and it is the one shape that says
                "underground" without a caption. */}
            <g stroke="rgba(243,233,216,0.07)" strokeWidth="1.2" fill="none">
              <path d={`M60 ${H} L60 190 q${W / 2 - 60} -150 ${W - 120} 0 L${W - 60} ${H}`} />
              <path d={`M150 ${H} L150 214 q${W / 2 - 150} -108 ${W - 300} 0 L${W - 150} ${H}`} />
              <path d={`M240 ${H} L240 236 q${W / 2 - 240} -74 ${W - 480} 0 L${W - 240} ${H}`} />
            </g>

            {/* Courses of stone, faint, so the walls read as masonry. */}
            <g stroke="rgba(243,233,216,0.035)" strokeWidth="1">
              {[250, 292, 334, 376].map(y => <path key={y} d={`M40 ${y} H${W - 40}`} />)}
            </g>

            {/* Back rack, then front, so depth reads correctly. */}
            <path d={`M110 ${SHELF_Y[0] + 20} H${W - 110}`} stroke="var(--oak-deep, #4a3018)" strokeWidth="7" strokeLinecap="round" />
            {back.map((v, i) => <Vessel key={v.batch.id} v={v} x={backX[i]} y={SHELF_Y[0]} />)}

            <path d={`M80 ${SHELF_Y[1] + 22} H${W - 80}`} stroke="var(--oak, #6b4a29)" strokeWidth="8" strokeLinecap="round" />
            {front.map((v, i) => <Vessel key={v.batch.id} v={v} x={frontX[i]} y={SHELF_Y[1]} />)}

            {batches.length === 0 && (
              <text x={W / 2} y={H / 2 + 10} textAnchor="middle"
                    fontSize="13" fill="var(--text-lo)" fontFamily="'Work Sans', sans-serif">
                Empty. Send a miso, a shoyu, a garum or a vinegar down and it will keep developing.
              </text>
            )}
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
            <p className="iso-hint">
              Nothing down here is being managed. It is being waited for — that is
              the whole point of the room.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CellarView;

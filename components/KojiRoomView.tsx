import React, { useState } from 'react';
import { Batch, Recipe, CrewMember } from '../types';
import PanelMark from './PanelMark';
import { getRecipeForBatch, getMaturity, describeMaturity } from '../services/gameLogic';
import IsoVessel, { isoScaleFor } from './IsoVessel';
import { VESSEL_ART } from './vesselSheet';
import { CloseIcon } from './icons';
import { getRecipeForBatch as recipeOf } from '../services/gameLogic';
import { KOJI_PLATE } from './kojiPlate';
import { KOJI_BED, BedView, BedStage } from './kojiBedSheet';
import { KOJI_ROOM_CAPACITY, KOJI_ROOM_TEMP, KOJI_ROOM_TARGET_STEP_KG, KOJI_ROOM_TARGET_MAX_KG, KOJI_ROOM_BED_KG, SPORULATION_START } from '../constants';

/**
 * THE KOJI ROOM
 *
 * A later-stage room, built the way the cellar is: a supplied painting with bare
 * boards, and every tray on them a real bed. It is the cellar's opposite in the
 * one way that matters — nothing down there wants touching, and everything in
 * here wants turning twice a day, which is why it comes with someone to do it.
 *
 * The viewBox is the plate's own 1344x800 grid. Beds stand on the middle and
 * bottom boards of both walls and across the front of the floor; the top boards
 * are above eye level and the mats, lids and broom are furniture.
 */

interface KojiRoomViewProps {
  batches: Batch[];
  keeper?: CrewMember;
  stockKg: number;
  targetKg: number;
  onTarget: (delta: number) => void;
  onClose: () => void;
  onSelect: (batch: Batch) => void;
  onCarryOut: (batch: Batch) => void;
}

const W = 1344;
const H = 800;
/* Where a bed stands, read off the painting: `x,y` is the middle of the tray's
   FOOT on the board or the floor, `w` its width in the plate's units (smaller as
   it recedes), and the view that matches that surface. Side boards take the
   turned tray, mirrored on the right wall so it runs back into the room. */
type Spot = { x: number; y: number; w: number; view: BedView; flip?: boolean };

/* Filled far to near, alternating walls, then the floor — a half-full room looks kept. */
const SPOTS: Spot[] = [
  { x: 296, y: 362, w: 118, view: 'turn' },               // left, middle board, far
  { x: 1048, y: 362, w: 118, view: 'turn', flip: true },   // right, middle board, far
  { x: 300, y: 516, w: 128, view: 'turn' },               // left, bottom board, far
  { x: 1044, y: 516, w: 128, view: 'turn', flip: true },   // right, bottom board, far
  { x: 126, y: 384, w: 138, view: 'turn' },               // left, middle board, near
  { x: 1218, y: 384, w: 138, view: 'turn', flip: true },   // right, middle board, near
  { x: 134, y: 604, w: 152, view: 'turn' },               // left, bottom board, near
  { x: 1210, y: 604, w: 152, view: 'turn', flip: true },   // right, bottom board, near
  { x: 330,  y: 738, w: 188, view: 'front' },              // floor, front
  { x: 1014, y: 738, w: 188, view: 'front' },
  { x: 560,  y: 772, w: 204, view: 'front' },
  { x: 784,  y: 772, w: 204, view: 'front' },
];



type Stage = 'growing' | 'peak' | 'spore' | 'spoiled';
/** Which painting: the bed's own look, which moves earlier than its label does. */
const pictureOf = (b: Batch, r: Recipe): BedStage =>
  b.progress >= SPORULATION_START ? 'spore'
    : b.progress >= r.peakWindowStart ? 'peak'
      : b.progress >= 25 ? 'bloom'
        : 'laid';
const stageOf = (b: Batch, r: Recipe): Stage =>
  b.status === 'spoiled' ? 'spoiled'
    : (b.kojiReserve || b.progress >= SPORULATION_START) ? 'spore'
      : b.progress >= r.peakWindowStart ? 'peak'
        : 'growing';
const STAGE_LABEL: Record<Stage, string> = {
  growing: 'Growing', peak: 'At its peak', spore: 'Running on to spore', spoiled: 'Spoiled',
};
const STAGE_TONE: Record<Stage, string> = {
  growing: 'var(--moss)', peak: 'var(--amber)', spore: 'var(--plum)', spoiled: 'var(--brick)',
};

const KojiRoomView: React.FC<KojiRoomViewProps> = ({ batches, keeper, stockKg, targetKg, onTarget, onClose, onSelect, onCarryOut }) => {
  const [focused, setFocused] = useState<string | null>(null);
  const beds = batches
    .map(batch => { const recipe = recipeOf(batch); return { batch, recipe, stage: stageOf(batch, recipe) }; })
    .sort((a, b) => (a.batch.startTime ?? 0) - (b.batch.startTime ?? 0));
  const active = beds.find(v => v.batch.id === focused);
  const growingKg = batches.filter(b => !b.kojiReserve && b.status !== 'spoiled').length * KOJI_ROOM_BED_KG;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="kojiroom" onClick={e => e.stopPropagation()}>
        <span className="corner c-tl" />
        <span className="corner c-br" />

        <div className="pr-head">
          <PanelMark name="kojiroom" />
          <div>
            <span className="kicker">Off the workshop</span>
            <h2>The Koji Room</h2>
          </div>
          <button className="close-stamp" onClick={onClose} aria-label="Back to the bench">
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="cellar-clime mono">
          <span>Held at <b>{KOJI_ROOM_TEMP} °C</b></span>
          <span>{keeper ? <>Keeper <b>{keeper.name}</b></> : 'No keeper — beds are kept warm, not tended'}</span>
          <span><b>{batches.length}</b> / {KOJI_ROOM_CAPACITY} beds</span>
        </div>

        <div className="kr-stock">
          <span>
            Koji in the pantry <b className="mono">{stockKg} kg</b>
            {growingKg > 0 && <> · growing <b className="mono">{growingKg} kg</b></>}
          </span>
          <span className="kr-target" title="The keeper counts beds already growing, so the pantry itself settles a little below this">
            {keeper ? 'Keeper tops pantry + beds up to' : 'A keeper would top them up to'}
            <button type="button" onClick={() => onTarget(-KOJI_ROOM_TARGET_STEP_KG)} disabled={targetKg <= 0} aria-label="Lower the koji target">−</button>
            <b className="mono">{targetKg} kg</b>
            <button type="button" onClick={() => onTarget(KOJI_ROOM_TARGET_STEP_KG)} disabled={targetKg >= KOJI_ROOM_TARGET_MAX_KG} aria-label="Raise the koji target">+</button>
          </span>
          <span className="kr-meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, targetKg > 0 ? ((stockKg + growingKg) / targetKg) * 100 : 100)}%` }} />
          </span>
        </div>

        <div className="iso-room cellar-room">
          <svg viewBox={`0 0 ${W} ${H}`} className="iso-svg" role="group" aria-label="The koji room">
            <defs>
              <radialGradient id="kojiVignette" cx="50%" cy="44%" r="74%">
                <stop offset="0%" stopColor="#000" stopOpacity="0" />
                <stop offset="74%" stopColor="#000" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#000" stopOpacity="0.36" />
              </radialGradient>
            </defs>
            <image href={KOJI_PLATE} x="0" y="0" width={W} height={H} preserveAspectRatio="xMidYMid slice" />
            {/* The cedar is paler than anything else in the game; a light warm
                multiply keeps it the same room as the trays standing in it. */}
            <rect x="0" y="0" width={W} height={H} fill="#6b4a29" style={{ mixBlendMode: 'multiply' }} opacity="0.18" />
            <rect x="0" y="0" width={W} height={H} fill="url(#kojiVignette)" />

            {beds.map((v, i) => {
              const spot = SPOTS[i];
              if (!spot) return null;
              return (
                <g key={v.batch.id}
                   className={`iso-slot${focused === v.batch.id ? ' open' : ''}`}
                   transform={`translate(${spot.x},${spot.y})`}
                   tabIndex={0} role="button"
                   aria-label={`${v.recipe.name}, ${Math.round(v.batch.progress)}% — ${STAGE_LABEL[v.stage]}. Open the ledger.`}
                   onMouseEnter={() => setFocused(v.batch.id)}
                   onMouseLeave={() => setFocused(f => (f === v.batch.id ? null : f))}
                   onFocus={() => setFocused(v.batch.id)}
                   onClick={() => onSelect(v.batch)}
                   onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(v.batch); } }}>
                  {(() => {
                    const art = KOJI_BED[spot.view][pictureOf(v.batch, v.recipe)];
                    const h = spot.w * (art.h / art.w);
                    return (
                      <>
                        <ellipse className="iso-shadow" cx="0" cy="-2" rx={spot.w * 0.46} ry={spot.w * 0.06} />
                        <g className="iso-lift painted" transform={spot.flip ? 'scale(-1,1)' : undefined}
                           style={v.stage === 'spoiled' ? { filter: 'sepia(0.7) saturate(0.6) brightness(0.8)' } : undefined}>
                          <image href={art.src} x={-spot.w / 2} y={-h} width={spot.w} height={h} />
                        </g>
                        <circle className="iso-pip" cx="0" cy={-h - 10} r={Math.max(4, spot.w * 0.035)} fill={STAGE_TONE[v.stage]}
                                stroke="rgba(20,14,9,0.7)" strokeWidth="1.5" />
                      </>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="iso-bar">
          {active ? (
            <div className="iso-actions">
              <span className="who">{active.recipe.name}</span>
              <span className="cellar-note">
                {Math.round(active.batch.progress)}% · <span style={{ color: STAGE_TONE[active.stage] }}>{STAGE_LABEL[active.stage]}</span>
              </span>
              <button className="mini-btn" onClick={() => onSelect(active.batch)}>Ledger</button>
              <button className="mini-btn salvage" onClick={() => onCarryOut(active.batch)}>To the bench</button>
            </div>
          ) : (
            <p className={`iso-hint${batches.length === 0 ? ' empty-mark' : ''}`}>
              {batches.length === 0 && <PanelMark name="kojiroom" size={56} faded />}
              {batches.length === 0
                ? (keeper
                    ? 'Nothing growing yet. The keeper lays beds from pantry grain and spore whenever koji falls below the target.'
                    : 'Nothing growing yet. Carry a koji bed in from the bench, or hire a koji keeper in Staff to lay them.')
                : (keeper
                    ? 'The keeper is turning the beds. Green pips are growing, amber at their peak, plum running on to spore.'
                    : 'Nobody is turning these beds. Hire a koji keeper in Staff, or take each one at its peak yourself.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default KojiRoomView;

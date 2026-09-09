import React from 'react';
import {
  TOOL_SHEET, TOOL_INDEX, TOOL_COLS,
  TOOL_CELL_W, TOOL_CELL_H, TOOL_SHEET_W, TOOL_SHEET_H,
} from './toolSheet';

/**
 * THE HARDWARE, IN THE ROOM
 *
 * Tools were inventory rows that silently changed a coefficient somewhere. A fan
 * made a bed cool faster, a humidifier slowed moisture loss, an agitator kept a
 * cask even — and none of them existed anywhere you could look at.
 *
 * They were flat silhouettes for a while, which the owner rightly called
 * terrible. These are painted, sliced from one sheet so the six match each other.
 *
 * Everything here is decorative in the strict sense — the simulation reads the
 * inventory, not these — but a tool you can see is a tool you remember you have,
 * and a room with a press and a centrifuge standing in it is visibly a different
 * operation from one with a clip-on fan.
 *
 * WHAT RUNNING LOOKS LIKE. The sheet is one flat picture per tool, so the moving
 * parts cannot be animated separately. What a working tool gets instead is drawn
 * over the top: a plume above the mister, a spun streak across the fan and the
 * centrifuge rotor, a warm cast on all of them. That is enough to answer "is it
 * doing anything", which is the only question the room needs to answer — the
 * numbers live in the inspector.
 */

export type ApplianceId =
  | 'portable_fan' | 'humidifier' | 'wooden_press'
  | 'centrifuge' | 'agitator' | 'mash_paddle';

interface IsoApplianceProps {
  id: ApplianceId;
  scale?: number;
  /** Drawn working when a batch is actually calling on it this tick. */
  running?: boolean;
  title?: string;
}

/* One cell drawn at about 150 units, which is the size a tool reads at against
   a 1344-wide room without swamping the shelf it stands on. */
const DRAWN = 150;

/* Where the moving part sits inside each cell, as a fraction of it — so the
   overlay follows the drawing rather than being placed by eye at one scale. */
const SPIN: Partial<Record<ApplianceId, { cx: number; cy: number; r: number }>> = {
  portable_fan: { cx: 0.46, cy: 0.46, r: 0.19 },
  centrifuge:   { cx: 0.43, cy: 0.36, r: 0.17 },
};

const IsoAppliance: React.FC<IsoApplianceProps> = ({ id, scale = 1, running, title }) => {
  const i = TOOL_INDEX[id] ?? 0;
  const col = i % TOOL_COLS;
  const row = Math.floor(i / TOOL_COLS);

  const k = (DRAWN / TOOL_CELL_W) * scale;
  const w = TOOL_CELL_W * k;
  const h = TOOL_CELL_H * k;
  const clip = `toolclip-${id}`;
  const spin = SPIN[id];

  return (
    <g className="iso-appliance" aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <ellipse className="iso-shadow" cx="0" cy={h * 0.44} rx={w * 0.34} ry={h * 0.07} />

      <defs>
        <clipPath id={clip}>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <image
          href={TOOL_SHEET}
          x={-w / 2 - col * w}
          y={-h / 2 - row * h}
          width={TOOL_SHEET_W * k}
          height={TOOL_SHEET_H * k}
          preserveAspectRatio="none"
        />
      </g>

      {running && (
        <>
          {/* A warm cast, so a working tool reads as working from across the room. */}
          <ellipse cx="0" cy="0" rx={w * 0.5} ry={h * 0.5}
                   fill="var(--amber, #e08a3c)" opacity="0.10" />
          {spin && (
            <g className="iso-spin-fast"
               style={{ transformOrigin: `${(spin.cx - 0.5) * w}px ${(spin.cy - 0.5) * h}px` }}>
              <ellipse cx={(spin.cx - 0.5) * w} cy={(spin.cy - 0.5) * h}
                       rx={w * spin.r} ry={h * spin.r * 0.92}
                       fill="none" stroke="rgba(243,233,216,0.5)" strokeWidth={w * 0.035}
                       strokeDasharray={`${w * 0.12} ${w * 0.3}`} />
            </g>
          )}
          {id === 'humidifier' && (
            <g className="iso-mist-plume">
              <ellipse cx={w * 0.02} cy={-h * 0.42} rx={w * 0.13} ry={h * 0.05}
                       fill="var(--teal, #5fa3a8)" opacity="0.22" />
              <ellipse cx={w * 0.07} cy={-h * 0.52} rx={w * 0.09} ry={h * 0.04}
                       fill="var(--teal, #5fa3a8)" opacity="0.15" />
            </g>
          )}
          {id === 'agitator' && (
            <g className="iso-agitate"
               style={{ transformOrigin: `0px ${-h * 0.1}px` }}>
              <path d={`M${-w * 0.1} ${h * 0.3} L${w * 0.1} ${h * 0.3}`}
                    stroke="rgba(243,233,216,0.35)" strokeWidth={w * 0.03} strokeLinecap="round" />
            </g>
          )}
        </>
      )}
    </g>
  );
};

export default IsoAppliance;

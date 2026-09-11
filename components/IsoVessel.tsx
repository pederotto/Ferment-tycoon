import React from 'react';
import { VESSEL_ART } from './vesselSheet';

/**
 * ISOMETRIC VESSELS
 *
 * The bench used to be a row of cards, each with a front-elevation drawing at a
 * fixed size, so a 2 L jar and a 60 L cask were the same object with different
 * text on them. These are the same vessels drawn to stand in a room.
 *
 * Two decisions worth knowing about:
 *
 * SCALE IS SOFTENED, NOT TRUE. Strictly, linear size goes as the cube root of
 * volume and a cask is 3.1x a jar — which is honest and unusable, because it
 * makes the jar too small to read or click. The spread here is about 1.9x, and
 * the rest of the size difference is carried by WHERE the vessel stands.
 *
 * BIG VESSELS ARE NOT ON THE TABLE. Nobody lifts a 60 L cask onto a workbench;
 * it stands on the floor. So anything needing four bench slots is drawn behind
 * the bench at floor level, which reads as large without competing for table
 * space — and leaves the table free for a scatter of small jars, which is what
 * a fermentation bench actually looks like.
 */

export type IsoVesselState = {
  /** 0-1, how full the vessel reads. Drives brine level and bed coverage. */
  fill?: number;
  /** Koji trays only: the lid is propped rather than sitting flat. */
  lidOpen?: boolean;
  /** Running hot — adds steam and a warm cast. */
  hot?: boolean;
  /** Past saving. Drains the colour out of it. */
  spoiled?: boolean;
  /** This one gets stirred: a paddle rests in it. */
  agitated?: boolean;
  /** Incubator only: the chamber is holding a setpoint. */
  heated?: boolean;
  /** The mister is running over this one. 0 off, 1 periodic, 2 continuous. */
  mist?: 0 | 1 | 2;
};

interface IsoVesselProps {
  vesselId: string;
  /** Multiplier on the vessel's own drawn size. */
  scale?: number;
  state?: IsoVesselState;
}

/** Softened size ramp. True cube-root would be 3.1x across the range; this is ~1.9x. */
export const isoScaleFor = (capacityL: number): number =>
  0.82 * Math.pow(Math.max(1, capacityL) / 2, 0.19);

/** Which shelf a vessel belongs on. Four-slot vessels stand on the floor. */
export const isoPlacement = (slotsRequired: number): 'floor' | 'back' | 'front' =>
  slotsRequired >= 4 ? 'floor' : slotsRequired >= 2 ? 'back' : 'front';

/**
 * Where each painting stands, in the drawn vessels' own units: its width, and the
 * y its base sits on — matched to the drawing it replaces, so the shadow, the pip
 * and the hit area land where they always did.
 */
const PAINTED_FOOT: Record<string, { w: number; bottom: number }> = {
  mason_jar:    { w: 27, bottom: 10 },
  onggi:        { w: 57, bottom: 33 },
  koji_muro:    { w: 64, bottom: 37 },
  incubator:    { w: 64, bottom: 37 },
  cedar_barrel: { w: 66, bottom: 39 },
  oak_cask:     { w: 70, bottom: 43 },
};

const Steam: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g className="iso-steam" transform={`translate(${x},${y})`} aria-hidden="true">
    <path d="M0 0 c-7 -13 7 -19 0 -32" strokeWidth="3.2" strokeLinecap="round" fill="none" />
    <path d="M13 -4 c7 -11 -6 -17 1 -28" strokeWidth="2.6" strokeLinecap="round" fill="none" />
  </g>
);

/** A paddle left standing in the mash — the marker for a ferment that is stirred. */
const Paddle: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x},${y})`} aria-hidden="true">
    <path d="M8 -26 L20 -30 L22 -24 L10 -20z" fill="var(--oak-lit, #8a6a3a)" />
    <path d="M-4 2 L10 -22" stroke="var(--oak-lit, #8a6a3a)" strokeWidth="2.6" strokeLinecap="round" />
  </g>
);

const IsoVessel: React.FC<IsoVesselProps> = ({ vesselId, scale = 1, state }) => {
  const st: IsoVesselState = state ?? {};
  const { fill = 0.6, lidOpen, hot, spoiled, agitated, heated, mist = 0 } = st;
  const s = scale;

  // Everything drains toward grey when a batch is lost.
  const g = spoiled ? 'grayscale(0.75) brightness(0.7)' : undefined;

  /** A fine spray hanging over the vessel, so the mist setting is visible. */
  const Mist = mist > 0 ? (
    <g className="iso-mist" opacity={mist === 2 ? 0.9 : 0.55} aria-hidden="true">
      <ellipse cx="0" cy="-52" rx="20" ry="7" fill="var(--teal, #5fa3a8)" opacity="0.14" />
      <g fill="var(--teal, #5fa3a8)" opacity="0.5">
        <circle cx="-11" cy="-46" r="1.2" /><circle cx="4" cy="-50" r="1" />
        <circle cx="12" cy="-43" r="1.1" /><circle cx="-4" cy="-41" r="0.9" />
      </g>
    </g>
  ) : null;

  const wrap = (children: React.ReactNode) => (
    <g transform={`scale(${s})`} style={{ filter: g }}>
      {Mist}
      {children}
    </g>
  );

  /* ------------------------------------------------------------ PAINTED
     Six vessels have paintings. They take the same overlays as the drawn ones —
     steam, mist, the paddle, the chamber's glow, the grey of a spoiled batch —
     but a painting cannot show its own brine level, so `fill` only reaches the
     drawn tray. The muro used to fall through to the barrel drawing below; it
     has a picture of its own now. */
  const art = VESSEL_ART[vesselId];
  const foot = PAINTED_FOOT[vesselId];
  if (art && foot) {
    const w = foot.w;
    const h = w * (art.h / art.w);
    const top = foot.bottom - h;
    return wrap(
      <>
        {hot && <Steam x={-6} y={top + 4} />}
        <image href={art.src} x={-w / 2} y={top} width={w} height={h} />
        {heated && (
          <rect x={-w * 0.36} y={top + h * 0.14} width={w * 0.72} height={h * 0.5} rx={2}
                fill="var(--amber, #e08a3c)" opacity={0.24} />
        )}
        {agitated && <Paddle x={6} y={top + h * 0.1} />}
      </>);
  }

  switch (vesselId) {
    /* ---------------------------------------------------------------- TRAY */
    case 'koji_tray': {
      const bed = 0.35 + fill * 0.5;
      return wrap(
        <>
          {hot && <Steam x={-14} y={-30} />}
          <path d="M0 -14 L52 12 L0 30 L-52 12z" fill="var(--oak, #6b4a29)" />
          <path d="M-52 12 L0 30 v11 L-52 23z" fill="var(--oak-deep, #4a3018)" />
          <path d="M52 12 L0 30 v11 L52 23z" fill="var(--oak-dark, #33200f)" />
          <path d="M0 -11 L46 12 L0 27 L-46 12z" fill="#cbb37e" opacity={bed} />
          <g fill="#efe2bd" opacity={0.85}>
            <circle cx={-16} cy={9} r={1.5} /><circle cx={9} cy={14} r={1.3} />
            <circle cx={-3} cy={18} r={1.2} /><circle cx={19} cy={9} r={1.3} />
          </g>
          <path d="M0 -14 L52 12 L0 30 L-52 12z" fill="none" stroke="rgba(243,233,216,0.26)" strokeWidth="1.1" />
          {lidOpen && (
            <path d="M-46 -6 L10 -34 L50 -14 L-6 14z"
                  fill="var(--oak-lit, #8a6a3a)" opacity="0.92"
                  stroke="rgba(243,233,216,0.3)" strokeWidth="1" />
          )}
        </>);
    }

    /* ----------------------------------------------------------- MASON JAR */
    case 'mason_jar': {
      const top = 8 - fill * 14;
      return wrap(
        <>
          <path d="M-15 -18 v22 a15 5.5 0 0 0 30 0 v-22z" fill="rgba(243,233,216,0.07)" />
          <path d={`M-15 ${top} v${4 - top} a15 5.5 0 0 0 30 0 v${-(4 - top)}z`} fill="var(--brine-lo, #a9721f)" />
          <ellipse cx="0" cy={top} rx="15" ry="5.5" fill="var(--brine-hi, #e7be6b)" />
          <path d="M-15 -18 v22 a15 5.5 0 0 0 30 0 v-22" fill="none" stroke="rgba(243,233,216,0.42)" strokeWidth="1.3" />
          <ellipse cx="0" cy="-18" rx="15" ry="5.5" fill="#2a2016" stroke="rgba(243,233,216,0.42)" strokeWidth="1.3" />
          <ellipse cx="0" cy="-20" rx="11.5" ry="4.2" fill="var(--oak-lit, #8a6a3a)" stroke="#33200f" strokeWidth="1" />
        </>);
    }

    /* --------------------------------------------------------------- ONGGI */
    case 'onggi':
      return wrap(
        <>
          {hot && <Steam x={-6} y={-46} />}
          <path d="M0 -32 C-22 -32 -29 -12 -27 4 C-25 20 -13 32 0 32 C13 32 25 20 27 4 C29 -12 22 -32 0 -32z" fill="var(--clay, #5d3b2e)" />
          <path d="M0 -32 C-14 -32 -25 -14 -26 4 C-27 20 -14 32 0 32 C-6 18 -10 -8 0 -32z" fill="var(--clay-lit, #7d5140)" opacity="0.5" />
          <path d="M0 32 C13 32 25 20 27 4 C24 22 13 30 0 32z" fill="var(--clay-deep, #40281e)" />
          <ellipse cx="0" cy="-32" rx="15" ry="5.6" fill="#2b1a13" stroke="rgba(243,233,216,0.3)" strokeWidth="1.2" />
          <ellipse cx="0" cy="-32" rx="10.5" ry="3.8" fill="#7a4a20" />
          {agitated && <Paddle x={6} y={-30} />}
        </>);

    /* ------------------------------------------------------- THERMAL BOX */
    case 'incubator':
      return wrap(
        <>
          <path d="M0 -34 L34 -14 L0 6 L-34 -14z" fill="#3b3630" />
          <path d="M-34 -14 L0 6 v30 L-34 16z" fill="#2b2723" />
          <path d="M34 -14 L0 6 v30 L34 16z" fill="#211d1a" />
          <path d="M-28 -8 L-4 6 v20 L-28 12z" fill={heated ? '#2a1a0d' : '#191713'} />
          {heated && <path d="M-28 -8 L-4 6 v20 L-28 12z" fill="var(--amber, #e08a3c)" opacity="0.3" />}
          <path d="M-28 -8 L-4 6 v20 L-28 12z" fill="none"
                stroke={heated ? 'rgba(224,138,60,0.5)' : 'rgba(243,233,216,0.14)'} strokeWidth="1" />
          <circle cx="18" cy="6" r="2.8" fill={heated ? 'var(--amber, #e08a3c)' : '#4a453d'} />
        </>);

    /* ------------------------------------------------------ BARRELS & CASKS */
    case 'cedar_barrel':
    case 'oak_cask':
    default: {
      const big = vesselId === 'oak_cask';
      const w = big ? 32 : 28;
      const top = big ? -50 : -44;
      const bot = big ? 42 : 38;
      return wrap(
        <>
          {hot && <Steam x={-8} y={top - 14} />}
          <path d={`M0 ${top} C${-w} ${top} ${-w - 4} ${top + 26} ${-w - 4} ${(top + bot) / 2} C${-w - 4} ${bot - 14} ${-w + 6} ${bot} 0 ${bot} C${w - 6} ${bot} ${w + 4} ${bot - 14} ${w + 4} ${(top + bot) / 2} C${w + 4} ${top + 26} ${w} ${top} 0 ${top}z`} fill="var(--oak, #6b4a29)" />
          <path d={`M0 ${top} C${-w + 6} ${top} ${-w} ${top + 26} ${-w} ${(top + bot) / 2} C${-w} ${bot - 14} ${-w + 10} ${bot} 0 ${bot} C${-8} ${bot - 18} ${-12} ${top + 30} 0 ${top}z`} fill="var(--oak-lit, #8a6a3a)" opacity="0.4" />
          <path d={`M0 ${bot} C${w - 6} ${bot} ${w + 4} ${bot - 14} ${w + 4} ${(top + bot) / 2} C${w + 2} ${bot - 10} ${w - 8} ${bot - 2} 0 ${bot}z`} fill="var(--oak-dark, #33200f)" />
          <g stroke="var(--oak-dark, #33200f)" strokeWidth="1.1" opacity="0.5" fill="none">
            <path d={`M${-w / 2} ${top + 3} C${-w / 2 - 4} ${top + 30} ${-w / 2 - 4} ${bot - 20} ${-w / 2} ${bot - 2}`} />
            <path d={`M${w / 2} ${top + 3} C${w / 2 + 4} ${top + 30} ${w / 2 + 4} ${bot - 20} ${w / 2} ${bot - 2}`} />
          </g>
          <path d={`M${-w - 3} ${top + 24} C${-w / 2} ${top + 31} ${w / 2} ${top + 31} ${w + 3} ${top + 24} L${w + 3} ${top + 31} C${w / 2} ${top + 38} ${-w / 2} ${top + 38} ${-w - 3} ${top + 31}z`} fill="var(--hoop, #6d635a)" />
          <path d={`M${-w - 3} ${bot - 26} C${-w / 2} ${bot - 19} ${w / 2} ${bot - 19} ${w + 3} ${bot - 26} L${w + 3} ${bot - 19} C${w / 2} ${bot - 12} ${-w / 2} ${bot - 12} ${-w - 3} ${bot - 19}z`} fill="var(--hoop, #6d635a)" />
          <ellipse cx="0" cy={top} rx={w - 4} ry={(w - 4) * 0.33} fill="#2c1f12" stroke="rgba(243,233,216,0.3)" strokeWidth="1.2" />
          <ellipse cx="0" cy={top} rx={(w - 4) * 0.76} ry={(w - 4) * 0.25} fill="#3a2a18" />
          {agitated && <Paddle x={10} y={top + 2} />}
        </>);
    }
  }
};

export default IsoVessel;

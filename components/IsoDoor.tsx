import React from 'react';

/**
 * THE DOOR OUT OF THE WORKSHOP.
 *
 * The bench was the whole building. Everything the player owned stood on one
 * table, which is fine for eight jars and wrong for an operation that ages a
 * colatura for a year — the cellar already existed mechanically (a cellared
 * batch ticks at a sixth of the rate and is out of reach of bench hygiene) and
 * had nowhere to be. A batch sent down there simply vanished.
 *
 * Drawn in the back wall rather than offered as a tab, because the point is that
 * the workshop has somewhere else in it. A door with light under it says there
 * is a room behind it in a way a button does not.
 */

interface IsoDoorProps {
  x?: number;
  y?: number;
  scale?: number;
  /** How many vessels are down there, shown on the frame. */
  occupied?: number;
  capacity?: number;
  onOpen?: () => void;
}

const IsoDoor: React.FC<IsoDoorProps> = ({ x = 0, y = 0, scale = 1, occupied = 0, capacity = 0, onOpen }) => (
  <g
    className="iso-door"
    transform={`translate(${x},${y}) scale(${scale})`}
    tabIndex={0}
    role="button"
    aria-label={`The cellar stair. ${occupied} of ${capacity} places used. Go down.`}
    onClick={onOpen}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(); } }}
  >
    <title>Down to the cellar — {occupied} of {capacity} places used</title>

    {/* The reveal, cut into the wall. */}
    <path d="M-34 26 L-34 -74 q34 -20 68 0 L34 26z" fill="#171109" />
    {/* Warm light spilling up the stair, which is the only cue that the room
        beyond is a room and not a cupboard. */}
    <path d="M-26 24 L-26 -66 q26 -15 52 0 L26 24z" fill="#0d0906" />
    <path d="M-26 24 L26 24 L18 4 L-18 4z" fill="rgba(217,164,65,0.10)" />

    {/* Steps down, receding. */}
    <g fill="rgba(243,233,216,0.06)" stroke="rgba(243,233,216,0.10)" strokeWidth="0.6">
      <path d="M-18 4 L18 4 L14 -6 L-14 -6z" />
      <path d="M-14 -6 L14 -6 L11 -15 L-11 -15z" />
      <path d="M-11 -15 L11 -15 L9 -23 L-9 -23z" />
    </g>

    {/* Frame and lintel. */}
    <path d="M-34 26 L-34 -74 q34 -20 68 0 L34 26" fill="none"
          stroke="var(--oak, #6b4a29)" strokeWidth="5" strokeLinejoin="round" />
    <path d="M-38 26 h76" stroke="var(--oak-deep, #4a3018)" strokeWidth="4" strokeLinecap="round" />

    {/* A slate on the frame, the way a cellar door has one. */}
    <g className="iso-door-slate" transform="translate(0,-46)">
      <rect x="-21" y="-11" width="42" height="22" rx="2.5" fill="#241b12" stroke="var(--brass)" strokeWidth="1" />
      <text x="0" y="4" textAnchor="middle" fontSize="11"
            fontFamily="'IBM Plex Mono', monospace" fill="var(--brass)">
        {occupied}/{capacity}
      </text>
    </g>
  </g>
);

export default IsoDoor;

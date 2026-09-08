import React from 'react';

/**
 * THE HARDWARE, IN THE ROOM
 *
 * Tools were inventory rows that silently changed a coefficient somewhere. A fan
 * made a bed cool faster, a humidifier slowed moisture loss, an agitator kept a
 * cask even — and none of them existed anywhere you could look at.
 *
 * Drawn into the workshop they do two things a row cannot: they say what you
 * own at a glance, and they say what the room is FOR. A bench with a press and a
 * centrifuge standing in it is a different operation from one with a clip-on fan.
 *
 * Everything here is decorative in the strict sense — the simulation reads the
 * inventory, not these — but a tool you can see is a tool you remember you have.
 */

export type ApplianceId =
  | 'portable_fan' | 'humidifier' | 'wooden_press'
  | 'centrifuge' | 'agitator' | 'mash_paddle';

interface IsoApplianceProps {
  id: ApplianceId;
  scale?: number;
  /** Drawn lit when it is actually doing something this tick. */
  running?: boolean;
  title?: string;
}

const IsoAppliance: React.FC<IsoApplianceProps> = ({ id, scale = 1, running, title }) => {
  const lit = !!running;
  const body = (() => {
    switch (id) {
      /* A clip-on fan: cage, blades, and a clamp biting the bench edge. */
      case 'portable_fan':
        return (
          <>
            <path d="M-3 12 L3 12 L2 26 L-2 26z" fill="#4a453d" />
            <path d="M-9 26 L9 26 L7 31 L-7 31z" fill="#3a352e" />
            <circle cx="0" cy="0" r="13" fill="#26221d" stroke="#5a544a" strokeWidth="1.6" />
            <g className={lit ? 'iso-fan-spin' : undefined} style={{ transformOrigin: '0px 0px' }}>
              <path d="M0 0 L-9 -7 A11 11 0 0 1 2 -11z" fill={lit ? '#8f8779' : '#6d675c'} />
              <path d="M0 0 L11 -3 A11 11 0 0 1 5 8z" fill={lit ? '#8f8779' : '#6d675c'} />
              <path d="M0 0 L-2 11 A11 11 0 0 1 -11 3z" fill={lit ? '#8f8779' : '#6d675c'} />
            </g>
            <circle cx="0" cy="0" r="2.6" fill="#9a9184" />
            <circle cx="0" cy="0" r="13" fill="none" stroke="rgba(243,233,216,0.16)" strokeWidth="0.8" />
          </>
        );

      /* An ultrasonic mister: tank, nozzle, and a plume when it is on. */
      case 'humidifier':
        return (
          <>
            {lit && (
              <g className="iso-mist-plume">
                <ellipse cx="0" cy="-30" rx="11" ry="5" fill="var(--teal, #5fa3a8)" opacity="0.16" />
                <ellipse cx="3" cy="-38" rx="8" ry="3.6" fill="var(--teal, #5fa3a8)" opacity="0.11" />
              </g>
            )}
            <path d="M0 -20 L13 -13 L0 -6 L-13 -13z" fill="#4c5a5c" />
            <path d="M-13 -13 L0 -6 v22 L-13 9z" fill="#3a4547" />
            <path d="M13 -13 L0 -6 v22 L13 9z" fill="#2c3537" />
            <path d="M-9 -8 L-2 -4 v13 L-9 5z" fill={lit ? 'rgba(95,163,168,0.5)' : 'rgba(95,163,168,0.2)'} />
            <ellipse cx="0" cy="-20" rx="4.6" ry="2" fill="#26302f" />
            <circle cx="8" cy="2" r="1.8" fill={lit ? 'var(--teal, #5fa3a8)' : '#3f4a4b'} />
          </>
        );

      /* A screw press: two posts, a beam, and a basket under the platen. */
      case 'wooden_press':
        return (
          <>
            <path d="M0 8 L26 21 L0 34 L-26 21z" fill="var(--oak-deep, #4a3018)" />
            <path d="M-26 21 L0 34 v7 L-26 28z" fill="#33200f" />
            <path d="M26 21 L0 34 v7 L26 28z" fill="#2a1a0c" />
            <path d="M-20 -30 L-14 -33 v46 L-20 16z" fill="var(--oak, #6b4a29)" />
            <path d="M20 -30 L14 -33 v46 L20 16z" fill="var(--oak-dark, #33200f)" />
            <path d="M0 -42 L22 -31 L0 -20 L-22 -31z" fill="var(--oak-lit, #8a6a3a)" />
            <path d="M-22 -31 L0 -20 v7 L-22 -24z" fill="var(--oak, #6b4a29)" />
            <path d="M22 -31 L0 -20 v7 L22 -24z" fill="var(--oak-dark, #33200f)" />
            <path d="M0 -26 v18" stroke="#8d8577" strokeWidth="3.2" strokeLinecap="round" />
            <ellipse cx="0" cy="-26" rx="7" ry="2.6" fill="#a39a8b" />
            <path d="M0 -6 L17 2 L0 10 L-17 2z" fill="#6d635a" />
            <path d="M0 2 L14 9 L0 15 L-14 9z" fill="#c9ad72" opacity="0.85" />
          </>
        );

      /* A benchtop centrifuge: drum, hinged lid, a light on the front. */
      case 'centrifuge':
        return (
          <>
            <ellipse cx="0" cy="14" rx="20" ry="8" fill="#2f2b26" />
            <path d="M-20 -2 a20 8 0 0 0 40 0 v16 a20 8 0 0 1 -40 0z" fill="#3d3831" />
            <ellipse cx="0" cy="-2" rx="20" ry="8" fill="#4a453d" />
            <ellipse cx="0" cy="-3" rx="13" ry="5" fill="#1d1a16" />
            <path d="M-20 -4 a20 8 0 0 1 40 0 l-3 -8 a17 6 0 0 0 -34 0z" fill="#565049" />
            <circle cx="0" cy="9" r="2" fill={lit ? 'var(--moss, #7a9e6a)' : '#332f2a'} />
          </>
        );

      /* A geared agitator: a motor on a post with a paddle going down. */
      case 'agitator':
        return (
          <>
            <path d="M-3 6 L3 6 L2 40 L-2 40z" fill="#4a453d" />
            <path d="M0 -14 L14 -7 L0 0 L-14 -7z" fill="#565049" />
            <path d="M-14 -7 L0 0 v11 L-14 4z" fill="#3d3831" />
            <path d="M14 -7 L0 0 v11 L14 4z" fill="#2e2a26" />
            <circle cx="0" cy="-14" r="3.4" fill={lit ? 'var(--amber, #e08a3c)' : '#6d675c'} />
            <g className={lit ? 'iso-agitate' : undefined} style={{ transformOrigin: '0px 6px' }}>
              <path d="M0 6 v26" stroke="#8d8577" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M-7 32 L7 32 L5 37 L-5 37z" fill="var(--oak-lit, #8a6a3a)" />
            </g>
          </>
        );

      /* A paddle leaning against whatever is nearest. */
      case 'mash_paddle':
      default:
        return (
          <>
            <path d="M6 -34 L14 -38 L18 -26 L10 -22z" fill="var(--oak-lit, #8a6a3a)" />
            <path d="M-6 6 L8 -26" stroke="var(--oak, #6b4a29)" strokeWidth="3" strokeLinecap="round" />
          </>
        );
    }
  })();

  return (
    <g className="iso-appliance" transform={`scale(${scale})`}>
      {title ? <title>{title}</title> : null}
      <ellipse className="iso-shadow" cx="0" cy={id === 'wooden_press' ? 40 : 24} rx="20" ry="7" />
      {body}
    </g>
  );
};

export default IsoAppliance;

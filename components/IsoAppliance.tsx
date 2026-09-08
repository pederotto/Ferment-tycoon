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

  /* Flat silhouettes rather than little isometric boxes. The pseudo-3D versions
     had three shaded faces each and read as clutter beside the vessels, which
     are simple rounded forms — the eye kept being pulled to the wrong objects.
     These are side elevations with one accent apiece, so they sit in the room
     as furniture instead of competing with the work. */
  const body = (() => {
    switch (id) {
      case 'portable_fan':
        return (
          <>
            <rect x="-2" y="10" width="4" height="18" rx="1" fill="#4a453d" />
            <rect x="-8" y="27" width="16" height="4" rx="2" fill="#3a352e" />
            <circle cx="0" cy="0" r="12" fill="#22201c" stroke="#5f584e" strokeWidth="2" />
            <g className={lit ? 'iso-fan-spin' : undefined} style={{ transformOrigin: '0px 0px' }}>
              <path d="M0 0 L-8 -6 A10 10 0 0 1 2 -10z" fill={lit ? '#9b9384' : '#6d675c'} />
              <path d="M0 0 L10 -2 A10 10 0 0 1 4 8z" fill={lit ? '#9b9384' : '#6d675c'} />
              <path d="M0 0 L-2 10 A10 10 0 0 1 -10 2z" fill={lit ? '#9b9384' : '#6d675c'} />
            </g>
            <circle cx="0" cy="0" r="2.2" fill="#a8a094" />
          </>
        );

      case 'humidifier':
        return (
          <>
            {lit && (
              <g className="iso-mist-plume">
                <ellipse cx="0" cy="-26" rx="9" ry="4" fill="var(--teal, #5fa3a8)" opacity="0.18" />
                <ellipse cx="2" cy="-33" rx="6" ry="3" fill="var(--teal, #5fa3a8)" opacity="0.12" />
              </g>
            )}
            <rect x="-10" y="-16" width="20" height="32" rx="4" fill="#3d4749" />
            <rect x="-6" y="-9" width="12" height="17" rx="2"
                  fill={lit ? 'rgba(95,163,168,0.45)' : 'rgba(95,163,168,0.16)'} />
            <rect x="-3.5" y="-20" width="7" height="5" rx="1.5" fill="#2b3335" />
            <circle cx="0" cy="12" r="1.8" fill={lit ? 'var(--teal, #5fa3a8)' : '#333b3c'} />
          </>
        );

      case 'wooden_press':
        return (
          <>
            <rect x="-22" y="24" width="44" height="7" rx="1.5" fill="var(--oak-deep, #4a3018)" />
            <rect x="-18" y="-34" width="6" height="58" fill="var(--oak, #6b4a29)" />
            <rect x="12" y="-34" width="6" height="58" fill="var(--oak, #6b4a29)" />
            <rect x="-22" y="-40" width="44" height="8" rx="1.5" fill="var(--oak-lit, #8a6a3a)" />
            <rect x="-2.5" y="-32" width="5" height="20" fill="#8d8577" />
            <rect x="-9" y="-36" width="18" height="4" rx="2" fill="#a39a8b" />
            <rect x="-15" y="-12" width="30" height="6" rx="1.5" fill="#6d635a" />
            <rect x="-14" y="-5" width="28" height="12" rx="1.5" fill="#c9ad72" opacity="0.9" />
          </>
        );

      case 'centrifuge':
        return (
          <>
            <rect x="-17" y="-6" width="34" height="24" rx="4" fill="#3d3831" />
            <path d="M-17 -4 a17 12 0 0 1 34 0z" fill="#4f4941" />
            <ellipse cx="0" cy="-4" rx="11" ry="4.5" fill="#1c1a16" />
            <g className={lit ? 'iso-spin-fast' : undefined} style={{ transformOrigin: '0px -4px' }}>
              <ellipse cx="0" cy="-4" rx="8" ry="3" fill="#6d675c" opacity="0.8" />
            </g>
            <rect x="-11" y="9" width="22" height="4" rx="2" fill="#2b2723" />
            <circle cx="12" cy="11" r="2" fill={lit ? 'var(--moss, #7a9e6a)' : '#332f2a'} />
          </>
        );

      case 'agitator':
        return (
          <>
            <rect x="-2" y="-6" width="4" height="40" fill="#4a453d" />
            <rect x="-11" y="-20" width="22" height="15" rx="3" fill="#514b43" />
            <circle cx="0" cy="-12.5" r="3" fill={lit ? 'var(--amber, #e08a3c)' : '#6d675c'} />
            <g className={lit ? 'iso-agitate' : undefined} style={{ transformOrigin: '0px -6px' }}>
              <rect x="-1.5" y="-6" width="3" height="34" rx="1.5" fill="#8d8577" />
              <path d="M-7 26 L7 26 L5 33 L-5 33z" fill="var(--oak-lit, #8a6a3a)" />
            </g>
          </>
        );

      case 'mash_paddle':
      default:
        return (
          <>
            <path d="M4 -34 L13 -37 L17 -24 L8 -21z" fill="var(--oak-lit, #8a6a3a)" />
            <path d="M-5 8 L7 -24" stroke="var(--oak, #6b4a29)" strokeWidth="3.4" strokeLinecap="round" />
          </>
        );
    }
  })();

  return (
    <g className="iso-appliance" transform={`scale(${scale})`}>
      {title ? <title>{title}</title> : null}
      <ellipse className="iso-shadow" cx="0" cy={id === 'wooden_press' ? 32 : 20} rx="17" ry="5" />
      {body}
    </g>
  );
};

export default IsoAppliance;

import React from 'react';

/**
 * INGREDIENT ART
 *
 * Every ingredient in the game draws the same generic glyph, so a pantry of
 * sixty-three things reads as sixty-three identical rows with different words on
 * them. The reference direction is a flat cream silhouette per ingredient — ink
 * on board, no shading, no outline — which is the cheapest illustration style
 * that still gives each thing its own shape.
 *
 * Hand-authored SVG rather than raster: it inherits the text colour, stays crisp
 * at any size, costs a couple of hundred bytes each, and the artifact CSP blocks
 * external images anyway.
 *
 * This is a proof of the approach on eight of the sixty-three. `ART` is a plain
 * lookup, so filling in the rest is additive and nothing breaks in the meantime —
 * anything missing falls through to the existing generic glyph.
 */

interface ArtProps { size?: number; color?: string; className?: string }

const S = (d: string) => ({ size = 22, color = 'currentColor', className }: ArtProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path d={d} fill={color} />
  </svg>
);

/* Pearl barley — a scatter of grains, each a leaning ellipse with a crease. */
const Barley: React.FC<ArtProps> = ({ size = 22, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <g fill={color}>
      {[[8,10,-24],[17,8,14],[24,13,-8],[11,18,8],[20,20,-20],[14,26,4],[24,25,18],[6,22,26]].map(([x,y,r],i)=>(
        <g key={i} transform={`translate(${x},${y}) rotate(${r})`}>
          <ellipse cx="0" cy="0" rx="3.4" ry="2.1" />
        </g>
      ))}
    </g>
  </svg>
);

/* Soybeans — rounder, with the seam a bean actually has. */
const Bean: React.FC<ArtProps & { dark?: boolean }> = ({ size = 22, color = 'currentColor', className, dark }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <g fill={color} opacity={dark ? 0.72 : 1}>
      {[[10,11],[21,9],[16,17],[8,21],[23,20],[15,26]].map(([x,y],i)=>(
        <g key={i} transform={`translate(${x},${y})`}>
          <circle cx="0" cy="0" r="3.6" />
        </g>
      ))}
    </g>
    <g stroke={dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)'} strokeWidth="0.9" fill="none">
      {[[10,11],[21,9],[16,17],[8,21],[23,20],[15,26]].map(([x,y],i)=>(
        <path key={i} d={`M${x-2.4} ${y-1} q2.4 2 4.8 0`} />
      ))}
    </g>
  </svg>
);

/* Garlic — the bulb with its papery ridges and a stub of neck. */
const Garlic = S('M16 3 q1.6 3 1.2 5.4 q4.6 1.4 6.6 6.2 q2 4.8 -1 8.6 q-3 3.8 -6.8 3.8 q-3.8 0 -6.8 -3.8 q-3 -3.8 -1 -8.6 q2 -4.8 6.6 -6.2 q-0.4 -2.4 1.2 -5.4z M11.4 12.6 q-1.2 6 1 12.4 M20.6 12.6 q1.2 6 -1 12.4');

/* Anchovies — three fish, tails crossed, the way they lie in a tin. */
const Fish: React.FC<ArtProps> = ({ size = 22, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <g fill={color}>
      {[6, 14, 22].map((y, i) => (
        <g key={i} transform={`translate(0,${y}) rotate(${i === 1 ? 3 : -2} 16 5)`}>
          <path d="M4 5 q7 -4.4 15 0 q-7 4.4 -15 0z" />
          <path d="M19 5 l6 -3.4 v6.8z" />
          <circle cx="8" cy="4.2" r="0.9" fill="rgba(0,0,0,0.55)" />
        </g>
      ))}
    </g>
  </svg>
);

/* Cep — the fat stem and heavy cap of a porcini. */
const Cep = S('M16 5 q7.6 0 10.4 5.2 q1 2 -1.2 2.4 q-4 0.8 -9.2 0.8 q-5.2 0 -9.2 -0.8 q-2.2 -0.4 -1.2 -2.4 q2.8 -5.2 10.4 -5.2z M13 14 q0.6 6.4 -0.8 11 q-0.4 1.4 1.2 1.6 q2.6 0.3 5.2 0 q1.6 -0.2 1.2 -1.6 q-1.4 -4.6 -0.8 -11z');

/* Sea salt — a heap of crystals, drawn as facets rather than dots. */
const Salt = S('M16 6 l3.6 5.2 -3.6 2.2 -3.6 -2.2z M9 14 l3.4 4.8 -3.4 2.2 -3.4 -2.2z M23 14 l3.4 4.8 -3.4 2.2 -3.4 -2.2z M16 17.4 l4.4 6.2 -4.4 2.8 -4.4 -2.8z');

/* Koji — grain under a bloom, which is the one thing a koji picture must show. */
const Koji: React.FC<ArtProps> = ({ size = 22, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path d="M4 20 q12 -5 24 0 q0 6 -12 6 q-12 0 -12 -6z" fill={color} />
    <g fill={color} opacity="0.55">
      {[[9,17],[14,15],[19,15],[24,17],[11.5,13],[21,12.5],[16,11]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r={2.6 - i * 0.14} />
      ))}
    </g>
  </svg>
);

/* Plums — fruit with the crease and a leaf. */
const Plum = S('M12 11 q-4.4 2.6 -4.4 7.4 q0 5.6 5 5.6 q2 0 3.4 -1.4 q1.4 1.4 3.4 1.4 q5 0 5 -5.6 q0 -4.8 -4.4 -7.4 q-2 -1.2 -4 -1.2 q-2 0 -4 1.2z M16 10 q0.4 -3.4 4.6 -4.6 q-0.6 3.6 -4.6 4.6z');

export const ART: Record<string, React.FC<ArtProps>> = {
  barley: Barley,
  soybeans: (p) => <Bean {...p} />,
  black_soybeans: (p) => <Bean {...p} dark />,
  garlic_bulbs: Garlic,
  anchovies: Fish,
  mackerel: Fish,
  ceps: Cep,
  salt: Salt,
  trapani_salt: Salt,
  barley_koji: Koji,
  koji_rice: Koji,
  plums: Plum,
};

/** The art for an ingredient, or null when it has none yet. */
export const artFor = (id: string): React.FC<ArtProps> | null => ART[id] ?? null;

export default ART;

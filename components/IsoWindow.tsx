import React from 'react';
import { WeatherState } from '../types';

/**
 * THE WINDOW
 *
 * A workshop with no daylight in it is a diagram. This is one tree, seen through
 * one window, and it is the only place in the game where the season is a picture
 * rather than a word in the header.
 *
 * It is also not decoration in the way it looks. Month drives ambient
 * temperature and humidity, and weather modifies both — so a bare tree under
 * snow is telling you why your koji is running cold, and the summer canopy is
 * telling you why it is not. The player has been reading those two numbers off a
 * status bar since the beginning.
 */

interface IsoWindowProps {
  /** 0-11. Drives the tree, not just the caption. */
  month: number;
  weather: WeatherState;
  x?: number;
  y?: number;
  scale?: number;
  /**
   * Draw the VIEW only — no reveal, no frame, no glazing bars, no sill.
   *
   * When this is drawn into a painted room the wall already has all of those,
   * and a second frame inside the painted one reads as a sticker stuck over the
   * hole. What the room needs from this component is the sky, the tree and the
   * weather; the architecture belongs to the plate.
   */
  bare?: boolean;
}

type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export const seasonOf = (month: number): Season =>
  month <= 1 || month === 11 ? 'winter'
    : month <= 4 ? 'spring'
      : month <= 7 ? 'summer'
        : 'autumn';

/** Sky behind the tree. Deliberately desaturated — it is dusk through glass. */
const SKY: Record<Season, [string, string]> = {
  winter: ['#2b3a49', '#3f4d59'],
  spring: ['#38485a', '#5d6b60'],
  summer: ['#3c5163', '#79766a'],
  autumn: ['#3a3f4d', '#6a5a4c'],
};

const FOLIAGE: Record<Season, string[]> = {
  winter: [],
  spring: ['#6d8f5a', '#7fa267', '#8fae74'],
  summer: ['#54793f', '#61894a', '#6f9755'],
  autumn: ['#a5702f', '#b8823a', '#8f5a26'],
};

const IsoWindow: React.FC<IsoWindowProps> = ({ month, weather, x = 0, y = 0, scale = 1, bare }) => {
  const season = seasonOf(month);
  const [skyTop, skyBottom] = SKY[season];
  const leaves = FOLIAGE[season];
  const uid = `win${season}`;

  const wet = weather.type === 'Rainy' || weather.type === 'Stormy';
  const snowy = weather.type === 'Snowy' || (season === 'winter' && weather.type === 'Cloudy');
  const bright = weather.type === 'Sunny' || weather.type === 'Heatwave';

  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} className="iso-window">
      <title>{`${season}, ${weather.type.toLowerCase()} — ${weather.description}`}</title>
      <defs>
        <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skyTop} />
          <stop offset="100%" stopColor={skyBottom} />
        </linearGradient>
        <clipPath id={`${uid}clip`}>
          <rect x="-52" y="-64" width="104" height="96" rx="3" />
        </clipPath>
      </defs>

      {!bare && <rect x="-58" y="-70" width="116" height="108" rx="4" fill="#241b12" />}
      <rect x="-52" y="-64" width="104" height="96" rx={bare ? 0 : 3} fill={`url(#${uid}sky)`} />

      <g clipPath={`url(#${uid}clip)`}>
        {bright && <circle cx="26" cy="-44" r="13" fill="#d8b878" opacity="0.32" />}

        {/* far hill, so the tree has something to stand on */}
        <path d="M-52 20 q26 -14 52 -4 q28 10 52 -2 v18 h-104z"
              fill={season === 'winter' ? '#4a5560' : '#3c4438'} opacity="0.7" />

        {/* the tree */}
        <path d="M-4 32 L-4 -12 q0 -6 4 -6 q4 0 4 6 L4 32z" fill="#4a3a2c" />
        <path d="M0 -6 L-16 -20 M0 -12 L14 -24 M0 0 L-13 -6 M0 -4 L12 -10"
              stroke="#4a3a2c" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        {leaves.length > 0 && (
          <g className="iso-canopy">
            <circle cx="-13" cy="-24" r="13" fill={leaves[0]} />
            <circle cx="9"  cy="-28" r="15" fill={leaves[1]} />
            <circle cx="-2" cy="-38" r="14" fill={leaves[2]} />
            <circle cx="14" cy="-16" r="10" fill={leaves[0]} />
            <circle cx="-16" cy="-10" r="9"  fill={leaves[1]} />
          </g>
        )}
        {season === 'autumn' && (
          <g className="iso-fall" fill={leaves[0]} opacity="0.75">
            <circle cx="-24" cy="2" r="1.8" /><circle cx="22" cy="10" r="1.6" />
            <circle cx="4" cy="16" r="1.5" />
          </g>
        )}
        {snowy && (
          <>
            <path d="M-52 24 q26 -8 52 -2 q28 8 52 -2 v14 h-104z" fill="#c9d4dc" opacity="0.55" />
            <g className="iso-snow" fill="#e8eef2" opacity="0.8">
              <circle cx="-30" cy="-40" r="1.6" /><circle cx="-6" cy="-52" r="1.4" />
              <circle cx="18" cy="-34" r="1.7" /><circle cx="34" cy="-50" r="1.3" />
              <circle cx="6" cy="-18" r="1.5" />
            </g>
          </>
        )}
        {wet && (
          <g className="iso-rain" stroke="#9fb6c4" strokeWidth="1" opacity="0.5" strokeLinecap="round">
            <path d="M-34 -52 l-4 12" /><path d="M-12 -58 l-4 12" />
            <path d="M10 -50 l-4 12" /><path d="M32 -56 l-4 12" />
            <path d="M-24 -30 l-4 12" /><path d="M20 -28 l-4 12" />
          </g>
        )}
      </g>

      {!bare && (
        <>
          {/* glazing bars and frame, over the glass */}
          <path d="M0 -64 V32 M-52 -16 H52" stroke="#241b12" strokeWidth="4" />
          <rect x="-52" y="-64" width="104" height="96" rx="3" fill="none" stroke="#3b2d1e" strokeWidth="3" />
          {/* a little light spilling onto the sill */}
          <rect x="-58" y="32" width="116" height="7" rx="2" fill="#3b2d1e" />
          <rect x="-52" y="32" width="104" height="3" fill={bright ? 'rgba(216,184,120,0.22)' : 'rgba(243,233,216,0.06)'} />
        </>
      )}
    </g>
  );
};

export default IsoWindow;

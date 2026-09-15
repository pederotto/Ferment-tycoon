import React from 'react';
import { WeatherState } from '../types';
import { WEATHER_SCENES } from './weatherSheet';
import { WINDOW_LIFE } from './windowLifeSheet';
import { weatherScene } from './BrassHud';

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
        {/* PAINTED, WHEN IT STANDS IN THE PAINTED ROOM.
            The room shows this through a portrait opening (134x170) scaled to
            cover, so the painting is placed on that opening in local units —
            centred on the sky's middle at y=-16 — rather than on the landscape
            104x96 sky, which would crop the portrait to a letterbox. */}
        {bare && (
          // The season's panel for the day's weather — painted tall, so it fills the
          // opening as painted (only a sliver top and bottom is trimmed). The weather
          // glass shows the same panel, so the two never disagree.
          <image href={WEATHER_SCENES[weatherScene(weather.type, season)]} x={-37} y={-63} width={74} height={94}
                 preserveAspectRatio="xMidYMid slice" />
        )}
        {bright && !bare && <circle cx="26" cy="-44" r="13" fill="#d8b878" opacity={0.32} />}

        {/* LIFE IN THE VIEW. The painting is still; these are the few things that
            move across it, chosen by the season and the weather so they also say
            something: swallows in spring, sheep on a mild day, leaves in autumn,
            a flash in a storm. Painted sprites (windowLifeSheet) animated in CSS, no filters (a
            filter on something that animates is re-rasterised every frame), and
            all of it stops under prefers-reduced-motion. Local units: the painted
            view spans x -37..37, y -63..31; the sky is the top half. */}
        {bare && (() => {
          const stormy = weather.type === 'Stormy';
          const foggy = weather.type === 'Foggy';
          const hot = weather.type === 'Heatwave';
          const calm = !wet && !snowy && !foggy;
          const birds = calm && season !== 'winter';
          // Painted sprites, not drawn strokes: swallows in the warm half of the
          // year, a crow in the cold half. Sizes are local units (the view is 74 wide).
          const Bird = ({ y, delay, dur, scale = 1, kind = 'swallow', pose = 0 }:
            { y: number; delay: number; dur: number; scale?: number; kind?: 'swallow' | 'crow'; pose?: number }) => {
            const sp = WINDOW_LIFE[kind][pose % WINDOW_LIFE[kind].length];
            const w = (kind === 'crow' ? 5 : 3.6) * scale;
            const h = w * sp.h / sp.w;
            return (
              <g className="wl-bird" style={{ animationDelay: `${delay}s`, animationDuration: `${dur}s` }}>
                <image href={sp.src} x={0} y={y - h / 2} width={w} height={h} />
              </g>
            );
          };
          const sheep = calm && season !== 'winter';
          const drift = season === 'spring' ? WINDOW_LIFE.blossom : WINDOW_LIFE.leaf.slice(0, 2);
          return (
            <g className="window-life">
              {/* The painting already carries the weather's light (a storm is painted
                  dark), so nothing greys it over; what is added here is only motion. */}
              {/* clouds drift across on grey days: soft-edged, high in the sky and
                  clear of the tree's crown, or they read as a grey pill stuck on it */}
              {(weather.type === 'Cloudy' || wet) && (
                <g className="wl-clouds" opacity={wet ? 0.8 : 0.6}>
                  <defs>
                    <radialGradient id={`${uid}cloud`}>
                      <stop offset="0" stopColor={stormy ? '#3f464e' : wet ? '#7d868e' : '#f3f4f4'} stopOpacity="0.95" />
                      <stop offset="0.6" stopColor={stormy ? '#3f464e' : wet ? '#7d868e' : '#f3f4f4'} stopOpacity="0.55" />
                      <stop offset="1" stopColor={stormy ? '#3f464e' : wet ? '#7d868e' : '#f3f4f4'} stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <g className="wl-cloud" style={{ animationDuration: '46s' }}>
                    <ellipse cx="0" cy="-59" rx="16" ry="5" fill={`url(#${uid}cloud)`} />
                    <ellipse cx="9" cy="-61" rx="10" ry="4.5" fill={`url(#${uid}cloud)`} />
                  </g>
                  <g className="wl-cloud" style={{ animationDuration: '63s', animationDelay: '-24s' }}>
                    <ellipse cx="0" cy="-53" rx="19" ry="5" fill={`url(#${uid}cloud)`} />
                    <ellipse cx="-10" cy="-55" rx="9" ry="4" fill={`url(#${uid}cloud)`} />
                  </g>
                </g>
              )}
              {/* birds: a few crossing now and then; swallows in spring are quicker */}
              {birds && (
                <>
                  <Bird y={-48} delay={2} dur={season === 'spring' ? 9 : 14} kind={season === 'autumn' ? 'crow' : 'swallow'} pose={0} />
                  <Bird y={-44} delay={2.6} dur={season === 'spring' ? 9.4 : 14.5} scale={0.8} kind={season === 'autumn' ? 'crow' : 'swallow'} pose={2} />
                  <Bird y={-55} delay={11} dur={season === 'spring' ? 10 : 16} scale={0.9} kind={season === 'autumn' ? 'crow' : 'swallow'} pose={1} />
                </>
              )}
              {!birds && season === 'winter' && !stormy && <Bird y={-50} delay={6} dur={22} scale={1.1} kind="crow" pose={1} />}
              {/* two painted sheep grazing on the meadow, barely moving */}
              {sheep && (
                <g className="wl-sheep2">
                  {[{ x: -26, y: 13, w: 8, i: 0, flip: false }, { x: 9, y: 21, w: 10, i: 2, flip: true }].map(sh => {
                    const sp = WINDOW_LIFE.sheep[sh.i];
                    const h = sh.w * sp.h / sp.w;
                    return (
                      <image key={sh.i} href={sp.src} x={sh.flip ? -(sh.x + sh.w) : sh.x} y={sh.y - h} width={sh.w} height={h}
                             transform={sh.flip ? 'scale(-1,1)' : undefined} />
                    );
                  })}
                </g>
              )}
              {/* spring blossom and autumn leaves, drifting down across the view */}
              {(season === 'spring' || season === 'autumn') && !wet && (
                <g className="wl-drift">
                  {[[-28, 0], [-12, -4], [4, -1.5], [20, -6], [30, -2.8], [-2, -8]].map(([x, d], i) => {
                    const sp = drift[i % drift.length];
                    const w = season === 'spring' ? 2.4 : 2.8;
                    return <image key={i} href={sp.src} x={x} y={-61} width={w} height={w * sp.h / sp.w}
                                  style={{ animationDelay: `${d}s` }} />;
                  })}
                </g>
              )}
              {/* rain that actually falls, heavier in a storm */}
              {wet && (
                <g className="wl-rain" stroke="#dbe6ee" strokeWidth="0.45" strokeLinecap="round" opacity={stormy ? 0.6 : 0.5}>
                  {Array.from({ length: stormy ? 40 : 28 }, (_, i) => {
                    const x = -38 + ((i * 37) % 78);
                    return <path key={i} d={`M${x} -64 l-2.2 7`} style={{ animationDelay: `${-((i * 0.137) % 1.1)}s` }} />;
                  })}
                </g>
              )}
              {/* snow: slow, wandering flakes */}
              {snowy && (
                <g className="wl-snow" fill="#ffffff" opacity="0.85">
                  {Array.from({ length: 16 }, (_, i) => (
                    <circle key={i} cx={-35 + ((i * 29) % 70)} cy={-64} r={0.45 + ((i * 7) % 3) * 0.2}
                            style={{ animationDelay: `${-((i * 0.83) % 9)}s`, animationDuration: `${7 + (i % 4)}s` }} />
                  ))}
                </g>
              )}
              {/* fog rolling through in two slow bands */}
              {foggy && (
                <g className="wl-fog">
                  {/* a gradient that fades to nothing at every edge, so the band
                      has no outline — a flat rounded rect read as a pill */}
                  <defs>
                    <radialGradient id={`${uid}fog`}>
                      <stop offset="0" stopColor="#eef1f2" stopOpacity="0.75" />
                      <stop offset="1" stopColor="#eef1f2" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <ellipse className="wl-fog-band" cx="-25" cy="-2" rx="48" ry="9" fill={`url(#${uid}fog)`} />
                  <ellipse className="wl-fog-band slow" cx="-10" cy="15" rx="55" ry="11" fill={`url(#${uid}fog)`} />
                </g>
              )}
              {/* a lightning flash, now and then */}
              {stormy && <rect className="wl-flash" x="-40" y="-66" width="80" height="100" fill="#f4f6ff" />}
              {/* heat: a warm haze breathing over the horizon */}
              {hot && <rect className="wl-haze" x="-40" y="-14" width="80" height="18" fill="#f3c98a" />}
            </g>
          );
        })()}

        {!bare && <>
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
        </>}
        {!bare && season === 'autumn' && (
          <g className="iso-fall" fill={leaves[0]} opacity="0.75">
            <circle cx="-24" cy="2" r="1.8" /><circle cx="22" cy="10" r="1.6" />
            <circle cx="4" cy="16" r="1.5" />
          </g>
        )}
        {/* the drawn view's own static snow and rain; the painted view has animated ones above */}
        {snowy && !bare && (
          <>
            {!bare && <path d="M-52 24 q26 -8 52 -2 q28 8 52 -2 v14 h-104z" fill="#c9d4dc" opacity="0.55" />}
            <g className="iso-snow" fill="#e8eef2" opacity="0.8">
              <circle cx="-30" cy="-40" r="1.6" /><circle cx="-6" cy="-52" r="1.4" />
              <circle cx="18" cy="-34" r="1.7" /><circle cx="34" cy="-50" r="1.3" />
              <circle cx="6" cy="-18" r="1.5" />
            </g>
          </>
        )}
        {wet && !bare && (
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

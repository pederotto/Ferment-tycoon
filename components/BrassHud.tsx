import React from 'react';
import { BRASS, BRASS_RAIL } from './brassSheet';
import { WEATHER_SCENES } from './weatherSheet';
import type { WeatherType } from '../types';
import { SPEEDS } from './SpeedControl';

/**
 * THE HEADER AS INSTRUMENTS.
 *
 * The header was chips, rings and dashed tickets — a dashboard. It is a bench's
 * instrument board now: a brass clock whose hand points at the speed and a lever
 * that holds the clock, glass tubes that fill for power, hygiene and the
 * inspector, and nameplates for the three numbers you own. The pictures are
 * dressing only; every reading is still printed, so nothing depends on judging
 * how full a tube looks.
 */

const img = (key: keyof typeof BRASS, className?: string, style?: React.CSSProperties) => (
  <img src={BRASS[key].src} className={className} style={style} alt="" aria-hidden="true" draggable={false} />
);

/* The hand sweeps across the top of the face: one notch per speed. */
const HAND_ANGLE = [-54, -18, 18, 54];

export const BrassSpeed: React.FC<{
  gameSpeed: number; paused: boolean;
  onSetSpeed: (n: number) => void; onTogglePause: () => void;
}> = ({ gameSpeed, paused, onSetSpeed, onTogglePause }) => {
  const i = Math.max(0, SPEEDS.indexOf(gameSpeed));
  return (
    <div className={`bspeed${paused ? ' paused' : ''}`}>
      <button className="blever" onClick={onTogglePause}
              title={paused ? 'Resume (Spacebar)' : 'Hold the clock (Spacebar)'}
              aria-label={paused ? 'Resume' : 'Pause'} aria-pressed={paused}>
        {img(paused ? 'leverDown' : 'leverUp')}
      </button>
      {/* Clicking the face steps to the next speed, which is what a hand on a dial invites. */}
      <button className="bdial" title={`Running at ${gameSpeed}x — click for the next speed`}
              aria-label={`Speed ${gameSpeed}x, next speed`}
              onClick={() => { onSetSpeed(SPEEDS[(i + 1) % SPEEDS.length]); if (paused) onTogglePause(); }}>
        {img('clock', 'face')}
        {img('hand', 'hand', { transform: `rotate(${HAND_ANGLE[i]}deg)` })}
      </button>
      <div className="notches">
        {SPEEDS.map(s => (
          // Picking a speed resumes as well as selects, as the chips always did.
          <button key={s} className={`notch${gameSpeed === s ? ' on' : ''}`}
                  onClick={() => { onSetSpeed(s); if (paused) onTogglePause(); }}
                  title={paused ? `Resume at ${s}x` : `Run at ${s}x`}>
            {s}&times;
          </button>
        ))}
      </div>
    </div>
  );
};

export const BrassGauge: React.FC<{
  emblem: 'fuse' | 'brush' | 'magnifier';
  label: string; value: string; percent: number;
  liquid: 'amber' | 'moss' | 'brick';
  alarm?: boolean;
  onClick?: () => void; disabled?: boolean; title?: string; ariaLabel?: string;
}> = ({ emblem, label, value, percent, liquid, alarm, onClick, disabled, title, ariaLabel }) => {
  const body = (
    <>
      {img(emblem, 'emb')}
      <span className="top">
        <span className="lbl">{label}</span>
        <span className="val mono">{value}</span>
      </span>
      <span className="tube">
        {img('tube')}
        <span className={`liq ${alarm ? 'brick' : liquid}`}
              style={{ ['--p' as string]: Math.max(0, Math.min(1, percent / 100)) }} />
      </span>
    </>
  );
  return onClick
    ? <button type="button" className={`bgauge action${alarm ? ' alarm' : ''}`} onClick={onClick}
              disabled={disabled} title={title} aria-label={ariaLabel}>{body}</button>
    : <div className={`bgauge${alarm ? ' alarm' : ''}`} title={title}>{body}</div>;
};

export const BrassTicket: React.FC<{
  emblem: 'rosette' | 'laurel' | 'purse'; label: string; value: React.ReactNode;
  className?: string; title?: string;
}> = ({ emblem, label, value, className = '', title }) => (
  <div className={`bticket ${className}`} title={title}
       style={{ backgroundImage: `url(${BRASS.plate.src})` }}>
    {img(emblem, 'emb')}
    <span className="lbl">{label}</span>
    <span className="num mono">{value}</span>
  </div>
);

/** The brass strip along the header's lower edge. */
export const BrassRail: React.FC = () => (
  <div className="hud-rail" aria-hidden="true" style={{ backgroundImage: `url(${BRASS_RAIL.src})` }} />
);

export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Which painting for the weather and the season (weatherSheet.ts): four panels
 * per season, in rows spring, summer, autumn, winter. The tree always matches the
 * season; the sky matches the weather as closely as that season's four allow.
 */
const SCENE: Record<SeasonKey, Record<WeatherType, number>> = {
  //        panels:  0 clear · 1 cloudy · 2 rain  · 3 mist
  spring: { Sunny: 0, Cloudy: 1, Rainy: 2, Stormy: 2, Snowy: 1, Heatwave: 0, Foggy: 3 },
  //        panels:  4 clear · 5 clouds · 6 heat  · 7 thunderstorm
  summer: { Sunny: 4, Cloudy: 5, Rainy: 7, Stormy: 7, Snowy: 5, Heatwave: 6, Foggy: 5 },
  //        panels:  8 clear · 9 windy  · 10 rain · 11 fog
  autumn: { Sunny: 8, Cloudy: 9, Rainy: 10, Stormy: 10, Snowy: 11, Heatwave: 8, Foggy: 11 },
  //        panels: 12 frost · 13 overcast · 14 snowfall · 15 blizzard
  winter: { Sunny: 12, Cloudy: 13, Rainy: 13, Stormy: 15, Snowy: 14, Heatwave: 12, Foggy: 13 },
};
export const weatherScene = (type: WeatherType, season: SeasonKey): number => SCENE[season]?.[type] ?? 0;

/* The thermometer reads -5..40°C, the span the ambient model actually produces. */
const T_LO = -5, T_HI = 40;

export const WeatherGlass: React.FC<{
  season: SeasonKey; dateLine: string; temp: number; humidity: number;
  weather: { type: WeatherType; description: string };
}> = ({ season, dateLine, temp, humidity, weather }) => {
  const t = Math.max(0, Math.min(1, (temp - T_LO) / (T_HI - T_LO)));
  return (
    <div className="wglass">
      <div className="port">
        <img className="scene" src={WEATHER_SCENES[weatherScene(weather.type, season)]} alt={weather.type} draggable={false} />
        {img('porthole', 'frame')}
        {img(season, 'badge')}
      </div>
      <div className="thermo" title={`${temp.toFixed(0)}°C`}>
        {img('thermo')}
        <span className="merc" style={{ ['--t' as string]: t }} />
        <span className="bulb" />
      </div>
      <div className="wtext">
        <div className="season slab">{dateLine}</div>
        <div className="temp"><b>{temp.toFixed(0)}&deg;</b><span>C</span><em>{humidity.toFixed(0)}% RH</em></div>
        <div className="wx">{weather.type} &mdash; {weather.description}</div>
      </div>
    </div>
  );
};

/**
 * THE WATCH. One clock for the bench and the land: the hour and minute of the
 * world, and a ring of the day's light round the dial — gold from sunrise to
 * sunset at 45°N, dark for the rest — so how much of the day is left reads at a
 * glance before the numbers do. Drawn until the painted face arrives; every
 * reading is still printed beside it.
 */
export const BrassWatch: React.FC<{ minute: number; sunrise: number; sunset: number }> = ({ minute, sunrise, sunset }) => {
  const R = 30;
  const a24 = (m: number) => (m / 1440) * 360 - 90;
  const arc = (from: number, to: number, r: number) => {
    const p = (deg: number) => [32 + r * Math.cos((deg * Math.PI) / 180), 32 + r * Math.sin((deg * Math.PI) / 180)];
    const [x0, y0] = p(a24(from)), [x1, y1] = p(a24(to));
    const large = ((to - from + 1440) % 1440) > 720 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const h = (minute / 60) % 12;
  const hourDeg = h * 30 - 90, minDeg = (minute % 60) * 6 - 90;
  const hand = (deg: number, len: number) => [32 + len * Math.cos((deg * Math.PI) / 180), 32 + len * Math.sin((deg * Math.PI) / 180)];
  const [hx, hy] = hand(hourDeg, 12), [mx, my] = hand(minDeg, 19);
  const [sx, sy] = hand(a24(minute), R - 3);
  const day = minute >= sunrise && minute < sunset;
  const left = Math.max(0, sunset - Math.max(minute, sunrise));
  const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;
  return (
    <div className="bwatch" title="The world clock: the bench and the land keep the same time">
      <svg viewBox="0 0 64 64" className="face" aria-hidden="true">
        <defs>
          <radialGradient id="bwBezel" cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#f3dca0" /><stop offset="45%" stopColor="#c19a4e" /><stop offset="100%" stopColor="#6e5122" />
          </radialGradient>
          <radialGradient id="bwEnamel" cx="45%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#f6efdc" /><stop offset="100%" stopColor="#d9ccaa" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="31.5" fill="url(#bwBezel)" />
        <circle cx="32" cy="32" r="27" fill="#1b1713" />
        <path d={arc(sunrise, sunset, R - 3)} stroke="#e2c27a" strokeWidth="3.2" fill="none" strokeLinecap="round" opacity="0.95" />
        <path d={arc(sunset, sunrise + 1440, R - 3)} stroke="#2c3550" strokeWidth="3.2" fill="none" opacity="0.9" />
        <circle cx="32" cy="32" r="23.5" fill="url(#bwEnamel)" />
        {Array.from({ length: 12 }, (_, i) => {
          const d = i * 30 - 90, [x0, y0] = hand(d, 21.5), [x1, y1] = hand(d, i % 3 === 0 ? 18.5 : 19.8);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#3a2b18" strokeWidth={i % 3 === 0 ? 1.4 : 0.7} />;
        })}
        <text x="32" y="17.6" textAnchor="middle" className="rn">XII</text>
        <text x="32" y="50.4" textAnchor="middle" className="rn">VI</text>
        <line x1="32" y1="32" x2={hx} y2={hy} stroke="#241a0e" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="32" y1="32" x2={mx} y2={my} stroke="#241a0e" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="32" cy="32" r="1.8" fill="#8a6a32" />
        <circle cx={sx} cy={sy} r="2.3" fill={day ? '#ffe7a3' : '#b8c4e6'} stroke="#1b1713" strokeWidth="0.6" />
      </svg>
      <div className="wtext">
        <div className="t"><b>{hhmm(minute)}</b></div>
        <div className="l">{day ? `${Math.floor(left / 60)} h ${String(left % 60).padStart(2, '0')} of light` : `Dark · sunrise ${hhmm(sunrise)}`}</div>
      </div>
    </div>
  );
};

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
 * Which painted sky for the weather. The paintings are one hill under twelve
 * skies (weatherSheet.ts): 0 clear, 1 cloud, 2 rain, 3 snow, 4 golden, 5 fog,
 * 6 bright mist, 7 night storm, 8/10 wind and leaves, 9 day storm, 11 haze.
 */
export const weatherScene = (type: WeatherType, season: SeasonKey): number => {
  switch (type) {
    case 'Sunny':    return season === 'winter' ? 3 : season === 'autumn' ? 4 : 0;
    case 'Cloudy':   return season === 'winter' ? 3 : season === 'autumn' ? 10 : 1;
    case 'Rainy':    return 2;
    case 'Snowy':    return 3;
    case 'Heatwave': return 11;
    case 'Foggy':    return season === 'spring' || season === 'summer' ? 6 : 5;
    case 'Stormy':   return season === 'autumn' || season === 'winter' ? 7 : 9;
    default:         return 0;
  }
};

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

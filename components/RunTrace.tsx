import React from 'react';
import { Batch, Recipe, TelemetrySample } from '../types';
import { FAULT_LABELS, diagnoseBatch } from '../services/mastery';

/**
 * RUN TRACE — what actually happened, rather than what is happening.
 *
 * The simulation moves temperature, moisture, stress and enzyme activity every
 * tick, but the bench only ever showed the current instant. That made the sim a
 * black box: a batch could be ruined by a spike forty seconds ago and the only
 * evidence left was a bad score at the end.
 *
 * This draws the whole run against the band the recipe wanted, marks where it
 * left that band, and — once the batch is finished or spoiled — says plainly
 * what went wrong.
 */

interface RunTraceProps {
  batch: Batch;
  recipe: Recipe;
}

const W = 300;
const H = 64;

const RunTrace: React.FC<RunTraceProps> = ({ batch, recipe }) => {
  const history = batch.history ?? [];
  if (history.length < 3) {
    return (
      <div className="trace-empty">
        Telemetry starts recording once the culture is moving.
      </div>
    );
  }

  const ideal = recipe.idealParams.temp;
  // Enough range to show the ideal band plus whatever actually happened.
  const temps = history.map(h => h.temp);
  const lo = Math.min(ideal - 10, ...temps) - 2;
  const hi = Math.max(ideal + 10, ...temps) + 2;
  const span = Math.max(1, hi - lo);

  const x = (p: number) => (Math.min(100, p) / 100) * W;
  const y = (t: number) => H - ((t - lo) / span) * H;

  const line = (pick: (s: TelemetrySample) => number) =>
    history.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s.p).toFixed(1)} ${y(pick(s)).toFixed(1)}`).join(' ');

  // The band the recipe actually wants, +/- 5 C.
  const bandTop = y(ideal + 5);
  const bandH = Math.max(2, y(ideal - 5) - y(ideal + 5));

  const peakTemp = Math.max(...temps);
  const peakStress = Math.max(...history.map(h => h.stress));
  const outOfBand = history.filter(h => Math.abs(h.temp - ideal) > 5).length;
  const outPct = Math.round((outOfBand / history.length) * 100);

  const finished = batch.status !== 'active';
  const faults = finished ? diagnoseBatch(batch, recipe) : [];

  // The peak window, drawn so the player can see where they pulled it.
  const winX = x(recipe.peakWindowStart);
  const winW = Math.max(2, x(recipe.peakWindowEnd) - winX);

  return (
    <div className="trace">
      <div className="tr-head">
        <span className="l">Run trace</span>
        <span className="k">
          peak {peakTemp.toFixed(0)}° · {outPct}% off-target
          {peakStress > 5 && <> · stress {peakStress.toFixed(0)}</>}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="tr-svg" preserveAspectRatio="none" role="img"
           aria-label={`Temperature trace: peaked at ${peakTemp.toFixed(0)} degrees, ${outPct} percent of the run outside the target band.`}>
        {/* the band the recipe wants */}
        <rect x="0" y={bandTop} width={W} height={bandH} className="tr-band" />
        {/* the peak harvest window */}
        <rect x={winX} y="0" width={winW} height={H} className="tr-window" />
        {/* ideal line */}
        <line x1="0" y1={y(ideal)} x2={W} y2={y(ideal)} className="tr-ideal" />
        {/* what actually happened */}
        <path d={line(s => s.temp)} className="tr-temp" />
        {/* where it went wrong */}
        {history.map((s, i) =>
          s.stress > 25 ? <circle key={i} cx={x(s.p)} cy={y(s.temp)} r="1.8" className="tr-hot" /> : null
        )}
      </svg>

      <div className="tr-legend">
        <span><i className="sw band" /> wanted {ideal}°</span>
        <span><i className="sw win" /> pull window</span>
        <span><i className="sw temp" /> held</span>
      </div>

      {finished && (
        <div className={`tr-post${batch.status === 'spoiled' ? ' bad' : ''}`}>
          <span className="l">{batch.status === 'spoiled' ? 'What killed it' : 'Post-mortem'}</span>
          {faults.length === 0 ? (
            <p>Nothing went materially wrong. It was held where it wanted to be.</p>
          ) : (
            <ul>
              {/* The labels are phrases written to follow a plural verb in the
                  advice context ("3 of your last 5 runs came in sharp"), so they
                  are rendered here as standalone sentences rather than prefixed
                  with "It" — which produced "It thin — not enough umami." */}
              {faults.map(f => {
                const label = FAULT_LABELS[f] ?? f;
                return <li key={f}>{label.charAt(0).toUpperCase() + label.slice(1)}.</li>;
              })}
            </ul>
          )}
          {peakStress > 60 && (
            <p className="hot">
              Peaked at {peakTemp.toFixed(0)}° against a target of {ideal}° — the culture was cooking itself
              for {outPct}% of the run.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default RunTrace;

import React from 'react';
import GameIcon from './GameIcon';
import { LogEntry } from '../types';
import { describeEnzymes, describeLineage } from '../services/koji';
import { RECIPES } from '../constants';
import IngredientIcon from './IngredientIcon';
import { CloseIcon } from './icons';

/**
 * THE HARVEST REPORT
 *
 * What actually came out, and why.
 *
 * Harvesting used to produce a one-line toast — "sold for $214" — and then the
 * batch was gone. Everything the simulation had worked out about the run went
 * with it: how far off-target it had drifted, what the enzymes ended up as,
 * whether it was pulled inside the window, what the strain had become. The
 * player got a number and no way to learn from it.
 *
 * This is that record, shown once at harvest and kept in the archive
 * afterwards. One component for both, reading the same `LogEntry.record`, so
 * the thing you glance at when it happens and the thing you study a month later
 * cannot drift apart.
 */

interface HarvestReportProps {
  entry: LogEntry;
  /** Modal (just harvested) vs inline (expanded inside the archive). */
  variant?: 'modal' | 'inline';
  onClose?: () => void;
}

const Row: React.FC<{ k: string; children: React.ReactNode; tone?: string }> = ({ k, children, tone }) => (
  <div className="hr-row">
    <span className="k">{k}</span>
    <span className="v" style={tone ? { color: tone } : undefined}>{children}</span>
  </div>
);

/** How far the held value ended up from the target, phrased rather than signed. */
const drift = (held: number, target: number, unit: string) => {
  const d = held - target;
  if (Math.abs(d) < 1) return <span className="ok">on target</span>;
  return (
    <span className={Math.abs(d) > 6 ? 'bad' : 'warn'}>
      {d > 0 ? '+' : ''}{d.toFixed(1)}{unit} {d > 0 ? 'over' : 'under'}
    </span>
  );
};

export const HarvestReportBody: React.FC<{ entry: LogEntry }> = ({ entry }) => {
  const r = entry.record;

  // Entries written before the run record existed still render — they just have
  // less to say, which is honest.
  if (!r) {
    return (
      <div className="hr-body">
        <p className="hr-thin">
          This one was archived before the bench kept full run records. All that
          survives is the outcome.
        </p>
        <div className="hr-grid">
          <Row k="Substrate">{entry.substrateName}</Row>
          <Row k="Sold for" tone="var(--moss)">${entry.value.toLocaleString()}</Row>
        </div>
      </div>
    );
  }

  const pulledInWindow = r.peakPulledAt >= r.peakWindow[0] && r.peakPulledAt <= r.peakWindow[1];
  const enz = r.enzymes ? describeEnzymes(r.enzymes) : null;

  return (
    <div className="hr-body">
      {/* --- the verdict --- */}
      <div className="hr-verdict">
        <div className="sc">
          <span className={`n ${r.spoiled ? 'bad' : r.score >= 75 ? 'good' : r.score < 50 ? 'bad' : ''}`}>
            {r.spoiled ? '—' : r.score}
          </span>
          <span className="l">{r.spoiled ? 'Spoiled' : 'Score'}</span>
        </div>
        <div className="stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <GameIcon key={i} name="star" size={13} color="var(--amber)" style={{ opacity: (i < (entry.rating || 0)) ? 1 : 0.28 }} />
          ))}
        </div>
        <div className="paid">
          <span className="n">${entry.value.toLocaleString()}</span>
          <span className="l">{r.buyer}{r.renown > 0 ? ` · +${r.renown} renown` : ''}</span>
        </div>
      </div>

      {/* --- what it was --- */}
      <span className="hr-lbl">The batch</span>
      <div className="hr-grid">
        <Row k="Substrate">{entry.substrateName}</Row>
        <Row k="Vessel">{r.vesselName}</Row>
        <Row k="Mass">{r.massG >= 1000 ? `${(r.massG / 1000).toFixed(2)} kg` : `${r.massG} g`}</Row>
        <Row k="Pulled at">
          <span className={pulledInWindow ? 'ok' : 'warn'}>
            {r.peakPulledAt}%{pulledInWindow ? ' — in the window' : ` — window was ${r.peakWindow[0]}–${r.peakWindow[1]}%`}
          </span>
        </Row>
      </div>

      {/* --- how it was held --- */}
      <span className="hr-lbl">How it was held</span>
      <div className="hr-grid">
        <Row k="Temp">{r.held.temp.toFixed(1)}° · {drift(r.held.temp, r.target.temp, '°')}</Row>
        <Row k="Humidity">{r.held.humidity.toFixed(0)}% · {drift(r.held.humidity, r.target.humidity, ' pts')}</Row>
        <Row k="Salinity">{r.held.salinity.toFixed(1)}% · {drift(r.held.salinity, r.target.salinity, ' pts')}</Row>
        {r.offTargetPct !== undefined && (
          <Row k="Off-target">
            <span className={r.offTargetPct > 40 ? 'bad' : r.offTargetPct > 15 ? 'warn' : 'ok'}>
              {r.offTargetPct}% of the run
            </span>
          </Row>
        )}
        {r.peakTemp !== undefined && r.peakTemp > r.target.temp + 5 && (
          <Row k="Peaked at" tone="var(--brick)">{r.peakTemp.toFixed(0)}°</Row>
        )}
        {r.evenness !== undefined && r.evenness < 99.5 && (
          <Row k="Evenness">
            <span className={r.evenness < 55 ? 'bad' : r.evenness < 80 ? 'warn' : 'ok'}>
              {r.evenness.toFixed(0)}% — capped the score at {(100 - (100 - r.evenness) * 0.45).toFixed(0)}
            </span>
          </Row>
        )}
        {r.controls && (
          <Row k="Chamber">
            vent {['sealed', 'cracked', 'open', 'forced'][r.controls.vent]}
            {r.controls.mist > 0 && ` · mist ${['off', 'periodic', 'continuous'][r.controls.mist]}`}
            {r.controls.heat !== null && ` · held at ${r.controls.heat}°`}
          </Row>
        )}
      </div>

      {/* --- what it became ---
          The guard and the body disagreed: it opened on `enz || r.lineage` but
          the lineage line needs generation > 1, so a founder culture with no
          enzymes recorded printed the heading and nothing under it. Guard on
          exactly what will render. */}
      {(() => {
        const showEnz = !!enz;
        const showLineage = !!r.lineage && r.lineage.generation > 1;
        if (!showEnz && !showLineage) return null;
        return (
          <>
            <span className="hr-lbl">What it became</span>
            {showEnz && <p className="hr-prose">{enz!.label}. {enz!.detail}</p>}
            {showLineage && <p className="hr-prose">{describeLineage(r.lineage!)}</p>}
          </>
        );
      })()}

      {/* --- what went wrong --- */}
      <span className="hr-lbl">{r.spoiled ? 'What killed it' : 'Post-mortem'}</span>
      {r.faults.length === 0 ? (
        <p className="hr-prose ok">Nothing went materially wrong. It was held where it wanted to be.</p>
      ) : (
        <ul className="hr-faults">
          {r.faults.map((f, i) => (
            <li key={i}>{f.charAt(0).toUpperCase() + f.slice(1)}.</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const HarvestReport: React.FC<HarvestReportProps> = ({ entry, variant = 'modal', onClose }) => {
  // What came out of the vessel, as a picture. The log entry keeps the recipe it
  // was made from, and the recipe names its own output.
  const productId = entry.config
    ? RECIPES.find(r => r.id === entry.config!.recipeId)?.outputIngredientId
    : undefined;

  if (variant === 'inline') {
    return <div className="hreport inline"><HarvestReportBody entry={entry} /></div>;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="hreport" onClick={e => e.stopPropagation()}>
        <span className="corner c-tl" />
        <span className="corner c-br" />

        <div className="hr-head">
          {productId && <span className="hr-pic"><IngredientIcon id={productId} size={56} /></span>}
          <div>
            <span className="kicker">Harvested</span>
            <h2>{entry.recipeName}</h2>
          </div>
          {onClose && (
            <button className="close-stamp" onClick={onClose} aria-label="Close harvest report">
              <CloseIcon size={13} />
            </button>
          )}
        </div>

        <div className="hr-scroll custom-scrollbar">
          <HarvestReportBody entry={entry} />
        </div>

        <div className="hr-foot">
          <span className="note">Kept in the Vintage Archives.</span>
          {onClose && <button className="btn btn-amber" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  );
};

export default HarvestReport;

import React, { useEffect, useState } from 'react';
import PanelMark from './PanelMark';
import { CloseIcon } from './icons';
import { GameState } from '../types';
import { RECIPES, VESSELS } from '../constants';
import { describeFormula } from '../services/gameLogic';
import { MASTER, PRIMER_CLASSES, PRIMER_KNOWN, PrimerClass, primerClassOf } from '../constants.story';

/**
 * THE PRIMER — Mr. Master's book: a page for each class of ferment.
 *
 * The frame is the Codex's (a dark studio head over the leather-and-slate
 * panel, with the class list as its rail) and the page itself is printed stock,
 * because a book is paper. Each page ends in one worked example built from the
 * recipe matrix through `describeFormula` — so it cannot drift from what the
 * resolver actually accepts — and two small marks: made by the book, tried by
 * instinct. Class names are `primer-*`, not `pr-*`: `.pr-body` already belongs
 * to the press room.
 */
interface PrimerModalProps {
  gameState: GameState;
  onClose: () => void;
}

const PrimerModal: React.FC<PrimerModalProps> = ({ gameState, onClose }) => {
  const [sel, setSel] = useState(0);

  // Escape closes the Primer and only the Primer: it is opened over the Codex.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const analysed = gameState.analyzedRecipeIds ?? [];
  const doneBook = (c: PrimerClass) => analysed.includes(c.example);
  const doneInstinct = (c: PrimerClass) => analysed.some(id => primerClassOf(id) === c.type && !PRIMER_KNOWN.includes(id));

  const cls = PRIMER_CLASSES[sel];
  const rec = RECIPES.find(r => r.id === cls.example);
  const formula = describeFormula(cls.example);
  const vessel = rec && VESSELS.find(v => v.id === rec.requiredVesselId);
  const have = !!vessel && (gameState.ownedVessels?.[vessel.id] ?? 0) > 0;

  const row = (label: string, value: string | null | undefined) => value ? (
    <div className="primer-row">
      <span className="l">{label}</span>
      <span className="v">{value}</span>
    </div>
  ) : null;

  return (
    <div
      className="story-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="The Primer"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="wood-panel codex-panel primer-panel">
        <div className="studio-head">
          <span className="sh-medal"><PanelMark name="codex" size={34} /></span>
          <div className="sh-title">
            <span className="kicker">Mr. Master's notes</span>
            <h2>The Primer</h2>
          </div>
          <button onClick={onClose} className="close-stamp" title="Close (Esc)" aria-label="Close the Primer">
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="primer-body">
          <div className="primer-nav" role="tablist">
            {PRIMER_CLASSES.map((c, i) => (
              <button
                key={c.example}
                role="tab"
                aria-selected={i === sel}
                className={`primer-tab${i === sel ? ' on' : ''}`}
                onClick={() => setSel(i)}
              >
                <span>{c.name}</span>
                <span className="primer-dots" aria-hidden="true">
                  <i className={doneBook(c) ? 'on' : ''} />
                  <i className={doneInstinct(c) ? 'on' : ''} />
                </span>
              </button>
            ))}
          </div>

          <div className="primer-page">
            <h3>{cls.name}</h3>
            <p className="primer-what">{cls.what}</p>
            <h4>What it wants</h4>
            <p>{cls.wants}</p>
            <h4>The levers you hold</h4>
            <ul>
              {cls.levers.map((t, i) => <li key={i}>{t}</li>)}
            </ul>

            {rec && (
              <div className="primer-box">
                <h4>The example: {rec.name}</h4>
                {formula && row('Substrate', formula.substrateLabel)}
                {formula && row('Add', formula.addLabels.join(', ') || 'Nothing else')}
                {formula && row('Vessel', formula.vesselName)}
                {row('Kit', vessel ? (have ? `You have the ${vessel.name}.` : `Needs the ${vessel.name} ($${vessel.cost}).`) : null)}
                {row('At a glance', `${rec.idealParams.temp}°C · ${rec.idealParams.humidity}% humidity · ${rec.idealParams.salinity}% salt · difficulty ${rec.difficulty}`)}
                <span className={`primer-chip${doneBook(cls) ? ' on' : ''}`}>{doneBook(cls) ? 'Made by the book' : 'Not made yet'}</span>
              </div>
            )}

            <div className="primer-box">
              <h4>Or by instinct</h4>
              <p>{cls.instinct}</p>
              <span className={`primer-chip${doneInstinct(cls) ? ' on' : ''}`}>{doneInstinct(cls) ? 'Tried by instinct' : 'Not tried yet'}</span>
            </div>

            <p className="primer-margin">{cls.margin} <span>— {MASTER}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrimerModal;

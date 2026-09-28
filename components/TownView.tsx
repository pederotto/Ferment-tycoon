import React, { useEffect } from 'react';
import { GameState } from '../types';
import { BUYERS, SUPPLIERS, VESSELS } from '../constants';
import { TOWNSFOLK, TOWN_CHAPTER_AT, TOWN_CHAPTER_NAME, Townsperson, TownNeed } from '../constants.town';
import {
  currentStep, describeReward, errandsDone, needMet, needProgress, townChapter, townDone,
} from '../services/town';
import { TOWN_FACES } from './townFaceSheet';
import { CloseIcon } from './icons';

/**
 * THE TOWN
 *
 * The people behind the vendors. Each card is a note of what someone asked,
 * printed on stock because it is a piece of paper you carry about; the room
 * around it is dark like every other screen. You go back to them when you have
 * it, and what they give you is something the rest of the game already reads.
 */

interface TownViewProps {
  gameState: GameState;
  onClose: () => void;
  onReport: (personId: string) => void;
}

const linkName = (p: Townsperson): string | null => {
  const b = p.linked?.buyerId && BUYERS.find(x => x.id === p.linked!.buyerId)?.name;
  const s = p.linked?.supplierId && SUPPLIERS.find(x => x.id === p.linked!.supplierId)?.name;
  return [b, s].filter(Boolean).join(' · ') || null;
};

/** The button says what going back does. */
const actLabel = (need: TownNeed): string => {
  switch (need.kind) {
    case 'deliver': return `Hand over ${need.kg} kg`;
    case 'pay': return `Pay $${need.amount}`;
    default: return 'Go and tell them';
  }
};

const progressLine = (g: GameState, need: TownNeed): string => {
  const { have, want } = needProgress(g, need);
  const n = Math.min(have, want);
  switch (need.kind) {
    case 'deliver': return `${have} of ${want} kg of ${need.what} in the pantry`;
    case 'pay': return have >= want ? 'You have it' : `$${want - have} short`;
    case 'standing': return `Standing ${have} of ${want}`;
    case 'renown': return `Renown ${have} of ${want}`;
    case 'errands': return `${have} of ${want} errands done in town`;
    case 'sold': return `${n} of ${want} ${want === 1 ? 'sale' : 'sales'}`;
    case 'cooked': return `${n} of ${want} ${want === 1 ? 'batch' : 'batches'} scoring ${need.minScore}+`;
    case 'vessels': {
      const v = need.vesselId && VESSELS.find(x => x.id === need.vesselId)?.name;
      return v ? (have >= want ? `${v} owned` : `No ${v} yet`) : `${have} of ${want} vessels owned`;
    }
    case 'places': return `${have} of ${want} places on the estate`;
    case 'found': return `${have} of ${want} wild species found`;
    case 'tells': return `${have} of ${want} tells learned`;
  }
};

const PersonCard: React.FC<{ g: GameState; p: Townsperson; onReport: (id: string) => void }> = ({ g, p, onReport }) => {
  const done = townDone(g, p.id);
  const step = currentStep(g, p);
  const ready = !!step && needMet(g, step.need);
  const last = done > 0 ? p.steps[done - 1] : null;
  const link = linkName(p);
  return (
    <article className={`tw-card${ready ? ' ready' : ''}${!step ? ' finished stamped' : ''}`}>
      <div className="tw-face"><img src={TOWN_FACES[p.face]} alt="" draggable={false} /></div>
      <div className="tw-main">
        <header>
          <h3>{p.name}</h3>
          <span className="tw-trade">{p.trade}</span>
          {step && <span className="tw-steps" aria-label={`${done} of ${p.steps.length} errands done`}>
            {p.steps.map((_, i) => <i key={i} className={i < done ? 'on' : ''} />)}
          </span>}
        </header>
        <p className="tw-where">{p.where}</p>
        {step ? (
          <>
            <p className="tw-ask">“{step.ask}”</p>
            <div className="tw-foot">
              <span className={`tw-prog${ready ? ' met' : ''}`}>{progressLine(g, step.need)}</span>
              <span className="tw-reward">{describeReward(step.reward).join(' · ')}</span>
            </div>
            <button className="btn btn-amber tw-go" disabled={!ready} onClick={() => onReport(p.id)}>
              {ready ? actLabel(step.need) : 'Not yet'}
            </button>
          </>
        ) : (
          <p className="tw-ask said">“{last?.thanks}”</p>
        )}
        {step && last && <p className="tw-last">Last time: “{last.thanks}”</p>}
        {link && <span className="tw-link">Speaks for {link}</span>}
      </div>
      {!step && <span className="tw-stamp">Friend of the house</span>}
    </article>
  );
};

const TownView: React.FC<TownViewProps> = ({ gameState: g, onClose, onReport }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chapter = townChapter(g);
  const done = errandsDone(g);
  const total = TOWNSFOLK.reduce((a, p) => a + p.steps.length, 0);
  const next = chapter < 3 ? TOWN_CHAPTER_AT[(chapter + 1) as 2 | 3] : null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="townview">
        <div className="tw-head">
          <span className="sh-medal tw-medal"><img src={TOWN_FACES.crier} alt="" draggable={false} /></span>
          <div className="sh-title">
            <span className="kicker">Chapter {chapter} · {TOWN_CHAPTER_NAME[chapter]}</span>
            <h2>The Town</h2>
          </div>
          <div className="sh-plates">
            <div className="sh-plate"><span className="l">Errands</span><span className="v">{done}<small> / {total}</small></span></div>
          </div>
          <button className="close-stamp" onClick={onClose} aria-label="Close the town">
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="tw-body custom-scrollbar">
          {([1, 2, 3] as const).filter(c => c <= chapter).reverse().map(c => (
            <section key={c}>
              <span className="ob-lbl">Chapter {c} · {TOWN_CHAPTER_NAME[c]}</span>
              <div className="tw-grid">
                {TOWNSFOLK.filter(p => p.chapter === c).map(p => <PersonCard key={p.id} g={g} p={p} onReport={onReport} />)}
              </div>
            </section>
          ))}
          {next !== null && (
            <p className="ob-empty tw-more">
              More of the town will speak to you after {next} errands. {next - done} to go.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TownView;

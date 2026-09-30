import React, { useEffect } from 'react';
import { ArrowRightIcon } from './icons';
import { MASTER, StoryCardData } from '../constants.story';

/**
 * A STORY CARD — a chapter opening, the first bill, the gift of the Primer.
 *
 * It is printed stock (`letter-paper`): a note Mr. Master has left on the bench,
 * not a panel of the room, and a pop-up you read over a painting is paper. The
 * clock is held while it is up (App.tsx). The beat was recorded as seen the
 * moment it fired, so nothing is lost by dismissing it any way at all: the button,
 * a click on the backdrop, or Escape — like every other modal. Escape is taken in
 * the capture phase and stopped, so it closes THIS card and not the Codex or
 * Supply that may be open behind it.
 */
interface StoryCardProps {
  card: StoryCardData;
  onClose: () => void;
}

const StoryCard: React.FC<StoryCardProps> = ({ card, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="story-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={card.title}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      // The button is focused on arrival, so Space is a natural way to say
      // "understood" — and Space is also the game's pause key. Let it press the
      // button and stop there, or the run comes back from the card paused.
      onKeyDown={e => { if (e.code === 'Space') e.stopPropagation(); }}
    >
      <div className="welcome-card letter-card letter-paper story-card">
        <div className="kicker">{card.kicker}</div>
        <h2 className="story-title">{card.title}</h2>
        <div className="letter-body">
          {card.paras.map((t, i) => <p key={i}>{t}</p>)}
        </div>
        <div className="letter-sign">— {MASTER}</div>
        <div className="letter-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="welcome-cta" type="button" autoFocus onClick={onClose}>
            {card.cta}
            <ArrowRightIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryCard;

import React, { useState } from 'react';
import GameIcon from './GameIcon';
import { ArrowRightIcon } from './icons';
import { CREST } from './titleArt';
import { LAB_PLATE } from './labPlate';
import { INITIAL_MONEY } from '../constants';
import { calculateOverheads } from '../services/gameLogic';
import { LETTER_PAGES, MASTER } from '../constants.story';

/**
 * CHAPTER 0 — THE LETTER.
 *
 * What the title screen becomes after "Begin": whose name goes over the door,
 * the letter in three pages, and the terms. It is the same scene as the title
 * card (the workshop plate behind it) because nothing has happened yet: the
 * world clock is stopped while the title screen is up, so reading costs no game
 * time. The name is handed to `onDone` and saved with the run (`playerName`).
 *
 * The name card is the title screen's own (charcoal plaster). The letter and the
 * terms are printed stock, because a letter is paper: `letter-paper`.
 */

export type LetterPhase = 'name' | 'p0' | 'p1' | 'p2' | 'p3';

interface LetterSceneProps {
    phase: LetterPhase;
    setPhase: (p: 'title' | LetterPhase) => void;
    onDone: (playerName: string) => void;
}

/** Pages of the letter, then the terms. */
const ORDER: LetterPhase[] = ['p0', 'p1', 'p2', 'p3'];

const LetterScene: React.FC<LetterSceneProps> = ({ phase, setPhase, onDone }) => {
    const [name, setName] = useState('');
    const clean = name.trim().slice(0, 24);
    const who = clean || 'Partner';
    // What the terms page promises, read off the game's own numbers: the
    // opening bench is two jars and a tray, and the till is INITIAL_MONEY.
    const bills = calculateOverheads({ mason_jar: 2, koji_tray: 1 }, 0, 0).total;
    const weeks = Math.floor(INITIAL_MONEY / bills);
    const at = ORDER.indexOf(phase);
    const art = { ['--art' as string]: `url(${LAB_PLATE})`, ['--art-tall' as string]: `url(${LAB_PLATE})` };

    // A plain function call, never a component: a component defined here would be
    // a new type every render, remounting the card and losing the caret.
    const shell = (inner: React.ReactNode) => (
        <div className="welcome-scene fixed inset-0 z-[100] flex items-center justify-center p-4 select-none overflow-hidden" style={art}>
            <div className="grain" />
            {inner}
        </div>
    );

    if (phase === 'name') {
        return shell(
            <div className="welcome-card letter-name">
                <span className="crest-mark sh-medal"><img src={CREST} alt="" aria-hidden="true" /></span>
                <div className="kicker">A letter is waiting</div>
                <h2>Whose name goes over the door?</h2>
                <p className="sub">It will be on the envelope, and on the bill.</p>
                <input
                    className="letter-input"
                    autoFocus
                    maxLength={24}
                    value={name}
                    placeholder="Your name"
                    aria-label="Your name"
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && clean) setPhase('p0'); }}
                />
                <button className="welcome-cta" type="button" disabled={!clean} onClick={() => { if (clean) setPhase('p0'); }}>
                    OPEN THE LETTER
                    <ArrowRightIcon size={16} />
                </button>
            </div>
        );
    }

    const dots = (
        <div className="letter-dots" aria-hidden="true">
            {ORDER.map((p, i) => <i key={p} className={i === at ? 'on' : ''} />)}
        </div>
    );

    if (phase === 'p3') {
        return shell(
            <div className="welcome-card letter-card letter-paper">
                <div className="letter-to">The terms</div>
                <div className="ledger-lines" style={{ textAlign: 'left' }}>
                    <div className="ledger-line">
                        <div className="ic"><GameIcon name="money" size={16} /></div>
                        <div>
                            <div className="t">${INITIAL_MONEY.toLocaleString()} in the till</div>
                            <div className="d">{`About ${weeks} weeks of runway if you do nothing, which is not the plan.`}</div>
                        </div>
                    </div>
                    <div className="ledger-line">
                        <div className="ic"><GameIcon name="calendar" size={16} /></div>
                        <div>
                            <div className="t">${bills} a week</div>
                            <div className="d">Rent and upkeep. It falls due whether or not anything is growing.</div>
                        </div>
                    </div>
                    <div className="ledger-line">
                        <div className="ic"><GameIcon name="flask" size={16} /></div>
                        <div>
                            <div className="t">A bench</div>
                            <div className="d">A cedar tray, two glass jars and a little koji. Everything else is earned.</div>
                        </div>
                    </div>
                    <div className="ledger-line">
                        <div className="ic"><GameIcon name="archives" size={16} color="#8a9a6b" /></div>
                        <div>
                            <div className="t">The rest of the house</div>
                            <div className="d">The town, the estate and the wild open as you do, in that order.</div>
                        </div>
                    </div>
                </div>
                <div className="letter-actions">
                    <button className="letter-link" type="button" onClick={() => setPhase('p2')}>Back</button>
                    <button className="welcome-cta" type="button" onClick={() => onDone(clean)}>
                        TO THE BENCH
                        <ArrowRightIcon size={16} />
                    </button>
                </div>
                {dots}
            </div>
        );
    }

    const page = LETTER_PAGES[at] || LETTER_PAGES[0];
    const last = at === LETTER_PAGES.length - 1;
    return shell(
        <div className="welcome-card letter-card letter-paper">
            <div className="letter-to">To {who}</div>
            <div className="letter-body">
                {page.map((t, i) => <p key={i}>{t}</p>)}
            </div>
            {last && <div className="letter-sign">— {MASTER}</div>}
            <div className="letter-actions">
                <button className="letter-link" type="button" onClick={() => setPhase(at === 0 ? 'name' : ORDER[at - 1])}>Back</button>
                <button className="letter-link" type="button" onClick={() => setPhase('p3')}>Skip the letter</button>
                <button className="welcome-cta" type="button" onClick={() => setPhase(ORDER[at + 1])}>
                    {last ? 'THE TERMS' : 'TURN THE PAGE'}
                    <ArrowRightIcon size={16} />
                </button>
            </div>
            {dots}
        </div>
    );
};

export default LetterScene;

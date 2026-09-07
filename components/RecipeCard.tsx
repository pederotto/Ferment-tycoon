import React from 'react';
import { Recipe, RecipeMastery, RecipeKnowledge } from '../types';
import { BOOK_ADVICE, BOOKS, MASTERY_RUNG_TITLES } from '../constants';
import { describeFormula } from '../services/gameLogic';
import { getMasteryLadder, benchAdvice, xpToNextLevel, masteryReveal } from '../services/mastery';
import { CloseIcon, BookIcon } from './icons';
import { Lightbulb, HelpCircle } from 'lucide-react';

/**
 * THE RECIPE CARD
 *
 * Everything you know about one recipe, in one place, from two clearly separated
 * sources:
 *
 *   FROM THE BOOK   Authored, bought, identical for everyone. Available the
 *                   moment the book is on the shelf. It is about the craft.
 *   FROM YOUR BENCH Generated from your own runs on this recipe — your average,
 *                   your best, and what your batches keep getting wrong. No book
 *                   can tell you this, because it is about you.
 *
 * This also exists to get the guidance OUT of the Inoculation Bench, where it
 * had grown to 650px of reading stacked on top of the Seal button.
 */

interface RecipeCardProps {
  recipe: Recipe;
  knowledge: RecipeKnowledge;
  mastery: RecipeMastery;
  ownedBookIds: string[];
  onClose: () => void;
}

const EMPTY: RecipeMastery = { xp: 0, level: 0, cooks: 0, bestScore: 0, avgScore: 0, recent: [] };

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, knowledge, mastery, ownedBookIds, onClose }) => {
  const m = mastery ?? EMPTY;
  const handLevel = knowledge === 'unknown' ? m.level : Math.max(1, m.level);
  const formula = knowledge !== 'unknown' ? describeFormula(recipe.id) : null;
  const ladder = getMasteryLadder(recipe, handLevel, m.cooks);
  const earned = ladder.filter(r => r.earned);
  const next = ladder.find(r => !r.earned) ?? null;
  const toNext = xpToNextLevel({ ...m, level: handLevel });
  const bench = benchAdvice(m, recipe);
  const reveal = masteryReveal(recipe, handLevel);

  const teachingBook = BOOKS.find(b => b.teaches.includes(recipe.id));
  const ownsBook = !!teachingBook && ownedBookIds.includes(teachingBook.id);
  const bookText = BOOK_ADVICE[recipe.id];
  // The book's advice is yours once you own the book, or once you have run the
  // recipe often enough to have worked it out for yourself.
  const showBookText = !!bookText && (ownsBook || knowledge === 'analyzed');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="reccard" onClick={e => e.stopPropagation()}>
        <span className="corner c-tl" />
        <span className="corner c-br" />

        <div className="rc-head">
          <div>
            <span className="type">{recipe.type}</span>
            <h2>{knowledge === 'unknown' ? 'Unknown Protocol' : recipe.name}</h2>
            <p className="sub">
              {knowledge === 'unknown'
                ? 'Buy the formula in a book, or stumble onto the combination yourself.'
                : recipe.description}
            </p>
          </div>
          <button className="close-stamp" onClick={onClose} aria-label="Close recipe card">
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="rc-body custom-scrollbar">
          {/* --- what it is made of --- */}
          {formula && (
            <section className="rc-sec">
              <span className="rc-lbl">The formula</span>
              <div className="formula-card" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <div className="frow"><span className="k">Base</span><span className="n">{formula.substrateLabel}</span></div>
                {formula.addLabels.length > 0 && (
                  <div className="frow"><span className="k">Add</span><span className="n">{formula.addLabels.join(' · ')}</span></div>
                )}
                {formula.forbidLabels.length > 0 && (
                  <div className="frow"><span className="k">Without</span><span className="n brick">{formula.forbidLabels.join(' · ')}</span></div>
                )}
                <div className="frow"><span className="k">In</span><span className="n">{formula.vesselName}</span></div>
                <div className="frow"><span className="k">Target</span><span className="n">{reveal.temp} · {reveal.humidity} · {reveal.salinity} salt</span></div>
                <div className="frow"><span className="k">Pull at</span><span className="n">{reveal.window}</span></div>
              </div>
            </section>
          )}

          {/* --- FROM THE BOOK --- */}
          <section className="rc-sec">
            <span className="rc-lbl book">
              <BookIcon size={12} color="var(--plum)" /> From the book
              {teachingBook && <em> · {teachingBook.title}</em>}
            </span>
            {showBookText ? (
              <p className="rc-prose">“{bookText}”</p>
            ) : (
              <p className="rc-locked">
                <HelpCircle size={12} />
                {teachingBook
                  ? `Written up in ${teachingBook.title}. Buy it from the Bindery and this fills in.`
                  : 'No published account of this one. You will have to work it out at the bench.'}
              </p>
            )}
          </section>

          {/* --- FROM YOUR BENCH --- */}
          <section className="rc-sec">
            <span className="rc-lbl bench">
              <Lightbulb size={12} color="var(--brass)" /> From your bench
              {m.cooks > 0 && <em> · {m.cooks} run{m.cooks === 1 ? '' : 's'}</em>}
            </span>

            {m.cooks === 0 ? (
              <p className="rc-locked">
                <HelpCircle size={12} />
                You have not made this yet. Run it and the bench starts keeping score.
              </p>
            ) : (
              <>
                <div className="rc-scores">
                  <span className="sc"><span className="l">Average</span><span className={`n ${m.avgScore >= 75 ? 'good' : m.avgScore < 55 ? 'bad' : ''}`}>{m.avgScore.toFixed(0)}</span></span>
                  <span className="sc"><span className="l">Best</span><span className="n good">{m.bestScore}</span></span>
                  <span className="sc"><span className="l">Hand</span><span className="n">{handLevel} / 5</span></span>
                </div>

                <ul className="rc-diag">
                  {bench.map((line, i) => <li key={i}>{line}</li>)}
                </ul>

                {m.recent.length > 0 && (
                  <div className="rc-recent">
                    <span className="l">Last runs</span>
                    <div className="runs">
                      {m.recent.map((r, i) => (
                        <span key={i} className={`run ${r.score >= 75 ? 'good' : r.score < 50 ? 'bad' : ''}`}
                              title={r.faults.length ? r.faults.join(', ') : 'nothing notable went wrong'}>
                          {r.score}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* --- the earned ladder --- */}
          {earned.length > 0 && (
            <section className="rc-sec">
              <span className="rc-lbl">What you have worked out</span>
              {earned.map(rung => (
                <div key={rung.level} className="rc-rung">
                  <span className="rt">{rung.level}. {rung.title}</span>
                  <p>{rung.body}</p>
                  {rung.rows && (
                    <div className="ladder"><div className="rrows">
                      {rung.rows.map(r => (
                        <span key={r.k} className="rrow"><span className="k">{r.k}</span><span className="n">{r.n}</span></span>
                      ))}
                    </div></div>
                  )}
                </div>
              ))}
              {next && (
                <div className="rc-rung sealed">
                  <span className="rt">{next.level}. {MASTERY_RUNG_TITLES[next.level]}</span>
                  <p>{toNext !== null && toNext > 0
                    ? `Sealed — ${toNext} more xp on this recipe.`
                    : 'Sealed — needs a run scoring 80 or better.'}</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeCard;

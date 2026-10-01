import React from 'react';
import PanelMark from './PanelMark';
import { GameState } from '../types';
import { CloseIcon, CheckIcon } from './icons';
import { CHAPTER_TITLES, MASTER, PRIMER_EXAMPLES, STEP_NOTES, hasKojiProduct, instinctDone, madeKoji } from '../constants.story';

/**
 * FIRST CULTURE — a guided opening, not a tour.
 *
 * The game asks a lot up front: enzymes, terroir ceilings, market saturation,
 * heat, reputation, mastery. It used to drop you in with $1,800 and no
 * indication of what any of it was for.
 *
 * This deliberately does NOT take control. It is a checklist that watches the
 * game state and advances by itself, so it can be ignored entirely and never
 * blocks a click. Each step says what to do and, more importantly, why — the
 * "why" is the part that transfers to recipes it never mentions.
 *
 * It is split by chapter now (constants.story.ts): chapter 1 is the six koji
 * steps, chapter 2 is the Primer. The header names the chapter and counts within
 * it, and each step carries a margin note from Mr. Master.
 */

interface FirstCultureProps {
  gameState: GameState;
  onDismiss: () => void;
  /** Opens the Primer, for the step that asks the player to read it. */
  onOpenPrimer?: () => void;
}

interface Step {
  id: string;
  /** Which chapter of the story this step belongs to. */
  ch: number;
  /** A button the step offers under its text. Only 'primer' exists. */
  action?: 'primer';
  title: string;
  body: string;
  done: (g: GameState) => boolean;
}

/** Did the player ever hold a chamber at something other than its defaults? */
const hasTouchedChamber = (g: GameState) =>
  g.batches.some(b => b.controls && (b.controls.vent > 0 || b.controls.mist > 0)) ||
  g.logbook.some(l => l.record?.controls && (l.record.controls.vent > 0 || l.record.controls.mist > 0));

/** A koji has been made and kept or sold: nothing about the bed can be asked of the player now. */
const kojiBeen = (g: GameState) => hasKojiProduct(g) || madeKoji(g);

const STEPS: Step[] = [
  {
    id: 'inoculate',
    ch: 1,
    title: 'Grow a koji',
    body: 'Open a bench slot. Pearl barley plus A. Oryzae spores, in the Cedar Tray. Koji is not a product — it is the enzyme factory everything else runs on.',
    done: g => g.batches.length > 0 || g.logbook.length > 0,
  },
  {
    id: 'fill',
    ch: 1,
    title: 'Fill the vessel',
    body: 'Set your proportions, then press "Fill to capacity at these proportions" under the fill bar. A half-full vessel costs the same weeks of rent as a full one, so it is rent paid for nothing. The button scales everything at once and leaves your ratios alone.',
    // Keeping a koji removes the batch and logs it with no record, so without the
    // koji fallback this step un-completed the moment the first koji was kept and
    // the guide jumped back to it for good.
    done: g => g.batches.some(b => (b.totalMass ?? 0) > 1200) || g.logbook.some(l => (l.record?.massG ?? 0) > 1200) || kojiBeen(g),
  },
  {
    id: 'steer',
    ch: 1,
    title: 'Decide what it will be',
    body: 'Before you seal it, look at the steering bar. Warm and wet grows amylase, which turns starch into sugar. Cool and dry grows protease, which frees the amino acids that taste savoury. The same spore makes either — you are choosing, not waiting.',
    done: g => g.batches.some(b => (b.enzymes?.amylase ?? 0) + (b.enzymes?.protease ?? 0) > 20) || kojiBeen(g),
  },
  {
    id: 'chamber',
    ch: 1,
    title: 'Hold it where you want it',
    body: 'Inspect the batch and find the Chamber panel. Vent sheds heat — and moisture with it. Mist adds water and cools as it evaporates, but only as fast as the vent carries it away. Run both: humidity holds while the temperature drops. That is the only route to a cool, damp bed, and to a properly savoury koji.',
    done: g => hasTouchedChamber(g) || kojiBeen(g),
  },
  {
    id: 'watch',
    ch: 1,
    title: 'Read the trace',
    body: 'The run trace draws the whole batch against the band it wanted, not just this instant. A bed ruined by a spike forty seconds ago looks fine right now — the trace is where you see it. Dots mark where it was under real stress.',
    done: g => g.batches.some(b => b.progress > 40) || kojiBeen(g),
  },
  {
    id: 'cellar',
    ch: 1,
    title: 'Keep it, do not sell it',
    body: 'When it is ready, press Keep rather than Sell. Selling a koji throws away the reason you grew it; keeping turns it into an ingredient carrying the exact enzymes you just steered.',
    done: kojiBeen,
  },
  {
    id: 'read',
    ch: 2,
    action: 'primer',
    title: 'Read the Primer',
    body: 'Open the Codex and press Read the Primer, or use the button below. It has a page for each kind of ferment: what the microbe wants, the levers you hold, and one example to follow.',
    // A save from before the story was never handed the book, so it cannot be
    // asked to read it.
    done: g => !!g.story?.primerRead || !!g.story?.seen?.includes('legacy'),
  },
  {
    id: 'book',
    ch: 2,
    title: 'Make one by the book',
    body: 'Pick one example from the Primer and make it as written. The miso uses the koji you kept: soybeans from Silk Road Imports, salt from Nordic, and a jar you already own. Sauerkraut needs an onggi first. Tepache and kombucha need only a jar.',
    done: g => PRIMER_EXAMPLES.some(id => g.analyzedRecipeIds.includes(id)),
  },
  {
    id: 'instinct',
    ch: 2,
    title: 'Then make one from instinct',
    body: 'Now make something the Primer does not name. Choose a page, use its principle, and improvise: a firm vegetable, a little salt, a jar. The bench names whatever you have made.',
    done: g => instinctDone(g),
  },
  {
    id: 'sell',
    ch: 2,
    title: 'Find a buyer',
    body: 'Harvest it and read the offers. Clean stock goes to the licensed trade; ruined stock is worth more to a fence. Every sale cools the market for that type, so vary what you make.',
    done: g => g.logbook.some(l => (l.value ?? 0) > 0),
  },
  {
    id: 'report',
    ch: 2,
    title: 'Read the post-mortem',
    body: 'Every harvest opens a report: where you pulled it against its window, how far each parameter drifted, and what went wrong. It is kept in the Vintage Archives. This is what makes the next batch better — a score alone never tells you why.',
    done: g => g.logbook.some(l => !!l.record),
  },
  {
    id: 'lineage',
    ch: 2,
    title: 'Breed your own strain',
    body: 'Sporulate a good bed instead of harvesting it. The spores inherit the conditions you held it at — warm and damp selects amylase, cool and dry selects protease — so a few generations in, you are running a house strain no shop sells.',
    done: g => g.customIngredients.some(i => (i.lineage?.generation ?? 0) > 1),
  },
];

/**
 * Each step as the player stands now: done once, done for good. The tests above
 * read live state, which moves under the player — the batch is kept, the koji is
 * spent in a miso — and a step that un-completed sent the guide back to it, so a
 * finished step is latched in `story.guideDone` (see `latchGuide`).
 */
const stepFlags = (g: GameState) => {
  const latched = g.story?.guideDone ?? [];
  return STEPS.map(s => latched.includes(s.id) || s.done(g));
};

/** Ids of steps that are done now and not yet latched; empty almost always. */
export const guideNewlyDone = (g: GameState): string[] => {
  const latched = g.story?.guideDone ?? [];
  const flags = stepFlags(g);
  return STEPS.filter((s, i) => flags[i] && !latched.includes(s.id)).map(s => s.id);
};

/** Pure, so it can run inside a state updater. Returns the same object when there is nothing to add. */
export const latchGuide = (g: GameState): GameState => {
  const add = guideNewlyDone(g);
  if (!add.length) return g;
  return { ...g, story: { ...(g.story ?? { seen: [] }), guideDone: [...(g.story?.guideDone ?? []), ...add] } };
};

/**
 * How far through the guide a run is. `complete` means it has nothing left to
 * say, which is when it should retire rather than sit there empty.
 */
export const guideProgress = (g: GameState) => {
  const done = stepFlags(g).filter(Boolean).length;
  return { done, total: STEPS.length, complete: done === STEPS.length };
};

const FirstCulture: React.FC<FirstCultureProps> = ({ gameState, onDismiss, onOpenPrimer }) => {
  const doneFlags = stepFlags(gameState);
  const currentIdx = doneFlags.findIndex(d => !d);
  if (currentIdx === -1) return null; // finished; App stops rendering it

  const current = STEPS[currentIdx];
  // The header counts within the chapter the player is in, not the whole guide.
  const chapterSteps = STEPS.filter(s => s.ch === current.ch);
  const chapterDone = chapterSteps.filter(s => doneFlags[STEPS.indexOf(s)]).length;
  // Steps can be satisfied out of order — you might sell something before you
  // ever touch the chamber — so "last done" is the nearest completed step behind
  // the current one, not simply the one before it in the list.
  const lastDone = (() => {
    for (let i = currentIdx - 1; i >= 0; i--) if (doneFlags[i]) return STEPS[i];
    return null;
  })();

  return (
    <div className="firstrun">
      <div className="fr-head">
        <PanelMark name="first" size={30} />
        <span className="l">Chapter {current.ch} · {CHAPTER_TITLES[current.ch]} · {chapterDone}/{chapterSteps.length}</span>
        <button className="close-stamp" style={{ width: 22, height: 22 }} onClick={onDismiss} aria-label="Dismiss the guide">
          <CloseIcon size={10} />
        </button>
      </div>

      <div className="fr-track">
        {STEPS.map((s, i) => (
          <span key={s.id} className={`fr-pip${doneFlags[i] ? ' done' : i === currentIdx ? ' now' : ''}`} title={s.title} />
        ))}
      </div>

      <h4>{current.title}</h4>
      <p>{current.body}</p>
      {STEP_NOTES[current.id] && <p className="fr-note">{STEP_NOTES[current.id]} <span>— {MASTER}</span></p>}
      {current.action === 'primer' && gameState.ownedBookIds.includes('primer_bench') && (
        <button className="btn btn-amber sm fr-act" type="button" onClick={onOpenPrimer}>Read the Primer</button>
      )}

      {lastDone && (
        <div className="fr-last">
          <CheckIcon size={10} color="var(--moss)" /> {lastDone.title}
        </div>
      )}
    </div>
  );
};

export default FirstCulture;

import React from 'react';
import PanelMark from './PanelMark';
import { GameState } from '../types';
import { INGREDIENTS } from '../constants';
import { CloseIcon, CheckIcon } from './icons';

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
 */

interface FirstCultureProps {
  gameState: GameState;
  onDismiss: () => void;
}

interface Step {
  id: string;
  title: string;
  body: string;
  done: (g: GameState) => boolean;
}

const hasKojiProduct = (g: GameState) =>
  Object.entries(g.inventory).some(([id, n]) =>
    n > 0 && (g.customIngredients.some(c => c.id === id && c.enzymes) ||
              INGREDIENTS.some(i => i.id === id && i.enzymes)));

/** Did the player ever hold a chamber at something other than its defaults? */
const hasTouchedChamber = (g: GameState) =>
  g.batches.some(b => b.controls && (b.controls.vent > 0 || b.controls.mist > 0)) ||
  g.logbook.some(l => l.record?.controls && (l.record.controls.vent > 0 || l.record.controls.mist > 0));

const STEPS: Step[] = [
  {
    id: 'inoculate',
    title: 'Grow a koji',
    body: 'Open a bench slot. Pearl barley plus A. Oryzae spores, in the Cedar Tray. Koji is not a product — it is the enzyme factory everything else runs on.',
    done: g => g.batches.length > 0 || g.logbook.length > 0,
  },
  {
    id: 'fill',
    title: 'Fill the vessel',
    body: 'Set your proportions, then press "Fill to capacity at these proportions" under the fill bar. A half-full vessel costs the same weeks of rent as a full one, so it is rent paid for nothing. The button scales everything at once and leaves your ratios alone.',
    done: g => g.batches.some(b => (b.totalMass ?? 0) > 1200) || g.logbook.some(l => (l.record?.massG ?? 0) > 1200),
  },
  {
    id: 'steer',
    title: 'Decide what it will be',
    body: 'Before you seal it, look at the steering bar. Warm and wet grows amylase, which turns starch into sugar. Cool and dry grows protease, which frees the amino acids that taste savoury. The same spore makes either — you are choosing, not waiting.',
    done: g => g.batches.some(b => (b.enzymes?.amylase ?? 0) + (b.enzymes?.protease ?? 0) > 20) || hasKojiProduct(g),
  },
  {
    id: 'chamber',
    title: 'Hold it where you want it',
    body: 'Inspect the batch and find the Chamber panel. Vent sheds heat — and moisture with it. Mist adds water and cools as it evaporates, but only as fast as the vent carries it away. Run both: humidity holds while the temperature drops. That is the only route to a cool, damp bed, and to a properly savoury koji.',
    done: g => hasTouchedChamber(g) || hasKojiProduct(g),
  },
  {
    id: 'watch',
    title: 'Read the trace',
    body: 'The run trace draws the whole batch against the band it wanted, not just this instant. A bed ruined by a spike forty seconds ago looks fine right now — the trace is where you see it. Dots mark where it was under real stress.',
    done: g => g.batches.some(b => b.progress > 40) || hasKojiProduct(g),
  },
  {
    id: 'cellar',
    title: 'Keep it, do not sell it',
    body: 'When it is ready, press Keep rather than Sell. Selling a koji throws away the reason you grew it; keeping turns it into an ingredient carrying the exact enzymes you just steered.',
    done: hasKojiProduct,
  },
  {
    id: 'use',
    title: 'Spend the enzymes',
    body: 'Now make something with it: soybeans, your koji, and salt, in a jar or crock. Protein plus protease is umami. Without the koji the beans stay beans.',
    done: g => g.logbook.some(l => !/koji/i.test(l.recipeName)),
  },
  {
    id: 'sell',
    title: 'Find a buyer',
    body: 'Harvest it and read the offers. Clean stock goes to the licensed trade; ruined stock is worth more to a fence. Every sale cools the market for that type, so vary what you make.',
    done: g => g.logbook.some(l => (l.value ?? 0) > 0),
  },
  {
    id: 'report',
    title: 'Read the post-mortem',
    body: 'Every harvest opens a report: where you pulled it against its window, how far each parameter drifted, and what went wrong. It is kept in the Vintage Archives. This is what makes the next batch better — a score alone never tells you why.',
    done: g => g.logbook.some(l => !!l.record),
  },
  {
    id: 'lineage',
    title: 'Breed your own strain',
    body: 'Sporulate a good bed instead of harvesting it. The spores inherit the conditions you held it at — warm and damp selects amylase, cool and dry selects protease — so a few generations in, you are running a house strain no shop sells.',
    done: g => g.customIngredients.some(i => (i.lineage?.generation ?? 0) > 1),
  },
];

/**
 * How far through the guide a run is. `complete` means it has nothing left to
 * say, which is when it should retire rather than sit there empty.
 */
export const guideProgress = (g: GameState) => {
  const done = STEPS.filter(step => step.done(g)).length;
  return { done, total: STEPS.length, complete: done === STEPS.length };
};

const FirstCulture: React.FC<FirstCultureProps> = ({ gameState, onDismiss }) => {
  const doneFlags = STEPS.map(s => s.done(gameState));
  const currentIdx = doneFlags.findIndex(d => !d);
  if (currentIdx === -1) return null; // finished; App stops rendering it

  const current = STEPS[currentIdx];
  const completed = doneFlags.filter(Boolean).length;
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
        <span className="l">First culture · {completed}/{STEPS.length}</span>
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

      {lastDone && (
        <div className="fr-last">
          <CheckIcon size={10} color="var(--moss)" /> {lastDone.title}
        </div>
      )}
    </div>
  );
};

export default FirstCulture;

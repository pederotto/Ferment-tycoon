import React from 'react';
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

const STEPS: Step[] = [
  {
    id: 'inoculate',
    title: 'Grow a koji',
    body: 'Open a bench slot. Pearl barley plus A. Oryzae spores, in the Cedar Tray. Koji is not a product — it is the enzyme factory everything else runs on.',
    done: g => g.batches.length > 0 || g.logbook.length > 0,
  },
  {
    id: 'steer',
    title: 'Decide what it will be',
    body: 'Before you seal it, look at the steering bar. Warm and wet grows amylase, which turns starch into sugar. Cool and dry grows protease, which frees the amino acids that taste savoury. The same spore makes either.',
    done: g => g.batches.some(b => (b.enzymes?.amylase ?? 0) + (b.enzymes?.protease ?? 0) > 20) || hasKojiProduct(g),
  },
  {
    id: 'watch',
    title: 'Watch it work',
    body: 'Inspect the running batch. The trace shows the whole run against the band it wants. A koji bed makes its own heat — if it climbs, prop the lid to let it go.',
    done: g => g.batches.some(b => b.progress > 40) || hasKojiProduct(g),
  },
  {
    id: 'cellar',
    title: 'Keep it, do not sell it',
    body: 'When it is ready, open the harvest studio and Stock in Cellar. Selling a koji wastes it. Cellaring turns it into an ingredient carrying the exact enzymes you grew.',
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
];

const FirstCulture: React.FC<FirstCultureProps> = ({ gameState, onDismiss }) => {
  const doneFlags = STEPS.map(s => s.done(gameState));
  const currentIdx = doneFlags.findIndex(d => !d);
  if (currentIdx === -1) return null; // finished; App stops rendering it

  const current = STEPS[currentIdx];
  const completed = doneFlags.filter(Boolean).length;

  return (
    <div className="firstrun">
      <div className="fr-head">
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

      {completed > 0 && (
        <div className="fr-last">
          <CheckIcon size={10} color="var(--moss)" /> {STEPS[currentIdx - 1]?.title}
        </div>
      )}
    </div>
  );
};

export default FirstCulture;

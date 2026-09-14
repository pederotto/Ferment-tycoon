import React from 'react';
import GameIcon from './GameIcon';
import { Ingredient, Vessel, Recipe, IngredientType } from '../types';
import { masteryReveal } from '../services/mastery';
import { recipesUsing, getRecipeKnowledge } from '../services/gameLogic';
import { describeEnzymes, suggestPairing } from '../services/koji';
import { Pin } from 'lucide-react';
import { getIngredientIcon } from './icons';
import IngredientIcon from './IngredientIcon';
import VesselArt from './VesselArt';

export type ScanTarget =
  | { type: 'ingredient'; data: Ingredient }
  | { type: 'vessel'; data: Vessel }
  | { type: 'recipe'; data: Recipe; masteryLevel?: number };

interface MolecularScanProps {
  target: ScanTarget;
  className?: string;
  embedded?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
  /**
   * Draw large, with the uses section — the click-to-open form rather than the
   * hover readout. Hovering wants to be small and fast; opening one deliberately
   * wants the picture big enough to look at and the question "what do I make
   * with this" answered.
   */
  full?: boolean;
  /** What the player has actually met, so uses can be revealed rather than told. */
  knowledge?: {
    unlockedRecipes: string[];
    analyzedRecipeIds: string[];
    ownedBookIds: string[];
  };
}

/**
 * THE SPECTROMETER
 *
 * Rebuilt rather than restyled. The old version had three problems that made it
 * close to useless:
 *
 *   - renderBar took a `label` argument and never rendered it, so five bars were
 *     distinguished by a small icon alone.
 *   - It knew nothing about starch, enzymes, strain bias or acid protection —
 *     i.e. nothing about the system that now decides every purchase and batch.
 *   - It printed the internal id (`bm_mackerel`) to the player.
 *
 * It now answers the only question worth asking of an ingredient: what is this
 * FOR. Numbers are still there, but the reading comes first.
 */

const Bar: React.FC<{ label: string; value: number; max?: number; tone: string; hint?: string }> = ({
  label, value, max = 10, tone, hint,
}) => (
  <div className="sc-bar" title={hint}>
    <span className="sc-lab">{label}</span>
    <span className="sc-track">
      <span className="sc-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: tone }} />
    </span>
    <span className="sc-val" style={{ color: tone }}>{Math.round(value)}</span>
  </div>
);

/** The one-line answer to "what is this for". */
function readIngredient(i: Ingredient): string {
  const h = i.hiddenStats;
  if (i.enzymes) {
    const d = describeEnzymes(i.enzymes);
    return `${d.label}. ${d.detail}`;
  }
  if (i.strainBias !== undefined) {
    return i.strainBias >= 0.7
      ? 'Bred for amylase. Run it warm and it turns starch into sugar.'
      : i.strainBias <= 0.3
        ? 'Bred for protease. Run it cool and it frees glutamate — umami.'
        : 'An even-handed strain. Where you run it decides what it becomes.';
  }
  if (i.type === IngredientType.ADDITIVE) {
    if (h.nativeSalinity > 50) return 'Salt. Osmotic protection, and it slows everything down.';
    return 'An additive. It shapes the environment rather than the flavour.';
  }
  const protein = h.proteinContent, starch = h.starchContent;
  if (protein >= 7 && starch <= 2) return 'Protein-rich, no starch. Needs a protease koji to become umami; an amylase koji is wasted on it.';
  if (starch >= 7 && protein <= 4) return 'Starch-rich, little protein. Wants an amylase koji — this is what sweetness and alcohol are made from.';
  if (protein >= 6 && starch >= 5) return 'Protein and starch both. Works with either koji, and rewards a balanced one.';
  if (h.microbialDiversity >= 7) return 'Carries a lot of wild life of its own. Expect funk, and expect it to be less predictable.';
  return 'Modest on every axis. Cheap bulk rather than a headline ingredient.';
}

const MolecularScan: React.FC<MolecularScanProps> = ({
  target, className = '', embedded = false, pinned = false, onTogglePin, full, knowledge,
}) => {
  const { type, data } = target;

  /* MARKS PRINTED ON PAPER, NOT GLOWING IN A DARK ROOM.
     The opened form is a label on light stock; the hover readout is a panel in
     a dark room. The room's amber on cream is mud, so the full form takes the
     same hues darkened to print. The tone reaches the bar as an inline style,
     so this cannot be a CSS override. */
  const T = full
    ? {
        moss: 'var(--ink-moss)', amber: 'var(--ink-amber)', brass: '#8a6a1f',
        brick: '#9c4429', teal: 'var(--ink-teal)', plum: 'var(--ink-plum)',
      }
    : {
        moss: 'var(--moss)', amber: 'var(--amber)', brass: 'var(--brass)',
        brick: 'var(--brick)', teal: 'var(--teal)', plum: 'var(--plum)',
      };

  const Head = () => {
    const Glyph = type === 'ingredient' ? getIngredientIcon(data as Ingredient) : null;
    return (
      <div className="sc-head">
        <div className="sc-id">
          <span className="sc-glyph">
            {type === 'vessel'
              ? <VesselArt vesselId={(data as Vessel).id} height={full ? 84 : 30} />
              : Glyph
                ? <IngredientIcon id={(data as Ingredient).id} size={full ? 84 : 30} fallback={Glyph} />
                : <GameIcon name="search" size={14} color="currentColor" />}
          </span>
          <div style={{ minWidth: 0 }}>
            <span className="sc-kicker">
              {type === 'ingredient' ? (data as Ingredient).type.toLowerCase()
                : type === 'vessel' ? 'vessel' : 'projected ferment'}
            </span>
            <h2>{data.name}</h2>
          </div>
        </div>
        {onTogglePin && (
          <button className={`sc-pin${pinned ? ' on' : ''}`} onClick={onTogglePin}
                  aria-label={pinned ? 'Unpin this scan' : 'Pin this scan to compare'}>
            {pinned ? <GameIcon name="unpin" size={12} /> : <GameIcon name="pin" size={12} />}
          </button>
        )}
      </div>
    );
  };

  const body = () => {
    switch (type) {
      case 'ingredient': {
        const i = data as Ingredient;
        const h = i.hiddenStats;
        return (
          <>
            <p className="sc-read">{readIngredient(i)}</p>
            <div className="sc-bars">
              <Bar label="Protein" value={h.proteinContent} tone={T.moss} hint="Protease converts this into glutamate — umami." />
              <Bar label="Starch" value={h.starchContent} tone={T.amber} hint="Amylase converts this into sugar." />
              <Bar label="Sugar" value={h.sugarContent} tone={T.brass} hint="Free sugar, already sweet and already fermentable." />
              <Bar label="Fat" value={h.fatContent} tone={T.brick} hint="Above 4, heat without salt turns this rancid." />
              <Bar label="Salt" value={h.nativeSalinity} max={100} tone={T.teal} hint="Salinity the ingredient brings by itself." />
              <Bar label="Wild" value={h.microbialDiversity} tone={T.plum} hint="Native microbial life. Funk, and unpredictability." />
            </div>
            {(() => {
              const pair = suggestPairing(i);
              if (!pair) return null;
              return (
                <div className="sc-pair">
                  <span className="ph">{pair.headline}</span>
                  {pair.partners.map((p, n) => (
                    <span key={n} className="pr">
                      <span className="w">{p.what}</span>
                      <span className="r">{p.ratio}</span>
                      <span className="y">{p.why}</span>
                    </span>
                  ))}
                </div>
              );
            })()}

            <div className="sc-facts">
              {i.enzymes && (
                <span className="f hi">amylase {i.enzymes.amylase} · protease {i.enzymes.protease}</span>
              )}
              {i.acidProtection ? <span className="f">citric shield {i.acidProtection}</span> : null}
              <span className="f">quality {i.quality}</span>
              <span className="f">{i.mass >= 1000 ? `${(i.mass / 1000).toFixed(1)}kg` : `${i.mass}${i.unitDisplay}`} per unit</span>
              {i.contraband && <span className="f bad">contraband{i.heatPerUnit ? ` · +${i.heatPerUnit} heat` : ''}</span>}
            </div>
          </>
        );
      }
      case 'vessel': {
        const v = data as Vessel;
        const insul = v.insulationFactor;
        return (
          <>
            <p className="sc-read">
              {insul >= 0.6
                ? 'Heavily insulated. Holds temperature well — and will cook a koji bed in its own heat unless you vent it.'
                : insul <= 0.25
                  ? 'Open and breathable. Sheds heat and moisture to the room, which is what a koji tray wants.'
                  : 'Moderately insulated. Forgiving for pastes and brines.'}
            </p>
            <div className="sc-bars">
              <Bar label="Insulation" value={insul * 10} tone={T.teal} hint="How strongly it resists the room's temperature." />
            </div>
            <div className="sc-facts">
              <span className="f hi">{v.capacityL}L capacity</span>
              <span className="f">{v.slotsRequired} bench slot{v.slotsRequired > 1 ? 's' : ''}</span>
              <span className={`f${v.powerDraw ? ' warn' : ''}`}>{v.powerDraw ? `${v.powerDraw}W draw` : 'no power'}</span>
              <span className="f">${v.cost}</span>
            </div>
          </>
        );
      }
      case 'recipe': {
        const r = data as Recipe;
        const rev = masteryReveal(r, target.masteryLevel ?? 0);
        return (
          <>
            <p className="sc-read">{r.description}</p>
            <div className="sc-facts">
              <span className="f hi">{rev.temp}</span>
              <span className="f hi">{rev.humidity}</span>
              <span className="f hi">{rev.salinity} salt</span>
              <span className="f">pull {rev.window}</span>
              <span className="f">difficulty {r.difficulty}</span>
            </div>
            {(target.masteryLevel ?? 0) < 3 && (
              <p className="sc-gated">Run it more and these figures sharpen up.</p>
            )}
          </>
        );
      }
    }
  };

  /**
   * WHAT YOU MAKE WITH IT.
   *
   * Only in the opened form. A hover readout answering "what is this" should not
   * also be teaching the recipe book — and a player who has not met a ferment
   * should not learn its name from a shopping list. So a recipe you know is
   * named; one you have not met is a shape: its family, and that it wants this
   * ingredient. That is enough to be a lead without being an answer.
   */
  const Uses = () => {
    if (!full || type !== 'ingredient') return null;
    const uses = recipesUsing(data as Ingredient);
    if (uses.length === 0) return null;

    const k = knowledge;
    const rows = uses.map(u => ({
      ...u,
      known: k
        ? getRecipeKnowledge(u.recipe.id, k.unlockedRecipes, k.analyzedRecipeIds, k.ownedBookIds) !== 'unknown'
        : false,
    }));
    const named = rows.filter(r => r.known);
    const hidden = rows.length - named.length;

    return (
      <div className="sc-uses">
        <div className="sc-uses-h">What it goes into</div>
        {named.length === 0 && (
          <p className="sc-uses-none">
            Nothing you have met yet. Run a batch with it, or read a book, and
            what it belongs in will show up here.
          </p>
        )}
        {named.map(r => (
          <div key={r.recipe.id} className="sc-use">
            <span className="n">{r.recipe.name}</span>
            <span className="r">{r.role === 'substrate' ? 'as the substrate' : 'as a component'}</span>
          </div>
        ))}
        {hidden > 0 && (
          <p className="sc-uses-more">
            {hidden} more {hidden === 1 ? 'ferment uses' : 'ferments use'} this, still
            unread. Mastery and the Codex open them.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={`scan${embedded ? ' embedded' : ' floating'}${full ? ' full' : ''} ${className}`}>
      <Head />
      <div className="sc-body">{body()}<Uses /></div>
    </div>
  );
};

export default MolecularScan;

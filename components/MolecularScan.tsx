import React from 'react';
import { Ingredient, Vessel, Recipe, IngredientType } from '../types';
import { masteryReveal } from '../services/mastery';
import { describeEnzymes, suggestPairing } from '../services/koji';
import { Pin, PinOff } from 'lucide-react';
import { SearchIcon, getIngredientIcon, VesselLineIcon } from './icons';

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
  target, className = '', embedded = false, pinned = false, onTogglePin,
}) => {
  const { type, data } = target;

  const Head = () => {
    const Glyph = type === 'ingredient' ? getIngredientIcon(data as Ingredient) : null;
    return (
      <div className="sc-head">
        <div className="sc-id">
          <span className="sc-glyph">
            {type === 'vessel'
              ? <VesselLineIcon vesselId={(data as Vessel).id} size={16} color="currentColor" />
              : Glyph
                ? <Glyph size={16} color="currentColor" />
                : <SearchIcon size={14} color="currentColor" />}
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
            {pinned ? <PinOff size={12} /> : <Pin size={12} />}
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
              <Bar label="Protein" value={h.proteinContent} tone="var(--moss)" hint="Protease converts this into glutamate — umami." />
              <Bar label="Starch" value={h.starchContent} tone="var(--amber)" hint="Amylase converts this into sugar." />
              <Bar label="Sugar" value={h.sugarContent} tone="var(--brass)" hint="Free sugar, already sweet and already fermentable." />
              <Bar label="Fat" value={h.fatContent} tone="var(--brick)" hint="Above 4, heat without salt turns this rancid." />
              <Bar label="Salt" value={h.nativeSalinity} max={100} tone="var(--teal)" hint="Salinity the ingredient brings by itself." />
              <Bar label="Wild" value={h.microbialDiversity} tone="var(--plum)" hint="Native microbial life. Funk, and unpredictability." />
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
              <Bar label="Insulation" value={insul * 10} tone="var(--teal)" hint="How strongly it resists the room's temperature." />
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

  return (
    <div className={`scan${embedded ? ' embedded' : ' floating'} ${className}`}>
      <Head />
      <div className="sc-body">{body()}</div>
    </div>
  );
};

export default MolecularScan;

import React from 'react';
import { INGREDIENT_SHEET, SHEET_COLS, SHEET_CELL_W, SHEET_CELL_H, sheetIndex } from './ingredientSheet';
import { PRODUCT_SHEET, PRODUCT_COLS, PRODUCT_CELL, productIndex } from './productSheet';
import {
  PANTRY_ING_SHEET, PANTRY_PRODUCT_SHEET, PANTRY_COLS, PANTRY_CELL, pantryIngIndex, pantryProductIndex,
} from './pantrySheet';
import { GRAIN_IDS, CORN_IDS } from '../constants.heritage';

const HERITAGE_KOJI_GRAINS: string[] = [...GRAIN_IDS, ...CORN_IDS];
import { artFor } from './IngredientArt';

/**
 * ONE INGREDIENT — OR ONE FINISHED PRODUCT — DRAWN.
 *
 * Five sources, in order: the painted ingredient sheet, the painted product
 * sheet (which also answers for every generated recipe's output, folded onto its
 * family), the two pantry sheets (`pantrySheet.ts`, exact ids only), the
 * hand-authored SVG for anything none of them carries, and the generic glyph as
 * a floor. Nothing ever renders empty, so adding to either sheet is
 * additive and a missing cell is invisible rather than broken.
 *
 * Sliced with background-position rather than by cropping to a canvas, so the
 * whole pantry is one decoded image however many rows are on screen. The product
 * cells carry alpha, so a jar sits on label stock without a plate behind it.
 */

interface Props {
  id: string;
  /** Rendered width in px. Height follows the cell's own aspect. */
  size?: number;
  fallback?: React.FC<{ size?: number; color?: string }>;
  className?: string;
}

/* Each sheet is registered once as a class. Inlining `url(<data URI>)` in every
   icon's style put the whole half-megabyte sheet into each element's style
   attribute — 111 rows in Supply carried 57 MB of style text and the screen took
   over a second to open. */
if (typeof document !== 'undefined' && !document.getElementById('ing-icon-sheets')) {
  const tag = document.createElement('style');
  tag.id = 'ing-icon-sheets';
  tag.textContent = `.ing-icon.sheet-ing{background-image:url("${INGREDIENT_SHEET}")}`
    + `.ing-icon.sheet-product{background-image:url("${PRODUCT_SHEET}")}`;
  document.head.appendChild(tag);
}
/* The pantry sheets get a tag of their own: the guard above skips injection when
   its id is already in the document, so under hot reload a rule added to that
   tag would not appear until a full page load. */
if (typeof document !== 'undefined' && !document.getElementById('pantry-icon-sheets')) {
  const tag = document.createElement('style');
  tag.id = 'pantry-icon-sheets';
  tag.textContent = `.ing-icon.sheet-pantry-ing{background-image:url("${PANTRY_ING_SHEET}")}`
    + `.ing-icon.sheet-pantry-product{background-image:url("${PANTRY_PRODUCT_SHEET}")}`;
  document.head.appendChild(tag);
}

const Sliced: React.FC<{
  sheet: 'ing' | 'product' | 'pantry-ing' | 'pantry-product'; cols: number; cw: number; ch: number; index: number; size: number; className?: string;
}> = ({ sheet, cols, cw, ch, index, size, className }) => {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const k = size / cw;                       // one scale for the whole sheet
  return (
    <span
      className={`ing-icon sheet-${sheet}${className ? ' ' + className : ''}`}
      role="img"
      aria-hidden="true"
      style={{
        width: size,
        height: ch * k,
        backgroundSize: `${cw * cols * k}px auto`,
        backgroundPosition: `-${col * cw * k}px -${row * ch * k}px`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

const LIQUID_BOTTLES: [RegExp, string][] = [
  [/^amino_|^tamari_amino|^moromi_cask/, 'pulse_amino_bottle'],
  [/^garum_fish_sauce/, 'fish_sauce'],
  [/^garum_tomato/, 'tomato_garum_bottle'],
  [/^garum_rose/, 'rose_garum'],
  [/^garum_/, 'colatura_bottle'],
  [/^brine_|^buttermilk_/, 'brined_fruit_jar'],
  [/^sake_pressed|^amazake/, 'grain_sake_bottle'],
  [/^wine_pressed/, 'country_wine_bottle'],
  [/^mead_pressed/, 'mead_bottle'],
  [/^kvass_|^tepache_|^chicha_|^makgeolli_|^brew_/, 'kvass_bottle'],
  [/^vinegar_raw/, 'fruit_vinegar_bottle'],
  [/^kombucha_strained/, 'kombucha_jar'],
  [/^ponzu_strained/, 'ponzu_bottle'],
];

const IngredientIcon: React.FC<Props> = ({ id, size = 30, fallback, className }) => {
  const i = sheetIndex(id);
  if (i >= 0) {
    return <Sliced sheet="ing" cols={SHEET_COLS} cw={SHEET_CELL_W} ch={SHEET_CELL_H}
                   index={i} size={size} className={className} />;
  }

  const p = productIndex(id);
  if (p >= 0) {
    return <Sliced sheet="product" cols={PRODUCT_COLS} cw={PRODUCT_CELL} ch={PRODUCT_CELL}
                   index={p} size={size} className={`product${className ? ' ' + className : ''}`} />;
  }

  // The pantry sheets are exact-id lookups, so they come before the pattern
  // fallbacks below: a painted cell for an id beats a family's borrowed picture.
  // No pantry id is on either older sheet, so nothing above can be shadowed.
  const pantryI = pantryIngIndex(id);
  if (pantryI >= 0) {
    return <Sliced sheet="pantry-ing" cols={PANTRY_COLS} cw={PANTRY_CELL} ch={PANTRY_CELL}
                   index={pantryI} size={size} className={className} />;
  }

  const pantryP = pantryProductIndex(id);
  if (pantryP >= 0) {
    return <Sliced sheet="pantry-product" cols={PANTRY_COLS} cw={PANTRY_CELL} ch={PANTRY_CELL}
                   index={pantryP} size={size} className={`product${className ? ' ' + className : ''}`} />;
  }

  // Koji the player grows is minted per bed (`koji_<substrate>_a6_p4`) and matches
  // no cell, so every grown bed drew nothing. A bed on a heritage grain or a
  // landrace corn is the heritage tray; every other bed is the barley koji.
  if (/^koji_.*_a\d+_p\d+$/.test(id)) {
    const substrate = id.replace(/^koji_/, '').replace(/_a\d+_p\d+$/, '');
    const heritage = HERITAGE_KOJI_GRAINS.includes(substrate) ? productIndex('heritage_koji_tray') : -1;
    if (heritage >= 0) return <Sliced sheet="product" cols={PRODUCT_COLS} cw={PRODUCT_CELL} ch={PRODUCT_CELL}
                                      index={heritage} size={size} className={`product${className ? ' ' + className : ''}`} />;
    const k = sheetIndex('barley_koji');
    if (k >= 0) return <Sliced sheet="ing" cols={SHEET_COLS} cw={SHEET_CELL_W} ch={SHEET_CELL_H}
                               index={k} size={size} className={className} />;
  }

  // Liquids a press mints from a batch (services/massBalance.ts) carry a family
  // prefix and a strength suffix, so no two share an id; each borrows the bottle
  // of its family from the product sheet.
  for (const [re, cell] of LIQUID_BOTTLES) {
    if (re.test(id)) {
      const pi = productIndex(cell);
      if (pi >= 0) return <Sliced sheet="product" cols={PRODUCT_COLS} cw={PRODUCT_CELL} ch={PRODUCT_CELL}
                                  index={pi} size={size} className={`product${className ? ' ' + className : ''}`} />;
    }
  }

  const Drawn = artFor(id) ?? fallback;
  return Drawn ? <Drawn size={Math.round(size * 0.8)} color="currentColor" /> : null;
};

export default IngredientIcon;

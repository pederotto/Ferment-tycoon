import React from 'react';
import { INGREDIENT_SHEET, SHEET_COLS, SHEET_CELL_W, SHEET_CELL_H, sheetIndex } from './ingredientSheet';
import { PRODUCT_SHEET, PRODUCT_COLS, PRODUCT_CELL, productIndex } from './productSheet';
import { GRAIN_IDS, CORN_IDS } from '../constants.heritage';

const HERITAGE_KOJI_GRAINS: string[] = [...GRAIN_IDS, ...CORN_IDS];
import { artFor } from './IngredientArt';

/**
 * ONE INGREDIENT — OR ONE FINISHED PRODUCT — DRAWN.
 *
 * Four sources, in order: the painted ingredient sheet, the painted product
 * sheet (which also answers for every generated recipe's output, folded onto its
 * family), the hand-authored SVG for anything neither carries, and the generic
 * glyph as a floor. Nothing ever renders empty, so adding to either sheet is
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

const Sliced: React.FC<{
  sheet: 'ing' | 'product'; cols: number; cw: number; ch: number; index: number; size: number; className?: string;
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

  const Drawn = artFor(id) ?? fallback;
  return Drawn ? <Drawn size={Math.round(size * 0.8)} color="currentColor" /> : null;
};

export default IngredientIcon;

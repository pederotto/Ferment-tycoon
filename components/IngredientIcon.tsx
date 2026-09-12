import React from 'react';
import { INGREDIENT_SHEET, SHEET_COLS, SHEET_CELL_W, SHEET_CELL_H, sheetIndex } from './ingredientSheet';
import { PRODUCT_SHEET, PRODUCT_COLS, PRODUCT_CELL, productIndex } from './productSheet';
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

const Sliced: React.FC<{
  sheet: string; cols: number; cw: number; ch: number; index: number; size: number; className?: string;
}> = ({ sheet, cols, cw, ch, index, size, className }) => {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const k = size / cw;                       // one scale for the whole sheet
  return (
    <span
      className={`ing-icon${className ? ' ' + className : ''}`}
      role="img"
      aria-hidden="true"
      style={{
        width: size,
        height: ch * k,
        backgroundImage: `url(${sheet})`,
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
    return <Sliced sheet={INGREDIENT_SHEET} cols={SHEET_COLS} cw={SHEET_CELL_W} ch={SHEET_CELL_H}
                   index={i} size={size} className={className} />;
  }

  const p = productIndex(id);
  if (p >= 0) {
    return <Sliced sheet={PRODUCT_SHEET} cols={PRODUCT_COLS} cw={PRODUCT_CELL} ch={PRODUCT_CELL}
                   index={p} size={size} className={`product${className ? ' ' + className : ''}`} />;
  }

  const Drawn = artFor(id) ?? fallback;
  return Drawn ? <Drawn size={Math.round(size * 0.8)} color="currentColor" /> : null;
};

export default IngredientIcon;

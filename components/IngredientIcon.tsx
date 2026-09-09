import React from 'react';
import { INGREDIENT_SHEET, SHEET_COLS, SHEET_CELL_W, SHEET_CELL_H, sheetIndex } from './ingredientSheet';
import { artFor } from './IngredientArt';

/**
 * ONE INGREDIENT, DRAWN.
 *
 * Three sources, in order of preference: the painted sheet, the hand-authored
 * SVG for anything the sheet does not carry, and the generic glyph as a floor.
 * Nothing ever renders empty, so adding to the sheet is additive and a missing
 * cell is invisible rather than broken.
 *
 * Sliced with background-position rather than by cropping to a canvas, so the
 * whole pantry is one decoded image in memory however many rows are on screen.
 */

interface Props {
  id: string;
  /** Rendered width in px. Height follows the cell's own aspect. */
  size?: number;
  fallback?: React.FC<{ size?: number; color?: string }>;
  className?: string;
}

const IngredientIcon: React.FC<Props> = ({ id, size = 30, fallback, className }) => {
  const i = sheetIndex(id);

  if (i >= 0) {
    const col = i % SHEET_COLS;
    const row = Math.floor(i / SHEET_COLS);
    const k = size / SHEET_CELL_W;          // one scale for the whole sheet
    return (
      <span
        className={`ing-icon${className ? ' ' + className : ''}`}
        role="img"
        aria-hidden="true"
        style={{
          width: size,
          height: SHEET_CELL_H * k,
          backgroundImage: `url(${INGREDIENT_SHEET})`,
          backgroundSize: `${SHEET_CELL_W * SHEET_COLS * k}px auto`,
          backgroundPosition: `-${col * SHEET_CELL_W * k}px -${row * SHEET_CELL_H * k}px`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    );
  }

  const Drawn = artFor(id) ?? fallback;
  return Drawn ? <Drawn size={Math.round(size * 0.8)} color="currentColor" /> : null;
};

export default IngredientIcon;

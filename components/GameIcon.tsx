import React from 'react';
import { ICON_SHEET, ICON_COLS, ICON_CELL, ICON_ORDER, IconName } from './iconSheet';

/**
 * ONE ICON FROM THE ENGRAVED SET.
 *
 * Drawn as a MASK filled with `currentColor`, not as a picture, so a single
 * sheet serves every surface the game has: ink on paper, brass in the rails,
 * amber when something is running. Inherits colour like a glyph, so nothing has
 * to be told what shade it is standing on.
 */
const GameIcon: React.FC<{ name: IconName; size?: number; className?: string }> = ({ name, size = 16, className }) => {
  const i = ICON_ORDER.indexOf(name);
  if (i < 0) return null;
  const col = i % ICON_COLS;
  const row = Math.floor(i / ICON_COLS);
  const k = size / ICON_CELL;
  const mask = {
    maskImage: `url(${ICON_SHEET})`,
    WebkitMaskImage: `url(${ICON_SHEET})`,
    maskSize: `${ICON_CELL * ICON_COLS * k}px auto`,
    WebkitMaskSize: `${ICON_CELL * ICON_COLS * k}px auto`,
    maskPosition: `-${col * ICON_CELL * k}px -${row * ICON_CELL * k}px`,
    WebkitMaskPosition: `-${col * ICON_CELL * k}px -${row * ICON_CELL * k}px`,
  } as React.CSSProperties;
  return (
    <span
      className={`gicon${className ? ' ' + className : ''}`}
      role="img"
      aria-hidden="true"
      style={{ width: size, height: size, ...mask }}
    />
  );
};

export default GameIcon;

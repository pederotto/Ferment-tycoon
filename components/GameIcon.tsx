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
interface GameIconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Fills the mask. Omit to inherit, which is what an icon beside text wants. */
  color?: string;
  style?: React.CSSProperties;
  /** Only for an icon that carries meaning on its own (a warning with no text). */
  label?: string;
}

/* THE SHEET IS REGISTERED ONCE, NOT INLINED PER ICON.
   The mask used to be `url(<the 363 KB data URI>)` in every icon's style
   attribute, so a screen with thirty icons parsed eleven megabytes of CSS text
   to draw them, and Supply took over a second to open. One rule carries it now;
   the inline style is size and position only. */
if (typeof document !== 'undefined' && !document.getElementById('gicon-sheet')) {
  const tag = document.createElement('style');
  tag.id = 'gicon-sheet';
  tag.textContent = `.gicon{-webkit-mask-image:url("${ICON_SHEET}");mask-image:url("${ICON_SHEET}")}`;
  document.head.appendChild(tag);
}

const GameIcon: React.FC<GameIconProps> = ({ name, size = 16, className, color, style, label }) => {
  const i = ICON_ORDER.indexOf(name);
  if (i < 0) return null;
  const col = i % ICON_COLS;
  const row = Math.floor(i / ICON_COLS);
  const k = size / ICON_CELL;
  const mask = {
    maskSize: `${ICON_CELL * ICON_COLS * k}px auto`,
    WebkitMaskSize: `${ICON_CELL * ICON_COLS * k}px auto`,
    maskPosition: `-${col * ICON_CELL * k}px -${row * ICON_CELL * k}px`,
    WebkitMaskPosition: `-${col * ICON_CELL * k}px -${row * ICON_CELL * k}px`,
  } as React.CSSProperties;
  return (
    <span
      className={`gicon${className ? ' ' + className : ''}`}
      role="img"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      style={{ width: size, height: size, ...mask, ...(color ? { color } : null), ...style }}
    />
  );
};

export default GameIcon;

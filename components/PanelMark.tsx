import React from 'react';
import { PANEL_MARK, PanelMarkName } from './panelSheet';

/**
 * The still life at the head of a screen. Decorative by definition — it is
 * hidden from the reader, because the heading beside it already says the word.
 */
const PanelMark: React.FC<{ name: PanelMarkName; size?: number }> = ({ name, size = 46 }) => {
  const m = PANEL_MARK[name];
  if (!m) return null;
  const k = size / Math.max(m.w, m.h);
  return (
    <span className="panel-mark" style={{ width: size, height: size }}>
      <img src={m.src} width={Math.round(m.w * k)} height={Math.round(m.h * k)} alt="" aria-hidden="true" draggable={false} />
    </span>
  );
};

export default PanelMark;

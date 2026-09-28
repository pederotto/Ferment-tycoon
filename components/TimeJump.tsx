import React, { useEffect, useState } from 'react';
import { formatClock } from '../services/climate';

/* SKIP AHEAD. The owner asked for more than a speed: a jump. Growing things are
   slow on purpose, and watching a bed at 8x for a week of game time is not a
   decision, it is waiting. The jump runs the world forward through
   `advanceWorld` exactly as the clock would, so nothing is skipped over — every
   tick and every estate day still happens, the keeper still does the rounds.
   It is a menu, so it is paper. */
export interface TimeJumpProps {
  minute: number;
  sunrise: number;
  sunset: number;
  onJump: (minutes: number, label: string) => void;
}

const TimeJump: React.FC<TimeJumpProps> = ({ minute, sunrise, sunset, onJump }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  const dark = minute >= sunset || minute < sunrise;
  const toMorning = ((sunrise - minute) + 1440) % 1440 || 1440;
  const toEvening = Math.max(1, sunset - minute);
  const options: [number, string, string][] = [
    [60, '1 hour', ''],
    [180, '3 hours', ''],
    dark ? [toMorning, 'Until morning', formatClock(sunrise)] : [toEvening, 'Until evening', formatClock(sunset)],
    [1440, '1 day', 'same time tomorrow'],
    [10080, '1 week', 'everything keeps growing'],
  ];
  return (
    <div className="time-jump">
      <button className="tj-btn" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu" title="Skip ahead in time">
        Skip ahead <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <button className="tj-scrim" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="tj-menu" role="menu">
            {options.map(([m, label, sub]) => (
              <button key={label} role="menuitem" className="tj-item" onClick={() => { setOpen(false); onJump(m, label); }}>
                <span className="l">{label}</span>{sub && <span className="s">{sub}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default TimeJump;

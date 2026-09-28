import React from 'react';
import { Play, PauseCircle } from 'lucide-react';
import TimeJump, { TimeJumpProps } from './TimeJump';

/**
 * THE CLOCK, WHEREVER YOU HAPPEN TO BE STANDING.
 *
 * This was inline in the header, which meant the only place you could change
 * speed was the one place you were not looking while a batch was running. Open
 * the inspector to watch a ferment and the control was behind the modal — so
 * the natural thing to do (speed up, watch what happens, slow down when it gets
 * interesting) required closing the thing you were watching.
 *
 * It also folded pause into the speed value: 0 meant paused, so pausing left
 * every speed chip unselected and a paused game could not say what it would
 * resume at. Speed and pause are separate here, and the selected speed stays
 * lit while the clock is stopped.
 */

/** What a room needs to carry the clock: the same four things the header has. */
export interface ClockProps {
  gameSpeed: number;
  paused: boolean;
  onSetSpeed: (n: number) => void;
  onTogglePause: () => void;
  /** For the jump: now, and today's light. */
  jump?: TimeJumpProps;
}

/** The speed and the jump together, for a room's head. */
export const RoomClock: React.FC<ClockProps> = ({ jump, ...speed }) => (
  <div className="room-clock">
    <SpeedControl {...speed} compact />
    {jump && <TimeJump {...jump} />}
  </div>
);

interface SpeedControlProps {
  gameSpeed: number;
  paused: boolean;
  onSetSpeed: (n: number) => void;
  onTogglePause: () => void;
  /** `compact` drops the word and keeps the glyph, for tight rows. */
  compact?: boolean;
}

export const SPEEDS = [1, 2, 4, 8];

const SpeedControl: React.FC<SpeedControlProps> = ({
  gameSpeed, paused, onSetSpeed, onTogglePause, compact,
}) => (
  <div
    className={`hud-speed flex items-center gap-1 rounded-xl p-1 border border-line-strong ml-1 shadow-inner relative z-50${compact ? ' compact' : ''}`}
    style={{ background: 'rgba(0,0,0,0.25)' }}
  >
    <button
      onClick={onTogglePause}
      className={`chip-tab${paused ? ' active' : ''}`}
      title="Toggle Pause / Resume (Spacebar)"
    >
      {paused
        ? <PauseCircle className="w-3 h-3 inline mr-1" />
        : <Play className="w-3 h-3 inline mr-1" />}
      {compact ? '' : (paused ? 'PAUSED' : 'RUN')}
    </button>
    {SPEEDS.map(speed => (
      <button
        key={speed}
        // Picking a speed resumes as well as selects. Clicking "8x" on a paused
        // game and having nothing happen is the behaviour nobody expects.
        onClick={() => { onSetSpeed(speed); if (paused) onTogglePause(); }}
        className={`chip-tab${gameSpeed === speed ? ' active' : ''}${paused ? ' held' : ''}`}
        title={paused ? `Resume at ${speed}x` : `Run at ${speed}x`}
      >
        {speed}x
      </button>
    ))}
  </div>
);

export default SpeedControl;

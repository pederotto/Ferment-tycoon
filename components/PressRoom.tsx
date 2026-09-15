import React, { useEffect, useRef, useState } from 'react';
import PanelMark from './PanelMark';
import { Batch } from '../types';
import { INGREDIENTS } from '../constants';
import { getRecipeForBatch } from '../services/gameLogic';
import { planSeparation } from '../services/massBalance';
import { PRESS_FRAMES, PressFrame } from './pressSheet';
import { CENTRIFUGE_PARTS } from './centrifugeSheet';
import { CloseIcon } from './icons';
import { ArrowRight } from 'lucide-react';

/**
 * THE PRESS
 *
 * Pressing was a button in the harvest tab labelled "Press" that changed some
 * numbers and printed a line in the log. For a moromi that button is not a yield
 * tweak — it is the last step of making soy sauce, the moment the mash becomes
 * the thing you were making. It deserved a screen.
 *
 * The whole point of this one is the arithmetic: what goes in, what comes out,
 * and what stays behind. A press separates; it does not create. Showing the cake
 * as well as the liquid is the honest version, and it is also the interesting
 * one — the cake is still food.
 *
 * AND THE MACHINE WORKS WHERE YOU CAN SEE IT. The painted press stands over the
 * jobs and, when you press, plays its job — bag in, plate down with the liquid
 * running, the cake pressed hard, the plate up — before the batch changes; the
 * centrifuge opens, shuts and spins. The App closes this screen the moment
 * `onPress` runs, so the sequence plays first and calls it last.
 */

interface PressRoomProps {
  /** Which machine's screen this is. Both separate; they separate differently. */
  tool: 'wooden_press' | 'centrifuge';
  batches: Batch[];
  customIngredients: typeof INGREDIENTS;
  onClose: () => void;
  onPress: (batch: Batch) => void;
}

/* The press's job, frame by frame, and how long each frame holds. */
const PRESS_STEPS: PressFrame[] = ['loaded', 'pressing', 'pressed', 'cake'];
const PRESS_STEP_MS = 650;
/* The centrifuge: lid open to load, then shut and spinning for two beats. */
const SPIN_STEPS = 3;
const SPIN_STEP_MS = 780;

const Thumb: React.FC<{ part: 'jug' | 'cake' }> = ({ part }) => (
  <img className="pj-thumb" src={CENTRIFUGE_PARTS[part].src} alt="" aria-hidden="true" draggable={false} />
);

const PressRoom: React.FC<PressRoomProps> = ({ tool, batches, customIngredients, onClose, onPress }) => {
  const isPress = tool === 'wooden_press';
  const all = [...INGREDIENTS, ...customIngredients];

  const pressable = batches
    // A bed growing in the koji room is not a press job — it was offering all
    // twelve of them, and pressing one flagged a live bed as pressed.
    .filter(b => !b.kojiRoom && (isPress ? !b.isPressed : !b.isFiltered) && b.status !== 'spoiled')
    .map(b => {
      const recipe = getRecipeForBatch(b);
      const substrate = all.find(i => i.id === b.substrateId);
      const ings = b.inputIngredientIds.map(id => all.find(i => i.id === id)).filter(Boolean) as typeof INGREDIENTS;
      // The same plan the App applies, so the preview cannot lie.
      return { batch: b, recipe, y: planSeparation(b, recipe, ings, isPress ? 'press' : 'centrifuge', substrate) };
    });

  const [run, setRun] = useState<{ id: string; step: number } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);

  const start = (batch: Batch) => {
    if (run) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onPress(batch); return; }
    const steps = isPress ? PRESS_STEPS.length : SPIN_STEPS;
    const ms = isPress ? PRESS_STEP_MS : SPIN_STEP_MS;
    setRun({ id: batch.id, step: 0 });
    for (let i = 1; i < steps; i++) {
      timers.current.push(window.setTimeout(() => setRun({ id: batch.id, step: i }), i * ms));
    }
    timers.current.push(window.setTimeout(() => onPress(batch), steps * ms));
  };

  const pressFrame = PRESS_FRAMES[run ? PRESS_STEPS[run.step] : (pressable.length ? 'loaded' : 'empty')];
  const spinning = !isPress && !!run && run.step >= 1;
  const cfPart = CENTRIFUGE_PARTS[!isPress && run && run.step === 0 ? 'open' : 'closed'];

  return (
    <div className="modal-overlay" onClick={() => { if (!run) onClose(); }}>
      <div className="pressroom" onClick={e => e.stopPropagation()}>
        <div className="pr-head">
          <PanelMark name="press" />
          <div>
            <span className="kicker">Hardware</span>
            <h2>{isPress ? 'The Press' : 'The Centrifuge'}</h2>
          </div>
          <button className="close-stamp" onClick={onClose} disabled={!!run}
                  aria-label={isPress ? 'Close the press' : 'Close the centrifuge'}>
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="pr-body custom-scrollbar">
          {/* The machine itself, standing over the work. */}
          <div className={`pr-stage${run ? ' working' : ''}`} aria-hidden="true">
            {isPress ? (
              <img className="pr-machine" src={pressFrame.src} alt="" draggable={false} />
            ) : (
              <div className={`pr-cf${spinning ? ' spinning' : ''}`}>
                <img className="pr-machine" src={cfPart.src} alt="" draggable={false} />
                {spinning && <span className="pr-spin" />}
              </div>
            )}
          </div>

          <p className="pr-lede">
            {isPress
              ? 'A press separates, it does not create. Everything that comes out was already in there — the question is only how much of the liquid you can persuade to leave the solids.'
              : 'Spinning throws the solids to the wall and leaves the liquid clear. You lose a tenth of the volume to what you throw away, and what remains is worth more than what went in.'}
          </p>

          {pressable.length === 0 ? (
            <p className="pr-empty empty-mark"><PanelMark name="press" size={56} faded />
              {isPress
                ? 'Nothing on the bench to press. A wet mash gives up liquid; a dry one only compacts.'
                : 'Nothing to clarify. The centrifuge is for liquids — a garum or a vinegar, not a paste.'}
            </p>
          ) : pressable.map(({ batch, recipe, y }) => {
            const busy = run?.id === batch.id;
            return (
              <div key={batch.id} className={`pr-job${(isPress && !y.runsOff) ? ' dry' : ''}${busy ? ' busy' : ''}`}>
                <div className="pj-head">
                  <span className="n">{recipe.name}</span>
                  <span className="v mono">{(y.massG / 1000).toFixed(1)} kg · {y.saltPct.toFixed(1)}% salt</span>
                </div>

                <div className="pj-flow">
                  <div className="pj-side">
                    <span className="l">In</span>
                    <span className="m mono">{(y.massG / 1000).toFixed(1)} kg</span>
                    <span className="d">{y.runsOff ? 'wet mash' : 'dry mash'}</span>
                  </div>

                  <ArrowRight size={15} className="pj-arrow" />

                  {!isPress ? (
                    <>
                      <div className="pj-side out">
                        <Thumb part="jug" />
                        <span className="l">Clarified</span>
                        <span className="m mono">{((y.massG - y.leesG) / 1000).toFixed(1)} kg</span>
                        <span className="d">clear, and worth more</span>
                      </div>
                      <div className="pj-side cake">
                        <span className="l">Thrown out</span>
                        <span className="m mono">{(y.leesG / 1000).toFixed(1)} kg</span>
                        <span className="d">lees and sediment</span>
                      </div>
                    </>
                  ) : y.runsOff ? (
                    <>
                      <div className="pj-side out">
                        <Thumb part="jug" />
                        <span className="l">{y.product?.name.split(' · ')[0] ?? 'Liquid'}</span>
                        <span className="m mono">{y.liquidUnits} L</span>
                        <span className="d">{y.saltPct.toFixed(1)}% salt · {y.aminoPct.toFixed(1)}% amino{y.ethanolPct >= 1 ? ` · ${y.ethanolPct.toFixed(0)}% alc` : ''}</span>
                      </div>
                      <div className="pj-side cake">
                        <Thumb part="cake" />
                        <span className="l">Cake</span>
                        <span className="m mono">{(y.cakeG / 1000).toFixed(1)} kg</span>
                        <span className="d">stays on the bench as the batch</span>
                      </div>
                    </>
                  ) : (
                    <div className="pj-side out">
                      <Thumb part="cake" />
                      <span className="l">Compacted</span>
                      <span className="m mono">{(y.cakeG / 1000).toFixed(1)} kg</span>
                      <span className="d">barely anything runs off</span>
                    </div>
                  )}
                </div>

                <div className="pj-foot">
                  <span className="why">
                    {!isPress
                      ? 'Spinning drops the lees out. You give up a tenth of the volume and get back something clear enough to sell as a finished sauce.'
                      : y.runsOff
                        ? (y.product?.description ?? 'Wet enough to separate.')
                        : 'Too dry to run off. Pressing only packs it down — it does not make more of it.'}
                  </span>
                  <button className="btn btn-amber" onClick={() => start(batch)} disabled={!!run}>
                    {busy
                      ? (isPress ? 'Pressing…' : 'Spinning…')
                      : !isPress ? 'Spin it clear' : y.runsOff ? `Press for ${y.liquidUnits} L` : 'Compact it'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PressRoom;

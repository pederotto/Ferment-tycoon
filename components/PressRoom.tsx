import React from 'react';
import { Batch, Recipe, FermentType } from '../types';
import { INGREDIENTS } from '../constants';
import { calculateBatchDynamics, getRecipeForBatch } from '../services/gameLogic';
import IsoAppliance from './IsoAppliance';
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
 */

interface PressRoomProps {
  /** Which machine's screen this is. Both separate; they separate differently. */
  tool: 'wooden_press' | 'centrifuge';
  batches: Batch[];
  customIngredients: typeof INGREDIENTS;
  onClose: () => void;
  onPress: (batch: Batch) => void;
}

/** Matches the extraction in handleProcessBatch, so the preview cannot lie. */
const previewYield = (batch: Batch, recipe: Recipe, ingredients: typeof INGREDIENTS) => {
  const { waterRatio, totalMass } = calculateBatchDynamics(ingredients as any, batch.ingredientQuantities);
  const wet = waterRatio > 0.5;
  const isMoromi = recipe.type === FermentType.SHOYU;
  const efficiency = isMoromi ? 0.92 : 0.8;
  const liquidMass = wet ? totalMass * waterRatio * efficiency : 0;
  return {
    wet, isMoromi, totalMass, waterRatio,
    liquidUnits: Math.floor(liquidMass / 1000),
    liquidMass,
    cakeMass: Math.max(0, totalMass - liquidMass),
  };
};

const PressRoom: React.FC<PressRoomProps> = ({ tool, batches, customIngredients, onClose, onPress }) => {
  const isPress = tool === 'wooden_press';
  const all = [...INGREDIENTS, ...customIngredients];

  const pressable = batches
    .filter(b => (isPress ? !b.isPressed : !b.isFiltered) && b.status !== 'spoiled')
    .map(b => {
      const recipe = getRecipeForBatch(b);
      const ings = b.inputIngredientIds
        .map(id => all.find(i => i.id === id))
        .filter(Boolean) as typeof INGREDIENTS;
      return { batch: b, recipe, ings, y: previewYield(b, recipe, ings) };
    });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pressroom" onClick={e => e.stopPropagation()}>
        <span className="corner c-tl" />
        <span className="corner c-br" />

        {/* The press itself, standing behind the working area. */}
        <div className="pr-scene" aria-hidden="true">
          <svg viewBox="0 0 260 190" width="100%" height="100%">
            <ellipse cx="130" cy="168" rx="96" ry="20" fill="rgba(0,0,0,0.35)" />
            <g transform="translate(130,112) scale(1.85)">
              <IsoAppliance id={tool} />
            </g>
          </svg>
        </div>

        <div className="pr-head">
          <div>
            <span className="kicker">Hardware</span>
            <h2>{isPress ? 'The Press' : 'The Centrifuge'}</h2>
          </div>
          <button className="close-stamp" onClick={onClose} aria-label={isPress ? 'Close the press' : 'Close the centrifuge'}>
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="pr-body custom-scrollbar">
          <p className="pr-lede">
            {isPress
              ? 'A press separates, it does not create. Everything that comes out was already in there — the question is only how much of the liquid you can persuade to leave the solids.'
              : 'Spinning throws the solids to the wall and leaves the liquid clear. You lose a tenth of the volume to what you throw away, and what remains is worth more than what went in.'}
          </p>

          {pressable.length === 0 ? (
            <p className="pr-empty">
              {isPress
                ? 'Nothing on the bench to press. A wet mash gives up liquid; a dry one only compacts.'
                : 'Nothing to clarify. The centrifuge is for liquids — a garum or a vinegar, not a paste.'}
            </p>
          ) : pressable.map(({ batch, recipe, y }) => (
            <div key={batch.id} className={`pr-job${(isPress && !y.wet) ? ' dry' : ''}`}>
              <div className="pj-head">
                <span className="n">{recipe.name}</span>
                <span className="v mono">{(y.totalMass / 1000).toFixed(1)} kg · {Math.round(y.waterRatio * 100)}% water</span>
              </div>

              <div className="pj-flow">
                <div className="pj-side">
                  <span className="l">In</span>
                  <span className="m mono">{(y.totalMass / 1000).toFixed(1)} kg</span>
                  <span className="d">{y.wet ? 'wet mash' : 'dry mash'}</span>
                </div>

                <ArrowRight size={15} className="pj-arrow" />

                {!isPress ? (
                  <>
                    <div className="pj-side out">
                      <span className="l">Clarified</span>
                      <span className="m mono">{(y.totalMass * 0.9 / 1000).toFixed(1)} kg</span>
                      <span className="d">clear, and worth more</span>
                    </div>
                    <div className="pj-side cake">
                      <span className="l">Thrown out</span>
                      <span className="m mono">{(y.totalMass * 0.1 / 1000).toFixed(1)} kg</span>
                      <span className="d">lees and sediment</span>
                    </div>
                  </>
                ) : y.wet ? (
                  <>
                    <div className="pj-side out">
                      <span className="l">Liquid</span>
                      <span className="m mono">{y.liquidUnits} L</span>
                      <span className="d">{y.isMoromi ? 'raw shoyu' : 'amino sauce'}</span>
                    </div>
                    <div className="pj-side cake">
                      <span className="l">Cake</span>
                      <span className="m mono">{(y.cakeMass / 1000).toFixed(1)} kg</span>
                      <span className="d">stays in the cloth</span>
                    </div>
                  </>
                ) : (
                  <div className="pj-side out">
                    <span className="l">Compacted</span>
                    <span className="m mono">+25%</span>
                    <span className="d">yield only</span>
                  </div>
                )}
              </div>

              <div className="pj-foot">
                <span className="why">
                  {!isPress
                    ? 'Spinning drops the lees out. You give up a tenth of the volume and get back something clear enough to sell as a finished sauce.'
                    : y.isMoromi
                      ? 'A moromi has been breaking down for months, so it gives its liquid up almost completely — 92% against 80% for a loose mash. This is the step that turns it into soy sauce.'
                      : y.wet
                        ? 'Wet enough to separate. The liquid is worth more than the mash it came from.'
                        : 'Too dry to run off. Pressing only packs it down.'}
                </span>
                <button className="btn btn-amber" onClick={() => onPress(batch)}>
                  {!isPress ? 'Spin it clear' : y.wet ? `Press for ${y.liquidUnits} L` : 'Compact it'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PressRoom;

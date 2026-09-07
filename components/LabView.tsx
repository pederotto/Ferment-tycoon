
import React from 'react';
import { Batch, Recipe, FermentType } from '../types';
import { RECIPES, VESSELS } from '../constants';
import { VesselArt, PlusIcon } from './icons';

interface LabViewProps {
  batches: Batch[];
  maxSlots: number;
  onSelectSlot: (batch: Batch | null) => void;
  onIntervention: (batch: Batch, action: string) => void;
  onQuickHarvest?: (batch: Batch) => void;
  usedSlots: number;
  gameSpeed: number;
  analyzedRecipeIds: string[]; // For Discovery Fog
}

const LabView: React.FC<LabViewProps> = ({
  batches,
  maxSlots,
  onSelectSlot,
  onIntervention,
  onQuickHarvest,
  usedSlots,
  gameSpeed,
  analyzedRecipeIds
}) => {

  const getRecipe = (batch: Batch): Recipe => {
    if (batch.cachedRecipe) return batch.cachedRecipe;
    const found = RECIPES.find(r => r.id === batch.recipeId);
    if (found) return found;
    return RECIPES.find(r => r.id === 'bio_sludge')!;
  };

  const getVessel = (id: string) => {
    const found = VESSELS.find(v => v.id === id);
    if (found) return found;
    return VESSELS[0];
  };

  const emptySlotsCount = Math.max(0, maxSlots - usedSlots);
  const emptySlots = Array.from({ length: emptySlotsCount });

  return (
    <div className="bench-wrap">
      <div className="lamp-glow" />

      <div className="bench-head">
        <h1 className="slab">
          The Fermentation Bench
          <span className="count mono">{batches.length} In Flight</span>
        </h1>
        <div className="slot-pill">Bench: <b>{usedSlots}</b> / {maxSlots} slots</div>
      </div>

      <div className="shelf custom-scrollbar">
        {batches.map((batch) => {
          const recipe = getRecipe(batch);
          const vessel = getVessel(batch.vesselId);

          const isSpoiled = batch.status === 'spoiled';
          const isPeak = !isSpoiled && batch.progress >= recipe.peakWindowStart && batch.progress <= recipe.peakWindowEnd;
          const isOverPeak = !isSpoiled && batch.progress > recipe.peakWindowEnd;
          const isReadyToHarvest = batch.status === 'ready' || isPeak || isOverPeak;

          const tempDiff = Math.abs(batch.params.temp - recipe.idealParams.temp);
          const isTempWarning = tempDiff > 3;
          const isTempCritical = tempDiff > 6;

          const needsVentilation = recipe.activeIntervention === 'Ventilate' && batch.params.temp > recipe.idealParams.temp + 2;
          const stress = batch.stress || 0;
          const isHighStress = stress > 65;
          const isWarnState = !isSpoiled && !isPeak && (isTempCritical || isHighStress || needsVentilation);

          const isDiscovered = analyzedRecipeIds.includes(recipe.id) || recipe.type === FermentType.FAIL;
          const displayName = isDiscovered ? recipe.name : 'Unidentified Reaction';

          const isKoji = recipe.type === FermentType.KOJI;

          let cubbyClass = 'cubby';
          if (isSpoiled) cubbyClass += ' spoiled';
          else if (isPeak) cubbyClass += ' peak';
          else if (isWarnState) cubbyClass += ' warn';

          let chipClass = 'status-chip grow';
          let chipLabel = `${Math.round(batch.progress)}%`;
          if (isSpoiled) { chipClass = 'status-chip spoiled'; chipLabel = 'Spoiled'; }
          else if (isPeak) { chipClass = 'status-chip ready'; chipLabel = 'Peak'; }
          else if (isWarnState) { chipClass = 'status-chip warn'; chipLabel = needsVentilation ? 'Overheat' : 'Stress'; }

          return (
            <div
              key={batch.id}
              className={cubbyClass}
              onClick={() => onSelectSlot(batch)}
              style={vessel.slotsRequired >= 3 ? { gridColumn: 'span 2' } : undefined}
            >
              {isKoji && !isSpoiled && (
                <div
                  className="animate-mycelium"
                  style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 10,
                    backgroundImage: 'radial-gradient(circle at 50% 35%, rgba(244,234,217,0.35) 10%, rgba(244,234,217,0.12) 40%, transparent 72%)',
                    opacity: Math.min(0.7, batch.progress / 90),
                    filter: 'blur(10px)'
                  }}
                />
              )}

              <div className="tag-row" style={{ position: 'relative', zIndex: 2 }}>
                <span className="vessel-badge">{vessel.name}</span>
                <span className={chipClass}><span className="dot" />{chipLabel}</span>
              </div>

              <div className="vessel-stage" style={{ position: 'relative', zIndex: 2 }}>
                <VesselArt vesselId={batch.vesselId} size={vessel.slotsRequired >= 3 ? 110 : 92} />
              </div>
              <div className="vessel-shadow" />

              <div className="label-block">
                <div className={`name slab${isDiscovered ? '' : ' fog'}`}>{displayName}</div>
                <div className="type">{isDiscovered ? recipe.type : 'Fog of War'}</div>
              </div>

              <div className="mini-dials">
                <div className="mini-dial">
                  <div className={`v mono${isTempCritical ? ' hot' : isTempWarning ? ' warn' : ''}`}>{batch.params.temp.toFixed(1)}&deg;</div>
                  <div className="l">Temp</div>
                </div>
                <div className="mini-dial">
                  <div className="v mono">{batch.params.humidity.toFixed(0)}%</div>
                  <div className="l">Humid</div>
                </div>
                <div className="mini-dial">
                  <div className={`v mono${batch.quality.safety < 60 ? ' hot' : ''}`}>{Math.round(batch.quality.safety)}</div>
                  <div className="l">Safety</div>
                </div>
              </div>

              <div className="peak-track">
                <div className="peak-zone" style={{ left: `${Math.min(100, recipe.peakWindowStart)}%`, width: `${Math.max(4, recipe.peakWindowEnd - recipe.peakWindowStart)}%` }} />
                <div
                  className="peak-fill"
                  style={{
                    width: `${Math.min(100, batch.progress)}%`,
                    background: isSpoiled ? 'var(--brick)' : isPeak ? 'var(--amber)' : 'var(--moss)'
                  }}
                />
              </div>

              <div className="cubby-actions">
                {isSpoiled ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectSlot(batch); }}
                    className="mini-btn salvage"
                    title="Salvage or discard this failed batch"
                  >
                    Salvage
                  </button>
                ) : needsVentilation ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onIntervention(batch, 'Ventilate'); }}
                    className="mini-btn salvage"
                    title="Ventilate high heat immediately"
                  >
                    Ventilate
                  </button>
                ) : (isPeak || isReadyToHarvest) ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (onQuickHarvest) { onQuickHarvest(batch); } else { onSelectSlot(batch); } }}
                    className="mini-btn harvest"
                    title="Instantly harvest to the best offer"
                  >
                    Harvest
                  </button>
                ) : (
                  <span className="section-lbl" style={{ paddingLeft: 2 }}>#{batch.id.slice(-4)}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectSlot(batch); }}
                  className="mini-btn inspect"
                  title="Open the ledger to inspect telemetry and intervene"
                >
                  Inspect
                </button>
              </div>
            </div>
          );
        })}

        {emptySlots.map((_, index) => (
          <button
            key={`empty-${index}`}
            onClick={() => onSelectSlot(null)}
            className="empty-cubby"
            type="button"
          >
            <div className="plus-ring">
              <PlusIcon size={16} />
            </div>
            <div className="lbl slab">Inoculate Culture</div>
            <div className="sub">Slot {usedSlots + index + 1} &middot; open</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LabView;

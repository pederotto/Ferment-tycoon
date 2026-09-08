import React, { useState } from 'react';
import { Batch, Recipe, FermentType, Buyer, StaffRoleType, ChamberControls } from '../types';
import { AlertTriangle, PauseCircle, Star, Package, Trash2, Sprout, Activity, ArrowDownToLine, Filter, Hourglass } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { describeEnzymes, describeLineage } from '../services/koji';
import RunTrace from './RunTrace';
import { calculateCriticScore, getInterestedBuyers, generateCriticFeedback, calculateBatchDynamics, calculateOffer, calculateWholesale, getDemandFor, buyerWillTake, getContrabandValue, isContrabandBatch, getControls, getLineage, chamberExchange, unevennessRate, evennessCeiling } from '../services/gameLogic';
import { INGREDIENTS } from '../constants';
import {
  CloseIcon, VesselArt, MixToolIcon, MistToolIcon, LidToolIcon, CleanToolIcon,
  LogLinesIcon, getBuyerIcon, getBuyerAccentColor, ArrowRightIcon
} from './icons';

/**
 * THE CHAMBER PANEL
 *
 * Held settings, not pokes. Three rows because there are exactly three things
 * you can hold: how much air moves, how much water goes in, and how hard the
 * box is heating.
 *
 * The readout underneath is the point of the whole component. Vent and mist are
 * individually easy to understand and jointly counter-intuitive — misting into
 * a sealed chamber does almost nothing to the temperature, and misting into a
 * draught is the strongest cooling in the game while barely moving humidity.
 * Rather than making the player derive that, the panel states what the current
 * combination is doing right now, and it updates as they change it.
 */
const VENT_LABELS = ['Sealed', 'Cracked', 'Open', 'Forced'];
const MIST_LABELS = ['Off', 'Periodic', 'Continuous'];

const ChamberPanel: React.FC<{
  batch: Batch;
  recipe: Recipe;
  inventory: Record<string, number>;
  onSetControl?: (patch: Partial<ChamberControls>) => void;
}> = ({ batch, recipe, inventory, onSetControl }) => {
  const c = getControls(batch);
  const hasFan = (inventory['portable_fan'] || 0) > 0;
  const hasHumidifier = (inventory['humidifier'] || 0) > 0;
  const isIncubator = batch.vesselId === 'incubator';
  const ex = chamberExchange(c, hasFan);
  const live = batch.status === 'active';

  const netHumidity = ex.moistureGain - ex.moistureLoss;
  const surface = batch.surfaceWater ?? 0;

  // What the current combination actually does, in one sentence.
  const reading = (() => {
    if (c.mist > 0 && ex.vent >= 2)
      return 'Evaporative cooling: the airflow is carrying the mist off and taking heat with it. Humidity roughly holds while the temperature falls — the only way to run cool and damp at once.';
    if (c.mist > 0 && ex.vent === 0)
      return 'Misting into a sealed chamber. The air saturates, so it cools very little — the water is going onto the bed instead of into the air.';
    if (ex.vent >= 2 && c.mist === 0)
      return 'Open and dry. Sheds heat fast, and moisture with it — watch the humidity, not just the temperature.';
    if (ex.vent === 0 && c.mist === 0)
      return 'Sealed. Whatever the culture generates, it keeps. Fine until it starts generating a lot.';
    return 'Cracked open. Gentle exchange with the room.';
  })();

  const Row: React.FC<{
    label: string; hint: string; value: number; max: number;
    names: string[]; locked?: (n: number) => string | null;
    onPick: (n: number) => void;
  }> = ({ label, hint, value, max, names, locked, onPick }) => (
    <div className="cp-row">
      <span className="cp-lab" title={hint}>{label}</span>
      <div className="cp-steps">
        {Array.from({ length: max + 1 }, (_, n) => {
          const lock = locked?.(n) ?? null;
          return (
            <button
              key={n}
              className={`cp-step${value === n ? ' on' : ''}${lock ? ' locked' : ''}`}
              disabled={!live || !!lock || !onSetControl}
              title={lock ?? names[n]}
              onClick={() => onPick(n)}
            >
              {names[n]}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="chamber">
      <div className="cp-head">
        <span className="l">Chamber</span>
        <span className="k mono">
          {batch.params.temp.toFixed(1)}° · {batch.params.humidity.toFixed(0)}% RH
        </span>
      </div>

      <Row
        label="Vent" hint="Airflow. Sheds heat and moisture together."
        value={c.vent} max={3} names={VENT_LABELS}
        locked={n => (n === 3 && !hasFan ? 'Forced air needs a portable fan' : null)}
        onPick={n => onSetControl?.({ vent: n as 0 | 1 | 2 | 3 })}
      />

      <Row
        label="Mist" hint="Added water. Cools by evaporating — but only as fast as the vent carries it away."
        value={c.mist} max={2} names={MIST_LABELS}
        locked={n => (n === 2 && !hasHumidifier ? 'Continuous misting needs a humidifier' : null)}
        onPick={n => onSetControl?.({ mist: n as 0 | 1 | 2 })}
      />

      {isIncubator && (
        <div className="cp-row">
          <span className="cp-lab" title="The chamber setpoint. Heat is a preservative in its own right — more of it means you need less salt.">
            Heat
          </span>
          <div className="cp-heat">
            <button className="cp-step" disabled={!live || !onSetControl}
                    onClick={() => onSetControl?.({ heat: c.heat === null ? recipe.idealParams.temp : null })}>
              {c.heat === null ? 'Off' : 'On'}
            </button>
            <input
              type="range" min={20} max={70} step={1}
              value={c.heat ?? recipe.idealParams.temp}
              disabled={!live || c.heat === null || !onSetControl}
              onChange={e => onSetControl?.({ heat: Number(e.target.value) })}
            />
            <span className="cp-set mono">{c.heat === null ? '—' : `${c.heat}°`}</span>
          </div>
        </div>
      )}

      {(() => {
        const even = batch.evenness ?? 100;
        const rate = unevennessRate(batch.totalMass || 1000, 0.7);
        if (rate <= 0.0001 && even > 99) {
          return (
            <p className="cp-even none">
              Small enough to ferment as one thing — it will not stratify, and
              never needs turning.
            </p>
          );
        }
        return (
          <div className="cp-even">
            <div className="eh">
              <span className="l">Evenness</span>
              <span className={`v${even < 55 ? ' bad' : even < 80 ? ' warn' : ''}`}>
                {even.toFixed(0)}% · ceiling {evennessCeiling(even).toFixed(0)}
              </span>
            </div>
            <div className="etrack">
              <div className={`efill${even < 55 ? ' bad' : even < 80 ? ' warn' : ''}`} style={{ width: `${even}%` }} />
            </div>
            <p>
              {even > 88
                ? 'Fermenting as one mass.'
                : even > 70
                  ? 'Starting to separate — the core is running ahead of the edge.'
                  : even > 50
                    ? 'Stratified. Turn it, or accept an average of several different ferments.'
                    : 'Badly stratified. What comes out will be dragged down by its worst part.'}
            </p>
          </div>
        );
      })()}

      <p className="cp-read">{reading}</p>

      <div className="cp-facts">
        <span className={`f${Math.abs(netHumidity) < 0.07 ? ' hi' : ''}`}>
          {/* Three bands rather than two. The signature vent+mist combination
              nets about +0.05 an hour — genuinely near-steady next to the -0.13
              of an open chamber, but it is not flat, and calling it "holding"
              would be the kind of small lie the player eventually catches. */}
          humidity {Math.abs(netHumidity) < 0.02
            ? 'holding'
            : Math.abs(netHumidity) < 0.07
              ? `near-steady, ${netHumidity > 0 ? 'up' : 'down'}`
              : netHumidity > 0 ? 'rising' : 'falling'}
        </span>
        <span className={`f${ex.evapCooling > 0.6 ? ' hi' : ''}`}>
          evaporative cooling {ex.evapCooling < 0.05 ? 'none' : ex.evapCooling < 0.6 ? 'slight' : 'strong'}
        </span>
        <span className={`f${surface > 55 ? ' bad' : ''}`} title="Free water on the substrate itself, which is not the same as humidity in the air. Airflow dries it off; a sealed chamber lets it pool, and a soaked bed grows bacteria rather than mould.">
          bed {surface < 20 ? 'dry' : surface < 55 ? 'damp' : surface < 80 ? 'wet' : 'waterlogged'}
        </span>
        {isIncubator && c.heat !== null && c.heat >= 55 && c.heat < 65 && (
          <span className="f hi" title="Above about 55 C nothing pathogenic establishes, whatever the salinity. This is the modern route: heat instead of salt.">
            heat-preserved
          </span>
        )}
        {isIncubator && c.heat !== null && c.heat >= 65 && (
          <span className="f bad" title="Enzymes are proteins and they denature. Past 65 C the batch stops developing permanently — cooling it back down does not bring them back.">
            above denaturing point
          </span>
        )}
      </div>
    </div>
  );
};

interface BatchInspectorProps {
  batch: Batch;
  recipe: Recipe;
  inventory?: Record<string, number>;
  activeStaff?: Record<StaffRoleType, boolean>;
  playerRenown?: number;
  playerXp?: number;
  playerReputation?: number;
  marketDemand?: Record<string, number>;
  onClose: () => void;
  onIntervention: (action: string) => void;
  onSetControl?: (patch: Partial<ChamberControls>) => void;
  onQuickHarvest: () => void;
  onSell?: (buyer: Buyer, price: number, renownGain: number) => void;
  onStore?: () => void;
  onCellar?: () => void;
  canCellar?: boolean;
  maturityNote?: string | null;
  onDiscard?: () => void;
  onBackSlop?: () => void;
  onSporulate?: () => void;
  onProcess?: (action: 'press' | 'filter') => void;
  onEvaluate?: (score: number, renown: number) => void;
  initialTab?: 'telemetry' | 'harvest';
}

// Full-circle progress ring (the ledger's centerpiece) — circumference-based,
// matching the mockup's math (r=98 => C≈615.75) but generalized to any radius.
const ProgressRing: React.FC<{ percent: number; color: string; size?: number; strokeWidth?: number }> = ({ percent, color, size = 220, strokeWidth = 8 }) => {
  const r = size / 2 - strokeWidth;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - clamped / 100);
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(243,233,216,0.1)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
};

// A small semicircle telemetry dial matching Inspector.dc.html's ".dial" arc.
const TelemetryDial: React.FC<{ value: string; label: string; target: string; percent: number; color: string }> = ({ value, label, target, percent, color }) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const arcLen = 72;
  const offset = arcLen * (1 - clamped / 100);
  return (
    <div className="dial">
      <svg width="54" height="30" viewBox="0 0 54 30">
        <path d="M4 27a23 23 0 0 1 46 0" fill="none" stroke="rgba(243,233,216,0.12)" strokeWidth="5" />
        <path d="M4 27a23 23 0 0 1 46 0" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={arcLen} strokeDashoffset={offset} />
      </svg>
      <div className="v mono">{value}</div>
      <div className="l">{label}</div>
      <div className="t">target {target}</div>
    </div>
  );
};

const BatchInspector: React.FC<BatchInspectorProps> = ({
  batch,
  recipe,
  inventory = {},
  activeStaff,
  playerRenown = 50,
  playerXp = 0,
  playerReputation = 0,
  marketDemand,
  onClose,
  onIntervention,
  onSetControl,
  onQuickHarvest,
  onSell,
  onStore,
  onCellar,
  canCellar,
  maturityNote,
  onDiscard,
  onBackSlop,
  onSporulate,
  onProcess,
  onEvaluate,
  initialTab = 'telemetry'
}) => {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'harvest'>(initialTab);

  const isKoji = recipe.type === FermentType.KOJI;
  const isGarum = recipe.type === FermentType.GARUM;
  const isLiquid = [FermentType.SHOYU, FermentType.GARUM, FermentType.VINEGAR].includes(recipe.type);
  const isSolid = [FermentType.MISO, FermentType.LACTO].includes(recipe.type);
  const isSpoiled = batch.status === 'spoiled';

  const isPaused = (batch.disturbanceTimer || 0) > 0;
  const lidOpen = batch.flags?.isLidPropped;
  const stress = batch.stress || 0;

  const needsAir = recipe.id === 'bagoong' && !lidOpen;
  const humidityRisk = recipe.id === 'bottarga' && batch.params.humidity > 40;
  const tempRisk = recipe.id === 'gochujang' && batch.params.temp > 30;

  const isInPeakWindow = batch.progress >= recipe.peakWindowStart && batch.progress <= recipe.peakWindowEnd;

  const score = calculateCriticScore(batch, recipe, activeStaff);
  const stars = Math.min(5, Math.max(1, Math.floor(score / 20)));
  const feedback = generateCriticFeedback(batch, recipe);

  const isExemplary = score >= 85 && batch.quality.safety >= 90;

  const batchIngredients = batch.inputIngredientIds.map(id => INGREDIENTS.find(i => i.id === id)).filter(Boolean);
  const { waterRatio } = calculateBatchDynamics(batchIngredients as any, batch.ingredientQuantities);
  const isWetMash = waterRatio > 0.5;

  const hasPress = (inventory['wooden_press'] || 0) > 0;
  const hasCentrifuge = (inventory['centrifuge'] || 0) > 0;

  const canPress = hasPress && !batch.isPressed && (
    recipe.type === FermentType.SHOYU ||
    recipe.type === FermentType.GARUM ||
    (recipe.type === FermentType.MISO && isWetMash)
  );

  const canFilter = hasCentrifuge && !batch.isFiltered && (recipe.type === FermentType.GARUM || recipe.type === FermentType.VINEGAR);

  const buyers = getInterestedBuyers(batch, recipe, score, playerRenown, playerXp, playerReputation);

  // Quick Harvest calculation for persistent toolbar.
  // REBALANCE: scales with the real score, with only a $5 salvage floor instead
  // of a guaranteed $20 — a genuine failure (score 0) is worth nothing.
  const offerCtx = { score, activeStaff, marketDemand };
  const baseWholesalePrice = calculateWholesale(batch, recipe, offerCtx);
  const demandLevel = getDemandFor(recipe.type, marketDemand);

  let highestOffer = baseWholesalePrice;
  let highestRenown = 0;

  buyers.forEach(buyer => {
    if (!buyerWillTake(batch, recipe, buyer, score)) return;
    const offer = calculateOffer(batch, recipe, buyer, offerCtx);
    if (offer.money > highestOffer) highestOffer = offer.money;
    if (offer.renown > highestRenown) highestRenown = offer.renown;
  });

  const ideal = recipe.idealFlavorProfile;
  const actual = batch.quality;

  const radarData = [
    { subject: 'Umami', Ideal: ideal.umami, Actual: Math.round(actual.umami), fullMark: 100 },
    { subject: 'Acidity', Ideal: ideal.acidity, Actual: Math.round(actual.acidity), fullMark: 100 },
    { subject: 'Funk', Ideal: ideal.funk, Actual: Math.round(actual.funk), fullMark: 100 },
    { subject: 'Sweetness', Ideal: ideal.sweetness, Actual: Math.round(actual.sweetness), fullMark: 100 },
  ];

  // Build the intervention tool row per ferment family (mirrors the earlier
  // per-family branching, restyled onto the mockup's .tool-btn chrome).
  type Tool = { key: string; label: string; icon: React.FC<any>; onClick: () => void; disabled?: boolean; active?: boolean };
  const tools: Tool[] = [];
  // The lid and the mister are held settings now, not pokes — they live in the
  // chamber panel below. What is left here is genuinely momentary: turning the
  // bed by hand is an action, not a state.
  if (isKoji) {
    tools.push({ key: 'mix', label: 'Mix', icon: MixToolIcon, onClick: () => onIntervention('Mix'), disabled: isPaused });
  }
  if (isLiquid) {
    tools.push({ key: 'stir', label: 'Stir', icon: MixToolIcon, onClick: () => onIntervention('Stir') });
    if (isGarum) tools.push({ key: 'skim', label: 'Skim', icon: CleanToolIcon, onClick: () => onIntervention('Skim') });
  }
  if (isSolid) {
    tools.push({ key: 'clean', label: 'Clean', icon: CleanToolIcon, onClick: () => onIntervention('Clean') });
  }

  // Anything big enough to stratify needs a way to be turned, whatever family it
  // belongs to. A miso mash is the classic case — it is the stiffest thing in
  // the game and therefore the fastest to separate, and it had no tool for it at
  // all: a paste could go badly stratified with nothing on screen to fix it.
  const stratifies = unevennessRate(batch.totalMass || 1000, 0.7) > 0.0001;
  if (stratifies && !tools.some(t => t.key === 'mix' || t.key === 'stir')) {
    tools.push({
      key: 'mix',
      label: 'Turn',
      icon: MixToolIcon,
      onClick: () => onIntervention('Mix'),
      disabled: isPaused,
    });
  }


  const alertText = isSpoiled
    ? 'Culture has spoiled — salvage via Bio-Reclamation or discard.'
    : needsAir
    ? 'Anaerobic stagnation: requires oxygen (open the lid).'
    : humidityRisk
    ? 'Excess moisture: bacterial rot imminent.'
    : tempRisk
    ? 'Hyperthermia: ethanolic breakdown underway.'
    : isKoji && isPaused
    ? 'Fungal hyphae re-weaving — transient pause after mechanical manipulation.'
    : null;

  return (
    <div className="modal-overlay">
      <div className="backdrop-blurscene">
        <div className="ghost-cubby" /><div className="ghost-cubby" /><div className="ghost-cubby" /><div className="ghost-cubby" />
      </div>

      <div className="ledger" style={{ maxHeight: '90vh' }}>
        <div className="corner c-tl" /><div className="corner c-tr" /><div className="corner c-bl" /><div className="corner c-br" />

        <div className="lhead">
          <div>
            <span className="type-tag">{recipe.type} &middot; {batch.vesselId} #{batch.id.slice(-4)}</span>
            <h1 className="slab">{recipe.name}</h1>
            <div className="gen mono">
              {batch.lineage && batch.lineage.generation > 1
                ? describeLineage(batch.lineage)
                : batch.generation > 1
                  ? `Lineage: Gen ${batch.generation} Culture`
                  : 'Lineage: Founder Culture'}
              {isSpoiled ? ' · Bio-Hazard' : isInPeakWindow ? ' · Peak Harvest Window' : batch.progress >= 100 ? ' · Mature / Ready' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="wood-panel" style={{ display: 'flex', borderRadius: 10, padding: 4, gap: 4 }}>
              <button onClick={() => setActiveTab('telemetry')} className={`chip-tab${activeTab === 'telemetry' ? ' active' : ''}`}>Bioreactor</button>
              <button onClick={() => setActiveTab('harvest')} className={`chip-tab${activeTab === 'harvest' ? ' active' : ''}`}>Harvest{isInPeakWindow && ' •'}</button>
            </div>
            <button onClick={onClose} className="close-stamp" title="Close Inspector">
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        <div className="lbody custom-scrollbar">
          {/* The run trace sits above both tabs: on Bioreactor it shows what is
              happening, on Harvest it is the post-mortem — and a finished batch
              opens straight onto Harvest, which is where it matters most. */}
          <div style={{ padding: '0 24px' }}>
            {maturityNote && (
              <div className="maturity-note">
                <span className="l">Maturing</span>
                <span className="v">{maturityNote}</span>
              </div>
            )}
            <RunTrace batch={batch} recipe={recipe} />
          </div>

          {activeTab === 'telemetry' ? (
            <>
              <div className="lcol-left">
                <div className="ring-stage">
                  <ProgressRing percent={batch.progress} color={isSpoiled ? 'var(--brick)' : isInPeakWindow ? 'var(--amber)' : 'var(--moss)'} />
                  <VesselArt vesselId={batch.vesselId} size={112} />
                </div>
                <div className="ribbon" style={isSpoiled ? { background: 'var(--brick)', color: '#fbe7df' } : undefined}>
                  {Math.round(batch.progress)}% &middot; {isSpoiled ? 'Spoiled' : isInPeakWindow ? 'Peak Window' : batch.progress >= 100 ? 'Mature' : 'Approaching Peak'}
                </div>
                <div className="progress-num">Peak window opens at <b>{recipe.peakWindowStart}%</b></div>
              </div>

              <div className="lcol-right">
                <div>
                  {batch.enzymes && (batch.enzymes.amylase > 0.5 || batch.enzymes.protease > 0.5) && (
                    <div className="steer" style={{ marginBottom: 14 }}>
                      <div className="sh">
                        <span className="l">Enzymes developing</span>
                        <span className="v">{describeEnzymes(batch.enzymes).label}</span>
                      </div>
                      <div className="strack">
                        <div
                          className="sfill"
                          style={{ width: `${(batch.enzymes.amylase / Math.max(1, batch.enzymes.amylase + batch.enzymes.protease)) * 100}%` }}
                        />
                      </div>
                      <div className="sends">
                        <span>protease {batch.enzymes.protease.toFixed(0)}</span>
                        <span>amylase {batch.enzymes.amylase.toFixed(0)}</span>
                      </div>
                      <p className="snote">
                        {describeEnzymes(batch.enzymes).detail} Nudge the heat and moisture now —
                        the bed is still deciding what it will be.
                      </p>
                    </div>
                  )}

                  <div className="section-lbl">Environmental Telemetry</div>
                  <div className="dial-row">
                    <TelemetryDial
                      value={`${batch.params.temp.toFixed(1)}°`} label="Temp" target={`${recipe.idealParams.temp}°`}
                      percent={Math.min(100, (batch.params.temp / (recipe.idealParams.temp * 1.6 || 1)) * 100)}
                      color={Math.abs(batch.params.temp - recipe.idealParams.temp) > 6 ? 'var(--brick)' : Math.abs(batch.params.temp - recipe.idealParams.temp) > 3 ? 'var(--amber)' : 'var(--moss)'}
                    />
                    <TelemetryDial
                      value={`${batch.params.humidity.toFixed(0)}%`} label="Humidity" target={`${recipe.idealParams.humidity}%`}
                      percent={batch.params.humidity}
                      color={Math.abs(batch.params.humidity - recipe.idealParams.humidity) > 10 ? 'var(--brick)' : Math.abs(batch.params.humidity - recipe.idealParams.humidity) > 5 ? 'var(--amber)' : 'var(--moss)'}
                    />
                    <TelemetryDial
                      value={`${batch.params.salinity.toFixed(1)}%`} label="Salinity" target={`${recipe.idealParams.salinity}%`}
                      percent={Math.min(100, batch.params.salinity * 5)}
                      color="var(--amber)"
                    />
                  </div>
                </div>

                <div className="peak-wrap">
                  <div className="section-lbl">{isKoji ? 'Thermal Hyphal Stress' : 'Fermentation Progress'}</div>
                  <div className="track">
                    {isKoji ? (
                      <div className="fill" style={{ width: `${Math.min(100, stress)}%`, background: stress > 80 ? 'var(--brick)' : stress > 40 ? 'var(--amber)' : 'var(--moss)' }} />
                    ) : (
                      <>
                        <div className="zone" style={{ left: `${Math.min(100, recipe.peakWindowStart)}%`, width: `${Math.max(4, recipe.peakWindowEnd - recipe.peakWindowStart)}%` }} />
                        <div className="fill" style={{ width: `${Math.min(100, batch.progress)}%` }} />
                        <div className="marker" style={{ left: `${Math.min(100, batch.progress)}%` }} />
                      </>
                    )}
                  </div>
                  {!isKoji && (
                    <div className="progress-num" style={{ textAlign: 'left', marginTop: 4 }}>
                      Safety: <b>{batch.quality.safety.toFixed(0)}/100</b>
                    </div>
                  )}
                </div>

                <ChamberPanel batch={batch} recipe={recipe} inventory={inventory} onSetControl={onSetControl} />

                {tools.length > 0 && (
                  <div>
                    <div className="section-lbl">Interventions</div>
                    <div className="tool-row">
                      {tools.map(t => (
                        <button key={t.key} className={`tool-btn${t.active ? ' on' : ''}`} disabled={t.disabled} onClick={t.onClick}>
                          <t.icon size={18} />
                          <span className="lbl">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {alertText && (
                  <div className="log-strip">
                    <LogLinesIcon size={11} />
                    <span><b>{isSpoiled ? 'Spoiled' : 'Warning'}</b> &middot; {alertText}</span>
                  </div>
                )}

                <div className="market">
                  <div className="cta-pair">
                    <button className="harvest-cta" onClick={onQuickHarvest} type="button">
                      <span className="big">Quick Harvest</span>
                      <span className="small">Sell to best offer (${highestOffer})</span>
                    </button>
                    {onStore && (
                      /* The counterpart to selling. Some batches are inputs, not
                         products — a koji you are about to make miso with should
                         not have to be sold and bought back. */
                      <button className="harvest-cta keep" onClick={onStore} type="button">
                        <span className="big">Keep</span>
                        <span className="small">Into the pantry, as an ingredient</span>
                      </button>
                    )}
                  </div>
                  <div className="buyer-list">
                    {buyers.slice(0, 3).map(buyer => {
                      const willBuy = buyerWillTake(batch, recipe, buyer, score);
                      const offer = calculateOffer(batch, recipe, buyer, offerCtx);
                      const price = offer.money;
                      const renownGain = offer.renown;
                      const BIcon = getBuyerIcon(buyer.type);
                      const accent = getBuyerAccentColor(buyer.type);
                      return (
                        <div key={buyer.id} className="buyer" style={!willBuy ? { opacity: 0.5 } : undefined}>
                          <span className="n"><BIcon size={12} color={accent} />{buyer.name}</span>
                          {buyer.paysIn === 'renown'
                            ? <span className="p plum">+{renownGain} Renown</span>
                            : <span className="p">${price.toLocaleString()}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="lcol-right" style={{ width: '100%', padding: '24px 28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(280px, 1.3fr)', gap: 20, alignItems: 'start' }}>
                {/* LEFT: sensory radar + tasting notes + processing bench */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="wood-panel" style={{ borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span className="section-lbl" style={{ marginBottom: 0 }}>Sensory Flavor Matrix</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>Score: {score}/100</span>
                    </div>
                    <div style={{ height: 190 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                          <PolarGrid stroke="rgba(243,233,216,0.15)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#c3b39a', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Target" dataKey="Ideal" stroke="var(--teal)" fill="var(--teal)" fillOpacity={0.15} />
                          <Radar name="Current" dataKey="Actual" stroke="var(--moss)" fill="var(--moss)" fillOpacity={0.4} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="wood-panel" style={{ borderRadius: 10, padding: 14 }}>
                    <div className="section-lbl">Organoleptic Tasting Notes</div>
                    {feedback.length === 0 ? (
                      <div className="log-strip ok"><span>Clean balanced profile. Ready for culinary evaluation.</span></div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {feedback.slice(0, 3).map((note, i) => (
                          <div key={i} className="log-strip"><span>{note}</span></div>
                        ))}
                      </div>
                    )}
                  </div>

                  {(canPress || canFilter) && (
                    <div className="wood-panel" style={{ borderRadius: 10, padding: 14 }}>
                      <div className="section-lbl">Post-Harvest Processing Bench</div>
                      <div className="tool-row">
                        {canPress && (
                          <button className="tool-btn" onClick={() => onProcess?.('press')}>
                            <ArrowDownToLine size={18} color="var(--teal)" />
                            <span className="lbl">{isWetMash ? 'Extract Sauce' : 'Hydro-Press'}</span>
                          </button>
                        )}
                        {canFilter && (
                          <button className="tool-btn" onClick={() => onProcess?.('filter')}>
                            <Filter size={18} color="var(--plum)" />
                            <span className="lbl">Clarify</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: buyer exchange + alternative destinations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="wood-panel" style={{ borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span className="section-lbl" style={{ marginBottom: 0 }}>Gastronomic Buyer Exchange</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span
                          className={`demand-chip ${demandLevel < 0.75 ? 'glut' : demandLevel > 1.02 ? 'keen' : ''}`}
                          title="Every sale of this ferment type cools the market for it. Appetite recovers each week."
                        >
                          {demandLevel < 0.75 ? 'Market glutted' : demandLevel > 1.02 ? 'Market keen' : 'Market steady'}
                          {' · '}{Math.round(demandLevel * 100)}%
                        </span>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-lo)' }}>{buyers.length} interested</span>
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, maxHeight: 260, overflowY: 'auto' }} className="custom-scrollbar">
                      {buyers.map(buyer => {
                        const willBuy = buyerWillTake(batch, recipe, buyer, score);
                        const offer = calculateOffer(batch, recipe, buyer, offerCtx);
                        const price = offer.money;
                        const renownGain = offer.renown;
                        const BIcon = getBuyerIcon(buyer.type);
                        const accent = getBuyerAccentColor(buyer.type);
                        return (
                          <div key={buyer.id} className="buyer" style={{ opacity: willBuy ? 1 : 0.55 }}>
                            <span className="n"><BIcon size={12} color={accent} />{buyer.name}</span>
                            {buyer.paysIn === 'renown'
                              ? <span className="p plum">+{renownGain} Renown</span>
                              : <span className="p">${price.toLocaleString()}</span>}
                            <span className="reject">"{willBuy ? buyer.dialogue.success : buyer.dialogue.reject}"</span>
                            {willBuy ? (
                              <button className="btn btn-moss" style={{ marginTop: 6, padding: '6px 10px', fontSize: 9 }} onClick={() => onSell?.(buyer, price, renownGain)}>
                                Accept <ArrowRightIcon size={11} color="var(--moss)" />
                              </button>
                            ) : (
                              <span className="reject" style={{ color: 'var(--brick)', marginTop: 4 }}>Req: {buyer.minScore} pts</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="wood-panel" style={{ borderRadius: 10, padding: 14 }}>
                    <div className="section-lbl">Alternative Batch Destinations</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {onCellar && canCellar && (
                        <button className="btn btn-plum" onClick={onCellar} title="Age this in the cellar — it keeps developing and frees the bench slot">
                          <Hourglass size={14} /> Lay down to age
                        </button>
                      )}
                      {onStore && (
                        <button className="btn btn-ghost" onClick={onStore} title="Into the pantry as an ingredient — a koji you can inoculate the next batch with, rather than a product you sell">
                          <Package size={14} /> Keep in Pantry
                        </button>
                      )}
                      {isKoji && isExemplary && onBackSlop && (
                        <button className="btn btn-ghost" onClick={onBackSlop}>
                          <Sprout size={14} color="var(--teal)" /> Back-Slop Inoculant
                        </button>
                      )}
                      {isKoji && isExemplary && onSporulate && (
                        <button className="btn btn-ghost" onClick={onSporulate}>
                          <Activity size={14} color="var(--amber)" /> Sporulate Lineage
                        </button>
                      )}
                      {onDiscard && (
                        <button className="btn btn-brick" style={{ marginLeft: 'auto' }} onClick={onDiscard}>
                          <Trash2 size={14} /> Discard / Clean
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PERSISTENT STATUS & HARVEST BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 28px', borderTop: '1px solid var(--line)', flexShrink: 0, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} className="mono">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-lo)', fontSize: 11 }}>Quality:</span>
              <span style={{ color: 'var(--amber)', fontWeight: 700, fontSize: 12 }}>{score}/100</span>
              <div style={{ display: 'flex', gap: 1 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={11} color="var(--amber)" fill={i < stars ? 'var(--amber)' : 'none'} />
                ))}
              </div>
            </div>
            <div className="divider-line" style={{ height: 16 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-lo)', fontSize: 11 }}>Est. Payout:</span>
              <span style={{ color: 'var(--moss)', fontWeight: 700, fontSize: 12 }}>${highestOffer}</span>
              {highestRenown > 0 && <span style={{ color: 'var(--plum)', fontWeight: 700, fontSize: 12 }}>+{highestRenown} Renown</span>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeTab === 'telemetry' ? (
              <>
                <button className="btn btn-ghost" onClick={() => setActiveTab('harvest')}>Open Harvest Studio</button>
                <button className="btn btn-amber" onClick={onQuickHarvest}>Quick Harvest (${highestOffer})</button>
              </>
            ) : (
              <button className="btn btn-ghost" onClick={() => setActiveTab('telemetry')}>Back to Bioreactor</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchInspector;

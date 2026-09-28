import React from 'react';
import { Batch, Recipe } from '../types';
import { SOIL_KINDS, soilGrade, soilYieldKg, newSoilState } from '../services/soil';
import { getControls } from '../services/gameLogic';

/* =============================================================================
   THE SOIL BATCH, READ

   A soil batch is judged on heat, air and time, not on a flavour profile, so
   the inspector shows those instead: what this kind wants, what it is getting,
   and the grade it is heading for. An instrument, so it is dark and its
   readings are monospaced; the one action it adds is turning a heap.
   ============================================================================= */

const WANTS: Record<string, string> = {
  sealed: 'Sealed. Keep the vent shut: air in a bucket is rot, not pickle.',
  cloth: 'Under a cloth: the vent cracked, breathing but covered. Sealed it builds pressure and goes to wine; open, it draws flies.',
  pumped: 'Air all the way through: the vent on forced, and the power on. Stop the pump and it goes anaerobic within hours.',
  aerobic: 'Air. A heap burns its oxygen as it heats, then cools; a turn puts both back.',
};

export const SoilPanel: React.FC<{ batch: Batch; recipe: Recipe; onTurn: () => void }> = ({ batch, recipe, onTurn }) => {
  const kind = SOIL_KINDS[recipe.id];
  if (!kind) return null;
  const s = batch.soil ?? newSoilState(batch.params.temp);
  const vent = getControls(batch).vent ?? 0;
  const grade = soilGrade(batch, recipe);
  const hotDays = s.hotTicks / 8;
  const airOk = kind.air === 'sealed' ? vent === 0 : kind.air === 'cloth' ? vent === 1 : kind.air === 'pumped' ? vent >= 2 : s.oxygen >= 45;
  return (
    <div className="soil-panel">
      <div className="sp-head">
        <span className="section-lbl">The soil lab</span>
        <span className="sp-grade">heading for grade <b className="mono">{grade}</b></span>
      </div>
      <p className="sp-wants">{WANTS[kind.air]}</p>
      <dl className="sp-read">
        <div><dt>Core</dt><dd className="mono">{batch.params.temp.toFixed(0)} °C</dd></div>
        {kind.selfHeats && <div><dt>Peak</dt><dd className="mono">{s.peakTemp.toFixed(0)} °C</dd></div>}
        {kind.selfHeats && <div className={hotDays >= 3 ? 'ok' : ''}><dt>Over 55 °C</dt><dd className="mono">{hotDays.toFixed(1)} of 3 d</dd></div>}
        {kind.air === 'aerobic' && <div className={s.oxygen < 30 ? 'bad' : ''}><dt>Oxygen</dt><dd className="mono">{Math.round(s.oxygen)}%</dd></div>}
        <div className={airOk ? 'ok' : 'bad'}><dt>Air</dt><dd className="mono">{airOk ? 'right' : 'wrong'}</dd></div>
        {kind.air === 'aerobic' && <div><dt>Turns</dt><dd className="mono">{s.turns}</dd></div>}
        <div><dt>Yield</dt><dd className="mono">{soilYieldKg(batch, recipe).toFixed(1)} kg</dd></div>
      </dl>
      {s.turned && <p className="sp-warn">Left too long: it has turned, and the grade is falling.</p>}
      {recipe.id === 'hot_compost' && hotDays < 3 && batch.progress > 60 && <p className="sp-warn">It has not cooked long enough to kill the weed seed. That caps the grade.</p>}
      {kind.air === 'aerobic' && batch.status !== 'spoiled' && (
        <button className="mini-btn gold" onClick={onTurn}>Turn the heap</button>
      )}
    </div>
  );
};

/** The harvest side: no critic and no market, just what goes into the pantry. */
export const SoilHarvest: React.FC<{ batch: Batch; recipe: Recipe; onStore?: () => void; onDiscard?: () => void }> = ({ batch, recipe, onStore, onDiscard }) => {
  const grade = soilGrade(batch, recipe);
  const kg = soilYieldKg(batch, recipe);
  const ready = batch.progress >= recipe.peakWindowStart;
  const spoiled = batch.status === 'spoiled';
  return (
    <div className="soil-harvest">
      <div className="section-lbl">For the land</div>
      <p className="sh-line">
        {spoiled ? 'It rotted. Tip it on the heap and start again.'
          : ready ? <>{kg.toFixed(1)} kg of {recipe.name.toLowerCase()}, grade <b>{grade}</b>. {grade >= 88 ? 'A strong batch: it goes further on a bed than a standard one.' : grade < 64 ? 'A weak batch: it takes more of it to do the same.' : 'Standard strength.'}</>
          : `Not ready: ${Math.round(batch.progress)} of ${recipe.peakWindowStart}.`}
      </p>
      <div className="cta-pair">
        {!spoiled && onStore && (
          <button className="harvest-cta" disabled={!ready} onClick={onStore} type="button">
            <span className="big">Into the pantry</span>
            <span className="small">{kg.toFixed(1)} kg, graded {grade}</span>
          </button>
        )}
        {onDiscard && (
          <button className="harvest-cta keep" onClick={onDiscard} type="button">
            <span className="big">Tip it out</span>
            <span className="small">Back onto the heap</span>
          </button>
        )}
      </div>
    </div>
  );
};

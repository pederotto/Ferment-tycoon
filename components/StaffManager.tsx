import PanelMark from './PanelMark';
import Portrait from './Portrait';
import React from 'react';
import GameIcon from './GameIcon';
import { CrewMember, StaffRoleType, GameState } from '../types';
import { STAFF_ROLES } from '../constants';
import { getTrait, describeCrewMember, crewWages } from '../services/crew';
import { CloseIcon } from './icons';
import SkillCard from './SkillCard';
import {
  CREW_LEVELS, progressOf, crewLevel, raisePerLevel, LEVEL_MAX, fermenterXp, gardenerXp, FERMENTER_LEVELS, GARDENER_LEVELS,
  craftRiskMult, craftYieldMult, craftSteadiness, gardenQualityBonus, gardenKgMult, GARDEN_SPOT_AT,
} from '../services/skills';
import { forageProgress, forageQualityBonus, foragePieceMult, lookMinutes } from '../services/wild';

/**
 * THE CREW
 *
 * This used to be four switches with fixed prices: you flipped the ones you
 * could afford and never thought about them again. The only question it asked
 * was whether you had the money, which is arithmetic, not a decision.
 *
 * Now it is a roster and a hiring pool. Everyone has a name, a wage they came
 * with, a trait that makes them good at one thing, and a skill that grows while
 * they work — so a cheap green technician who will be excellent in six months
 * is a genuinely different bet from an expensive one who is excellent today.
 *
 * The pool rotates monthly. Who is looking for work is part of the situation.
 */

interface StaffManagerProps {
  onClose: () => void;
  crew: CrewMember[];
  pool: CrewMember[];
  money: number;
  week: number;
  onHire: (candidate: CrewMember) => void;
  onLetGo: (id: string) => void;
  /** The whole game, for the player's own three tracks. */
  self?: GameState;
}

const ROLE_NAME: Record<StaffRoleType, string> = {
  cleaner: 'Porter',
  tech: 'Technician',
  chef: 'Sous Chef',
  rd: 'Head of R&D',
  toji: 'Koji Keeper',
  gardener: 'Gardener',
  orchardist: 'Orchardist',
  beekeeper: 'Beekeeper',
  poultry: 'Poultry Keeper',
  soil_tech: 'Soil Technician',
  forager: 'Forager’s Apprentice',
};

/* A hand's level on the 1-15 scale (services/skills.ts), and how far to the next. */
const Level: React.FC<{ c: CrewMember }> = ({ c }) => {
  const L = crewLevel(c);
  const p = progressOf(c.xp ?? CREW_LEVELS[L - 1], CREW_LEVELS);
  return (
    <span className="cw-level" title={p.max ? 'Level 15 of 15' : `Level ${L} of 15 · ${p.into} of ${p.span} experience to the next`}>
      <span className="lv">Lv {L}<small>/15</small></span>
      <span className="bar"><i style={{ width: `${Math.round((L - 1) / 14 * 100)}%` }} /></span>
    </span>
  );
};

const StaffManager: React.FC<StaffManagerProps> = ({
  onClose, crew, pool, money, week, onHire, onLetGo, self,
}) => {
  const payroll = crewWages(crew);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="crewroom" onClick={e => e.stopPropagation()}>
        <span className="corner c-tl" />
        <span className="corner c-br" />

        <div className="cw-head">
          <PanelMark name="crew" />
          <div>
            <span className="kicker">Week {week}</span>
            <h2>The Crew</h2>
          </div>
          <button className="close-stamp" onClick={onClose} aria-label="Close the crew roster">
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="cw-payroll">
          <span className="l"><GameIcon name="staff" size={12} /> Payroll</span>
          <span className={`v${payroll > 900 ? ' bad' : payroll > 450 ? ' warn' : ''}`}>
            ${payroll.toLocaleString()} / week
          </span>
          <span className="n">
            {payroll === 0
              ? 'Nobody on the books. Every vessel you own, you turn yourself.'
              : payroll > 900
                ? 'This is a serious wage bill. It comes out whether the benches are busy or not.'
                : 'Paid every week, busy or idle.'}
          </span>
        </div>

        <div className="cw-body custom-scrollbar">
          {self && (() => {
            const fp = progressOf(fermenterXp(self), FERMENTER_LEVELS);
            const gp = progressOf(gardenerXp(self), GARDENER_LEVELS);
            const wp = forageProgress(self);
            return (
              <section className="cw-self">
                <span className="cw-lbl">Your own hands</span>
                <SkillCard title="Fermenter" {...fp}
                  perks={[[`−${Math.round((1 - craftRiskMult(fp.level)) * 100)}%`, 'spoilage odds'], [`+${Math.round((craftYieldMult(fp.level) - 1) * 100)}%`, 'yield'], [`−${Math.round(craftSteadiness(fp.level) * 100)}%`, 'disturbance']]}
                  note="Earned by every batch you sell or cellar, more for a good one. It travels with each batch you seal, and never adds to the critic's score." />
                <SkillCard title="Gardener" {...gp}
                  perks={[[`+${gardenQualityBonus(gp.level)}`, 'grade'], [`×${gardenKgMult(gp.level).toFixed(2)}`, 'kilos picked']]}
                  note={`Earned by work on the land. From level ${GARDEN_SPOT_AT} you see a place's problems as you come in.`} />
                <SkillCard title="Forager" {...wp}
                  perks={[[`+${forageQualityBonus(wp.level)}`, 'grade'], [`×${foragePieceMult(wp.level).toFixed(2)}`, 'per find'], [`${lookMinutes(wp.level)} min`, 'a look']]}
                  note="Earned out in the wild: every look, tell, right call and kilo picked." />
              </section>
            );
          })()}
          <section>
            <span className="cw-lbl">On the books</span>
            {crew.length === 0 ? (
              <p className="cw-empty empty-mark">
                <PanelMark name="crew" size={56} faded />
                You are running this alone. That is fine while everything fits in a
                jar — a large vessel stratifies faster than one person can turn it.
              </p>
            ) : crew.map(c => {
              const trait = getTrait(c.traitId);
              return (
                <div key={c.id} className="cw-member">
                  <div className="mh">
                    <Portrait seed={c.id} size={46} className="cw-face" role={c.role} />
                    <div>
                      <span className="nm">{c.name}</span>
                      <span className="rl">{ROLE_NAME[c.role]} · {trait.label}</span>
                    </div>
                    <div className="rt">
                      <Level c={c} />
                      <span className="wg">${c.weeklyWage}/wk</span>
                    </div>
                  </div>
                  <p className="dsc">{describeCrewMember(c)}</p>
                  <div className="mf">
                    <span className="srv">
                      <GameIcon name="ledger_up" size={10} /> {c.weeksWorked} week{c.weeksWorked === 1 ? '' : 's'} in
                      {crewLevel(c) < LEVEL_MAX && <em> · still improving; each level is a {Math.round((raisePerLevel(c.role) - 1) * 100)}% raise</em>}
                    </span>
                    <button className="btn btn-ghost sm" onClick={() => onLetGo(c.id)}>Let go</button>
                  </div>
                </div>
              );
            })}
          </section>

          <section>
            <span className="cw-lbl"><GameIcon name="hire" size={12} /> Looking for work</span>
            <p className="cw-note">
              This lot are available now. The list changes every month whether you
              hire from it or not.
            </p>
            {pool.length === 0 ? (
              <p className="cw-empty empty-mark"><PanelMark name="crew" size={44} faded />Nobody about this month.</p>
            ) : pool.map(c => {
              const trait = getTrait(c.traitId);
              const afford = money >= c.hiringCost;
              return (
                <div key={c.id} className={`cw-candidate${afford ? '' : ' poor'}`}>
                  <div className="mh">
                    <Portrait seed={c.id} size={46} className="cw-face" role={c.role} />
                    <div>
                      <span className="nm">{c.name}</span>
                      <span className="rl">{ROLE_NAME[c.role]} · {trait.label}</span>
                    </div>
                    <div className="rt">
                      <Level c={c} />
                      <span className="wg">${c.weeklyWage}/wk</span>
                    </div>
                  </div>
                  <p className="quote">“{c.line}”</p>
                  <p className="dsc">{trait.blurb}</p>
                  <div className="mf">
                    <span className="srv">${c.hiringCost} to take on</span>
                    <button className="btn btn-amber sm" disabled={!afford} onClick={() => onHire(c)}>
                      {afford ? 'Hire' : 'Cannot afford'}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>

          <section>
            <span className="cw-lbl">What each role is for</span>
            {STAFF_ROLES.map(r => (
              <div key={r.id} className="cw-role">
                <span className="rn">{ROLE_NAME[r.id]}</span>
                <span className="re">{r.effectDescription}</span>
              </div>
            ))}
            <p className="cw-note">
              <GameIcon name="alert" size={10} /> A second person in the same role is worth
              having, but never as much as the first.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StaffManager;

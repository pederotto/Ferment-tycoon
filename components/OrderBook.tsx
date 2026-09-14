import PanelMark from './PanelMark';
import { BUYER_SEAL } from './sealSheet';
import React from 'react';
import GameIcon from './GameIcon';
import { Contract, GameState } from '../types';
import { BUYERS } from '../constants';
import {
  STANDING_TIERS, standingTier, getStanding, describeContractWant,
  contractProgressLabel, isVendorUnlocked, describeUnlock,
} from '../services/vendors';
import { CloseIcon } from './icons';
import { CheckCircle2 } from 'lucide-react';

/**
 * THE ORDER BOOK
 *
 * Who you deal with, what they think of you, and what you have promised them.
 *
 * The buyer list was a price comparison you consulted once per harvest and
 * forgot. This is the other half: the part that accumulates. A vendor you have
 * sold good stock to for twenty weeks pays a third more than a stranger and
 * offers you work that is not on anyone else's menu; a vendor you let down
 * remembers that instead.
 *
 * Contracts sit here rather than in the harvest screen on purpose. Signing one
 * is a decision about the next month of production, not about the batch in
 * front of you.
 */

interface OrderBookProps {
  gameState: GameState;
  onClose: () => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

const StandingBar: React.FC<{ value: number }> = ({ value }) => {
  const tier = standingTier(value);
  return (
    <div className="ob-standing">
      <div className="sb-track">
        {STANDING_TIERS.slice(1).map(t => (
          <span key={t.min} className="sb-notch" style={{ left: `${t.min}%` }} />
        ))}
        <div className="sb-fill" style={{ width: `${Math.max(2, value)}%` }} />
      </div>
      <span className="sb-lab">{tier.label}{tier.priceBonus > 0 && <em> · +{Math.round(tier.priceBonus * 100)}%</em>}</span>
    </div>
  );
};

/** A buyer's stamp, where one has been cut. */
const Seal: React.FC<{ id?: string; size?: number }> = ({ id, size = 26 }) =>
  id && BUYER_SEAL[id]
    ? <img className="seal" src={BUYER_SEAL[id]} style={{ width: size, height: size }} alt="" aria-hidden="true" draggable={false} />
    : null;

const OrderBook: React.FC<OrderBookProps> = ({ gameState, onClose, onAccept, onDecline }) => {
  const offered = gameState.contracts.filter(c => c.status === 'offered');
  const active = gameState.contracts.filter(c => c.status === 'active');
  const settled = gameState.contracts.filter(c => c.status === 'complete' || c.status === 'failed').slice(0, 6);

  // Vendors you have actually met, best relationship first. An unmet vendor is
  // listed too, but only by what it would take to reach them.
  const known = BUYERS
    .filter(b => isVendorUnlocked(b, gameState) && b.type !== 'Underground')
    .sort((a, b) => getStanding(gameState, b.id) - getStanding(gameState, a.id));
  const locked = BUYERS.filter(b => !isVendorUnlocked(b, gameState) && b.type !== 'Underground');

  const weeksLeft = (c: Contract) => c.dueWeek - gameState.week;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="orderbook" onClick={e => e.stopPropagation()}>
        <span className="corner c-tl" />
        <span className="corner c-br" />

        <div className="ob-head">
          <PanelMark name="orders" />
          <div>
            <span className="kicker">Week {gameState.week}</span>
            <h2>The Order Book</h2>
          </div>
          <button className="close-stamp" onClick={onClose} aria-label="Close the order book">
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="ob-body custom-scrollbar">
          {/* --- offers on the table --- */}
          {offered.length > 0 && (
            <section>
              <span className="ob-lbl"><GameIcon name="handshake" size={12} /> On the table</span>
              {offered.map(c => (
                <div key={c.id} className="ob-offer">
                  <div className="oh">
                    <Seal id={c.buyerId} />
                    <span className="who">{c.buyerName}</span>
                    <span className="pay">${c.pricePerUnit.toLocaleString()} <em>per unit</em></span>
                  </div>
                  <p className="pitch">“{c.pitch}”</p>
                  <div className="terms">
                    <span><b>{c.unitsRequired}</b> units of {describeContractWant(c)}</span>
                    <span>scoring <b>{c.minScore}+</b></span>
                    <span>by week <b>{c.dueWeek}</b></span>
                    <span className="worth">worth ${(c.pricePerUnit * c.unitsRequired).toLocaleString()}</span>
                  </div>
                  <p className="risk">
                    Fail and it costs ${c.cashPenalty.toLocaleString()} and their goodwill. Contracted stock
                    does not glut the market — that is what you are buying.
                  </p>
                  <div className="acts">
                    <button className="btn btn-amber" onClick={() => onAccept(c.id)}>Sign it</button>
                    <button className="btn btn-ghost" onClick={() => onDecline(c.id)}>Turn it down</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* --- what you owe --- */}
          <section>
            <span className="ob-lbl"><GameIcon name="clock" size={12} /> Promised</span>
            {active.length === 0 ? (
              <p className="ob-empty">
                Nothing outstanding. Sell good stock to the same vendor a few times
                and they will start offering you work.
              </p>
            ) : active.map(c => {
              const left = weeksLeft(c);
              const tight = left <= 1;
              return (
                <div key={c.id} className={`ob-active${tight ? ' tight' : ''}`}>
                  <div className="oh">
                    <span className="who">{c.buyerName}</span>
                    <span className={`due${tight ? ' bad' : ''}`}>
                      {left < 0 ? 'overdue' : left === 0 ? 'due this week' : `${left} week${left === 1 ? '' : 's'} left`}
                    </span>
                  </div>
                  <div className="terms">
                    <span>{describeContractWant(c)} · <b>{c.minScore}+</b></span>
                    <span>{contractProgressLabel(c)}</span>
                    <span className="worth">${c.pricePerUnit.toLocaleString()}/unit</span>
                  </div>
                  <div className="ptrack">
                    <div className="pfill" style={{ width: `${(c.unitsDelivered / c.unitsRequired) * 100}%` }} />
                  </div>
                  {tight && (
                    <p className="risk bad">
                      <GameIcon name="alert" size={11} /> ${c.cashPenalty.toLocaleString()} and {c.standingPenalty} standing
                      if this is not finished.
                    </p>
                  )}
                </div>
              );
            })}
          </section>

          {/* --- who you deal with --- */}
          <section>
            <span className="ob-lbl">Standing</span>
            {known.map(b => {
              const v = getStanding(gameState, b.id);
              const tier = standingTier(v);
              const line = v >= 60 ? b.warmth?.trusted : v >= 15 ? b.warmth?.known : b.warmth?.cool;
              return (
                <div key={b.id} className="ob-vendor">
                  <div className="oh">
                    <Seal id={b.id} />
                    <span className="who">{b.name}</span>
                    <span className="mult">×{b.priceMultiplier}{b.paysIn === 'renown' && ' renown'}</span>
                  </div>
                  <StandingBar value={v} />
                  <p className="blurb">{line || tier.blurb}</p>
                </div>
              );
            })}
          </section>

          {/* --- who you have not met --- */}
          {locked.length > 0 && (
            <section>
              <span className="ob-lbl"><GameIcon name="lock" size={12} /> Not yet</span>
              {locked.map(b => (
                <div key={b.id} className="ob-locked">
                  <Seal id={b.id} size={20} />
                  <span className="who">{b.name}</span>
                  <span className="how">{b.unlock ? describeUnlock(b.unlock) : `Reputation ${b.minReputation}.`}</span>
                </div>
              ))}
            </section>
          )}

          {/* --- history --- */}
          {settled.length > 0 && (
            <section>
              <span className="ob-lbl">Settled</span>
              {settled.map(c => (
                <div key={c.id} className={`ob-settled${c.status === 'failed' ? ' failed' : ''}`}>
                  {c.status === 'complete'
                    ? <CheckCircle2 size={12} color="var(--moss)" />
                    : <GameIcon name="alert" size={12} color="var(--brick)" />}
                  <span className="who">{c.buyerName}</span>
                  <span className="what">{c.unitsRequired} × {describeContractWant(c)}</span>
                  <span className="res">{c.status === 'complete' ? 'delivered' : 'failed'}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderBook;

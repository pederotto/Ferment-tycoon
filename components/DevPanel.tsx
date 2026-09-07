import React, { useState } from 'react';
import { GameState, Batch } from '../types';
import { BOOKS, RECIPES, INGREDIENTS, VESSELS, getUndergroundTierFromXp } from '../constants';
import { CloseIcon } from './icons';

/**
 * DEV PANEL — testing tools, not a game feature.
 *
 * Opened with Ctrl/Cmd+Shift+D, or by loading the page with ?dev in the URL.
 * Nothing here is reachable in normal play, and the whole component can be
 * deleted without touching game code.
 */

interface DevPanelProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  onClose: () => void;
  godMode: boolean;
  setGodMode: (on: boolean) => void;
}

const DevPanel: React.FC<DevPanelProps> = ({ gameState, setGameState, onClose, godMode, setGodMode }) => {
  const [note, setNote] = useState<string | null>(null);
  const say = (t: string) => { setNote(t); setTimeout(() => setNote(null), 2200); };

  const patch = (p: Partial<GameState>) => setGameState(prev => ({ ...prev, ...p }));

  const unlockEverything = () => {
    patch({
      unlockedRecipes: RECIPES.map(r => r.id),
      analyzedRecipeIds: RECIPES.map(r => r.id),
      ownedBookIds: BOOKS.map(b => b.id),
      ownedVesselIds: VESSELS.map(v => v.id),
    });
    say('Every recipe, book and vessel unlocked.');
  };

  const maxMastery = () => {
    const all: GameState['recipeMastery'] = {};
    RECIPES.forEach(r => {
      all[r.id] = { xp: 9999, level: 5, cooks: 99, bestScore: 100 };
    });
    patch({ recipeMastery: all });
    say('Every recipe at Hand 5 — the full advice ladder is readable.');
  };

  const stockPantry = () => {
    const inv = { ...gameState.inventory };
    INGREDIENTS.forEach(i => { inv[i.id] = 99; });
    patch({ inventory: inv });
    say('99 of every ingredient, including the grey market.');
  };

  const finishBatches = () => {
    patch({
      batches: gameState.batches.map((b: Batch) => ({
        ...b,
        progress: Math.max(b.progress, (b.cachedRecipe?.peakWindowStart ?? 90) + 2),
        status: b.status === 'spoiled' ? 'spoiled' : 'ready',
      })),
    });
    say('All running batches jumped to their peak window.');
  };

  const jump = (weeks: number) => {
    setGameState(prev => {
      let week = prev.week + weeks;
      let month = prev.month + Math.floor(weeks / 4);
      let year = prev.year;
      while (month > 11) { month -= 12; year += 1; }
      return { ...prev, week, month, year };
    });
    say(`Jumped ${weeks} week${weeks === 1 ? '' : 's'}.`);
  };

  const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="dev-row">
      <span className="dl">{label}</span>
      <span className="dv">{children}</span>
    </div>
  );

  return (
    <div className="dev-panel">
      <div className="dev-head">
        <div>
          <h3>Dev tools</h3>
          <span className="sub">Ctrl/Cmd+Shift+D to toggle · not reachable in normal play</span>
        </div>
        <button className="close-stamp" onClick={onClose} aria-label="Close dev tools">
          <CloseIcon size={12} />
        </button>
      </div>

      <div className="dev-body">
        <label className="dev-god">
          <input
            type="checkbox"
            checked={godMode}
            onChange={(e) => {
              setGodMode(e.target.checked);
              say(e.target.checked ? 'God mode on — purchases are free, bills are waived.' : 'God mode off.');
            }}
          />
          <span>
            <b>God mode</b>
            <em>Money never falls. Bills, wages and fines are waived; nothing is unaffordable.</em>
          </span>
        </label>

        <Row label="Funds">
          {[1000, 10000, 100000].map(n => (
            <button key={n} className="dev-btn" onClick={() => { patch({ money: gameState.money + n }); say(`+$${n.toLocaleString()}`); }}>
              +${n >= 1000 ? `${n / 1000}k` : n}
            </button>
          ))}
        </Row>

        <Row label="Bench xp">
          {[250, 700, 1500].map(n => (
            <button key={n} className="dev-btn" onClick={() => { patch({ xp: n }); say(`xp set to ${n} — underground tier ${getUndergroundTierFromXp(n)}`); }}>
              {n}
            </button>
          ))}
        </Row>

        <Row label="Renown">
          {[25, 100, 500].map(n => (
            <button key={n} className="dev-btn" onClick={() => { patch({ renown: n }); say(`Renown set to ${n}`); }}>{n}</button>
          ))}
        </Row>

        <Row label="Reputation">
          {[10, 30, 60].map(n => (
            <button key={n} className="dev-btn" onClick={() => { patch({ reputation: n }); say(`Reputation set to ${n}`); }}>{n}</button>
          ))}
        </Row>

        <Row label="Inspector heat">
          {[0, 60, 95].map(n => (
            <button key={n} className="dev-btn" onClick={() => { patch({ heat: n }); say(`Heat set to ${n}%`); }}>{n}%</button>
          ))}
        </Row>

        <Row label="Hygiene">
          {[100, 50, 10].map(n => (
            <button key={n} className="dev-btn" onClick={() => { patch({ hygiene: n }); say(`Hygiene set to ${n}%`); }}>{n}%</button>
          ))}
        </Row>

        <Row label="Time">
          <button className="dev-btn" onClick={() => jump(1)}>+1 wk</button>
          <button className="dev-btn" onClick={() => jump(4)}>+1 mo</button>
          <button className="dev-btn" onClick={() => jump(12)}>+1 season</button>
        </Row>

        <div className="dev-actions">
          <button className="btn btn-ghost" onClick={unlockEverything}>Unlock all recipes, books &amp; vessels</button>
          <button className="btn btn-ghost" onClick={maxMastery}>Max every mastery track</button>
          <button className="btn btn-ghost" onClick={stockPantry}>Stock 99 of every ingredient</button>
          <button className="btn btn-ghost" onClick={finishBatches}>Finish all running batches</button>
          <button
            className="btn btn-brick"
            onClick={() => { patch({ insolvencyStrikes: 0, gameOver: false, undergroundBusts: 0 }); say('Insolvency and bust record cleared.'); }}
          >
            Clear strikes &amp; busts
          </button>
        </div>

        {note && <div className="dev-note">{note}</div>}
      </div>
    </div>
  );
};

export default DevPanel;

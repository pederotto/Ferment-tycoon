import React from 'react';
import PanelMark from './PanelMark';
import { Batch } from '../types';
import { getRecipeForBatch, isAgitatedFerment } from '../services/gameLogic';
import IsoAppliance, { ApplianceId } from './IsoAppliance';

/**
 * THE RACK
 *
 * The hardware you own, and whether any of it is working. It stood in the
 * painted room for a while and never read right — the sheet draws each tool from
 * one angle while the room recedes to a vanishing point, so half of them faced
 * out of it and none looked like they were standing on anything.
 *
 * Lifted out of the scene entirely so it can live in the side rail, where there
 * is room for a list. That is also where it belongs: what you own is a fact
 * about your operation, not a feature of the room.
 */

export const RACK: { id: ApplianceId; label: string; opens?: boolean }[] = [
  { id: 'wooden_press', label: 'Wooden Press', opens: true },
  { id: 'centrifuge',   label: 'Centrifuge',   opens: true },
  { id: 'humidifier',   label: 'Ultrasonic Mister' },
  { id: 'portable_fan', label: 'Clip-on Fan' },
  { id: 'agitator',     label: 'Geared Agitator' },
  { id: 'mash_paddle',  label: 'Mash Paddle' },
];

interface ToolRackProps {
  inventory: Record<string, number>;
  batches: Batch[];
  onOpenTool?: (id: string) => void;
}

const ToolRack: React.FC<ToolRackProps> = ({ inventory, batches, onOpenTool }) => {
  const owned = RACK.filter(h => (inventory[h.id] ?? 0) > 0);
  if (owned.length === 0) {
    return <p className="rack-empty empty-mark"><PanelMark name="hardware" size={40} faded />Nothing yet. Tools are bought from Supply.</p>;
  }

  // A tool is "running" when a batch is actually calling on it this tick — the
  // fan turns while something is vented, the mister plumes while anything mists.
  const venting = batches.some(b => (b.controls?.vent ?? 0) >= 3);
  const misting = batches.some(b => (b.controls?.mist ?? 0) > 0);
  const stirring = batches.some(b => isAgitatedFerment(getRecipeForBatch(b)));

  return (
    <div className="rack">
      {owned.map(h => {
        const on = h.id === 'portable_fan' ? venting
          : h.id === 'humidifier' ? misting
          : h.id === 'agitator' ? stirring
          : false;
        const cls = `tool-card${on ? ' running' : ''}${h.opens ? ' opens' : ''}`;
        const art = (
          <>
            <svg viewBox="-80 -80 160 160" className="tc-art" aria-hidden="true">
              <IsoAppliance id={h.id} scale={0.85} running={on} />
            </svg>
            <span className="tc-name">{h.label}</span>
            <span className="tc-state">{on ? 'running' : h.opens ? 'open it' : 'idle'}</span>
          </>
        );
        return h.opens ? (
          <button key={h.id} type="button" className={cls}
                  onClick={() => onOpenTool?.(h.id)} title={`Open the ${h.label}`}>
            {art}
          </button>
        ) : (
          <div key={h.id} className={cls} title={h.label}>{art}</div>
        );
      })}
    </div>
  );
};

export default ToolRack;

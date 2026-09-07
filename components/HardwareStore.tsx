
import React from 'react';
import { Vessel, Ingredient } from '../types';
import { VESSELS } from '../constants';
import { ChevronDown } from 'lucide-react';
import { WrenchIcon, BoltIcon, JarOutlineIcon, BatteryIcon, VesselLineIcon, getToolIcon } from './icons';

interface HardwareStoreProps {
    isOpen: boolean;
    onToggle: () => void;
    money: number;
    ownedVesselIds: string[];
    tools: Ingredient[];
    inventory: Record<string, number>;
    currentPower?: number;
    maxPower?: number;
    onBuyVessel: (vessel: Vessel) => void;
    onBuyTool: (tool: Ingredient) => void;
    onUpgradePower?: (additionalPower: number, cost: number) => void;
}

const HardwareStore: React.FC<HardwareStoreProps> = ({
    isOpen,
    onToggle,
    money,
    ownedVesselIds,
    tools,
    inventory,
    currentPower = 0,
    maxPower = 100,
    onBuyVessel,
    onBuyTool,
    onUpgradePower
}) => {
    const totalVessels = VESSELS.length;
    const ownedVesselCount = ownedVesselIds.length;
    const isOverloaded = currentPower > maxPower;

    return (
        // When closed, 46px of the drawer peeks out as a grab tab. That peek used
        // to land on top of the HUD and cover the three gauge rings, so the tab is
        // offset by the 72px header height and the whole drawer sits behind the
        // HUD (z-20 vs the HUD's z-30) while it slides.
        <div
            className="fixed top-0 left-0 right-0 z-20 flex flex-col items-center pointer-events-none"
            style={{
                transform: isOpen ? 'translateY(0)' : 'translateY(calc(-100% + 46px + var(--hud-h)))',
                transition: 'transform 0.5s ease'
            }}
        >
            <div className="sheet" style={{ borderRadius: '0 0 20px 20px', width: 'min(1200px, 96vw)', maxHeight: '82vh', pointerEvents: 'auto' }}>
                <div className="shead">
                    <div className="ttl">
                        <div className="ic"><WrenchIcon size={18} /></div>
                        <div>
                            <h1 className="slab">Lab Equipment &amp; Hardware</h1>
                            <div className="sub">Vessels, machinery, and the power to run them</div>
                        </div>
                    </div>
                    <div className="grid-ticket">
                        <BoltIcon size={14} />
                        <div>
                            <div className="g-lbl">Electrical Grid</div>
                            <div className="g-val mono">
                                {currentPower}W <span style={{ color: 'var(--text-lo)' }}>/ {maxPower}W</span>
                                {isOverloaded && <span style={{ color: 'var(--brick)', fontSize: 10 }}> OVERLOAD</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="cols custom-scrollbar">
                    {/* VESSELS */}
                    <div>
                        <div className="col-head"><JarOutlineIcon size={13} />Fermentation Vessels</div>
                        {VESSELS.map(vessel => {
                            const isOwned = ownedVesselIds.includes(vessel.id);
                            const canAfford = money >= vessel.cost;
                            return (
                                <div key={vessel.id} className={`eq-card${isOwned ? ' owned' : ''}`}>
                                    <div className="eq-top">
                                        <div className="eq-left">
                                            <div className="eq-ic" style={{ color: isOwned ? 'var(--moss)' : 'var(--amber)' }}>
                                                <VesselLineIcon vesselId={vessel.id} size={16} />
                                            </div>
                                            <div>
                                                <div className="eq-name">{vessel.name}</div>
                                                <div className="eq-meta">
                                                    Cap {vessel.capacityL}L &middot; {vessel.slotsRequired} slot{vessel.slotsRequired > 1 ? 's' : ''}
                                                    {vessel.powerDraw > 0 && <> &middot; <span className="watt">{vessel.powerDraw}W</span></>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {isOwned ? (
                                        <div className="eq-btn owned-tag">Acquired</div>
                                    ) : (
                                        <button onClick={() => canAfford && onBuyVessel(vessel)} disabled={!canAfford} aria-label={`Buy ${vessel.name} for $${vessel.cost}`} className={`eq-btn${!canAfford ? ' disabled' : ''}`}>
                                            {canAfford ? `Purchase $${vessel.cost}` : `Need $${vessel.cost}`}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* TOOLS */}
                    <div>
                        <div className="col-head"><BoltIcon size={13} color="var(--text-lo)" />Machinery &amp; Tools</div>
                        {tools.map(tool => {
                            const count = inventory[tool.id] || 0;
                            const canAfford = money >= tool.baseCost;
                            const ToolIcon = getToolIcon(tool.id);
                            return (
                                <div key={tool.id} className="eq-card">
                                    <div className="eq-top">
                                        <div className="eq-left">
                                            <div className="eq-ic"><ToolIcon size={17} /></div>
                                            <div>
                                                <div className="eq-name">
                                                    {tool.name}
                                                    {count > 0 && <span style={{ color: 'var(--moss)', fontSize: 9, marginLeft: 6 }}>&times;{count} owned</span>}
                                                </div>
                                                <div className="eq-meta">{tool.description}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => canAfford && onBuyTool(tool)} disabled={!canAfford} aria-label={`Buy ${tool.name} for $${tool.baseCost}`} className={`eq-btn${!canAfford ? ' disabled' : ''}`}>
                                        {canAfford ? `Buy Unit $${tool.baseCost}` : `Need $${tool.baseCost}`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* POWER */}
                    <div>
                        <div className="col-head"><BatteryIcon size={13} />Power Infrastructure</div>

                        <div className="eq-card">
                            <div className="breaker">
                                <div className="lever"><div className="knob" style={{ top: 2 }} /></div>
                                <div style={{ flex: 1 }}>
                                    <div className="eq-name">Sub-Panel Breaker</div>
                                    <div className="power-desc">+50W capacity. Dedicated breaker switches prevent brownouts.</div>
                                </div>
                            </div>
                            <button
                                onClick={() => money >= 500 && onUpgradePower?.(50, 500)}
                                disabled={money < 500}
                                className="eq-btn power"
                                style={money < 500 ? { background: 'rgba(0,0,0,0.2)', color: 'var(--text-lo)', borderColor: 'var(--line)' } : undefined}
                            >
                                {money >= 500 ? 'Upgrade $500' : 'Need $500'}
                            </button>
                        </div>

                        <div className="eq-card">
                            <div className="breaker">
                                <div className="lever"><div className="knob" style={{ top: 2 }} /></div>
                                <div style={{ flex: 1 }}>
                                    <div className="eq-name">3-Phase Service</div>
                                    <div className="power-desc">+100W capacity. Heavy-duty conduit for dense incubation.</div>
                                </div>
                            </div>
                            <button
                                onClick={() => money >= 1000 && onUpgradePower?.(100, 1000)}
                                disabled={money < 1000}
                                className="eq-btn power"
                                style={money < 1000 ? { background: 'rgba(0,0,0,0.2)', color: 'var(--text-lo)', borderColor: 'var(--line)' } : undefined}
                            >
                                {money >= 1000 ? 'Upgrade $1,000' : 'Need $1,000'}
                            </button>
                        </div>

                        {isOverloaded && (
                            <div className="eq-card" style={{ borderColor: 'rgba(179,69,47,0.4)' }}>
                                <div className="breaker">
                                    <div className="lever" style={{ borderColor: 'rgba(179,69,47,0.5)' }}><div className="knob" style={{ top: 18, background: 'var(--brick)' }} /></div>
                                    <div style={{ flex: 1 }}>
                                        <div className="eq-name">Grid Status</div>
                                        <div className="power-desc" style={{ color: '#e0a58f' }}>
                                            Drawing {currentPower}W on a {maxPower}W breaker &mdash; heating is offline until load drops.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pull Handle */}
            <div
                className="wood-panel"
                style={{
                    borderRadius: '0 0 12px 12px', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer', pointerEvents: 'auto', borderTop: 'none'
                }}
                onClick={onToggle}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber)' }}>
                    <WrenchIcon size={14} color="var(--amber)" />
                    <span className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Hardware Store</span>
                </div>
                <div className="divider-line" style={{ height: 16 }} />
                <div className="mono" style={{ display: 'flex', gap: 14, fontSize: 9, color: 'var(--text-lo)', whiteSpace: 'nowrap' }}>
                    <span>Vessels: {ownedVesselCount}/{totalVessels}</span>
                    <span>Grid: {currentPower}W/{maxPower}W</span>
                    <span>Balance: ${money.toLocaleString()}</span>
                </div>
                <ChevronDown size={15} color="var(--text-lo)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
            </div>
        </div>
    );
};

export default HardwareStore;

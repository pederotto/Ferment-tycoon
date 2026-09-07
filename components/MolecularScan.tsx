
import React from 'react';
import { Ingredient, Vessel, Recipe } from '../types';
import { masteryReveal } from '../services/mastery';
import { Activity, Zap, Thermometer, Droplets, Flame, Utensils } from 'lucide-react';
import { SearchIcon } from './icons';

export type ScanTarget =
  | { type: 'ingredient'; data: Ingredient }
  | { type: 'vessel'; data: Vessel }
  | { type: 'recipe'; data: Recipe; masteryLevel?: number };

interface MolecularScanProps {
  target: ScanTarget;
  className?: string;
  embedded?: boolean; // If true, removes absolute positioning for use in footers
}

const MolecularScan: React.FC<MolecularScanProps> = ({ target, className = '', embedded = false }) => {
  const { type, data } = target;

  const renderBar = (label: string, value: number, max: number, color: string, icon: React.ReactNode) => (
    <div className="flex items-center gap-2 w-full">
        <div className="w-4 shrink-0 flex justify-center" style={{ color: 'var(--text-lo)' }}>{icon}</div>
        <div className="flex-1 min-w-0">
            <div className="h-1.5 rounded-full overflow-hidden relative" style={{ background: 'var(--bg-cubby)', border: '1px solid var(--line)' }}>
                <div className="h-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}></div>
            </div>
        </div>
        <span className="text-[9px] font-mono w-4 text-right" style={{ color }}>{value}</span>
    </div>
  );

  const getContent = () => {
    switch (type) {
      case 'ingredient': {
        const ing = data as Ingredient;
        const massDisplay = ing.mass > 0 ? (ing.mass >= 1000 ? `${(ing.mass/1000).toFixed(1)}kg` : `${ing.mass}${ing.unitDisplay}`) : '-';
        return (
          <div className="flex flex-col gap-1 w-full">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full">
               {renderBar("Prot", ing.hiddenStats.proteinContent, 10, "var(--brick)", <Utensils className="w-3 h-3"/>)}
               {renderBar("Lip", ing.hiddenStats.fatContent, 10, "var(--brass)", <Flame className="w-3 h-3"/>)}
               {renderBar("Glu", ing.hiddenStats.sugarContent, 10, "var(--amber)", <Zap className="w-3 h-3"/>)}
               {renderBar("Sod", ing.hiddenStats.nativeSalinity, 10, "var(--teal)", <Droplets className="w-3 h-3"/>)}
               {renderBar("Mic", ing.hiddenStats.microbialDiversity, 10, "var(--plum)", <Activity className="w-3 h-3"/>)}
            </div>
            <div className="mt-1 pt-1 flex justify-between items-center" style={{ borderTop: '1px solid var(--line)' }}>
               <span className="text-[9px] font-mono uppercase" style={{ color: 'var(--text-lo)' }}>Mass</span>
               <span className="font-mono font-bold text-xs" style={{ color: 'var(--moss)' }}>{massDisplay}</span>
            </div>
          </div>
        );
      }
      case 'vessel': {
        const v = data as Vessel;
        return (
          <div className="space-y-2 w-full">
             <div className="flex items-center justify-between p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)' }}>
                <span className="text-[9px] font-mono uppercase" style={{ color: 'var(--text-lo)' }}>Power</span>
                <span className="text-xs font-mono font-bold flex items-center gap-1" style={{ color: 'var(--amber)' }}><Zap className="w-3 h-3"/> {v.powerDraw}W</span>
             </div>
             {renderBar("Insulation", v.insulationFactor * 10, 10, "var(--teal)", <Thermometer className="w-3 h-3"/>)}
          </div>
        );
      }
      case 'recipe': {
        // Same gate as the Codex: hovering a recipe must not leak what mastery sells.
        const rev = masteryReveal(target.data, target.masteryLevel ?? 0);
        const r = data as Recipe;
        return (
          <div className="space-y-2 w-full">
             {renderBar("Complex", r.difficulty, 10, "var(--plum)", <Activity className="w-3 h-3"/>)}
             <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="p-1 rounded text-center" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line)' }}>
                   <div className="text-[8px] uppercase" style={{ color: 'var(--text-lo)' }}>Temp</div>
                   <div className="text-sm font-mono font-bold" style={{ color: 'var(--moss)' }}>{rev.temp}</div>
                </div>
                <div className="p-1 rounded text-center" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line)' }}>
                   <div className="text-[8px] uppercase" style={{ color: 'var(--text-lo)' }}>Humid</div>
                   <div className="text-sm font-mono font-bold" style={{ color: 'var(--teal)' }}>{rev.humidity}</div>
                </div>
             </div>
          </div>
        );
      }
    }
  };

  const containerClasses = embedded
    ? `w-full flex gap-3 md:gap-6 ${className}`
    : `absolute z-50 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden w-[calc(100vw-2rem)] max-w-sm ${className}`;

  const containerStyle: React.CSSProperties = embedded
    ? {}
    : { background: 'rgba(15,11,7,0.95)', border: '1px solid var(--line-strong)' };

  return (
    <div className={containerClasses} style={containerStyle}>
       {/* Identity Column */}
       <div
         className={embedded ? 'w-1/3 md:w-1/3 pr-2 shrink-0 flex flex-col justify-center' : ''}
         style={embedded ? { borderRight: '1px solid var(--line)' } : { borderBottom: '1px solid var(--line-strong)' }}
       >
          <div className="flex flex-col h-full justify-center" style={!embedded ? { padding: 12, background: 'rgba(157,139,176,0.08)' } : undefined}>
              <div className="flex items-center gap-1 mb-1" style={{ color: 'var(--plum)' }}>
                  <SearchIcon size={11} color="var(--plum)" />
                  <span className="text-[8px] font-mono font-bold uppercase tracking-widest hidden md:inline">Scan</span>
              </div>
              <h2 className={`${embedded ? 'text-xs md:text-xl' : 'text-lg'} font-bold leading-tight font-mono mb-1 line-clamp-2`} style={{ color: 'var(--text-hi)' }}>
                  {data.name}
              </h2>
              {embedded && (
                 <span className="text-[8px] font-mono uppercase truncate" style={{ color: 'var(--text-lo)' }}>{data.id}</span>
              )}
          </div>
       </div>

       {/* Data Column */}
       <div className={embedded ? 'flex-1 flex items-center' : 'p-4'}>
          {getContent()}
       </div>
    </div>
  );
};

export default MolecularScan;

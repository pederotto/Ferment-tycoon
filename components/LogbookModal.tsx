import React, { useState, useMemo } from 'react';
import { LogEntry, Recipe, FermentType } from '../types';
import { RECIPES, VESSELS } from '../constants';
import { Star, Sparkles, Award, CheckCircle2, HelpCircle, Thermometer, Droplets, Clock, Box } from 'lucide-react';
import { CloseIcon, BookIcon, SearchIcon } from './icons';

interface LogbookModalProps {
  onClose: () => void;
  logbook: LogEntry[];
  analyzedRecipeIds: string[];
}

const LogbookModal: React.FC<LogbookModalProps> = ({ onClose, logbook, analyzedRecipeIds }) => {
  const [activeTab, setActiveTab] = useState<'codex' | 'archives'>('codex');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const filteredRecipes = useMemo(() => {
    return RECIPES.filter(recipe => {
      if (recipe.id === 'bio_sludge') return false;
      const matchesType = selectedType === 'ALL' || recipe.type === selectedType;
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [searchQuery, selectedType]);

  const filteredArchives = useMemo(() => {
    return logbook.filter(entry => {
      const query = searchQuery.toLowerCase();
      return entry.recipeName.toLowerCase().includes(query) ||
             entry.substrateName.toLowerCase().includes(query) ||
             (entry.notes && entry.notes.toLowerCase().includes(query));
    });
  }, [logbook, searchQuery]);

  const totalValue = useMemo(() => logbook.reduce((sum, e) => sum + (e.value || 0), 0), [logbook]);
  const discoveredCount = useMemo(() => {
    const known = RECIPES.filter(r => analyzedRecipeIds.includes(r.id) && r.id !== 'bio_sludge');
    return known.length;
  }, [analyzedRecipeIds]);

  const fermentTypes = [
    { label: 'All Schools', value: 'ALL' },
    { label: 'Garum', value: FermentType.GARUM },
    { label: 'Miso & Pastes', value: FermentType.MISO },
    { label: 'Koji Cultivation', value: FermentType.KOJI },
    { label: 'Lacto-Ferment', value: FermentType.LACTO },
    { label: 'Vinegar & Acids', value: FermentType.VINEGAR },
    { label: 'Blackening', value: FermentType.BLACK }
  ];

  return (
    <div className="modal-overlay">
      <div className="wood-panel" style={{ width: 'min(1100px, 96vw)', height: 'min(90vh, 760px)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div className="lhead" style={{ flexWrap: 'wrap' }}>
          <div className="ttl-row">
            <div className="ic"><BookIcon size={18} color="var(--moss)" /></div>
            <div>
              <h1 className="slab">Laboratory Codex &amp; Archive</h1>
              <div className="sub">Culinary taxonomy, tested parameters, and vintage harvest registries</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="hidden sm:flex mono" style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11 }}>
              <div>
                <span className="section-lbl" style={{ marginBottom: 0, display: 'block' }}>Discovered</span>
                <span style={{ fontWeight: 700, color: 'var(--moss)' }}>{discoveredCount} / {RECIPES.length - 1}</span>
              </div>
              <div className="divider-line" style={{ height: 20 }} />
              <div>
                <span className="section-lbl" style={{ marginBottom: 0, display: 'block' }}>Harvests</span>
                <span style={{ fontWeight: 700, color: 'var(--teal)' }}>{logbook.length}</span>
              </div>
              <div className="divider-line" style={{ height: 20 }} />
              <div>
                <span className="section-lbl" style={{ marginBottom: 0, display: 'block' }}>Net Yield</span>
                <span style={{ fontWeight: 700, color: 'var(--amber)' }}>${totalValue.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={onClose} className="close-stamp" title="Close">
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        {/* Tabs & Search */}
        <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setActiveTab('codex')} className={`chip-tab${activeTab === 'codex' ? ' active' : ''}`}>
              <Sparkles size={12} style={{ display: 'inline', marginRight: 5 }} /> Recipe Codex
            </button>
            <button onClick={() => setActiveTab('archives')} className={`chip-tab${activeTab === 'archives' ? ' active' : ''}`}>
              <Award size={12} style={{ display: 'inline', marginRight: 5 }} /> Vintage Archives ({logbook.length})
            </button>
          </div>

          <div className="search-box" style={{ width: 260 }}>
            <SearchIcon size={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'codex' ? 'Search recipes...' : 'Search vintages...'}
            />
          </div>
        </div>

        {activeTab === 'codex' && (
          <div style={{ padding: '10px 28px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }} className="custom-scrollbar">
            {fermentTypes.map(ft => (
              <button
                key={ft.value}
                onClick={() => setSelectedType(ft.value)}
                className={`chip-tab${selectedType === ft.value ? ' active' : ''}`}
                style={{ whiteSpace: 'nowrap' }}
              >
                {ft.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {activeTab === 'codex' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {filteredRecipes.map(recipe => {
                const isDiscovered = analyzedRecipeIds.includes(recipe.id);
                const vessel = VESSELS.find(v => v.id === recipe.requiredVesselId);

                return (
                  <div
                    key={recipe.id}
                    className="wood-panel"
                    style={{ borderRadius: 12, padding: 16, opacity: isDiscovered ? 1 : 0.7, display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span className="vessel-badge">{recipe.type}</span>
                          {isDiscovered ? (
                            <span className="status-chip ready" style={{ background: 'rgba(138,154,107,0.15)', color: 'var(--moss)' }}>
                              <CheckCircle2 size={10} /> Analyzed
                            </span>
                          ) : (
                            <span className="status-chip" style={{ color: 'var(--text-lo)', background: 'rgba(0,0,0,0.2)' }}>
                              <HelpCircle size={10} /> Undiscovered
                            </span>
                          )}
                        </div>
                        <h3 className="slab" style={{ fontSize: 15, fontWeight: 600 }}>
                          {isDiscovered ? recipe.name : 'Unknown Experimental Protocol'}
                        </h3>
                      </div>
                      <span className="ticket" style={{ padding: '4px 8px' }}>
                        <span className="num mono" style={{ fontSize: 11 }}>{recipe.difficulty}&#9733;</span>
                      </span>
                    </div>

                    <p style={{ fontSize: 11, color: 'var(--text-mid)', lineHeight: 1.5 }}>
                      {isDiscovered ? recipe.description : 'Analyze this batch to decipher its molecular characteristics and optimal brewing matrix.'}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: 9, padding: 10, textAlign: 'center' }} className="mono">
                      <div>
                        <div className="section-lbl" style={{ marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}><Thermometer size={10} color="var(--brick)" /> Temp</div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{isDiscovered ? `${recipe.idealParams.temp}°` : '??°'}</div>
                      </div>
                      <div style={{ borderLeft: '1px solid var(--line)' }}>
                        <div className="section-lbl" style={{ marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}><Droplets size={10} color="var(--teal)" /> Humid</div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{isDiscovered ? `${recipe.idealParams.humidity}%` : '??%'}</div>
                      </div>
                      <div style={{ borderLeft: '1px solid var(--line)' }}>
                        <div className="section-lbl" style={{ marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}><Clock size={10} color="var(--amber)" /> Time</div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{recipe.baseDurationSeconds}s</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-lo)', paddingTop: 8, borderTop: '1px solid var(--line)' }} className="mono">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Box size={11} color="var(--plum)" /> {vessel?.name || 'Any Vessel'}</span>
                      {isDiscovered && (
                        <span>Umami {recipe.idealFlavorProfile.umami} &middot; Sweet {recipe.idealFlavorProfile.sweetness}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredArchives.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-lo)' }}>
                  <BookIcon size={40} color="var(--text-lo)" />
                  <p className="mono" style={{ marginTop: 12 }}>No vintage records found.</p>
                  <p style={{ fontSize: 11, marginTop: 4 }}>Harvest batches in the lab to populate your permanent registry.</p>
                </div>
              ) : (
                filteredArchives.map(entry => {
                  const dateString = new Date(entry.date).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  });
                  return (
                    <div key={entry.id} className="wood-panel" style={{ borderRadius: 12, padding: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }} className="mono">
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{entry.recipeName}</span>
                          <span style={{ color: 'var(--text-lo)' }}>&middot;</span>
                          <span style={{ fontSize: 11, color: 'var(--text-mid)' }}>Substrate: <b style={{ color: 'var(--text-hi)' }}>{entry.substrateName}</b></span>
                          <span style={{ fontSize: 10, color: 'var(--text-lo)', marginLeft: 'auto' }}>{dateString}</span>
                        </div>
                        <p style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-mid)' }}>"{entry.notes || 'No evaluation notes recorded.'}"</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={13} color="var(--amber)" fill={i < (entry.rating || 0) ? 'var(--amber)' : 'none'} />
                          ))}
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 70 }}>
                          <div className="section-lbl" style={{ marginBottom: 2 }}>Yield</div>
                          <div className="mono" style={{ fontWeight: 700, color: 'var(--moss)', fontSize: 13 }}>${entry.value ? entry.value.toLocaleString() : '0'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '10px 24px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-lo)', flexShrink: 0 }} className="mono">
          <span>Fermentation Science Database &middot; Rev 3.0</span>
          <span>Press ESC or close to exit</span>
        </div>
      </div>
    </div>
  );
};

export default LogbookModal;

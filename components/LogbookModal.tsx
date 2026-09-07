import React, { useState, useMemo } from 'react';
import { LogEntry, Recipe, FermentType, RecipeMastery } from '../types';
import { RECIPES, VESSELS, eraForRecipe } from '../constants';
import { getMastery, masteryReveal } from '../services/mastery';
import RecipeCard from './RecipeCard';
import { HarvestReportBody } from './HarvestReport';
import { getRecipeKnowledge, describeFormula } from '../services/gameLogic';
import { Star, Sparkles, Award, CheckCircle2, HelpCircle, Thermometer, Droplets, Clock, Box, BookOpen } from 'lucide-react';
import { CloseIcon, BookIcon, SearchIcon } from './icons';

interface LogbookModalProps {
  onClose: () => void;
  logbook: LogEntry[];
  analyzedRecipeIds: string[];
  recipeMastery: Record<string, RecipeMastery>;
  unlockedRecipes?: string[];
  discoveredRecipeIds?: string[];
  ownedBookIds?: string[];
}

const LogbookModal: React.FC<LogbookModalProps> = ({ onClose, logbook, analyzedRecipeIds, recipeMastery, unlockedRecipes = [], ownedBookIds = [], discoveredRecipeIds = [] }) => {
  const [activeTab, setActiveTab] = useState<'codex' | 'archives'>('codex');
  // The Library splits what you have MADE from what you have only READ — the
  // difference the books system created and the Codex was flattening away.
  const [shelf, setShelf] = useState<'all' | 'discovered' | 'cooked' | 'book' | 'unknown'>('all');
  const [openCard, setOpenCard] = useState<string | null>(null);
  // Which archived run is expanded. The archive listed a name and a price and
  // nothing about the run itself; the full record is one click down now.
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const filteredRecipes = useMemo(() => {
    return RECIPES.filter(recipe => {
      if (recipe.id === 'bio_sludge') return false;
      const matchesType = selectedType === 'ALL' || recipe.type === selectedType;
      const k = getRecipeKnowledge(recipe.id, unlockedRecipes, analyzedRecipeIds, ownedBookIds);
      const matchesShelf =
        shelf === 'all' ? true :
        shelf === 'discovered' ? discoveredRecipeIds.includes(recipe.id) :
        shelf === 'cooked' ? k === 'analyzed' :
        shelf === 'book' ? k === 'known' : k === 'unknown';
      if (!matchesShelf) return false;
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [searchQuery, selectedType, shelf, unlockedRecipes, analyzedRecipeIds, ownedBookIds, discoveredRecipeIds]);

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
  const knownCount = useMemo(() => {
    return RECIPES.filter(r => r.id !== 'bio_sludge' &&
      getRecipeKnowledge(r.id, unlockedRecipes, analyzedRecipeIds, ownedBookIds) !== 'unknown').length;
  }, [unlockedRecipes, analyzedRecipeIds, ownedBookIds]);

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
                {knownCount > discoveredCount && (
                  <span style={{ fontSize: 9, color: 'var(--plum)', display: 'block' }}>
                    +{knownCount - discoveredCount} in the book
                  </span>
                )}
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
          <div className="shelf-row">
            {([
              { id: 'all', label: 'Everything' },
              { id: 'discovered', label: 'Discovered' },
              { id: 'cooked', label: 'Cooked' },
              { id: 'book', label: 'In the book' },
              { id: 'unknown', label: 'Unknown' },
            ] as const).map(sh => {
              const n = RECIPES.filter(r => r.id !== 'bio_sludge' && (() => {
                const k = getRecipeKnowledge(r.id, unlockedRecipes, analyzedRecipeIds, ownedBookIds);
                return sh.id === 'all' ? true : sh.id === 'cooked' ? k === 'analyzed' : sh.id === 'book' ? k === 'known' : k === 'unknown';
              })()).length;
              return (
                <button
                  key={sh.id}
                  onClick={() => setShelf(sh.id)}
                  className={`chip-tab${shelf === sh.id ? ' active' : ''}`}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {sh.label} <span className="cnt">{n}</span>
                </button>
              );
            })}
          </div>
        )}

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
                // Three states: unknown / known (bought the formula in a book, never
                // run it) / analyzed (actually produced it). A book buys you the name,
                // the description and the combination; the flavour target and the peak
                // window are still earned at the bench.
                const knowledge = getRecipeKnowledge(recipe.id, unlockedRecipes, analyzedRecipeIds, ownedBookIds);
                const formula = knowledge !== 'unknown' ? describeFormula(recipe.id) : null;
                const isAnalyzed = knowledge === 'analyzed';
                const isDiscovered = knowledge !== 'unknown';
                // Cooking a recipe once used to hand over its exact target temp and
                // humidity. Precision is now bought with mastery: a band at rung 3-4,
                // the exact figures only at rung 5.
                const hand = getMastery(recipeMastery, recipe);
                const reveal = masteryReveal(recipe, isDiscovered ? Math.max(1, hand.level) : 0);
                const vessel = VESSELS.find(v => v.id === recipe.requiredVesselId);

                return (
                  <div
                    key={recipe.id}
                    className="wood-panel"
                    onClick={() => setOpenCard(recipe.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenCard(recipe.id); } }}
                    title="Open the recipe card"
                    style={{ borderRadius: 12, padding: 16, opacity: isDiscovered ? 1 : 0.7, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span className="vessel-badge">{recipe.type}</span>
                          {(() => { const era = eraForRecipe(recipe.id); return era ? (
                            <span className="era-tag" title={`${era.title} · ${era.years}`}>{era.title}</span>
                          ) : null; })()}
                          {isAnalyzed ? (
                            <span className="status-chip ready" style={{ background: 'rgba(138,154,107,0.15)', color: 'var(--moss)' }}>
                              <CheckCircle2 size={10} /> Analyzed
                            </span>
                          ) : discoveredRecipeIds.includes(recipe.id) ? (
                            <span className="status-chip" style={{ background: 'rgba(217,164,65,0.15)', color: 'var(--amber)' }}>
                              <Sparkles size={10} /> Found it yourself
                            </span>
                          ) : knowledge === 'known' ? (
                            <span className="status-chip" style={{ background: 'rgba(157,139,176,0.15)', color: 'var(--plum)' }}>
                              <BookOpen size={10} /> In the book
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
                      {isDiscovered ? recipe.description : 'Buy the formula in a book, or stumble onto the combination yourself.'}
                    </p>

                    {formula && (
                      <div className="formula-card">
                        <span className="fl">The formula</span>
                        <div className="frow"><span className="k">Base</span><span className="n">{formula.substrateLabel}</span></div>
                        {formula.addLabels.length > 0 && (
                          <div className="frow"><span className="k">Add</span><span className="n">{formula.addLabels.join(' · ')}</span></div>
                        )}
                        {formula.forbidLabels.length > 0 && (
                          <div className="frow"><span className="k">Without</span><span className="n brick">{formula.forbidLabels.join(' · ')}</span></div>
                        )}
                        <div className="frow"><span className="k">In</span><span className="n">{formula.vesselName}</span></div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: 9, padding: 10, textAlign: 'center' }} className="mono">
                      <div>
                        <div className="section-lbl" style={{ marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}><Thermometer size={10} color="var(--brick)" /> Temp</div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{isDiscovered ? reveal.temp : '??°'}</div>
                      </div>
                      <div style={{ borderLeft: '1px solid var(--line)' }}>
                        <div className="section-lbl" style={{ marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}><Droplets size={10} color="var(--teal)" /> Humid</div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{isDiscovered ? reveal.humidity : '??%'}</div>
                      </div>
                      <div style={{ borderLeft: '1px solid var(--line)' }}>
                        <div className="section-lbl" style={{ marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}><Clock size={10} color="var(--amber)" /> Time</div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{isDiscovered ? reveal.duration : '??s'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-lo)', paddingTop: 8, borderTop: '1px solid var(--line)' }} className="mono">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Box size={11} color="var(--plum)" /> {vessel?.name || 'Any Vessel'}</span>
                      {hand.cooks > 0 && (
                        <span style={{ color: 'var(--brass)' }} title={`${hand.xp} xp on this recipe`}>
                          Hand {hand.level}/5 · {hand.cooks} run{hand.cooks === 1 ? '' : 's'}
                        </span>
                      )}
                      {isAnalyzed && (
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
                    <div key={entry.id} className="wood-panel arch-entry" style={{ borderRadius: 12, padding: 16 }}>
                     <button type="button" className="arch-summary"
                             onClick={() => setOpenEntry(openEntry === entry.id ? null : entry.id)}
                             aria-expanded={openEntry === entry.id}
                             title={entry.record ? 'Open the full run record' : 'Archived before full records were kept'}>
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
                        <span className={`arch-chev${openEntry === entry.id ? ' open' : ''}`} aria-hidden>&rsaquo;</span>
                      </div>
                     </button>
                     {openEntry === entry.id && <HarvestReportBody entry={entry} />}
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

      {openCard && (() => {
        const r = RECIPES.find(x => x.id === openCard);
        if (!r) return null;
        return (
          <RecipeCard
            recipe={r}
            knowledge={getRecipeKnowledge(r.id, unlockedRecipes, analyzedRecipeIds, ownedBookIds)}
            mastery={getMastery(recipeMastery, r)}
            ownedBookIds={ownedBookIds}
            onClose={() => setOpenCard(null)}
          />
        );
      })()}
    </div>
  );
};

export default LogbookModal;

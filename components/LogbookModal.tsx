import PanelMark from './PanelMark';
import React, { useState, useMemo, useEffect } from 'react';
import GameIcon from './GameIcon';
import { LogEntry, Recipe, FermentType, RecipeMastery } from '../types';
import { RECIPES, VESSELS, eraForRecipe } from '../constants';
import { getMastery, masteryReveal } from '../services/mastery';
import RecipeCard from './RecipeCard';
import { HarvestReportBody } from './HarvestReport';
import { getRecipeKnowledge, describeFormula } from '../services/gameLogic';
import { CheckCircle2 } from 'lucide-react';
import { CloseIcon, BookIcon } from './icons';

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (openCard) setOpenCard(null); else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openCard, onClose]);

  return (
    // Closes like every other screen: a click on the backdrop (never one that
    // started inside, and never one on the recipe card opened from here, which
    // has its own backdrop), or Escape.
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wood-panel codex-panel" style={{ width: 'min(1100px, 96vw)', height: 'min(90vh, 760px)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* THE STUDIO HEAD — the same header as every dark screen: the painted mark
            in a brass-ringed medallion, a kicker, a short title, the numbers on brass
            plates, one round close. The engraved wheat rule, the laurel watermark and
            the "Rev 3.0" footer were a Victorian ledger in a restored studio. */}
        <div className="studio-head">
          <span className="sh-medal"><PanelMark name="codex" size={34} /></span>
          <div className="sh-title">
            <span className="kicker">The house library</span>
            <h2>Codex</h2>
          </div>
          <div className="sh-plates">
            <span className="sh-plate" title={knownCount > discoveredCount ? `${knownCount - discoveredCount} more are written in books you own` : undefined}>
              <span className="l">Discovered</span>
              <span className="v">{discoveredCount}<small>/{RECIPES.length - 1}</small>{knownCount > discoveredCount && <em>+{knownCount - discoveredCount}</em>}</span>
            </span>
            <span className="sh-plate">
              <span className="l">Harvests</span>
              <span className="v">{logbook.length}</span>
            </span>
            <span className="sh-plate">
              <span className="l">Net yield</span>
              <span className="v">${totalValue.toLocaleString()}</span>
            </span>
          </div>
          <button onClick={onClose} className="close-stamp" title="Close (Esc)" aria-label="Close the Codex">
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Section tabs and search: the same bar Supply has, under the studio head. */}
        <div className="cx-bar">
          <div className="cx-tabs" role="tablist">
            <button role="tab" aria-selected={activeTab === 'codex'} onClick={() => setActiveTab('codex')} className={`sec-tab${activeTab === 'codex' ? ' active' : ''}`}>
              <GameIcon name="sparkle" size={12} /> Recipes <span className="tab-count">{RECIPES.length - 1}</span>
            </button>
            <button role="tab" aria-selected={activeTab === 'archives'} onClick={() => setActiveTab('archives')} className={`sec-tab${activeTab === 'archives' ? ' active' : ''}`}>
              <GameIcon name="award" size={12} /> Archive <span className="tab-count">{logbook.length}</span>
            </button>
          </div>

          <div className="search-box cx-search">
            <GameIcon name="search" size={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'codex' ? 'Search recipes…' : 'Search the archive…'}
              aria-label={activeTab === 'codex' ? 'Search recipes' : 'Search the archive'}
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
                >
                  {sh.label} <span className="cnt">{n}</span>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'codex' && (
          <div className="cx-types custom-scrollbar">
            {fermentTypes.map(ft => (
              <button
                key={ft.value}
                onClick={() => setSelectedType(ft.value)}
                className={`chip-tab${selectedType === ft.value ? ' active' : ''}`}
              >
                {ft.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="cx-body custom-scrollbar">
          {activeTab === 'codex' ? (
            <div className="cx-grid">
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
                  /* THE CODEX IS A BOOK OF PRINTED RECIPE LABELS, and one you
                     have not met yet is unprinted stock — which is the same
                     rule the Supply shelf uses for a locked line. */
                  <div
                    key={recipe.id}
                    className={`codex-card${isDiscovered ? '' : ' unknown'}`}
                    onClick={() => setOpenCard(recipe.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenCard(recipe.id); } }}
                    title="Open the recipe card"
                  >
                    <div className="cc-head">
                      <div className="cc-id">
                        <div className="cc-tags">
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
                              <GameIcon name="sparkle" size={10} /> Found it yourself
                            </span>
                          ) : knowledge === 'known' ? (
                            <span className="status-chip" style={{ background: 'rgba(157,139,176,0.15)', color: 'var(--plum)' }}>
                              <GameIcon name="books" size={10} /> In the book
                            </span>
                          ) : (
                            <span className="status-chip" style={{ color: 'var(--text-lo)', background: 'rgba(0,0,0,0.2)' }}>
                              <GameIcon name="help" size={10} /> Undiscovered
                            </span>
                          )}
                        </div>
                        <h3 className="cc-name">
                          {isDiscovered ? recipe.name : 'Unknown Experimental Protocol'}
                        </h3>
                      </div>
                      <span className="cc-diff">{recipe.difficulty}&#9733;</span>
                    </div>

                    <p className="cc-desc">
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

                    {/* The held conditions ARE instrument readings, so they keep
                        the monospace even on paper — a figure copied off a gauge. */}
                    <div className="cc-params">
                      <div>
                        <div className="l"><GameIcon name="thermometer" size={10} color="currentColor" /> Temp</div>
                        <div className="v">{isDiscovered ? reveal.temp : '??°'}</div>
                      </div>
                      <div>
                        <div className="l"><GameIcon name="droplet" size={10} color="currentColor" /> Humid</div>
                        <div className="v">{isDiscovered ? reveal.humidity : '??%'}</div>
                      </div>
                      <div>
                        <div className="l"><GameIcon name="clock" size={10} color="currentColor" /> Time</div>
                        <div className="v">{isDiscovered ? reveal.duration : '??s'}</div>
                      </div>
                    </div>

                    <div className="cc-foot">
                      <span><GameIcon name="parcel" size={11} color="currentColor" /> {vessel?.name || 'Any Vessel'}</span>
                      {hand.cooks > 0 && (
                        <span className="hand" title={`${hand.xp} xp on this recipe`}>
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
                /* The same empty state every screen uses: the faded mark centred over
                   a line of what to do. text-align could not centre the mark, which is
                   a flex box, so it sat stranded at the left. */
                <div className="empty-mark cx-empty">
                  <PanelMark name="books" size={64} faded />
                  <p className="cx-empty-t">{searchQuery ? 'Nothing in the archive matches that.' : 'The archive is empty.'}</p>
                  <p className="cx-empty-s">Every batch you harvest is written in here, with its score and its notes.</p>
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
                            <GameIcon key={i} name="star" size={13} color="var(--amber)" style={{ opacity: (i < (entry.rating || 0)) ? 1 : 0.28 }} />
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

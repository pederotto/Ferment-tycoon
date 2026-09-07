import React, { useState, useMemo } from 'react';
import { Ingredient, Supplier, IngredientType, Vessel, Book } from '../types';
import { SUPPLIERS, VESSELS, BOOKS, UNDERGROUND_TIER_XP } from '../constants';
import MolecularScan from './MolecularScan';
import { ChevronUp, Lock, Sparkles, Zap } from 'lucide-react';
import { BagIcon, SearchIcon, ShieldIcon, CheckIcon, getIngredientIcon, VesselLineIcon, JarOutlineIcon, ArrowRightIcon, WrenchIcon, BookIcon } from './icons';

interface MarketplaceProps {
  isOpen: boolean;
  onToggle: () => void;
  ingredients: Ingredient[];
  inventory: Record<string, number>;
  money: number;
  renown: number;
  relationships: Record<string, { level: number; xp: number }>;
  onBuy: (ingredient: Ingredient, quantity?: number) => void;
  ownedVesselIds?: string[];
  onBuyVessel?: (vessel: Vessel) => void;
  onBuyBook?: (book: Book) => void;
  ownedBookIds?: string[];
  playerXp?: number;
  undergroundTier?: number;
  onOpenHardware?: () => void;
}

const SUPPLIER_ACCENT: Record<string, string> = {
  nordic: 'var(--amber)',
  asia_import: 'var(--brass)',
  biolab: 'var(--plum)',
  prime: 'var(--brick)',
  tech: 'var(--teal)',
};

const Marketplace: React.FC<MarketplaceProps> = ({
  isOpen,
  onToggle,
  ingredients,
  inventory,
  money,
  renown,
  relationships,
  onBuy,
  ownedVesselIds = [],
  onBuyVessel,
  onBuyBook,
  ownedBookIds = [],
  playerXp = 0,
  undergroundTier = 1,
  onOpenHardware
}) => {
  const [showBlackMarket, setShowBlackMarket] = useState(false);
  const [hoveredIng, setHoveredIng] = useState<Ingredient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [buyQuantity, setBuyQuantity] = useState<number>(1);

  const getInventoryCount = (id: string) => inventory[id] || 0;
  const getDiscount = (level: number) => Math.min(0.25, (level - 1) * 0.05);

  const visibleSuppliers = useMemo(() => {
    if (showBlackMarket) {
      return SUPPLIERS.filter(s => s.id === 'black_market');
    }
    return SUPPLIERS.filter(s => s.id !== 'black_market' && s.id !== 'in_house');
  }, [showBlackMarket]);

  const categoryTabs = [
    { id: 'all', label: 'All Stock' },
    { id: IngredientType.SUBSTRATE, label: 'Substrates' },
    { id: IngredientType.STARTER, label: 'Starters' },
    { id: IngredientType.ADDITIVE, label: 'Additives' },
    { id: IngredientType.TOOL, label: 'Tools' },
  ];

  return (
    // The two wrapper divs in App.tsx are pointer-events:none so the bench stays
    // clickable around the drawer; the drawer itself has to opt back in, exactly
    // as HardwareStore does. Without this the whole panel is inert and clicks
    // fall through to the cubbies behind it.
    <div className="sheet" style={{ height: isOpen ? '68vh' : '58px', maxHeight: isOpen ? '86vh' : '58px', transition: 'height 0.4s ease', pointerEvents: 'auto' }}>
      {hoveredIng && isOpen && (
        <div className="absolute pointer-events-none z-50" style={{ bottom: 'calc(100% + 12px)', left: '50%', transform: 'translateX(-50%)' }}>
          <MolecularScan target={{ type: 'ingredient', data: hoveredIng }} />
        </div>
      )}

      <div onClick={onToggle} style={{ cursor: 'pointer', flexShrink: 0 }}>
        <div className="pull-tab" />
        <div className="shead">
          <div className="ttl">
            <div className="ic"><BagIcon size={18} /></div>
            <div>
              <h1 className="slab">Sourcing &amp; Exchange</h1>
              <div className="sub">{isOpen ? 'Click to minimize the sourcing terminal' : 'Suppliers, cultures, and hardware from across the region'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isOpen && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowBlackMarket(!showBlackMarket); }}
                className="underground-btn"
                style={showBlackMarket ? { background: 'rgba(179,69,47,0.3)' } : undefined}
              >
                <span className="seal-dot"><ShieldIcon size={12} /></span>
                {showBlackMarket ? 'Exit Underground' : 'Underground Channel'}
              </button>
            )}
            <ChevronUp size={18} color="var(--text-lo)" style={{ transform: isOpen ? 'none' : 'rotate(180deg)', transition: 'transform 0.4s' }} />
          </div>
        </div>
      </div>

      {isOpen && (
        <>
          <div className="filter-row">
            <div className="search-box">
              <SearchIcon size={13} />
              <input
                type="text"
                placeholder="Filter reagents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="market-tabs">
              {categoryTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedType(tab.id)}
                  className={`chip-tab${selectedType === tab.id ? ' active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="bulk-buy">
              <span className="l">Bulk</span>
              {[1, 5, 10, 25].map(qty => (
                <button
                  key={qty}
                  onClick={() => setBuyQuantity(qty)}
                  className={`q${buyQuantity === qty ? ' active' : ''}`}
                >
                  {qty}x
                </button>
              ))}
            </div>
          </div>

          <div className="stalls custom-scrollbar">
            {visibleSuppliers.map((supplier) => {
              const rel = relationships[supplier.id] || { level: 1, xp: 0 };
              const discount = getDiscount(rel.level);
              const accent = supplier.id === 'black_market' ? 'var(--brick)' : (SUPPLIER_ACCENT[supplier.id] || 'var(--amber)');
              const nextLevelXp = rel.level * 100;
              const xpPercent = Math.min(100, (rel.xp / nextLevelXp) * 100);

              const supplierIngs = ingredients
                .filter(i => i.supplierId === supplier.id)
                .filter(i => {
                  if (selectedType !== 'all' && i.type !== selectedType) return false;
                  if (searchQuery.trim() !== '') {
                    return i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      i.description.toLowerCase().includes(searchQuery.toLowerCase());
                  }
                  return true;
                })
                .sort((a, b) => a.tierRequired - b.tierRequired);

              if (supplierIngs.length === 0) return null;

              return (
                <div key={supplier.id} className="stall" style={{ '--ac': accent } as React.CSSProperties}>
                  <div className="awning" />
                  <div className="stall-head">
                    <div className="row1">
                      <div>
                        <h3>{supplier.name}</h3>
                        <div className="d">{supplier.description}</div>
                      </div>
                      {supplier.id !== 'black_market' ? (
                        <span className="lvl-badge">LVL {rel.level}</span>
                      ) : (
                        <span className="lvl-badge illegal">ILLEGAL</span>
                      )}
                    </div>
                    {supplier.id !== 'black_market' && (
                      <div className="loyalty">
                        <div className="lrow"><span>Loyalty &middot; {rel.xp}/{nextLevelXp} XP</span><b>{Math.round(discount * 100)}% off</b></div>
                        <div className="ltrack"><div className="lfill" style={{ width: `${xpPercent}%` }} /></div>
                      </div>
                    )}
                  </div>

                  <div className="items">
                    {supplierIngs.map((ing) => {
                      // The fence has no loyalty ladder — it gates on your standing
                      // at the bench. Using supplier level here was what made its
                      // tier-2 and tier-5 goods permanently unbuyable.
                      const isLocked = supplier.id === 'black_market'
                        ? (ing.undergroundTier ?? 1) > undergroundTier
                        : rel.level < ing.tierRequired;
                      const unitCost = Math.floor(ing.baseCost * (1 - discount));
                      const totalCost = unitCost * buyQuantity;
                      const isRenown = ing.currency === 'renown';
                      const canAfford = isRenown
                        ? renown >= (ing.baseCost * buyQuantity)
                        : money >= totalCost;
                      const massLabel = ing.mass > 0
                        ? (ing.mass >= 1000 ? `${ing.mass / 1000}kg` : `${ing.mass}${ing.unitDisplay}`)
                        : '1 unit';
                      const IngIcon = getIngredientIcon(ing);

                      return (
                        <div
                          key={ing.id}
                          role="button"
                          tabIndex={isLocked || !canAfford ? -1 : 0}
                          aria-disabled={isLocked || !canAfford}
                          aria-label={`${ing.name} — ${isLocked ? 'locked' : `buy ${buyQuantity}`}`}
                          className={`item${isLocked ? ' locked' : ''}`}
                          onMouseEnter={() => !isLocked && setHoveredIng(ing)}
                          onMouseLeave={() => setHoveredIng(null)}
                          onClick={() => !isLocked && canAfford && onBuy(ing, buyQuantity)}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !isLocked && canAfford) {
                              e.preventDefault();
                              onBuy(ing, buyQuantity);
                            }
                          }}
                        >
                          <div className="left">
                            <div className={`avatar${isLocked ? ' dim' : ''}`} style={!isLocked ? { color: accent } : undefined}>
                              {isLocked ? <Lock size={13} /> : <IngIcon size={14} />}
                            </div>
                            <div>
                              <div className="n">
                                {ing.name}
                                {ing.isLiving && <span className="living-tag">Living</span>}
                              </div>
                              <div className="meta">
                                {isLocked
                                  ? (supplier.id === 'black_market'
                                      ? `They don't deal this to a bench your size · ${UNDERGROUND_TIER_XP[(ing.undergroundTier ?? 1) - 1]} xp`
                                      : `Requires Lvl ${ing.tierRequired}`)
                                  : <>Stock <b>{getInventoryCount(ing.id)}</b> &middot; {massLabel}/unit{ing.heatPerUnit ? <> &middot; <span style={{ color: 'var(--brick)' }}>+{ing.heatPerUnit} heat</span></> : null}</>}
                              </div>
                            </div>
                          </div>
                          <div className="right">
                            <div className={`price${isRenown ? ' plum' : ''}`} style={!canAfford ? { color: 'var(--brick)' } : undefined}>
                              {isRenown ? <>{ing.baseCost * buyQuantity} <Sparkles size={10} style={{ display: 'inline' }} /></> : `$${totalCost}`}
                            </div>
                            {!isLocked && (
                              <button disabled={!canAfford} className={`buy-btn${!canAfford ? ' locked' : ''}`}>Buy</button>
                            )}
                            {isLocked && <span className="buy-btn locked">Locked</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {(() => {
              const shelf = showBlackMarket ? 'underground' : 'bindery';
              const books = BOOKS.filter(b => b.shelf === shelf);
              if (!onBuyBook || books.length === 0) return null;
              return (
              <div className="stall" style={{ '--ac': showBlackMarket ? 'var(--brick)' : 'var(--plum)' } as React.CSSProperties}>
                <div className="awning" />
                <div className="stall-head">
                  <div className="row1">
                    <div>
                      <h3>
                        <BookIcon size={13} color={showBlackMarket ? 'var(--brick)' : 'var(--plum)'} />
                        {showBlackMarket ? ' The Restricted Shelf' : ' The Bindery'}
                      </h3>
                      <div className="d">
                        {showBlackMarket
                          ? 'Photocopied, twice removed, no receipts'
                          : 'Formulas in print — what goes in, and in what'}
                      </div>
                    </div>
                    <span className={`lvl-badge${showBlackMarket ? ' illegal' : ''}`}>Books</span>
                  </div>
                </div>
                <div className="items">
                  {books.map(book => {
                    const owned = ownedBookIds.includes(book.id);
                    const tooGreen = playerXp < book.xpRequired;
                    const rel = book.gatedBy ? relationships[book.gatedBy.supplierId] : undefined;
                    const notRegular = !!book.gatedBy && (!rel || rel.level < book.gatedBy.level);
                    const canAfford = money >= book.price;
                    const locked = owned || tooGreen || notRegular;

                    return (
                      <div
                        key={book.id}
                        className={`item${locked && !owned ? ' locked' : ''}`}
                        title={book.blurb}
                        onMouseEnter={() => setHoveredIng(null)}
                      >
                        <div className="left">
                          <div className={`avatar${locked ? ' dim' : ''}`}>
                            <BookIcon size={13} color="currentColor" />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="n">{book.title}</div>
                            <div className="meta">
                              {owned
                                ? 'on the shelf'
                                : tooGreen
                                  ? `needs ${book.xpRequired} bench xp`
                                  : notRegular
                                    ? 'kept for regulars'
                                    : `teaches ${book.teaches.length}`}
                              {book.heatOnPurchase ? ` · +${book.heatOnPurchase} heat` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="right">
                          {owned ? (
                            <span className="buy-btn locked">Owned</span>
                          ) : (
                            <>
                              <span className="price">${book.price.toLocaleString()}</span>
                              <button
                                disabled={locked || !canAfford}
                                onClick={() => !locked && canAfford && onBuyBook(book)}
                                className={`buy-btn${locked || !canAfford ? ' locked' : ''}`}
                                aria-label={`Buy ${book.title} for $${book.price}`}
                              >
                                Buy
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {!showBlackMarket && (selectedType === IngredientType.TOOL || selectedType === 'all') && (
              <div className="stall" style={{ '--ac': 'var(--teal)' } as React.CSSProperties}>
                <div className="awning" />
                <div className="stall-head">
                  <div className="row1">
                    <div>
                      <h3><JarOutlineIcon size={13} color="var(--teal)" /> Vessels &amp; Containment</h3>
                      <div className="d">Bioreactors, airlocked jars &amp; casks</div>
                    </div>
                    <span className="lvl-badge">Hardware</span>
                  </div>
                </div>
                <div className="items">
                  {VESSELS
                    .filter(vessel => {
                      if (!searchQuery.trim()) return true;
                      return vessel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        vessel.description.toLowerCase().includes(searchQuery.toLowerCase());
                    })
                    .map(vessel => {
                      const isOwned = ownedVesselIds.includes(vessel.id);
                      const canAfford = money >= vessel.cost;
                      return (
                        <div key={vessel.id} className="item">
                          <div className="left">
                            <div className="avatar" style={{ color: isOwned ? 'var(--moss)' : 'var(--teal)' }}>
                              {isOwned ? <CheckIcon size={13} /> : <VesselLineIcon vesselId={vessel.id} size={14} />}
                            </div>
                            <div>
                              <div className="n">{vessel.name}</div>
                              <div className="meta">
                                Cap {vessel.capacityL}L &middot; {vessel.slotsRequired} slot{vessel.slotsRequired > 1 ? 's' : ''}
                                {vessel.powerDraw > 0 && <> &middot; <span style={{ color: 'var(--amber)' }}><Zap size={9} style={{ display: 'inline' }} />{vessel.powerDraw}W</span></>}
                              </div>
                            </div>
                          </div>
                          <div className="right">
                            {isOwned ? (
                              <span className="price" style={{ color: 'var(--moss)' }}>Owned</span>
                            ) : (
                              <>
                                <div className="price">${vessel.cost}</div>
                                <button disabled={!canAfford} onClick={() => canAfford && onBuyVessel?.(vessel)} className={`buy-btn${!canAfford ? ' locked' : ''}`}>Buy</button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
                {onOpenHardware && (
                  <div className="stall-foot" onClick={onOpenHardware} style={{ cursor: 'pointer' }}>
                    <span>Need power upgrades?</span>
                    <span className="link"><WrenchIcon size={10} color="var(--amber)" /> Workshop <ArrowRightIcon size={10} color="var(--amber)" /></span>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Marketplace;

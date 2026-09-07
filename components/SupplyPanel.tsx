import React, { useMemo, useState } from 'react';
import { Ingredient, IngredientType, Vessel, Book, Supplier } from '../types';
import { VESSELS, BOOKS, SUPPLIERS, UNDERGROUND_TIER_XP, MAX_EQUIPMENT_SLOTS } from '../constants';
import {
  BagIcon, SearchIcon, ShieldIcon, CheckIcon, getIngredientIcon, VesselLineIcon,
  JarOutlineIcon, WrenchIcon, BookIcon, BoltIcon,
} from './icons';
import { Lock, ChevronUp, ArrowUpDown } from 'lucide-react';

/**
 * SUPPLY — one place to spend money.
 *
 * This replaces two drawers that did the same job. The Hardware Store lived at
 * the top of the screen and the Sourcing & Exchange at the bottom; both sold
 * vessels, both fought the HUD and each other for stacking order, and neither
 * could show you the thing that now decides a purchase — what an ingredient is
 * actually made of.
 *
 * The ingredient tab is a single sortable catalogue rather than a grid of
 * per-supplier boxes. Supplier is a tag and a loyalty strip; it is no longer a
 * container you have to shop inside one at a time. You can finally sort the
 * whole shelf by protein, by starch, or by price and see the answer at once.
 */

type Tab = 'ingredients' | 'hardware' | 'books' | 'underground';
type SortKey = 'name' | 'price' | 'protein' | 'starch' | 'quality';

interface SupplyPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  ingredients: Ingredient[];
  inventory: Record<string, number>;
  money: number;
  playerXp: number;
  undergroundTier: number;
  relationships: Record<string, { level: number; xp: number }>;
  ownedVesselIds: string[];
  ownedBookIds: string[];
  currentPower: number;
  maxPower: number;
  usedSlots: number;
  onBuy: (ingredient: Ingredient, quantity?: number) => void;
  onBuyVessel: (vessel: Vessel) => void;
  onBuyTool: (tool: Ingredient) => void;
  onBuyBook: (book: Book) => void;
  onUpgradePower?: (additionalPower: number, cost: number) => void;
}

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'price', label: 'Price' },
  { id: 'protein', label: 'Protein' },
  { id: 'starch', label: 'Starch' },
  { id: 'quality', label: 'Quality' },
];

/** A small bar for one composition axis, 0-10. */
const Bar: React.FC<{ v: number; tone: string; title: string }> = ({ v, tone, title }) => (
  <span className="cbar" title={title}>
    <span className="cfill" style={{ width: `${Math.min(100, v * 10)}%`, background: tone }} />
  </span>
);

const SupplyPanel: React.FC<SupplyPanelProps> = ({
  isOpen, onToggle, ingredients, inventory, money, playerXp, undergroundTier,
  relationships, ownedVesselIds, ownedBookIds, currentPower, maxPower, usedSlots,
  onBuy, onBuyVessel, onBuyTool, onBuyBook, onUpgradePower,
}) => {
  const [tab, setTab] = useState<Tab>('ingredients');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [asc, setAsc] = useState(true);
  const [qty, setQty] = useState(1);

  const owned = (id: string) => inventory[id] || 0;

  const legalSuppliers = SUPPLIERS.filter(s => s.id !== 'black_market' && s.id !== 'in_house');

  const rows = useMemo(() => {
    const underground = tab === 'underground';
    let list = ingredients.filter(i => {
      if (i.type === IngredientType.TOOL) return false;
      const isBM = i.supplierId === 'black_market';
      if (underground !== isBM) return false;
      if (i.supplierId === 'in_house') return false;
      if (category !== 'all' && i.type !== category) return false;
      if (supplierFilter !== 'all' && i.supplierId !== supplierFilter) return false;
      if (search.trim() && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    const dir = asc ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'price': return (a.baseCost - b.baseCost) * dir;
        case 'protein': return (a.hiddenStats.proteinContent - b.hiddenStats.proteinContent) * dir;
        case 'starch': return (a.hiddenStats.starchContent - b.hiddenStats.starchContent) * dir;
        case 'quality': return (a.quality - b.quality) * dir;
        default: return a.name.localeCompare(b.name) * dir;
      }
    });
    return list;
  }, [ingredients, tab, category, supplierFilter, search, sort, asc]);

  const tools = ingredients.filter(i => i.type === IngredientType.TOOL);
  const shelfBooks = BOOKS.filter(b => b.shelf === (tab === 'underground' ? 'underground' : 'bindery'));

  const lockReason = (i: Ingredient): string | null => {
    if (i.supplierId === 'black_market') {
      const need = i.undergroundTier ?? 1;
      if (need > undergroundTier) return `standing · ${UNDERGROUND_TIER_XP[need - 1]} xp`;
      return null;
    }
    const rel = relationships[i.supplierId];
    if (rel && rel.level < i.tierRequired) return `loyalty · lvl ${i.tierRequired}`;
    return null;
  };

  const priceOf = (i: Ingredient) => {
    if (i.supplierId === 'black_market') return i.baseCost;
    const rel = relationships[i.supplierId];
    const discount = Math.min(0.25, ((rel?.level ?? 1) - 1) * 0.05);
    return Math.floor(i.baseCost * (1 - discount));
  };

  return (
    <div className="supply" style={{ height: isOpen ? '72vh' : '58px', maxHeight: isOpen ? '88vh' : '58px' }}>
      <div className="pull-tab" />

      <div className="sup-head" onClick={onToggle}>
        <div className="ttl">
          <div className="ic"><BagIcon size={18} /></div>
          <div>
            <h1 className="slab">Supply</h1>
            <div className="sub">
              {isOpen ? 'Click to minimise' : 'Ingredients, vessels, tools, books and the underground'}
            </div>
          </div>
        </div>
        <div className="right">
          <span className="ticket funds"><span className="lbl">Funds</span><span className="num">${money.toLocaleString()}</span></span>
          <ChevronUp size={18} color="var(--text-lo)" style={{ transform: isOpen ? 'none' : 'rotate(180deg)', transition: 'transform 0.35s' }} />
        </div>
      </div>

      {isOpen && (
        <>
          <div className="sup-tabs">
            {([
              { id: 'ingredients', label: 'Ingredients', icon: <BagIcon size={13} color="currentColor" /> },
              { id: 'hardware', label: 'Vessels & Tools', icon: <WrenchIcon size={13} color="currentColor" /> },
              { id: 'books', label: 'Books', icon: <BookIcon size={13} color="currentColor" /> },
              { id: 'underground', label: 'Underground', icon: <ShieldIcon size={12} color="currentColor" /> },
            ] as const).map(t => (
              <button
                key={t.id}
                className={`sup-tab${tab === t.id ? ' active' : ''}${t.id === 'underground' ? ' illicit' : ''}`}
                onClick={() => setTab(t.id as Tab)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ---------- INGREDIENTS / UNDERGROUND CATALOGUE ---------- */}
          {(tab === 'ingredients' || tab === 'underground') && (
            <>
              <div className="sup-controls">
                <div className="search-box">
                  <SearchIcon size={13} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the shelf…" aria-label="Search ingredients" />
                </div>

                <div className="chips">
                  {[
                    { id: 'all', label: 'All' },
                    { id: IngredientType.SUBSTRATE, label: 'Substrates' },
                    { id: IngredientType.STARTER, label: 'Starters' },
                    { id: IngredientType.ADDITIVE, label: 'Additives' },
                  ].map(c => (
                    <button key={c.id} className={`chip-tab${category === c.id ? ' active' : ''}`} onClick={() => setCategory(c.id)}>{c.label}</button>
                  ))}
                </div>

                <div className="bulk-buy">
                  <span className="l">Buy</span>
                  {[1, 5, 10, 25].map(n => (
                    <button key={n} className={`q${qty === n ? ' active' : ''}`} onClick={() => setQty(n)}>{n}×</button>
                  ))}
                </div>
              </div>

              {tab === 'ingredients' && (
                <div className="loyalty-strip">
                  <button className={`sup-supplier${supplierFilter === 'all' ? ' active' : ''}`} onClick={() => setSupplierFilter('all')}>
                    All suppliers
                  </button>
                  {legalSuppliers.map(s => {
                    const rel = relationships[s.id] ?? { level: 1, xp: 0 };
                    const next = rel.level * 100;
                    return (
                      <button
                        key={s.id}
                        className={`sup-supplier${supplierFilter === s.id ? ' active' : ''}`}
                        onClick={() => setSupplierFilter(supplierFilter === s.id ? 'all' : s.id)}
                        title={`${rel.xp}/${next} xp to level ${rel.level + 1}`}
                      >
                        <span className="dot" style={{ background: `var(--${s.color === 'zinc' ? 'text-lo' : 'amber'})` }} />
                        {s.name.split(' ')[0]}
                        <b>L{rel.level}</b>
                        <span className="ltrack"><span className="lfill" style={{ width: `${Math.min(100, (rel.xp / next) * 100)}%` }} /></span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="cat-head">
                <span className="c-item">Item</span>
                <span className="c-comp">
                  Composition
                  <em>protein · starch</em>
                </span>
                <span className="c-enz">Enzymes</span>
                {SORTS.map(sk => (
                  <button
                    key={sk.id}
                    className={`c-sort${sort === sk.id ? ' active' : ''}`}
                    onClick={() => { if (sort === sk.id) setAsc(!asc); else { setSort(sk.id); setAsc(sk.id === 'name'); } }}
                  >
                    {sk.label}{sort === sk.id && <ArrowUpDown size={9} />}
                  </button>
                ))}
              </div>

              <div className="catalogue custom-scrollbar">
                {rows.length === 0 && <div className="cat-empty">Nothing on this shelf matches.</div>}
                {rows.map(i => {
                  const Glyph = getIngredientIcon(i);
                  const lock = lockReason(i);
                  const price = priceOf(i);
                  const cost = price * qty;
                  const affordable = money >= cost;
                  const supplier = SUPPLIERS.find(s => s.id === i.supplierId);
                  const h = i.hiddenStats;

                  return (
                    <div key={i.id} className={`cat-row${lock ? ' locked' : ''}`}>
                      <span className="c-item">
                        <span className="glyph"><Glyph size={14} color="currentColor" /></span>
                        <span className="txt">
                          <span className="n">
                            {i.name}
                            {i.isLiving && <span className="living-tag">Live</span>}
                            {i.contraband && <span className="living-tag illicit">Illicit</span>}
                          </span>
                          <span className="m">
                            {supplier?.name ?? '—'} · {owned(i.id)} in store
                            {i.heatPerUnit ? <> · <b className="heat">+{i.heatPerUnit} heat</b></> : null}
                          </span>
                        </span>
                      </span>

                      <span className="c-comp">
                        <Bar v={h.proteinContent} tone="var(--moss)" title={`protein ${h.proteinContent}/10`} />
                        <Bar v={h.starchContent} tone="var(--amber)" title={`starch ${h.starchContent}/10`} />
                      </span>

                      <span className="c-enz">
                        {i.enzymes
                          ? <span className="enz">{i.enzymes.amylase}/{i.enzymes.protease}</span>
                          : i.strainBias !== undefined
                            ? <span className="enz strain">{i.strainBias >= 0.7 ? 'amylase strain' : i.strainBias <= 0.3 ? 'protease strain' : 'balanced strain'}</span>
                            : <span className="enz none">—</span>}
                      </span>

                      <span className="c-qual">{i.quality}</span>
                      <span className="c-price">${price}</span>

                      <span className="c-buy">
                        {lock ? (
                          <span className="buy-btn locked"><Lock size={10} /> {lock}</span>
                        ) : (
                          <button
                            className={`buy-btn${!affordable ? ' locked' : ''}`}
                            disabled={!affordable}
                            onClick={() => affordable && onBuy(i, qty)}
                            aria-label={`Buy ${qty} ${i.name} for $${cost}`}
                          >
                            Buy {qty > 1 ? `${qty}× · $${cost}` : ''}
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ---------- VESSELS & TOOLS ---------- */}
          {tab === 'hardware' && (
            <div className="sup-body custom-scrollbar">
              <div className="sup-meta">
                <span><BoltIcon size={12} /> Grid {currentPower}W / {maxPower}W</span>
                <span>Bench {usedSlots} / {MAX_EQUIPMENT_SLOTS} slots</span>
                <span>Vessels {ownedVesselIds.length} / {VESSELS.length}</span>
              </div>

              <span className="sup-lbl">Fermentation vessels</span>
              <div className="eq-grid">
                {VESSELS.map(v => {
                  const isOwned = ownedVesselIds.includes(v.id);
                  const canAfford = money >= v.cost;
                  return (
                    <div key={v.id} className={`eq-card${isOwned ? ' owned' : ''}`}>
                      <div className="eq-top">
                        <span className="eq-ic"><VesselLineIcon vesselId={v.id} size={15} color="currentColor" /></span>
                        <span>
                          <b>{v.name}</b>
                          <em>Cap {v.capacityL}L · {v.slotsRequired} slot{v.slotsRequired > 1 ? 's' : ''}{v.powerDraw ? ` · ${v.powerDraw}W` : ''}</em>
                        </span>
                      </div>
                      <p>{v.description}</p>
                      {isOwned
                        ? <span className="eq-btn owned-tag"><CheckIcon size={11} /> Acquired</span>
                        : <button className={`eq-btn${!canAfford ? ' disabled' : ''}`} disabled={!canAfford} onClick={() => onBuyVessel(v)} aria-label={`Buy ${v.name} for $${v.cost}`}>
                            {canAfford ? `Purchase $${v.cost}` : `Need $${v.cost}`}
                          </button>}
                    </div>
                  );
                })}
              </div>

              <span className="sup-lbl">Machinery &amp; tools</span>
              <div className="eq-grid">
                {tools.map(t => {
                  const canAfford = money >= t.baseCost;
                  const rel = relationships[t.supplierId];
                  const locked = rel && rel.level < t.tierRequired;
                  return (
                    <div key={t.id} className="eq-card">
                      <div className="eq-top">
                        <span className="eq-ic"><WrenchIcon size={14} color="currentColor" /></span>
                        <span><b>{t.name}</b><em>{owned(t.id)} owned</em></span>
                      </div>
                      <p>{t.description}</p>
                      {locked
                        ? <span className="eq-btn disabled"><Lock size={11} /> Lab Tech lvl {t.tierRequired}</span>
                        : <button className={`eq-btn${!canAfford ? ' disabled' : ''}`} disabled={!canAfford} onClick={() => onBuyTool(t)} aria-label={`Buy ${t.name} for $${t.baseCost}`}>
                            {canAfford ? `Buy unit $${t.baseCost}` : `Need $${t.baseCost}`}
                          </button>}
                    </div>
                  );
                })}
              </div>

              {onUpgradePower && (
                <>
                  <span className="sup-lbl">Power infrastructure</span>
                  <div className="eq-grid">
                    {[{ w: 50, c: 500 }, { w: 100, c: 1000 }].map(u => (
                      <div key={u.w} className="eq-card">
                        <div className="eq-top">
                          <span className="eq-ic"><BoltIcon size={14} color="currentColor" /></span>
                          <span><b>+{u.w}W breaker</b><em>Raises the ceiling to {maxPower + u.w}W</em></span>
                        </div>
                        <p>Powered vessels trip the breaker above the grid limit and stop heating.</p>
                        <button className={`eq-btn${money < u.c ? ' disabled' : ''}`} disabled={money < u.c} onClick={() => onUpgradePower(u.w, u.c)}>
                          {money >= u.c ? `Upgrade $${u.c.toLocaleString()}` : `Need $${u.c.toLocaleString()}`}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------- BOOKS ---------- */}
          {tab === 'books' && (
            <div className="sup-body custom-scrollbar">
              <span className="sup-lbl">The Bindery — formulas in print</span>
              <div className="eq-grid">
                {shelfBooks.map(b => {
                  const has = ownedBookIds.includes(b.id);
                  const tooGreen = playerXp < b.xpRequired;
                  const rel = b.gatedBy ? relationships[b.gatedBy.supplierId] : undefined;
                  const notRegular = !!b.gatedBy && (!rel || rel.level < b.gatedBy.level);
                  const canAfford = money >= b.price;
                  return (
                    <div key={b.id} className={`eq-card${has ? ' owned' : ''}`}>
                      <div className="eq-top">
                        <span className="eq-ic"><BookIcon size={14} color="currentColor" /></span>
                        <span><b>{b.title}</b><em>{b.author} · teaches {b.teaches.length}</em></span>
                      </div>
                      <p>{b.blurb}</p>
                      {has
                        ? <span className="eq-btn owned-tag"><CheckIcon size={11} /> On the shelf</span>
                        : tooGreen
                          ? <span className="eq-btn disabled"><Lock size={11} /> {b.xpRequired} bench xp</span>
                          : notRegular
                            ? <span className="eq-btn disabled"><Lock size={11} /> kept for regulars</span>
                            : <button className={`eq-btn${!canAfford ? ' disabled' : ''}`} disabled={!canAfford} onClick={() => onBuyBook(b)}>
                                {canAfford ? `Buy $${b.price.toLocaleString()}` : `Need $${b.price.toLocaleString()}`}
                              </button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'underground' && (
            <div className="sup-body custom-scrollbar" style={{ paddingTop: 0 }}>
              <span className="sup-lbl illicit">The restricted shelf</span>
              <div className="eq-grid">
                {BOOKS.filter(b => b.shelf === 'underground').map(b => {
                  const has = ownedBookIds.includes(b.id);
                  const tooGreen = playerXp < b.xpRequired;
                  const canAfford = money >= b.price;
                  return (
                    <div key={b.id} className={`eq-card${has ? ' owned' : ''}`}>
                      <div className="eq-top">
                        <span className="eq-ic"><BookIcon size={14} color="currentColor" /></span>
                        <span><b>{b.title}</b><em>{b.author}{b.heatOnPurchase ? ` · +${b.heatOnPurchase} heat` : ''}</em></span>
                      </div>
                      <p>{b.blurb}</p>
                      {has
                        ? <span className="eq-btn owned-tag"><CheckIcon size={11} /> On the shelf</span>
                        : tooGreen
                          ? <span className="eq-btn disabled"><Lock size={11} /> {b.xpRequired} bench xp</span>
                          : <button className={`eq-btn${!canAfford ? ' disabled' : ''}`} disabled={!canAfford} onClick={() => onBuyBook(b)}>
                              {canAfford ? `Buy $${b.price.toLocaleString()}` : `Need $${b.price.toLocaleString()}`}
                            </button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SupplyPanel;

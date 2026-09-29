import React, { useEffect, useState } from 'react';
import { GameState } from '../types';
import { FacilityId } from '../types.farm';
import { CROPS, FACILITIES, FAMILIES, FARM_TOOLS, PROBLEMS } from '../constants.farm';
import { GARDEN_SEED_SIZES, GARDEN_SHOP_ITEMS, GS_KIND, GS_TOOL_ART, ShopItem, ShopKind, gsSeedArt } from '../constants.shop';
import { seasonLabel } from '../constants.forage';
import { INGREDIENTS } from '../constants';
import { ActionResult, buySeed, buyShopItem, buyTool, seedPrice } from '../services/estate';
import { GS_ITEMS, GS_UI, GS_SCENE } from './gardenShopSheet';
import { FARM_ICONS } from './farmIconSheet';
import { CROP_SPRITES } from './estatePlates';
import { CloseIcon } from './icons';

/**
 * THE GARDEN SHOP
 *
 * Seed, feed, remedies, beneficial insects and machines (constants.shop.ts).
 * A shop is a dark room like every other screen; what is on its shelves is
 * printed stock, because a seed packet and a sack label are paper.
 */

/** One of the shop's pictures, or the tool sheet's where the shop has none. */
export const GsArt: React.FC<{ sheet?: 'items' | 'ui'; cell: number; size?: number }> = ({ sheet = 'items', cell, size = 48 }) => {
  const src = (sheet === 'ui' ? GS_UI : GS_ITEMS)[cell];
  if (!src) return null;
  return <img className="gs-art" src={src} width={size} height={size} alt="" aria-hidden="true" draggable={false} />;
};

const nameOf = (id: string) => INGREDIENTS.find(i => i.id === id)?.name ?? id;
const money = (v: number) => `$${Math.round(v).toLocaleString()}`;

/** What an item does, in the small print under its description. */
export const shopEffects = (i: ShopItem): string[] => {
  const out: string[] = [];
  if (i.fertility) out.push(`${i.fertility > 0 ? '+' : ''}${i.fertility} fertility`);
  if (i.life) out.push(`${i.life > 0 ? '+' : ''}${i.life} soil life`);
  if (i.clears) out.push(`sees off ${i.clears.map(id => PROBLEMS[id]?.label.toLowerCase()).filter(Boolean).join(', ')}`);
  if (i.key === 'wca') out.push('stops blossom-end rot');
  if (i.lasts) out.push(`guards ${i.lasts} days`);
  if (i.covered) out.push('under cover only');
  if (i.months) out.push(`works ${seasonLabel(i.months)}`);
  out.push(i.synthetic ? 'synthetic: the bed loses its label' : i.kind === 'feed' ? 'bought feed' : '');
  return out.filter(Boolean);
};

interface CardProps { art: React.ReactNode; title: string; sub?: string; lines: string[]; stock?: string | null; children: React.ReactNode }
const Card: React.FC<CardProps> = ({ art, title, sub, lines, stock, children }) => (
  <div className="gs-card">
    <div className="gs-pic">{art}</div>
    <div className="gs-txt">
      <h4>{title}{sub && <small>{sub}</small>}</h4>
      {lines.map((l, k) => <p key={k} className={k === 0 ? 'ab' : 'fx'}>{l}</p>)}
      {stock && <p className="gs-stock">{stock}</p>}
      <div className="gs-buy">{children}</div>
    </div>
  </div>
);

const TABS: ShopKind[] = ['seeds', 'feed', 'organic', 'bio', 'tools'];
const TAB_ART: Record<ShopKind, ['items' | 'ui', number]> = { seeds: ['ui', 4], feed: ['ui', 5], organic: ['ui', 6], bio: ['ui', 7], tools: ['items', 30] };

interface GardenShopProps {
  gameState: GameState;
  tab: ShopKind;
  onTab: (t: ShopKind) => void;
  onClose: () => void;
  onBuy: (fn: (s: GameState) => ActionResult) => void;
}

const GardenShop: React.FC<GardenShopProps> = ({ gameState: g, tab, onTab, onClose, onBuy }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  // Every seed is on the shelf: buying ahead for a season is planning, not a mistake.
  const [onlyNow, setOnlyNow] = useState(false);
  const est = g.estate;
  const seeds = est.seeds ?? {};
  const shop = est.shop ?? {};
  const owned = Object.keys(est.facilities) as FacilityId[];
  const month = g.month;

  let body: React.ReactNode;
  if (tab === 'seeds') {
    const crops = Object.values(CROPS)
      .filter(c => !onlyNow || c.plant.includes(month) || c.plant.includes((month + 1) % 12))
      .sort((a, b) => (b.plant.includes(month) ? 1 : 0) - (a.plant.includes(month) ? 1 : 0) || nameOf(a.id).localeCompare(nameOf(b.id)));
    // Grouped by kind, in the order the families are declared; sow-now first within each.
    const groups = (Object.keys(FAMILIES) as (keyof typeof FAMILIES)[])
      .map(fam => ({ fam, list: crops.filter(c => c.family === fam) }))
      .filter(g2 => g2.list.length > 0);
    body = crops.length === 0
      ? <p className="gs-empty">Nothing goes in the ground this month or next. Show every seed instead.</p>
      : groups.map(({ fam, list }) => (
        <React.Fragment key={fam}>
          <h3 className="gs-group">{FAMILIES[fam].label}<small>{list.length}</small></h3>
          {list.map(c => {
        const places = c.where.map(w => FACILITIES[w]?.name ?? w);
        const usable = c.where.some(w => owned.includes(w));
        const have = Math.round(seeds[c.id] ?? 0);
        const line = est.seedLines[c.id] ?? 0;
        const now = c.plant.includes(month);
        const sprite = CROP_SPRITES[c.id]?.tiny;
        return (
          <Card key={c.id}
            art={<span className="gs-packet"><GsArt cell={gsSeedArt(c)} size={56} />{sprite && <img className="gs-crop es-sprite tiny" src={sprite} alt="" />}</span>}
            title={nameOf(c.id)} sub={now ? ' · sow now' : ` · sow ${seasonLabel(c.plant)}`}
            lines={[c.note, `For ${places.join(' or ')}${usable ? '' : ' — not yours yet'}${line > 0 ? ` · your own line is generation ${line}` : ''}`]}
            stock={have > 0 ? `In the shed: seed for ${have} m²` : null}>
            {GARDEN_SEED_SIZES.filter(z => !z.field || c.where.includes('top_field')).map(z => {
              const cost = seedPrice(c, z);
              return <button key={z.id} className="btn sm" disabled={g.money < cost} onClick={() => onBuy(s => buySeed(s, c.id, z.id))}>{z.label} {z.m2} m² · {money(cost)}</button>;
            })}
          </Card>
        );
          })}
        </React.Fragment>
      ));
  } else if (tab === 'tools') {
    body = FARM_TOOLS.map(t => {
      const where = (t.where ?? owned).filter(fid => owned.includes(fid));
      const art = GS_TOOL_ART[t.id];
      const icon = FARM_ICONS[t.id];
      return (
        <Card key={t.id}
          art={art ? <GsArt sheet={art[0]} cell={art[1]} size={56} /> : icon ? <img className="gs-art" src={icon.src} width={icon.w} height={icon.h} alt="" /> : null}
          title={t.name} sub={` · ${money(t.cost)}`} lines={[t.about]}>
          {where.length === 0
            ? <span className="gs-note">Needs {(t.where ?? []).map(w => FACILITIES[w]?.name ?? w).join(' or ') || 'some land'} first.</span>
            : where.map(fid => est.facilities[fid]?.kit[t.id]
              ? <span key={fid} className="gs-owned">✓ {FACILITIES[fid].name}</span>
              : <button key={fid} className="btn sm" disabled={g.money < t.cost} onClick={() => onBuy(s => buyTool(s, fid, t.id))}>For {FACILITIES[fid].name}</button>)}
        </Card>
      );
    });
  } else {
    body = GARDEN_SHOP_ITEMS.filter(i => i.kind === tab).map(i => {
      const have = Math.round(shop[i.id] ?? 0);
      return (
        <Card key={i.id} art={<GsArt cell={i.art} size={56} />} title={i.name} sub={` · ${money(i.price)} a ${i.unit}`}
          lines={[i.about, shopEffects(i).join(' · ')]}
          stock={`A ${i.unit} covers ${i.cover} m²${have > 0 ? ` · in the shed: ${have} m²` : ''}`}>
          {[1, 5].map(n => (
            <button key={n} className="btn sm" disabled={g.money < i.price * n} onClick={() => onBuy(s => buyShopItem(s, i.id, n))}>
              {n === 1 ? `One ${i.unit}` : `${n} ${i.unit}s`} · {money(i.price * n)}
            </button>
          ))}
        </Card>
      );
    });
  }

  return (
    <div className="modal-overlay gshop-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="townview gshop">
        <div className="tw-head gs-head" style={{ ['--gs-scene' as string]: `url(${GS_SCENE})` } as React.CSSProperties}>
          <span className="sh-medal gs-medal"><GsArt sheet="ui" cell={0} size={52} /></span>
          <div className="sh-title">
            <span className="kicker">Seed, feed and ironmongery</span>
            <h2>The Garden Shop</h2>
          </div>
          <div className="sh-plates">
            <div className="sh-plate"><span className="l">Purse</span><span className="v">{money(g.money)}</span></div>
          </div>
          <button className="close-stamp" onClick={onClose} aria-label="Close the shop"><CloseIcon size={13} /></button>
        </div>
        <div className="gs-tabs" role="tablist">
          {TABS.map(t => (
            <button key={t} role="tab" aria-selected={tab === t} className={`gs-tab${tab === t ? ' on' : ''}`} onClick={() => onTab(t)}>
              <GsArt sheet={TAB_ART[t][0]} cell={TAB_ART[t][1]} size={22} />{GS_KIND[t].label}
            </button>
          ))}
        </div>
        <div className="gs-intro">
          <p>{GS_KIND[tab].note}</p>
          {tab === 'seeds' && <button className="linkish" onClick={() => setOnlyNow(v => !v)}>{onlyNow ? 'Show every seed' : 'Only what goes in this month or next'}</button>}
        </div>
        <div className="tw-body custom-scrollbar"><div className="gs-grid">{body}</div></div>
      </div>
    </div>
  );
};

export default GardenShop;

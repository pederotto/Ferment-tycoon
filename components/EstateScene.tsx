import React, { useEffect, useRef } from 'react';
import { EstateState, FacilityId, Plot, Tree, GroundId } from '../types.farm';
import { GROUNDS, GROUND_ORDER } from '../constants.wild';
import { CROPS, FAMILIES, TREE_SPECS } from '../constants.farm';
import { ESTATE_PLATES, ESTATE_GEOM, CROP_SPRITES, CROP_STAGES, CROP_EXTRA, StageSprite } from './estatePlates';
import { HEN_FRAMES } from './farmIconSheet';
import { DayWeather, sunTimes, roll } from '../services/climate';
import { flyingDay } from '../services/livestock';

/* =============================================================================
   THE ESTATE, DRAWN

   A 384x216 pixel canvas, scaled up crisp. The plate is the place; everything
   that changes is drawn live over it from the state — each bed at its stage,
   what has ripened, what has gone wrong, what is laid over it — and then the
   day: its weather, and its light, which follows the real sunrise and sunset
   at 45°N, so a December field day is visibly short.

   The plates (components/estatePlates.ts) are the owner's paintings where they
   exist, at their own 480x270 grid, and placeholders at 384x216 elsewhere; the
   canvas takes the size of the plate. Geometry comes with each plate, measured
   off it, so a bed is drawn where the picture has a bed. Beds and strips are
   quads (top-left, top-right, bottom-right, bottom-left) because the paintings
   are in perspective, and anything standing on them is scaled by its depth:
   k * (y - horizon).
   ============================================================================= */

export const SCENE_W = 384;
export const SCENE_H = 216;

export type ScenePlace = FacilityId | 'farm_map' | 'wild_map' | GroundId;
export const isGround = (p: string): p is GroundId => !!GROUNDS[p as GroundId];
/** The wild map's postcards: every ground, and the salt pans, which are on the coast. */
export const WILD_TILES: (GroundId | 'salt_pans')[] = [...GROUND_ORDER, 'salt_pans'];
/** Whether the wild map is the owner's painting (pins) or the postcard board (tiles). */
export const wildMapPainted = (): boolean => !!ESTATE_PLATES['wild_map:summer'];
export const tileRect = (i: number): number[] => { const c = i % 4, r = Math.floor(i / 4); return [c * 120 + 4, r * 90 + 4, c * 120 + 116, r * 90 + 86]; };

/** The grid this place's plate is on. */
export const sceneSize = (place: ScenePlace): [number, number] => place === 'wild_map' ? [480, 270] : ESTATE_GEOM[place]?.size ?? [SCENE_W, SCENE_H];

export type Quad = number[][];
/** A rectangle [x0, y0, x1, y1] or a quad, as a quad. */
export const asQuad = (r: number[] | Quad): Quad => Array.isArray(r[0]) ? r as Quad : [[r[0] as number, r[1] as number], [r[2] as number, r[1] as number], [r[2] as number, r[3] as number], [r[0] as number, r[3] as number]];
/** The point u across and v down a quad (bilinear). */
const qAt = (q: Quad, u: number, v: number): [number, number] => {
  const tx = q[0][0] + (q[1][0] - q[0][0]) * u, ty = q[0][1] + (q[1][1] - q[0][1]) * u;
  const bx = q[3][0] + (q[2][0] - q[3][0]) * u, by = q[3][1] + (q[2][1] - q[3][1]) * u;
  return [tx + (bx - tx) * v, ty + (by - ty) * v];
};
/** v for a fraction t of the real depth from the far edge to the near one, so rows are evenly spaced on the ground. */
const depthV = (q: Quad, t: number, horizon: number): number => {
  const y0 = (q[0][1] + q[1][1]) / 2, y1 = (q[2][1] + q[3][1]) / 2;
  if (y0 - horizon < 1) return t;
  const d0 = 1 / (y0 - horizon), d1 = 1 / (y1 - horizon);
  const y = horizon + 1 / (d0 + (d1 - d0) * t);
  return (y - y0) / (y1 - y0);
};
const depthScale = (g: any, y: number): number => g?.k ? g.k * (y - g.horizon) : 1 + (y - 100) / 120;

interface Props {
  place: ScenePlace;
  estate: EstateState;
  month: number;
  doy: number;
  day: number;
  minute: number;
  wx: DayWeather;
  weekType: string;
  owned: Partial<Record<FacilityId, boolean>>;
  selected: string[];
}

const seasonOf = (m: number) => (m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter');

/** Which painted variant fits today: snow lying, a hoarfrost morning, or the plain season. */
export const plateKey = (place: ScenePlace, month: number, wx: DayWeather, weekType: string): string => {
  const s = seasonOf(month);
  const snowy = weekType === 'Snowy' || wx.snow;
  const variant = s === 'winter' && snowy ? 'winter_snow' : wx.frost && (s === 'spring' || s === 'autumn') ? `${s}_frost` : s;
  // A painted place may lack a variant (the lemon house came without a clear
  // winter): the plain season, then the other winter, then summer.
  const tries = [variant, s, s === 'winter' ? 'winter_snow' : s, 'summer'].map(v => `${place}:${v}`);
  return tries.find(k => ESTATE_PLATES[k]) ?? tries[0];
};

/* Tree ids in the model against the placeholder plates' tree positions. */
const TREE_AT: Record<string, string> = {
  apple_old: 'apple_1', apple_young: 'apple_2', plum_near: 'plum_2', plum_far: 'plum_1', yuzu_wall: 'yuzu', akebi_pergola: 'akebi',
  finger_lime: 'finger_limes', calamansi_pot: 'calamansi', buddhas_hand_pot: 'buddhas_hand', black_sapote_pot: 'black_sapote',
};
// A painted place names its trees by the game's own ids; the placeholder renders used the
// aliases above. The tree's own id wins, so the two can coexist.
export const treeGeom = (place: ScenePlace, id: string): number[] | undefined => ESTATE_GEOM[place]?.trees?.[id] ?? ESTATE_GEOM[place]?.trees?.[TREE_AT[id] ?? id];
export const potGeom = (place: ScenePlace, id: string): number[] | undefined => ESTATE_GEOM[place]?.pots?.[id] ?? ESTATE_GEOM[place]?.pots?.[TREE_AT[id] ?? id];

const FRUIT_COL: Record<string, string[]> = {
  apples: ['#b8302a', '#d8503a', '#8aa83a'], plums: ['#c8d860', '#a8c048'], yuzu: ['#e8c02a', '#f2d84a'], akebi: ['#6a3a8a', '#8a5aa8'],
  finger_limes: ['#3a5a2a', '#5a7a3a'], calamansi: ['#e89a2a', '#b8b83a'], buddhas_hand: ['#f0d040', '#e8c030'], black_sapote: ['#4a6a2a', '#6a8a3a'],
};
const TOMATO_COL: Record<string, string> = {
  cuore_di_bue: '#d0342a', brandywine: '#d8606a', black_krim: '#6a2a2a', green_zebra: '#b8c040', cherokee_purple: '#7a3a44',
  san_marzano: '#d8302a', costoluto_genovese: '#d0402a', white_beauty: '#ece6c8', striped_german: '#e8a030', paul_robeson: '#5a2a26',
};
const CORN_COL: Record<string, string[]> = {
  hopi_blue_corn: ['#3a4a8a', '#5a5aa0'], glass_gem_corn: ['#c86aa0', '#6ab0c8', '#e8c040'], painted_corn: ['#c84a3a', '#e8c040', '#6a4a8a'],
  oaxacan_green_corn: ['#6a9a4a'], bloody_butcher_corn: ['#8a1a1a'], mandan_bride_corn: ['#e8d8a8', '#a86a8a'], strawberry_popcorn: ['#c83a3a'],
  navajo_wedding_corn: ['#e8e0d0', '#6a4a8a'], cherokee_long_ear_corn: ['#d8a040', '#8a4a8a'], fire_chief_corn: ['#c83a2a', '#e8b040'],
};

const IMG: Record<string, HTMLImageElement> = {};
const img = (src: string, onload: () => void): HTMLImageElement => {
  let i = IMG[src];
  if (!i) { i = new Image(); i.onload = onload; i.src = src; IMG[src] = i; }
  return i;
};

const EstateScene: React.FC<Props> = (props) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef(props);
  live.current = props;
  const tick = useRef(0);
  const hens = useRef<{ x: number; y: number; tx: number; ty: number; c: string }[]>([]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, last = 0, alive = true;
    const draw = () => frame(ctx, live.current, tick.current, hens.current, reduce, () => { if (alive) draw(); });
    const loop = (t: number) => {
      if (!alive) return;
      if (!document.hidden && t - last > 95) { last = t; tick.current++; draw(); }
      raf = requestAnimationFrame(loop);
    };
    draw();
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);

  // A still frame whenever the state changes, for reduced motion and for the first paint.
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (ctx) frame(ctx, props, tick.current, hens.current, true, () => {});
  });

  const [w, h] = sceneSize(props.place);
  return <canvas ref={ref} width={w} height={h} className="estate-canvas" aria-hidden="true" />;
};

/* -----------------------------------------------------------------------------
   DRAWING
   --------------------------------------------------------------------------- */
const px = (ctx: CanvasRenderingContext2D, x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };

const frame = (
  ctx: CanvasRenderingContext2D, p: Props, t: number,
  hens: { x: number; y: number; tx: number; ty: number; c: string }[], still: boolean, redraw: () => void,
) => {
  const [W, H] = sceneSize(p.place);
  wake = redraw;
  // Resizing a canvas resets its context, smoothing included.
  if (ctx.canvas.width !== W || ctx.canvas.height !== H) { ctx.canvas.width = W; ctx.canvas.height = H; }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);
  if (p.place === 'wild_map') { drawWildMap(ctx, p, redraw); drawLight(ctx, p); return; }
  const key = plateKey(p.place, p.month, p.wx, p.weekType);
  const plate = ESTATE_PLATES[key] ? img(ESTATE_PLATES[key], redraw) : null;
  if (plate && plate.complete && plate.width) ctx.drawImage(plate, 0, 0);
  else { ctx.fillStyle = '#1a130b'; ctx.fillRect(0, 0, W, H); }
  if (isGround(p.place)) drawGround(ctx, p, redraw);
  const f = !isGround(p.place) && p.place !== 'farm_map' ? p.estate.facilities[p.place as FacilityId] : undefined;
  if (p.place === 'farm_map') drawMap(ctx, p);
  else if (f) {
    if (p.place === 'walled_garden') drawGarden(ctx, f.plots, p, t);
    if (p.place === 'polytunnel') drawTunnel(ctx, f.plots, p, t);
    if (p.place === 'top_field') drawField(ctx, f.plots, p, t);
    if (p.place === 'orchard' || p.place === 'orangery') drawTrees(ctx, f.trees, p, t);
    if (p.place === 'orangery' && f.stoveLit) drawStove(ctx, t, ESTATE_GEOM.orangery?.stove ?? [36, 170]);
    if (p.place === 'hives' && f.hives) drawHives(ctx, f.hives, p, t, still);
    if (p.place === 'hen_run' && f.hens) drawHens(ctx, f.hens, hens, t, still);
    if (p.place === 'salt_pans' && f.pans) drawPans(ctx, f.pans, t);
    if (p.place === 'worm_shed' && f.shed) drawShed(ctx, f.shed, p, t);
  }
  drawWeather(ctx, p, t, still);
  drawLight(ctx, p);
};

/* --- plants --- */
const stageFrac = (pl: Plot['planting']) => {
  if (!pl) return 0;
  const spec = CROPS[pl.cropId];
  return pl.gdd / spec.gddToRipe;
};

/* --- the owner's crop sprites -------------------------------------------------
   Seven stages a family, from the crop sheets. No two plants in a bed are the
   same: each is seeded with its own size, a mirror, a small offset from its
   place in the row, and its own pace — some a few days ahead of the bed, some
   behind — so a bed comes into flower and ripens unevenly, the way one does,
   instead of in lockstep. */
const SPRITE_SET: Record<string, string> = {
  brassica: 'cabbage', napa: 'napa', allium: 'garlic', tomato: 'tomato', chili: 'chili', strawberry: 'strawberry',
  rose: 'rose', corn: 'corn', bean: 'bean', fava: 'fava', pea: 'pea', chickpea: 'chickpea', lentil: 'lentil',
};
/** How tall the ripe plant stands at scale 1, in scene pixels (cabbage and strawberry by their spread). */
const SPRITE_TALL: Record<string, number> = { tomato: 46, bean: 38, pea: 22, fava: 25, chickpea: 13, lentil: 9, napa: 12, corn: 50, chili: 15, rose: 16, cabbage: 11, garlic: 12, strawberry: 8 };
const TOMATO_COLOUR: Record<string, string> = {
  cuore_di_bue: 'red', brandywine: 'pink', black_krim: 'black', green_zebra: 'green', cherokee_purple: 'plum',
  san_marzano: 'red', costoluto_genovese: 'red', white_beauty: 'cream', striped_german: 'orange', paul_robeson: 'black',
};
let wake: () => void = () => {};
/** The stage a single plant shows, with its own pace folded in. */
const plantStage = (f: number, jit: number, ripe: boolean, over: boolean, dead: boolean): number => {
  if (dead || over) return 6;
  const fj = f * (1 + jit);
  if (ripe) return fj >= 0.97 ? 5 : 4;
  return fj < 0.05 ? 0 : fj < 0.2 ? 1 : fj < 0.45 ? 2 : fj < 0.64 ? 3 : 4;
};
/** Not every row ends in the plant the game wants: garlic's last two cells are lifted
 *  bulbs, which never stand in a bed, and a dead rose is bare canes, not hips. */
const STAGE_MAP: Record<string, number[]> = { garlic: [0, 1, 2, 3, 4, 4, 4] };
const DEAD_SPRITE: Record<string, [string, number]> = { rose: ['rose', 0], garlic: ['garlic', 4] };

const drawCropSprite = (ctx: CanvasRenderingContext2D, cropId: string, f: number, x: number, y: number, scale: number, ripe: boolean, over: boolean, dead: boolean, seed: number): boolean => {
  const fam = CROPS[cropId]?.family;
  const set = fam ? SPRITE_SET[fam] : undefined;
  const stages = set ? CROP_STAGES[set] : undefined;
  if (!set || !stages) return false;
  const r = (k: number) => roll('plant', cropId, seed, k);
  const st = plantStage(f, (r(0) - 0.5) * 0.2, ripe, over, dead);
  const dm = dead ? DEAD_SPRITE[set] : undefined;
  let sp: StageSprite | undefined = dm ? CROP_STAGES[dm[0]]?.[dm[1]] : stages[STAGE_MAP[set]?.[st] ?? st];
  if (st === 5 && set === 'tomato') sp = CROP_EXTRA[`tomato_ripe-${TOMATO_COLOUR[cropId] ?? 'red'}`] ?? sp;
  if (st === 5 && cropId === 'pineberry') sp = CROP_EXTRA.pineberry_ripe ?? sp;
  if (!sp) return false;
  const im = img(sp.src, wake);
  if (!im.complete || !im.width) return true;
  const ref = stages[5] ?? sp;
  const k = (SPRITE_TALL[set] / ref.h) * scale * (0.86 + r(1) * 0.28);
  const w = sp.w * k, h = sp.h * k;
  const px0 = Math.round(x + (r(2) - 0.5) * 2 * scale), py0 = Math.round(y + (r(3) - 0.5) * 1.5 * scale);
  ctx.save();
  if (dead) ctx.globalAlpha = 0.7;
  if (r(4) < 0.5) { ctx.translate(px0, 0); ctx.scale(-1, 1); ctx.translate(-px0, 0); }
  ctx.drawImage(im, Math.round(px0 - w / 2), Math.round(py0 - h), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  ctx.restore();
  return true;
};

const drawPlant = (ctx: CanvasRenderingContext2D, cropId: string, f: number, x: number, y: number, scale: number, ripe: boolean, over: boolean, dead: boolean, fruit: number, seed: number) => {
  const fam = FAMILIES[CROPS[cropId]?.family];
  if (!fam) return;
  if (drawCropSprite(ctx, cropId, f, x, y, scale, ripe, over, dead, seed)) return;
  const leaf = dead ? '#5a4a30' : over ? '#8a7a40' : '#4e8a34';
  const leaf2 = dead ? '#3a3020' : over ? '#6a5a30' : '#3a6a28';
  if (f < 0.05) { px(ctx, x, y, '#5a8a34'); return; }
  const grow = Math.min(1, f);
  switch (fam.id) {
    case 'brassica': case 'napa': {
      const r = Math.max(1, Math.round((fam.id === 'napa' ? 3.5 : 4.5) * scale * Math.min(1, 0.3 + grow)));
      ctx.fillStyle = leaf2; ctx.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r + 1);
      ctx.fillStyle = leaf; ctx.fillRect(Math.round(x - r + 1), Math.round(y - r - 1), r * 2 - 2, r);
      if (f > 0.5 && !dead) { const h = Math.max(1, Math.round(r * 0.7)); ctx.fillStyle = over ? '#c8c060' : '#a8c870'; ctx.fillRect(Math.round(x - h / 2), Math.round(y - r), h, h); }
      if (over && !dead) px(ctx, x, y - r - 2, '#e8d040');
      return;
    }
    case 'allium': {
      const h = Math.round(3 + 5 * grow * scale);
      for (let k = 0; k < h; k++) { px(ctx, x, y - k, k % 2 ? leaf : leaf2); if (k > 2 && k % 2 === 0) { px(ctx, x - 1, y - k, leaf); px(ctx, x + 1, y - k - 1, leaf2); } }
      if (ripe || over) { ctx.fillStyle = '#e8e0d0'; ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 2); }
      return;
    }
    case 'tomato': case 'chili': case 'strawberry': case 'rose': {
      // drawn by their own place; a generic bush here
      const r = Math.max(1, Math.round(3 * scale * grow));
      ctx.fillStyle = leaf2; ctx.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r);
      ctx.fillStyle = leaf; ctx.fillRect(Math.round(x - r + 1), Math.round(y - r - 1), Math.max(1, r * 2 - 2), r);
      if (fruit > 0) for (let k = 0; k < Math.min(6, Math.ceil(fruit)); k++) px(ctx, x - r + ((seed + k * 3) % (r * 2 + 1)), y - r + ((seed + k * 5) % Math.max(1, r)), fam.id === 'strawberry' ? '#f4ece0' : fam.id === 'rose' ? '#d85a8a' : '#d8342a');
      return;
    }
    default: {
      // pulses on canes or in bushes
      const h = Math.round((3 + 7 * grow) * scale);
      for (let k = 0; k < h; k++) { px(ctx, x, y - k, k % 2 ? leaf : leaf2); if (k % 2 === 0) { px(ctx, x - 1, y - k, leaf); px(ctx, x + 1, y - k - 1, leaf2); } }
      if (f > 0.42 && f < 0.62 && !dead) px(ctx, x + 1, y - h + 1, cropId === 'broad_beans' ? '#f0f0e8' : '#e8a8c0');
      if (f >= 0.62) { ctx.fillStyle = ripe || over ? '#3a2e20' : '#6aa040'; ctx.fillRect(Math.round(x) + 1, Math.round(y - h * 0.6), 1, 3); ctx.fillRect(Math.round(x) - 2, Math.round(y - h * 0.4), 1, 3); }
    }
  }
};

/** A flock on a bed: most of it on the ground hopping and pecking, a few birds at a time
 *  lifting off and landing again somewhere else. Each bird is sized by its own depth. */
const BIRD: Record<string, { n: number; body: string; dark: string; beak: string; size: number }> = {
  birds_grain: { n: 12, body: '#8a6a44', dark: '#5a4028', beak: '#c8a870', size: 0.7 },   // sparrows
  crows:       { n: 4,  body: '#16161c', dark: '#08080c', beak: '#3a3a40', size: 1.2 },
  pigeons:     { n: 3,  body: '#8a8e9a', dark: '#5a5e6a', beak: '#d8b0a0', size: 1.0 },
};
const drawFlock = (ctx: CanvasRenderingContext2D, q: Quad, g: any, t: number, seed: number, b: { n: number; body: string; dark: string; beak: string; size: number }) => {
  for (let k = 0; k < b.n; k++) {
    const r = (j: number) => roll('flock', seed, k, j);
    const cycle = 240 + r(1) * 160;
    const ph = ((t + r(2) * cycle) % cycle) / cycle;         // 0..1 through this bird's cycle
    const hopTo = Math.floor((t + r(2) * cycle) / cycle);     // a new spot after every flight
    const u = 0.1 + roll('fu', seed, k, hopTo) * 0.8, v = 0.15 + roll('fv', seed, k, hopTo) * 0.75;
    const [gx, gy] = qAt(q, u, v);
    const s = Math.max(1, Math.round(depthScale(g, gy) * b.size));
    const dir = roll('fd', seed, k, hopTo) < 0.5 ? -1 : 1;
    if (ph < 0.86) {
      // on the ground: a hop now and then, the head down to peck
      const hop = (t + k * 7) % 23 === 0 ? s : 0;
      const peck = (t + k * 5) % 17 < 4;
      const x = Math.round(gx + Math.sin((t + k * 11) / 40) * 2 * s), y = Math.round(gy) - hop;
      ctx.fillStyle = 'rgba(30,24,14,0.25)'; ctx.fillRect(x - s, Math.round(gy) + 1, 3 * s, 1);
      ctx.fillStyle = b.body; ctx.fillRect(x - s, y - 2 * s, 3 * s, 2 * s);
      ctx.fillStyle = b.dark; ctx.fillRect(x - s - dir * s, y - 2 * s, s, s);           // tail
      const hx = x + dir * 2 * s, hy = peck ? y - s : y - 3 * s;
      ctx.fillStyle = b.body; ctx.fillRect(hx - (dir < 0 ? 0 : 0), hy, s, s);          // head
      ctx.fillStyle = b.beak; ctx.fillRect(hx + dir * s, hy + (peck ? s - 1 : Math.floor(s / 2)), Math.max(1, Math.ceil(s / 2)), 1);
    } else {
      // in the air: up and over in an arc, wings beating
      const a = (ph - 0.86) / 0.14;
      const x = Math.round(gx + dir * a * 30 * s), y = Math.round(gy - Math.sin(a * Math.PI) * 18 * s - 2 * s);
      const up = (t + k) % 4 < 2;
      ctx.fillStyle = b.body; ctx.fillRect(x, y, 2 * s, s);
      ctx.fillStyle = b.dark;
      ctx.fillRect(x - s, y + (up ? -s : s), s, s); ctx.fillRect(x + 2 * s, y + (up ? -s : s), s, s);
    }
  }
};

/** What the season and the problems have laid over a bed, drawn on its quad. */
const drawBedExtras = (ctx: CanvasRenderingContext2D, q: Quad, plot: Plot, t: number, seed: number, g: any) => {
  const pl = plot.planting;
  const rnd = (k: number) => roll('bed', seed, k);
  const P = (k: number) => qAt(q, rnd(k), rnd(k + 99));
  // how much ground this is on screen, so a big near bed gets as dense a cover as a small far one
  const xs = q.map(c => c[0]), ys = q.map(c => c[1]);
  const areaPx = Math.max(1, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) * 0.7);
  const n = (base: number) => Math.round(base * Math.min(6, Math.max(0.5, areaPx / 1800)));
  const midY = (ys[0] + ys[2]) / 2;
  const sc = Math.max(1, Math.round(depthScale(g, midY)));
  if (pl?.cover.mulch) for (let k = 0; k < n(60); k++) { const [x, y] = P(k); ctx.fillStyle = k % 3 ? '#c8a860' : '#a88a48'; ctx.fillRect(Math.round(x), Math.round(y), sc, 1); }
  if (plot.water < 22 && !pl?.cover.mulch) for (let k = 0; k < n(6); k++) { const [x, y] = qAt(q, 0.1 + rnd(k + 7) * 0.8, 0.15 + rnd(k + 17) * 0.75); ctx.fillStyle = '#2a1e14'; ctx.fillRect(Math.round(x), Math.round(y), 4 * sc, 1); px(ctx, x + 2 * sc, y + 1, '#2a1e14'); }
  if (!pl) return;
  for (const pr of pl.problems) {
    if (pr.id === 'weeds') for (let k = 0; k < n(26); k++) { const [x, y] = P(k + 300); ctx.fillStyle = k % 2 ? '#7ab83a' : '#5a9a2a'; ctx.fillRect(Math.round(x), Math.round(y) - sc + 1, 1, sc); }
    if (pr.id === 'whites') for (let k = 0; k < 4; k++) { const [x0, y0] = qAt(q, ((t * (1 + k) * 0.01 + k * 0.3) % 1), 0); const by = y0 - 5 * sc + Math.sin(t / 3 + k) * 3; px(ctx, x0, by, '#f6f6f0'); px(ctx, x0 + 1, by - (t % 2), '#f6f6f0'); }
    if (pr.id === 'slugs') for (let k = 0; k < n(5); k++) { const [x, y] = P(k + 500); ctx.fillStyle = 'rgba(220,230,235,0.75)'; ctx.fillRect(Math.round(x), Math.round(y), 4 * sc, 1); }
    if (pr.id === 'pigeons' || pr.id === 'crows' || pr.id === 'birds_grain') drawFlock(ctx, q, g, t, seed, BIRD[pr.id]);
    if (pr.id === 'blight' || pr.id === 'rust' || pr.id === 'chocolate_spot' || pr.id === 'ascochyta' || pr.id === 'blackspot') for (let k = 0; k < n(10); k++) { const [x, y] = P(k + 700); px(ctx, x, y, pr.id === 'rust' ? '#c8702a' : '#5a3a1a'); }
  }
  const lift = 8 * sc;
  if (pl.cover.net || pl.cover.fleece) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1] - lift); ctx.lineTo(q[1][0], q[1][1] - lift); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]); ctx.closePath();
    if (pl.cover.fleece) { ctx.fillStyle = 'rgba(244,244,236,0.55)'; ctx.fill(); }
    else { ctx.clip(); ctx.fillStyle = 'rgba(220,226,230,0.3)'; for (let x = Math.min(...xs); x < Math.max(...xs); x += 3) ctx.fillRect(x, Math.min(...ys) - lift, 1, Math.max(...ys) - Math.min(...ys) + lift); for (let y = Math.min(...ys) - lift; y < Math.max(...ys); y += 3) ctx.fillRect(Math.min(...xs), y, Math.max(...xs) - Math.min(...xs), 1); }
    ctx.restore();
  }
};

const drawGarden = (ctx: CanvasRenderingContext2D, plots: Plot[], p: Props, t: number) => {
  const g = ESTATE_GEOM.walled_garden;
  let bed = 0;
  plots.forEach(plot => {
    const pl = plot.planting;
    if (plot.id === 'roses') {
      const q = asQuad(g.rose);
      if (!pl) return;
      const inBloom = pl.stage === 'ripe';
      const n = inBloom ? Math.round(90 + 140 * Math.min(1, pl.ripeKg / 0.5)) : pl.stage === 'flowering' || pl.stage === 'fruiting' ? 70 : 0;
      // the bushes themselves, then what is on them
      if (pl.stage !== 'dead') for (let k = 0; k < 14; k++) {
        const [x, y] = qAt(q, 0.25 + roll('rb', k) * 0.5, (k + 0.5) / 14);
        const sc = depthScale(g, y), r = Math.max(2, Math.round(4 * sc));
        ctx.fillStyle = pl.stage === 'spent' && p.month >= 9 ? '#5a5a30' : '#3a5a26'; ctx.fillRect(Math.round(x - r), Math.round(y - r * 1.6), r * 2, Math.round(r * 1.6));
        ctx.fillStyle = '#4e7a32'; ctx.fillRect(Math.round(x - r + 1), Math.round(y - r * 1.6 - 1), r * 2 - 2, r);
      }
      for (let k = 0; k < n; k++) {
        const [x, y] = qAt(q, 0.15 + roll('rose', k) * 0.7, roll('rose2', k));
        const sc = depthScale(g, y);
        ctx.fillStyle = inBloom ? ['#d85a8a', '#f08aaa', '#b83a6a'][k % 3] : '#7a9a4a';
        ctx.fillRect(Math.round(x), Math.round(y - 5 * sc * roll('rose3', k)), Math.max(1, Math.round(sc * 0.8)), Math.max(1, Math.round(sc * 0.8)));
      }
      if (pl.stage === 'spent' && p.month >= 7) for (let k = 0; k < 40; k++) { const [x, y] = qAt(q, 0.2 + roll('hip', k) * 0.6, roll('hip2', k)); px(ctx, x, y - 4 * depthScale(g, y) * roll('hip3', k), '#c83a1a'); }
      return;
    }
    const R = g.beds[bed++];
    if (!R) return;
    const q = asQuad(R);
    drawBedExtras(ctx, q, plot, t, bed, g);
    if (!pl) return;
    const f = stageFrac(pl);
    const cols = plot.areaM2 >= 6 ? 6 : 4;
    const rows = plot.areaM2 >= 6 ? 3 : 2;
    const perPlant = pl.plants > 0 ? pl.ripeKg / pl.plants * 20 : 0;
    for (let yy = 0; yy < rows; yy++) {
      const v = depthV(q, (yy + 0.5) / rows, g.horizon ?? -20);
      for (let xx = 0; xx < cols; xx++) {
        const [x, y] = qAt(q, (xx + 0.5) / cols, v);
        // A sick bed has gaps where plants failed.
        if (roll('gap', plot.id, xx, yy) > 0.35 + pl.health / 100 * 0.7) continue;
        drawPlant(ctx, pl.cropId, f, x, y, depthScale(g, y), pl.stage === 'ripe', pl.stage === 'over' || pl.stage === 'spent', pl.stage === 'dead', perPlant, bed * 97 + xx * 7 + yy * 3);
      }
    }
  });
};

const drawTunnel = (ctx: CanvasRenderingContext2D, plots: Plot[], p: Props, t: number) => {
  const g = ESTATE_GEOM.polytunnel;
  // Everything in one list, far to near, so a near plant stands in front of a far one.
  const all: { plot: Plot; pt: number[]; k: number; n: number }[] = [];
  plots.forEach((plot, i) => { const pts: number[][] = g.beds[i] ?? []; pts.forEach((pt, k) => all.push({ plot, pt, k, n: pts.length })); });
  all.sort((a, b) => a.pt[1] - b.pt[1]);
  for (const { plot, pt, k, n } of all) {
    const pl = plot.planting;
    const [x, y, sc] = pt;
    if (plot.water < 22 && (!pl || k === 0)) { ctx.fillStyle = '#2a1e14'; ctx.fillRect(Math.round(x - 4 * sc), Math.round(y + 2), Math.round(6 * sc), 1); }
    if (!pl) continue;
    const spec = CROPS[pl.cropId];
    const fam = FAMILIES[spec.family];
    const f = stageFrac(pl);
    const dead = pl.stage === 'dead';
    const tall = fam.id === 'tomato';
    const fruitPer = n ? pl.ripeKg / n : 0;
    const h = Math.round((tall ? 44 : fam.id === 'chili' ? 16 : 8) * sc * Math.min(1, 0.15 + f));
    const leaf = dead ? '#5a4a30' : pl.stage === 'spent' ? '#7a6a3a' : '#4e8a34';
    const leaf2 = dead ? '#3a3020' : pl.stage === 'spent' ? '#5a4a28' : '#3a6a28';
    if (drawCropSprite(ctx, pl.cropId, f, x, y + 1, sc, pl.stage === 'ripe', pl.stage === 'over' || pl.stage === 'spent', dead, k + plots.indexOf(plot) * 17)) {
      if (pl.problems.some(q => q.id === 'whitefly') && (t + k) % 5 < 2) px(ctx, x + 3 * sc, y - h - 2, '#f4f4f4');
      continue;
    }
    if (tall) {
      const X = Math.round(x), Y = Math.round(y), w = Math.max(1, Math.round(sc * 0.6));
      ctx.fillStyle = dead ? '#4a3a24' : '#3e6a2a'; ctx.fillRect(X, Y - h, w, h);
      // Leaves in loose clusters up the stem, bigger the nearer the plant. Seeded
      // per plant so no two stand alike and none of them looks like a ladder.
      const cl = Math.max(1, Math.round(sc * 1.3));
      const rl = (j: number, q: number) => roll('tl', plot.id, k, j, q);
      for (let j = 2, n = 0; j < h; j += Math.max(2, Math.round((2.2 + rl(n, 0) * 1.6) * sc)), n++) {
        const side = rl(n, 1) < 0.5 ? 1 : -1;
        const lw = cl * 2 + Math.round(rl(n, 2) * cl * 1.5), lh = cl + Math.round(rl(n, 3) * cl * 0.8);
        const lx = side > 0 ? X + w : X - lw, ly = Y - j - lh + Math.round(rl(n, 4) * 2);
        ctx.fillStyle = leaf2; ctx.fillRect(lx, ly + 1, lw, lh);
        ctx.fillStyle = leaf; ctx.fillRect(lx + (side > 0 ? 0 : 1), ly, lw - 1, Math.max(1, lh - 1));
        if (rl(n, 5) < 0.45) { const ox = side > 0 ? X - cl : X + w; ctx.fillStyle = leaf2; ctx.fillRect(ox, ly + Math.round(cl * 0.6), cl, Math.max(1, cl - 1)); }
      }
      // green trusses, then colour as it ripens
      if (f > 0.62 && !dead) {
        const col = TOMATO_COL[pl.cropId] ?? '#d0342a';
        const trusses = Math.max(1, Math.round(h / (10 * sc)));
        const r = Math.max(1, Math.round(2 * sc * 0.8));
        for (let j = 0; j < trusses; j++) {
          const ty = Y - 6 * sc - j * 9 * sc;
          const ripeHere = pl.stage === 'ripe' && fruitPer > 0.05 && j < 1 + fruitPer * 2;
          ctx.fillStyle = ripeHere ? col : '#6aa040';
          ctx.fillRect(X + (j % 2 ? w + 1 : -r - 1), Math.round(ty), r, r);
          ctx.fillRect(X + (j % 2 ? w + 1 + r : -2 * r - 1), Math.round(ty + r * 0.6), r, r);
        }
      }
    } else {
      drawPlant(ctx, pl.cropId, f, x, y, sc * 1.4, pl.stage === 'ripe', pl.stage === 'over' || pl.stage === 'spent', dead, fruitPer * 4, k * 5);
      if (fam.id === 'chili' && pl.stage === 'ripe' && fruitPer > 0.02) for (let j = 0; j < 3; j++) { ctx.fillStyle = j % 2 ? '#d8302a' : '#c02820'; ctx.fillRect(Math.round(x - 2 * sc + j * 2 * sc), Math.round(y - h / 2 - j * sc), Math.max(1, Math.round(sc * 0.7)), Math.max(2, Math.round(sc * 1.4))); }
    }
    if (pl.problems.some(q => q.id === 'whitefly') && (t + k) % 5 < 2) px(ctx, x + 3 * sc, y - h - 2, '#f4f4f4');
  }
};

/* How much a metre of ground shrinks going away from you, against a metre across:
   rows 0.25 m apart land 3 px apart at the foot of the painted field, where a
   metre across is 19 px, and close up into a haze by the hedge. */
const FORESHORTEN = 0.0316;

const drawField = (ctx: CanvasRenderingContext2D, plots: Plot[], p: Props, t: number) => {
  const g = ESTATE_GEOM.top_field;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const hz = g.horizon ?? 0;
  const ppm = (y: number) => (g.k ?? 0.08) * (y - hz);    // pixels per metre at y
  plots.forEach((plot, i) => {
    const S = g.strips[i];
    const pl = plot.planting;
    if (!S) return;
    const q = asQuad(S);
    drawBedExtras(ctx, q, plot, t, 40 + i, g);
    if (!pl) return;
    const fam = FAMILIES[CROPS[pl.cropId].family];
    const f = stageFrac(pl);
    const ripe = pl.stage === 'ripe', over = pl.stage === 'over' || pl.stage === 'spent', dead = pl.stage === 'dead';
    const yTop = Math.max(0, (q[0][1] + q[1][1]) / 2), yBot = Math.min(H, (q[2][1] + q[3][1]) / 2);
    // Rows at constant y are lines of constant depth; step down the strip in
    // ground metres, and across each row between its two edges.
    const edge = (y: number): [number, number] => {
      const v = (y - (q[0][1] + q[1][1]) / 2) / ((q[2][1] + q[3][1]) / 2 - (q[0][1] + q[1][1]) / 2);
      return [q[0][0] + (q[3][0] - q[0][0]) * v, q[1][0] + (q[2][0] - q[1][0]) * v];
    };
    const rowsBy = (rowM: number, fn: (y: number, x0: number, x1: number, m: number) => void) => {
      for (let y = yTop + 2; y < yBot; ) {
        const m = ppm(y);
        const [x0, x1] = edge(y);
        fn(Math.round(y), Math.max(0, x0), Math.min(W, x1), m);
        y += Math.max(1.5, rowM * m * m * FORESHORTEN);
      }
    };
    const tiles = CROP_STAGES.grain;
    if ((fam.id === 'wintergrain' || fam.id === 'springgrain') && tiles) {
      // Patches off the owner's sheet, stamped across each row a metre and a
      // bit wide, each a touch ahead or behind its neighbour.
      rowsBy(0.55, (y, x0, x1, m) => {
        const tw = Math.max(3, 1.4 * m);
        for (let x = x0 - tw * 0.3 + ((y * 7) % 5); x < x1; x += tw * 0.72) {
          const seed = Math.round(x) * 131 + y;
          const st = plantStage(f, (roll('grain', seed) - 0.5) * 0.14, ripe, over, dead);
          const sp = tiles[st];
          const im = sp && img(sp.src, wake);
          if (!im || !im.complete || !im.width) continue;
          const k = tw / sp.w, hh = sp.h * k * (0.9 + roll('gh', seed) * 0.2);
          ctx.drawImage(im, Math.round(x), Math.round(y - hh), Math.max(1, Math.round(tw)), Math.max(1, Math.round(hh)));
        }
      });
    } else if (fam.id === 'wintergrain' || fam.id === 'springgrain') {
      const tall = 1.0 * Math.min(1, 0.2 + f);
      const cc = dead ? '#6a5a3a' : over ? '#8a6a3a' : f < 0.72 ? '#5a8a34' : ripe ? '#d8b860' : '#a8a84a';
      const ear = ripe || over ? '#e8c870' : '#b8b860';
      rowsBy(0.25, (y, x0, x1, m) => {
        const hh = Math.max(1, Math.round(tall * m));
        const dx = Math.max(2, Math.round(m * 0.12));
        for (let x = x0 + (y % 2); x < x1; x += dx) {
          const jit = ((x * 7 + y * 3) % 3) - 1;
          ctx.fillStyle = cc; ctx.fillRect(Math.round(x), y - hh - jit, 1, hh + jit);
          if (f > 0.62 && !dead) { ctx.fillStyle = ear; ctx.fillRect(Math.round(x), y - hh - jit - Math.max(1, Math.round(m * 0.08)), 1, Math.max(1, Math.round(m * 0.08))); }
        }
      });
    } else if (fam.id === 'corn' && CROP_STAGES.corn) {
      rowsBy(0.75, (y, x0, x1, m) => {
        const dx = Math.max(3, Math.round(0.7 * m));
        for (let x = x0 + (y % 3); x < x1; x += dx) drawCropSprite(ctx, pl.cropId, f, x, y, 2.2 * m / 50, ripe, over, dead, Math.round(x) * 31 + y);
      });
    } else if (fam.id === 'corn') {
      const cols = CORN_COL[pl.cropId] ?? ['#e8c040'];
      rowsBy(0.75, (y, x0, x1, m) => {
        const hh = Math.round(2.2 * m * Math.min(1, 0.1 + f));
        const dx = Math.max(3, Math.round(0.7 * m));
        const w = Math.max(1, Math.round(m * 0.04));
        for (let x = x0 + (y % 3); x < x1; x += dx) {
          const X = Math.round(x);
          if (f < 0.1) { px(ctx, X, y, '#5a8a34'); continue; }
          ctx.fillStyle = dead ? '#5a4a30' : over || ripe ? '#b8a860' : '#5a8a34'; ctx.fillRect(X, y - hh, w, hh);
          const lw = Math.max(1, Math.round(m * 0.25));
          ctx.fillStyle = dead ? '#4a3a24' : over || ripe ? '#a89850' : '#6a9a3a';
          ctx.fillRect(X - lw, Math.round(y - hh * 0.6), lw, 1); ctx.fillRect(X + w, Math.round(y - hh * 0.4), lw, 1); ctx.fillRect(X - lw, Math.round(y - hh * 0.25), lw, 1);
          if (f > 0.5 && f < 0.62) { ctx.fillStyle = '#e8d890'; ctx.fillRect(X, y - hh - 1, w, 1); }
          if (f >= 0.62 && !dead) { ctx.fillStyle = ripe || over ? cols[X % cols.length] : '#8ab050'; ctx.fillRect(X + w, Math.round(y - hh * 0.55), Math.max(1, Math.round(m * 0.08)), Math.max(2, Math.round(m * 0.2))); }
        }
      });
    } else {
      // pulses and garlic in the field: low rows
      // The field is a long view: a pea sprite there is a few pixels of detail
      // and a row of them reads as static, so pulses are drawn as rows.
      rowsBy(0.45, (y, x0, x1, m) => {
        // A row closing over as the crop grows: two
        // greens, then flowers, then pods, then straw.
        const grow = Math.min(1, f);
        const hh = Math.max(1, Math.round(m * 0.35 * (0.25 + grow)));
        const cw = Math.max(1, Math.round(m * 0.18 * (0.3 + grow)));
        const step = Math.max(2, Math.round(cw * 1.3));
        const c1 = dead ? '#5a4a30' : ripe || over ? '#a88a50' : '#4e7a2e';
        const c2 = dead ? '#46391f' : ripe || over ? '#c8a860' : '#6a9a3a';
        const fl = pl.cropId === 'broad_beans' ? '#f0f0e8' : pl.cropId.includes('chick') ? '#e8e0f0' : '#b89ad8';
        for (let x = x0 + (y % 3); x < x1; x += step) {
          const X = Math.round(x), r = roll('pulse', X, y);
          const h = Math.max(1, hh + (r < 0.3 ? -1 : r > 0.8 ? 1 : 0));
          ctx.fillStyle = c1; ctx.fillRect(X, y - h, cw, h);
          ctx.fillStyle = c2; ctx.fillRect(X + (r < 0.5 ? 0 : cw - 1), y - h, 1, Math.max(1, h - 1));
          if (!dead && !ripe && !over && f > 0.42 && f < 0.7 && r > 0.55) px(ctx, X + (cw >> 1), y - h, fl);
        }
      });
    }
  });
};

const drawTrees = (ctx: CanvasRenderingContext2D, trees: Tree[], p: Props, t: number) => {
  for (const tree of trees) {
    const c = treeGeom(p.place, tree.id);
    if (!c) continue;
    const spec = TREE_SPECS[tree.cropId];
    const bloomNow = tree.bloom > 0 && tree.gdd < spec.gddBloom + 90 && tree.fruitKg === 0;
    const rr = (k: number) => roll('tree', tree.id, k);
    // A fruit or a flower is sized to the canopy, or on a big painted tree it is a speck nobody can see.
    const fs = c[2] >= 30 ? 3 : 2, bs = c[2] >= 30 ? 2 : 1;
    if (bloomNow) {
      const n = Math.round(30 + 60 * tree.bloom);
      for (let i = 0; i < n; i++) { const a = rr(i) * Math.PI * 2, d = Math.sqrt(rr(i + 500)); ctx.fillStyle = i % 4 ? '#f6eef0' : '#f0c0d0'; ctx.fillRect(Math.round(c[0] + Math.cos(a) * d * c[2]), Math.round(c[1] + Math.sin(a) * d * c[3]), bs, bs); }
    }
    const hanging = tree.fruitKg + tree.ripeKg;
    if (hanging > 0.05) {
      const n = Math.round(Math.min(60, 6 + hanging * (spec.prime > 20 ? 0.45 : 4)));
      const ripeShare = tree.ripeKg / hanging;
      const cols = FRUIT_COL[tree.cropId] ?? ['#d8a030'];
      for (let i = 0; i < n; i++) {
        const a = rr(i + 1000) * Math.PI * 2, d = Math.sqrt(rr(i + 2000));
        const fx = Math.round(c[0] + Math.cos(a) * d * c[2]), fy = Math.round(c[1] + Math.sin(a) * d * c[3]);
        const isRipe = i < n * ripeShare;
        ctx.fillStyle = '#1e1a10'; ctx.fillRect(fx, fy + fs, fs, 1);
        ctx.fillStyle = isRipe ? cols[i % cols.length] : '#9ac850'; ctx.fillRect(fx, fy, fs, fs);
        px(ctx, fx, fy, isRipe ? '#fff6d8' : '#c8e880');
      }
    }
    // windfalls under the tree (on the tiles round a pot)
    const pot = potGeom(p.place, tree.id);
    const fy = pot ? pot[3] + 2 : c[1] + c[3] + 6, fx0 = pot ? pot[0] - 6 : c[0] - c[2] * 0.6, fw = pot ? pot[2] - pot[0] + 12 : c[2] * 1.2;
    if (tree.lostKg > 1 && p.month >= 5 && p.month <= 10) for (let i = 0; i < Math.min(12, tree.lostKg / 2); i++) px(ctx, fx0 + rr(i + 3000) * fw, fy + rr(i + 4000) * 6, '#8a5a2a');
    if (tree.problems.some(q => q.id === 'wasps')) for (let w = 0; w < 5; w++) px(ctx, c[0] - 10 + ((t * 2 + w * 9) % 20), c[1] + c[3] + 4 + Math.sin(t + w) * 2, '#e0b020');
  }
};

const drawStove = (ctx: CanvasRenderingContext2D, t: number, at: number[]) => {
  // a warm glow round the stove, and a thread of smoke from the pipe
  const [x, y] = at;
  const flick = (t % 6) < 3 ? 0.2 : 0.15;
  const grd = ctx.createRadialGradient(x, y, 2, x, y, 80);
  grd.addColorStop(0, `rgba(255,170,80,${flick})`); grd.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = grd; ctx.fillRect(x - 80, y - 80, 160, 160);
  ctx.fillStyle = 'rgba(255,150,60,0.55)'; ctx.fillRect(x - 3, y + 6, 6, 2);
};

const drawHives = (ctx: CanvasRenderingContext2D, hives: NonNullable<EstateState['facilities']['hives']>['hives'], p: Props, t: number, still: boolean) => {
  const g = ESTATE_GEOM.hives;
  const flying = flyingDay(p.wx) && p.month >= 2 && p.month <= 9;
  hives!.forEach((h, i) => {
    const at = g.hives[i];
    if (!at) return;
    // A painted hive is [centre x, foot y, roof-top y, width]: the hive is in the picture, so
    // only its state is drawn — bees round its own entrance, a shadow over a dead colony.
    if (at.length >= 4) {
      const [cx, foot, top, w] = at;
      const hgt = foot - top;
      if (!h.alive) { ctx.fillStyle = 'rgba(20,16,12,0.35)'; ctx.fillRect(Math.round(cx - w / 2), Math.round(top + hgt * 0.25), Math.round(w), Math.round(hgt * 0.55)); return; }
      if (!flying || still) return;
      const ey = foot - hgt * 0.36;                           // the landing board
      const n = Math.round(8 + 14 * h.strength);
      const reach = w * 0.9;
      for (let b = 0; b < n; b++) {
        const q = t * (0.16 + (b % 5) * 0.03) + b * 1.7;
        const r2 = 4 + ((b * 7) % 10) / 10 * reach;
        const bx = cx + Math.cos(q) * r2, by = ey - 4 + Math.sin(q * 1.7) * r2 * 0.45;
        px(ctx, bx, by, (t + b) % 2 ? '#e8c030' : '#2a2014');
        if (w > 60) px(ctx, bx + 1, by, '#2a2014');
      }
      return;
    }
    // supers stacked on top for the honey they are carrying
    const supers = Math.min(3, Math.floor(h.surplus / 7));
    for (let s = 0; s < supers; s++) { ctx.fillStyle = s % 2 ? '#e8e2cc' : '#f4eedc'; ctx.fillRect(at[0] - 11, at[1] - 34 - s * 6, 22, 6); ctx.fillStyle = '#8a8272'; ctx.fillRect(at[0] - 11, at[1] - 29 - s * 6, 22, 1); }
    if (!h.alive) { ctx.fillStyle = 'rgba(20,16,12,0.35)'; ctx.fillRect(at[0] - 12, at[1] - 24, 24, 24); return; }
    if (!flying || still) return;
    const n = Math.round(6 + 10 * h.strength);
    for (let b = 0; b < n; b++) {
      const q = t * (0.18 + (b % 5) * 0.03) + b * 1.7;
      const r2 = 5 + (b * 7) % 26;
      px(ctx, at[0] + Math.cos(q) * r2, at[1] - 12 + Math.sin(q * 1.7) * r2 * 0.5, (t + b) % 2 ? '#e8c030' : '#2a2014');
    }
  });
};

/** A hen off the owner's sheet, pre-shrunk to the run's scale (about as tall as the painted
 *  waterer's body). Frames: stand, walk x3, peck, scratch, sit; the sheet faces right. */
const HEN_BREED_ORDER = ['brown', 'white', 'black', 'speckled'];
const drawHen = (ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, breed: number, frame: number) => {
  const fr = HEN_FRAMES[HEN_BREED_ORDER[breed % HEN_BREED_ORDER.length]]?.[frame];
  if (!fr) return;
  const im = img(fr.src, wake);
  if (!im.complete || !im.width) return;
  ctx.fillStyle = 'rgba(40,28,16,0.28)'; ctx.fillRect(x - 7, y - 1, 14, 2);
  ctx.save();
  if (dir < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
  ctx.drawImage(im, Math.round(x - fr.w / 2), Math.round(y - fr.h), fr.w, fr.h);
  ctx.restore();
};

const drawHens = (ctx: CanvasRenderingContext2D, run: NonNullable<EstateState['facilities']['hen_run']>['hens'], hens: { x: number; y: number; tx: number; ty: number; c: string }[], t: number, still: boolean) => {
  const g = ESTATE_GEOM.hen_run;
  const R = g.run;
  const cols = ['#8a4a22', '#e8e0d0', '#2a2420', '#a8683a', '#e8e0d0', '#6a3a1a', '#c8a060', '#3a3028'];
  while (hens.length < run!.hens) { const k = hens.length; hens.push({ x: R[0] + 20 + roll('hx', k) * (R[2] - R[0] - 40), y: R[1] + 12 + roll('hy', k) * (R[3] - R[1] - 16), tx: 0, ty: 0, c: cols[k % cols.length] }); }
  hens.length = run!.hens;
  hens.forEach((h, i) => {
    if (!still && t % 3 === 0) {
      if (!h.tx || Math.hypot(h.tx - h.x, h.ty - h.y) < 2) { h.tx = R[0] + 6 + roll('htx', i, t) * (R[2] - R[0] - 12); h.ty = R[1] + 10 + roll('hty', i, t) * (R[3] - R[1] - 12); }
      h.x += Math.sign(h.tx - h.x); h.y += Math.sign(h.ty - h.y) * 0.5;
    }
  });
  // Far hens first, so a near one stands in front of them.
  [...hens.keys()].sort((a, b) => hens[a].y - hens[b].y).forEach(i => {
    const h = hens[i];
    const x = Math.round(h.x), y = Math.round(h.y), dir = h.tx < h.x ? -1 : 1;
    // Walking while she has somewhere to be; otherwise pecking, now and then scratching, or standing.
    const moving = !still && !!h.tx && Math.hypot(h.tx - h.x, h.ty - h.y) >= 2;
    const r = roll('peck', i, Math.floor(t / 6));
    const frame = moving ? 1 + (Math.floor(t / 3) + i) % 3 : still ? 0 : r < 0.3 ? 4 : r < 0.4 ? 5 : 0;
    drawHen(ctx, x, y, dir, i, frame);
  });
};

const drawPans = (ctx: CanvasRenderingContext2D, pans: NonNullable<EstateState['facilities']['salt_pans']>['pans'], t: number) => {
  const g = ESTATE_GEOM.salt_pans;
  pans!.forEach((pan, i) => {
    const R = g.pans[i];
    if (!R) return;
    // A painted pan is a quad in perspective: brine fills its floor in a colour that follows
    // its strength (sea blue, greying as it concentrates, amber near saturation, as real pans
    // go when the salt-loving algae bloom), crust speckles it, flor glints on a still day.
    if (Array.isArray(R[0])) {
      const q = R as unknown as Quad;
      const shape = () => { ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let c = 1; c < 4; c++) ctx.lineTo(q[c][0], q[c][1]); ctx.closePath(); };
      if (pan.brineMm > 0.5) {
        const k = Math.min(1, Math.max(0, (pan.gPerL - 35) / (300 - 35)));
        const [c0, c1] = k < 0.5 ? [[0, 140, 205], [160, 176, 192]] : [[160, 176, 192], [222, 155, 74]];
        const u = k < 0.5 ? k * 2 : (k - 0.5) * 2;
        const col = c0.map((v, j) => Math.round(v + (c1[j] - v) * u));
        ctx.fillStyle = `rgba(${col.join(',')},${Math.min(0.8, 0.3 + pan.brineMm / 60)})`; shape(); ctx.fill();
        // a glint along the far edge
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(Math.round(q[0][0] + 4), Math.round(q[0][1] + 1), Math.round(q[1][0] - q[0][0] - 8), 1);
      }
      const crust = Math.min(1, pan.crustKg / 12);
      const areaPx = (q[1][0] - q[0][0] + q[2][0] - q[3][0]) / 2 * (q[3][1] - q[0][1]);
      for (let k = 0; k < Math.round(areaPx * 0.35 * crust); k++) { const [x, y] = qAt(q, roll('pc', i, k), roll('pd', i, k)); px(ctx, x, y, k % 4 ? '#f2f0ea' : '#dcd8cc'); }
      if (pan.florKg > 0.05 && (t % 10) < 5) for (let f = 0; f < Math.min(20, pan.florKg * 24); f++) { const [x, y] = qAt(q, roll('fl', i, f), roll('fm', i, f) * 0.5); px(ctx, x, y, '#ffffff'); }
      if (pan.covered) { ctx.fillStyle = 'rgba(52,62,58,0.72)'; shape(); ctx.fill(); }
      return;
    }
    const w = R[2] - R[0], h = R[3] - R[1];
    if (pan.brineMm > 0.5) { ctx.fillStyle = `rgba(110,150,170,${Math.min(0.85, 0.25 + pan.brineMm / 50)})`; ctx.fillRect(R[0], R[1], w, h); }
    const crust = Math.min(1, pan.crustKg / 12);
    for (let k = 0; k < Math.round(w * h * 0.4 * crust); k++) px(ctx, R[0] + roll('pc', i, k) * w, R[1] + roll('pd', i, k) * h, k % 4 ? '#f2f0ea' : '#dcd8cc');
    if (pan.florKg > 0.05 && (t % 10) < 5) for (let s = 0; s < Math.min(14, pan.florKg * 20); s++) px(ctx, R[0] + 6 + (s * 13) % (w - 8), R[1] + 3 + (s % 4) * 8, '#ffffff');
    if (pan.covered) { ctx.fillStyle = 'rgba(40,52,58,0.7)'; ctx.fillRect(R[0] - 2, R[1] - 3, w + 4, 4); ctx.fillStyle = 'rgba(70,86,94,0.55)'; ctx.fillRect(R[0] - 2, R[1], w + 4, h); }
  });
};

/** Measured off the painted shed: the ramps the prepupae climb out along into the lidded
 *  buckets, and the mesh cage above the bins where the adults mate. The bins and towers are
 *  painted shut, so nothing is drawn on them: how full they are lives in the panel. */
const SHED_RAMPS: [number, number, number, number][] = [[341, 190, 365, 215], [396, 190, 425, 215]];
const FLY_CAGE = [353, 78, 443, 132];

const drawShed = (ctx: CanvasRenderingContext2D, shed: NonNullable<EstateState['facilities']['worm_shed']>['shed'], p: Props, t: number) => {
  const s = shed!;
  if (s.bsfLarvaeKg < 0.05) return;
  // Prepupae crawling down the ramps while the colony is eating and it is warm enough.
  const working = s.bsfFeedKg > 0.2 && p.month >= 3 && p.month <= 9;
  if (working) {
    const n = Math.round(2 + 5 * Math.min(1, s.bsfLarvaeKg / 2));
    SHED_RAMPS.forEach(([x0, y0, x1, y1], i) => {
      for (let k = 0; k < n; k++) {
        const u = ((t * 0.004 + roll('pp', i, k)) % 1);
        const x = x0 + (x1 - x0) * u + (roll('ppx', i, k) - 0.5) * 3, y = y0 + (y1 - y0) * u;
        px(ctx, x, y, '#3a2a1c'); px(ctx, x + 1, y, '#5a4430');
      }
    });
  }
  // Adults in the cage in the warm months.
  if (p.month >= 4 && p.month <= 8) {
    const n = Math.round(4 + 8 * Math.min(1, s.bsfLarvaeKg / 2));
    for (let k = 0; k < n; k++) {
      const x = FLY_CAGE[0] + 3 + ((t * (0.6 + roll('fx', k)) + roll('fx0', k) * 90) % (FLY_CAGE[2] - FLY_CAGE[0] - 6));
      const y = FLY_CAGE[1] + 6 + roll('fy', k) * (FLY_CAGE[3] - FLY_CAGE[1] - 12) + Math.sin(t / 3 + k) * 3;
      px(ctx, x, y, '#141414');
    }
  }
};

const drawMap = (ctx: CanvasRenderingContext2D, p: Props) => {
  const places = ESTATE_GEOM.farm_map?.places ?? {};
  // Places not yet bought are drawn back, so what is yours reads first.
  for (const [id, R] of Object.entries(places) as [string, number[]][]) {
    if (p.owned[id as FacilityId]) continue;
    ctx.fillStyle = 'rgba(26,19,11,0.46)';
    ctx.fillRect(R[0] - 2, R[1] - 2, R[2] - R[0] + 4, R[3] - R[1] + 4);
  }
};

/* --- the wild --- */
/** What you have found today and not yet dealt with, drawn where you found it. */
const drawGround = (ctx: CanvasRenderingContext2D, p: Props, redraw: () => void) => {
  const v = p.estate.wild?.visit;
  if (!v || v.ground !== p.place) return;
  const big = ctx.canvas.width > 400;
  v.finds.forEach(f => {
    if (f.done) return;
    const s = CROP_SPRITES[f.species];
    if (!s) return;
    const i = img(s.small, redraw);
    if (!i.complete || !i.width) return;
    const w = big ? i.width * 1.25 : i.width, h = big ? i.height * 1.25 : i.height;
    ctx.fillStyle = 'rgba(20,14,8,0.35)'; ctx.fillRect(Math.round(f.at[0] - w * 0.4), Math.round(f.at[1] + 1), Math.round(w * 0.8), 2);
    ctx.drawImage(i, Math.round(f.at[0] - w / 2), Math.round(f.at[1] - h + 2), Math.round(w), Math.round(h));
  });
};

/** The wild map, until a painted one comes: a board of postcards cut from each ground's own plate. */
const drawWildMap = (ctx: CanvasRenderingContext2D, p: Props, redraw: () => void) => {
  // The owner's painted map, when it is there; the postcards otherwise.
  const key = plateKey('wild_map', p.month, p.wx, p.weekType);
  if (ESTATE_PLATES[key]) {
    const im = img(ESTATE_PLATES[key], redraw);
    if (im.complete && im.width) ctx.drawImage(im, 0, 0);
    return;
  }
  ctx.fillStyle = '#211a12'; ctx.fillRect(0, 0, 480, 270);
  WILD_TILES.forEach((g, i) => {
    const R = tileRect(i);
    const key = plateKey(g as ScenePlace, p.month, p.wx, p.weekType);
    const src = ESTATE_PLATES[key];
    ctx.fillStyle = '#0e0b07'; ctx.fillRect(R[0] - 1, R[1] - 1, R[2] - R[0] + 2, R[3] - R[1] + 2);
    if (!src) return;
    const im = img(src, redraw);
    if (!im.complete || !im.width) return;
    // the middle 4:3 of a 16:9 plate
    const sw = im.height * 4 / 3, sx = (im.width - sw) / 2;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, sx, 0, sw, im.height, R[0], R[1], R[2] - R[0], R[3] - R[1]);
    ctx.imageSmoothingEnabled = false;
    if (g === 'bog' && !p.estate.wild?.bogFound) { ctx.fillStyle = 'rgba(20,16,12,0.45)'; ctx.fillRect(R[0], R[1], R[2] - R[0], R[3] - R[1]); }
    if (g === 'salt_pans' && !p.owned.salt_pans) { ctx.fillStyle = 'rgba(20,16,12,0.5)'; ctx.fillRect(R[0], R[1], R[2] - R[0], R[3] - R[1]); }
    // a band for the name, printed by the overlay
    ctx.fillStyle = 'rgba(12,9,6,0.72)'; ctx.fillRect(R[0], R[3] - 15, R[2] - R[0], 15);
  });
};

/* --- the day --- */
const drawWeather = (ctx: CanvasRenderingContext2D, p: Props, t: number, still: boolean) => {
  const SCENE_W = ctx.canvas.width, SCENE_H = ctx.canvas.height;
  const indoors = p.place === 'polytunnel' || p.place === 'orangery';
  const { wx } = p;
  if (!indoors && wx.rainMm > 2 && !wx.snow) {
    ctx.fillStyle = 'rgba(30,50,60,0.12)'; ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    ctx.fillStyle = 'rgba(200,220,230,0.55)';
    const n = Math.min(260, 60 + wx.rainMm * 8);
    for (let k = 0; k < n; k++) { const x = (roll('rx', k) * SCENE_W + (still ? 0 : t * 5)) % SCENE_W, y = (roll('ry', k) * SCENE_H + (still ? 0 : t * 11)) % SCENE_H; ctx.fillRect(Math.round(x), Math.round(y), 1, 3); }
  }
  if (!indoors && (wx.snow || (p.weekType === 'Snowy' && wx.rainMm > 0))) {
    for (let k = 0; k < 90; k++) { const x = (roll('sx', k) * SCENE_W + (still ? 0 : Math.sin(t / 9 + k) * 3)) % SCENE_W, y = (roll('sy', k) * SCENE_H + (still ? 0 : t * (0.4 + (k % 4) * 0.2))) % SCENE_H; px(ctx, x, y, k % 5 ? '#f4f6f4' : '#dfe6ea'); }
  }
  if (!indoors && wx.hail) for (let k = 0; k < 60; k++) px(ctx, roll('hx', k, t) * SCENE_W, roll('hy', k, t) * SCENE_H, '#f0f4f4');
  if (!indoors && p.weekType === 'Foggy') {
    // valley fog sits low and thins by midday
    const thin = Math.max(0.15, 1 - Math.max(0, p.minute - 7 * 60) / 300);
    const grd = ctx.createLinearGradient(0, 60, 0, SCENE_H);
    grd.addColorStop(0, `rgba(210,214,212,${0.05 * thin})`); grd.addColorStop(0.5, `rgba(214,218,216,${0.42 * thin})`); grd.addColorStop(1, `rgba(214,218,216,${0.25 * thin})`);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  }
  // autumn leaves drifting in the woody places
  if (!still && !indoors && p.month >= 8 && p.month <= 10 && (p.place === 'orchard' || p.place === 'walled_garden' || p.place === 'hives')) {
    for (let k = 0; k < 12; k++) { const x = (roll('lx', k) * SCENE_W + t * 0.6 + Math.sin(t / 7 + k) * 4) % SCENE_W, y = (roll('ly', k) * SCENE_H + t * (0.3 + (k % 3) * 0.15)) % SCENE_H; ctx.fillStyle = ['#b0612c', '#c48d3c', '#9a5c26'][k % 3]; ctx.fillRect(Math.round(x), Math.round(y), 2, 1); }
  }
};

/** Daylight: night outside the sun's hours, gold at either end of the day. */
export const lightAt = (doy: number, minute: number): { dark: number; gold: number } => {
  const s = sunTimes(doy);
  const TW = 40;   // civil twilight, roughly
  if (minute < s.sunrise - TW || minute > s.sunset + TW) return { dark: 1, gold: 0 };
  if (minute < s.sunrise) return { dark: (s.sunrise - minute) / TW, gold: 0.6 };
  if (minute > s.sunset) return { dark: (minute - s.sunset) / TW, gold: 0.6 };
  const fromEdge = Math.min(minute - s.sunrise, s.sunset - minute);
  return { dark: 0, gold: fromEdge < 70 ? 1 - fromEdge / 70 : 0 };
};

const drawLight = (ctx: CanvasRenderingContext2D, p: Props) => {
  const SCENE_W = ctx.canvas.width, SCENE_H = ctx.canvas.height;
  const { dark, gold } = lightAt(p.doy, p.minute);
  if (gold > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(255,160,80,${0.45 * gold})`; ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    ctx.restore();
  }
  if (dark > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(40,52,96,${0.72 * dark})`; ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    ctx.restore();
    ctx.fillStyle = `rgba(6,8,18,${0.35 * dark})`; ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  }
};

export default EstateScene;

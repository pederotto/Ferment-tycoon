/* =============================================================================
   THE GARDEN SHOP

   Seed, feed, remedies, beneficial insects and machines. Planting draws on
   seed in the shed (bought here, or saved from your own crops) rather than
   charging money at the bed, and what is bought here is applied from a bed's
   Feed & treat menu, where it plugs into the pest system that already exists:
   an item's `key` is written into `treated` until `lasts` days on, and every
   problem it `clears` takes that key in its `stoppedBy` (wired in
   constants.farm.ts, after PROBLEMS).

   Bought feed of any kind restarts a bed's biodynamic year, as the manure
   fallback always has; NPK counts as a synthetic spray as well.
   ============================================================================= */

export type ShopKind = 'seeds' | 'feed' | 'organic' | 'bio' | 'tools';

export interface SeedSize { id: string; label: string; m2: number; off: number; field?: boolean }
/** A packet sows a bed, a tin a small place, a sack a field strip; bigger is cheaper per m². */
export const GARDEN_SEED_SIZES: SeedSize[] = [
  { id: 'packet', label: 'Packet', m2: 10, off: 1 },
  { id: 'tin', label: 'Tin', m2: 50, off: 0.9 },
  { id: 'sack', label: 'Sack', m2: 250, off: 0.78, field: true },
];

export interface ShopItem {
  id: string;
  kind: Exclude<ShopKind, 'seeds' | 'tools'>;
  /** Cell in the items sheet (gardenShopSheet.ts). */
  art: number;
  name: string;
  unit: string;
  /** m² one unit covers. The shed holds m² of cover, not units. */
  cover: number;
  price: number;
  fertility?: number;
  life?: number;
  /** Written into a planting's `treated` for `lasts` days; problems in `clears` are stopped by it. */
  key?: string;
  lasts?: number;
  clears?: string[];
  /** Months it works in (a living thing needs its season). */
  months?: number[];
  /** Works only under cover (the tunnel, the lemon house). */
  covered?: boolean;
  /** Counts as a synthetic application: the bed loses its label. */
  synthetic?: boolean;
  about: string;
}

export const GARDEN_SHOP_ITEMS: ShopItem[] = [
  { id: 'gs_manure', kind: 'feed', art: 8, name: 'Well-rotted manure', unit: 'bag', cover: 10, price: 9, fertility: 18, life: 8, about: 'A year on the heap and it no longer smells. Dug in, it feeds the soil and its life alike.' },
  { id: 'gs_chicken', kind: 'feed', art: 9, name: 'Chicken manure pellets', unit: 'tub', cover: 40, price: 14, fertility: 14, life: 2, about: 'Strong nitrogen in a handful. Scatter it thin or it scorches.' },
  { id: 'gs_bonemeal', kind: 'feed', art: 10, name: 'Bone meal', unit: 'box', cover: 40, price: 12, fertility: 8, life: 1, about: 'Slow phosphate for roots, fruit and flowers.' },
  { id: 'gs_fbb', kind: 'feed', art: 11, name: 'Fish, blood & bone', unit: 'bag', cover: 40, price: 15, fertility: 16, life: 2, about: 'The old balanced feed of the allotment: something for leaf, root and fruit.' },
  { id: 'gs_seaweed', kind: 'feed', art: 12, name: 'Seaweed meal', unit: 'bag', cover: 40, price: 18, fertility: 6, life: 10, about: 'Trace elements from the shore, and a feast for soil fungi.' },
  { id: 'gs_ash', kind: 'feed', art: 13, name: 'Wood ash', unit: 'bucket', cover: 30, price: 6, fertility: 5, key: 'potash', lasts: 28, clears: ['rust'], about: 'Potash from the bread oven. Firms the growth that rust gets into.' },
  { id: 'gs_lime', kind: 'feed', art: 14, name: 'Garden lime', unit: 'sack', cover: 50, price: 8, fertility: 2, key: 'lime', lasts: 120, clears: ['clubroot'], about: 'Sweetens a sour bed. Clubroot hates it.' },
  { id: 'gs_comfrey', kind: 'feed', art: 15, name: 'Comfrey pellets', unit: 'tub', cover: 40, price: 14, fertility: 10, life: 3, key: 'wca', lasts: 14, about: 'Bocking 14, dried and pressed. Potash and calcium for fruiting crops: no blossom-end rot.' },
  { id: 'gs_rockdust', kind: 'feed', art: 16, name: 'Rock dust', unit: 'sack', cover: 40, price: 16, fertility: 4, life: 12, about: 'Ground basalt. Slow minerals, and it wakes a tired soil.' },
  { id: 'gs_npk', kind: 'feed', art: 17, name: 'NPK granules', unit: 'bag', cover: 60, price: 12, fertility: 24, life: -6, synthetic: true, about: 'Blue granules from the factory. Fast, cheap, and hard on the soil’s life.' },
  { id: 'gs_soap', kind: 'organic', art: 18, name: 'Soft soap', unit: 'bottle', cover: 40, price: 8, key: 'soap', lasts: 10, clears: ['aphids', 'blackfly', 'whitefly', 'scale'], about: 'Potassium soap in a can of water. Smothers the soft-bodied ones.' },
  { id: 'gs_neem', kind: 'organic', art: 19, name: 'Neem oil', unit: 'bottle', cover: 40, price: 16, key: 'neem', lasts: 14, clears: ['aphids', 'whitefly', 'tuta', 'flea', 'mildew'], about: 'Pressed from the neem seed. Insects stop feeding and moult badly.' },
  { id: 'gs_copper', kind: 'organic', art: 20, name: 'Bordeaux mixture', unit: 'tin', cover: 40, price: 14, life: -3, key: 'copper', lasts: 14, clears: ['blight', 'scab', 'brown_rot', 'chocolate_spot', 'ascochyta', 'blackspot'], about: 'Copper sulphate and lime, as the vineyards have used it since 1880. Keeps blight off; the copper stays in the soil.' },
  { id: 'gs_sulphur', kind: 'organic', art: 21, name: 'Sulphur dust', unit: 'packet', cover: 40, price: 10, key: 'sulphur', lasts: 14, clears: ['mildew', 'rust', 'grain_rust', 'blackspot'], about: 'Yellow flowers of sulphur, dusted on in the morning. Mildew and rust stay back.' },
  { id: 'gs_pyrethrum', kind: 'organic', art: 22, name: 'Pyrethrum', unit: 'spray', cover: 30, price: 18, life: -2, key: 'pyrethrum', lasts: 7, clears: ['aphids', 'blackfly', 'flea', 'whites', 'pea_moth', 'borer'], about: 'From dried chrysanthemum heads. Knocks down almost anything — the ladybirds too.' },
  { id: 'gs_ferric', kind: 'organic', art: 23, name: 'Ferric phosphate pellets', unit: 'tub', cover: 60, price: 9, key: 'ferric', lasts: 21, clears: ['slugs'], about: 'The slug pellet that leaves the hedgehogs and the thrushes alone.' },
  { id: 'gs_nematodes', kind: 'bio', art: 24, name: 'Slug nematodes', unit: 'pack', cover: 40, price: 22, life: 2, key: 'nematodes', lasts: 42, months: [2, 3, 4, 5, 6, 7, 8], clears: ['slugs'], about: 'Phasmarhabditis, a million to the pack, watered in. They hunt slugs underground for six weeks. Needs the soil above five degrees.' },
  { id: 'gs_ladybirds', kind: 'bio', art: 25, name: 'Ladybird larvae', unit: 'tube', cover: 20, price: 26, key: 'ladybirds', lasts: 35, months: [3, 4, 5, 6, 7], clears: ['aphids', 'blackfly'], about: 'Adalia larvae on the leaves: each eats its way through hundreds of aphids before it pupates.' },
  { id: 'gs_lacewings', kind: 'bio', art: 26, name: 'Lacewing larvae', unit: 'card', cover: 20, price: 24, key: 'lacewings', lasts: 28, months: [3, 4, 5, 6, 7, 8], clears: ['aphids', 'whitefly', 'scale'], about: 'Chrysoperla: aphid lions. Less choosy than ladybirds.' },
  { id: 'gs_encarsia', kind: 'bio', art: 27, name: 'Encarsia wasps', unit: 'card', cover: 30, price: 20, key: 'encarsia', lasts: 42, covered: true, clears: ['whitefly'], about: 'Tiny parasitic wasps hatched from cards hung in the crop. They only work under cover, and they keep whitefly down all season.' },
  { id: 'gs_bt', kind: 'bio', art: 28, name: 'Bt caterpillar spray', unit: 'sachet', cover: 40, price: 15, key: 'bt', lasts: 10, months: [3, 4, 5, 6, 7, 8], clears: ['whites', 'tuta', 'borer', 'codling', 'plum_moth', 'pea_moth'], about: 'Bacillus thuringiensis, a soil bacterium. Kills caterpillars that eat it and nothing else.' },
];

export const GS_BY_ID: Record<string, ShopItem> = Object.fromEntries(GARDEN_SHOP_ITEMS.map(i => [i.id, i]));

export const GS_KIND: Record<ShopKind, { label: string; note: string }> = {
  seeds: { label: 'Seed', note: 'Every seed on the estate comes from here or from what you save yourself.' },
  feed: { label: 'Feed & soil', note: 'Bought feed of any kind restarts a bed’s biodynamic year. The worm shed and the soil lab make yours for nothing.' },
  organic: { label: 'Remedies', note: 'The traditional organic cabinet: soaps, oils, copper and sulphur. Each keeps a bed clean for a while and clears what is already there.' },
  bio: { label: 'Beneficials', note: 'Living things, sent by post. They work only in their season, and some only under cover — but they stay on the job for weeks.' },
  tools: { label: 'Tools & machines', note: 'Water, cultivation and machinery. Bought for one place at a time.' },
};

/** Machines drawn from the shop's own sheets rather than the farm tool sheet: [sheet, cell]. */
export const GS_TOOL_ART: Record<string, ['items' | 'ui', number]> = {
  rain_gun: ['items', 29], rotavator: ['items', 30], walking_tractor: ['items', 31],
  propagator: ['ui', 2], auto_vent: ['ui', 3],
};

/** Which seed-sheet cell stands for a crop's packet. */
export const gsSeedArt = (spec: { family: string; how: string }): number => {
  const fam = spec.family;
  if (fam === 'wintergrain' || fam === 'springgrain' || fam === 'corn') return 4;
  if (fam === 'strawberry') return 2;
  if (fam === 'allium') return 3;
  if (fam === 'rose') return 5;
  return spec.how === 'plug' ? 1 : 0;
};

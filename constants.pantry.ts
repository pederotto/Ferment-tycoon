import { Ingredient, IngredientType, Recipe, FermentType, MatrixEntry, MatrixSubstrate, Batch } from './types';
import type { TastingNote } from './services/gameLogic';
import { FORAGE_SUPPLIER } from './constants.forage';
import { mk, TOMATO_IDS } from './constants.heritage';
import { fruit } from './constants.market';
import { tr as tx } from './i18n/runtime';

/* =============================================================================
   THE PANTRY PACK — twenty-three recipes, a shelf of heirlooms to make them
   from, and tasting notes that change with age

   Added from the heirloom and ancient recipe list. It arrived as a patch on the
   built page and was carried into the source from there; nothing in it is
   generated, so read this file rather than the bundle.

   Three things live here, and the order the game reads them in matters:

   1. INGREDIENTS. Every heirloom swap-in is its own ingredient with its own
      stats. Grains, corn, beans and tomatoes went into constants.heritage.ts
      beside their families (the family lists there are what put them in the
      matrix); everything else — cabbages, squash, wild alliums, plums, apples,
      mustards, roots, berries, garlics, honeys, persimmons, nuts, pods, flowers,
      gingers, oats, milks and cultures — is here. Picked things carry a season,
      and who picks them decides the supplier, as everywhere else.

   2. RECIPES AND THEIR MATRIX ENTRIES. Two tables, because the entries fall on
      either side of the older ones (see PANTRY_MATRIX and PANTRY_MATRIX_LATE).

   3. STAGED TASTING NOTES. `PANTRY_STAGES` holds a look, a smell, a taste and a
      feel for a fresh, a ripe and an aged jar, and `applyPantryStages` writes
      them over the generic notes. Recipes with one profile use it throughout.
   ============================================================================= */

const NORDIC = 'nordic';           // Nordic Staples Co. — grains, honey, sugar, milk
const PRIME = 'prime';             // Prime Sourcing — produce, orchard fruit, cultured goods
const SILK = 'asia_import';        // Silk Road Imports — Asian greens, chillies, ginger
const BIOLAB = 'biolab';           // BioLab Cultures — the milk cultures

/* -----------------------------------------------------------------------------
   FAMILIES

   Explicit id lists, never tokens: `hasId` is a substring test, and a token that
   is a fragment of other ids leaks (`pine` matched pineapple). Where a family
   reaches back to an older ingredient — 'apples', 'garlic_bulbs', 'hazelnuts',
   'rose_petals', 'raw_milk', 'heavy_cream' — it is named here by its old id.
   --------------------------------------------------------------------------- */

const PANTRY_G = {
  cabbage: ['michihili', 'wong_bok', 'january_king', 'cavolo_nero'],
  squash: [
    'aehobak', 'kabocha', 'red_kuri', 'rouge_vif_detampes', 'musquee_de_provence', 'blue_hubbard', 'seminole_pumpkin',
    'long_island_cheese',
  ],
  alliums: ['wild_garlic', 'ramps', 'three_cornered_leek', 'garlic_mustard', 'chinese_garlic_chives'],
  sweetpep: ['jimmy_nardello', 'corno_di_toro', 'padron'],
  plums: ['nanko_ume', 'damson', 'greengage', 'mirabelle', 'sloe', 'victoria_plum', 'prune_plum', 'cherry_plum'],
  apples: [
    'apples', 'cox_orange_pippin', 'egremont_russet', 'roxbury_russet', 'esopus_spitzenburg', 'bramley',
    'bardsey_apple', 'sieversii_apple', 'crab_apples', 'kingston_black', 'dabinett', 'yarlington_mill', 'foxwhelp',
    'harrison_apple', 'hewes_crab',
  ],
  mustards: ['wasabina', 'red_giant_mustard', 'osaka_purple_mustard', 'green_wave_mustard', 'takana'],
  carrots: ['purple_black_carrot', 'afghan_purple_carrot', 'cosmic_purple_carrot', 'orange_carrots'],
  currants: [
    'blackcurrants', 'redcurrants', 'whitecurrants', 'jostaberry', 'aronia', 'elderberries', 'gooseberry_whinhams',
  ],
  garlics: [
    'garlic_bulbs', 'rocambole_garlic', 'chesnok_red', 'georgian_crystal', 'music_garlic', 'creole_garlic',
    'elephant_garlic',
  ],
  black_garlics: ['rocambole_garlic', 'chesnok_red', 'georgian_crystal', 'music_garlic', 'creole_garlic'],
  persimmons: [
    'hachiya_persimmon', 'fuyu_persimmon', 'cheongdo_bansi', 'american_persimmon', 'chocolate_persimmon',
    'sangju_persimmon',
  ],
  cheong_fruit: [
    'hachiya_persimmon', 'fuyu_persimmon', 'cheongdo_bansi', 'american_persimmon', 'chocolate_persimmon',
    'dog_rose_hips', 'rugosa_hips', 'apple_rose_hips', 'blackcurrants',
  ],
  nuts: [
    'hazelnuts', 'tonda_gentile', 'tonda_giffoni', 'kentish_cob', 'cosford_cob', 'walnuts', 'chestnuts', 'almonds',
    'pecans',
  ],
  pods: ['chilhuacle_negro', 'ancho_pods', 'pasilla_pods', 'scotch_bonnet', 'aji_amarillo'],
  flowers: ['meadowsweet', 'elderflower', 'linden_blossom', 'sweet_woodruff', 'chamomile', 'rose_petals'],
  gingers: ['ginger_root', 'blue_ring_ginger', 'turmeric_root', 'galangal_root'],
  soda: ['elderberries', 'rhubarb_victoria', 'sumac_berries'],
  verbenas: ['lemon_verbena', 'lemon_balm', 'lemongrass', 'lemon_myrtle'],
  oats: ['oats', 'bristle_oat', 'naked_oats', 'black_tartarian_oat'],
  milks: [
    'raw_milk', 'jersey_milk', 'guernsey_milk', 'welsh_black_milk', 'dexter_milk', 'brown_swiss_milk', 'buffalo_milk',
    'goat_milk', 'sheep_milk',
  ],
  creams: [
    'heavy_cream', 'jersey_milk', 'guernsey_milk', 'welsh_black_milk', 'dexter_milk', 'brown_swiss_milk',
    'buffalo_milk', 'goat_milk', 'sheep_milk',
  ],
} satisfies Record<string, string[]>;

/** The heritage apples: every apple in the family but the first, which is the old supermarket one. */
const HERITAGE_APPLES = PANTRY_G.apples.slice(1);

const pOneOf = (ids: string[], label: string): MatrixSubstrate => ({ kind: 'oneOf', ids, label });

/* -----------------------------------------------------------------------------
   INGREDIENTS
   --------------------------------------------------------------------------- */

export const PANTRY_INGREDIENTS: Ingredient[] = [
  // --- Cabbages for kimchi and kraut ---

  mk('michihili', 'Michihili Cabbage', SILK, 8, 76,
    { sugarContent: 3, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'The tall Chinese napa. Crunchier than a wong bok, and holds its crispness for longer in the crock.',
    ['kimchi'], { tags: ['PRODUCE'] }),

  mk('wong_bok', 'Wong Bok', SILK, 8, 74,
    { sugarContent: 4, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'The squat, round napa. Sweet, juicy and tender, and it goes soft sooner than the tall kind.',
    ['kimchi'], { tags: ['PRODUCE'] }),

  mk('january_king', 'January King Cabbage', PRIME, 10, 78,
    { sugarContent: 3, starchContent: 1, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'An English heirloom savoy from the 1860s, purple-flushed and frost-hardy. Blue-green crinkled leaves with a denser chew than napa.',
    ['kimchi', 'sauerkraut'], { tags: ['PRODUCE'], season: [9, 10, 11, 0, 1] }),   // Oct-Feb

  mk('cavolo_nero', 'Cavolo Nero', PRIME, 11, 78,
    { sugarContent: 3, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 2, innateAcidity: 1 },
    'Tuscan kale, the black cabbage. Turns almost black-green in the jar and a little bitter, which a chilli paste is happy to cover.',
    ['kimchi'], { tags: ['PRODUCE'], season: [9, 10, 11, 0, 1] }),   // Oct-Feb

  // --- Radishes (an additive: they go in with the cabbage) ---

  mk('mu_radish', 'Korean Mu Radish', SILK, 6, 72,
    { sugarContent: 3, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'The dense, waxy, pale-green Korean radish. Cubed into kkakdugi or matchsticked into the paste, and it stays crisp.',
    ['kimchi'], { tags: ['PRODUCE'], type: IngredientType.ADDITIVE, mass: 500, unitDisplay: 'g' }),

  mk('beauty_heart_radish', 'Watermelon Radish', PRIME, 9, 78,
    { sugarContent: 4, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'Chinese heirloom, beauty heart, plain green outside and hot pink at the centre. The pink bleeds into the brine.',
    ['kimchi'], { tags: ['PRODUCE'], season: [9, 10, 11, 0], type: IngredientType.ADDITIVE, mass: 500, unitDisplay: 'g' }),   // Oct-Jan

  mk('black_spanish_radish', 'Black Spanish Radish', PRIME, 8, 76,
    { sugarContent: 3, starchContent: 1, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'Black-skinned, white-fleshed, and hot as horseradish. Black-rimmed batons in the jar and a sinus-clearing bite.',
    ['kimchi'], { tags: ['PRODUCE'], season: [9, 10, 11, 0], type: IngredientType.ADDITIVE, mass: 500, unitDisplay: 'g' }),   // Oct-Jan

  // --- Jeotgal, the fish that feeds a kimchi ---

  mk('saeujeot', 'Saeujeot', SILK, 14, 76,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 4, microbialDiversity: 3, fatContent: 0, proteinContent: 5, innateUmami: 6 },
    'Salted fermented shrimp, the traditional kimchi seasoning. Adds sweetness and body where fish sauce adds only salt.',
    ['kimchi'], { type: IngredientType.ADDITIVE, mass: 250, unitDisplay: 'g' }),

  mk('aekjeot', 'Anchovy Aekjeot', SILK, 12, 74,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 5, microbialDiversity: 3, fatContent: 0, proteinContent: 5, innateUmami: 7 },
    'Korean fermented anchovy sauce. Sharper and saltier than shrimp, and it deepens the funk.',
    ['kimchi'], { type: IngredientType.ADDITIVE, mass: 250, unitDisplay: 'g' }),

  // --- Chillies for the paste ---

  mk('gochugaru_yeongyang_chili', 'Yeongyang Gochugaru', SILK, 18, 88,
    { sugarContent: 3, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 1 },
    "Sun-dried gochugaru from Yeongyang, where Korea's best chilli grows. Bright red, sweet-hot and slightly smoky: the classic.",
    ['kimchi', 'gochujang'], { tierRequired: 2, type: IngredientType.ADDITIVE, mass: 250, unitDisplay: 'g' }),

  mk('kashmiri_chili', 'Kashmiri Chilli', SILK, 14, 80,
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 1 },
    'Vivid red and mild. Colours the paste without setting it on fire.',
    ['kimchi'], { type: IngredientType.ADDITIVE, mass: 250, unitDisplay: 'g' }),

  mk('urfa_chili', 'Urfa Biber', SILK, 16, 84,
    { sugarContent: 4, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 1 },
    'A Turkish chilli sun-dried by day and sweated at night, so it goes dark maroon. Raisin, smoke and a slow heat.',
    ['kimchi'], { tierRequired: 2, type: IngredientType.ADDITIVE, mass: 250, unitDisplay: 'g' }),

  mk('aleppo_chili', 'Aleppo Chilli', SILK, 15, 82,
    { sugarContent: 3, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'Syrian, oily and tart, with a cumin-and-sun-dried-tomato edge. Medium heat that arrives late.',
    ['kimchi'], { tierRequired: 2, type: IngredientType.ADDITIVE, mass: 250, unitDisplay: 'g' }),

  mk('espelette_pepper', "Piment d'Espelette", PRIME, 22, 88,
    { sugarContent: 4, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 1 },
    'The Basque chilli, hung on house fronts to dry. Sweet, fruity and gentle, and it makes a fruity paste.',
    ['kimchi'], { tierRequired: 2, type: IngredientType.ADDITIVE, mass: 250, unitDisplay: 'g' }),

  mk('chiltepin_chili', 'Chiltepin', SILK, 26, 84,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1 },
    'The wild ancestor of the cultivated chilli, a bird-pepper the size of a pea. Sharp, fast and very hot.',
    ['kimchi'], { tierRequired: 2, type: IngredientType.ADDITIVE, mass: 100, unitDisplay: 'g' }),

  // --- Squash ---

  mk('aehobak', 'Aehobak', PRIME, 9, 74,
    { sugarContent: 4, starchContent: 3, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Korean summer squash, pale green and delicate. Cooks through in the jar and stays tender.',
    ['hobak_kimchi'], { tags: ['PRODUCE'], season: [5, 6, 7, 8] }),   // Jun-Sep

  mk('kabocha', 'Kabocha', PRIME, 10, 78,
    { sugarContent: 5, starchContent: 4, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'The Japanese pumpkin, sweet and floury. The reference squash for hobak kimchi.',
    ['hobak_kimchi'], { tags: ['PRODUCE'], season: [8, 9, 10, 11] }),   // Sep-Dec

  mk('red_kuri', 'Red Kuri', PRIME, 11, 78,
    { sugarContent: 5, starchContent: 4, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Hokkaido squash. Deep orange, a chestnut flavour and a dense texture.',
    ['hobak_kimchi'], { tags: ['PRODUCE'], season: [8, 9, 10, 11] }),   // Sep-Dec

  mk('rouge_vif_detampes', "Rouge Vif d'Etampes", PRIME, 13, 80,
    { sugarContent: 4, starchContent: 3, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'The Cinderella pumpkin, an old French market squash. Soft, moist and a little stringy, but a beautiful colour.',
    ['hobak_kimchi'], { tierRequired: 2, tags: ['PRODUCE'], season: [8, 9, 10, 11] }),   // Sep-Dec

  mk('musquee_de_provence', 'Musquee de Provence', PRIME, 13, 80,
    { sugarContent: 6, starchContent: 3, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'A ribbed, tan-orange pumpkin of southern France. Caramel-sweet, and it ferments to an amber colour.',
    ['hobak_kimchi'], { tierRequired: 2, tags: ['PRODUCE'], season: [8, 9, 10, 11] }),   // Sep-Dec

  mk('blue_hubbard', 'Blue Hubbard', PRIME, 12, 78,
    { sugarContent: 3, starchContent: 5, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'A huge grey-blue squash with a hard shell. Dry, nutty flesh, and a grey-blue edge to the rind.',
    ['hobak_kimchi'], { tierRequired: 2, tags: ['PRODUCE'], season: [8, 9, 10, 11] }),   // Sep-Dec

  mk('seminole_pumpkin', 'Seminole Pumpkin', PRIME, 14, 82,
    { sugarContent: 4, starchContent: 4, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Grown by the Seminole for centuries, and still grown wild in the Florida hammocks. Firm, and it holds its shape.',
    ['hobak_kimchi'], { tierRequired: 2, tags: ['PRODUCE'], season: [8, 9, 10, 11] }),   // Sep-Dec

  mk('long_island_cheese', 'Long Island Cheese Pumpkin', PRIME, 12, 78,
    { sugarContent: 5, starchContent: 3, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'An 1807 pumpkin named for its wheel-of-cheese shape. Tan, sweet and dense.',
    ['hobak_kimchi'], { tierRequired: 2, tags: ['PRODUCE'], season: [8, 9, 10, 11] }),   // Sep-Dec

  // --- Wild alliums ---

  mk('wild_garlic', 'Wild Garlic (Ramsons)', FORAGE_SUPPLIER.id, 8, 76,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 2, innateAcidity: 2 },
    'Ramsons, off the woodland floor in April. Bright green, sharp garlic in the leaf and a smell you can find from the road.',
    ['wild_garlic_ferment'], { tags: ['PRODUCE'], season: [2, 3, 4], mass: 250, unitDisplay: 'g' }),   // Mar-May

  mk('ramps', 'Ramps', FORAGE_SUPPLIER.id, 16, 82,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 7, fatContent: 0, proteinContent: 2, innateAcidity: 2 },
    'Allium tricoccum, the North American wild leek. Red-purple stems and a stronger, funkier smell than ramsons.',
    ['wild_garlic_ferment'], { tierRequired: 2, tags: ['PRODUCE'], season: [3, 4], mass: 250, unitDisplay: 'g' }),   // Apr-May

  mk('three_cornered_leek', 'Three-cornered Leek', FORAGE_SUPPLIER.id, 6, 70,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 2, innateAcidity: 2 },
    'A pale, weedy relative that has taken over half the hedgerows. Milder and more onion-like than ramsons.',
    ['wild_garlic_ferment'], { tags: ['PRODUCE'], season: [1, 2, 3, 4], mass: 250, unitDisplay: 'g' }),   // Feb-May

  mk('garlic_mustard', 'Garlic Mustard', FORAGE_SUPPLIER.id, 5, 68,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 2, innateAcidity: 3 },
    'Jack-by-the-hedge. Garlic on the nose and a bitter mustard edge on the tongue.',
    ['wild_garlic_ferment'], { tags: ['PRODUCE'], season: [2, 3, 4, 5], mass: 250, unitDisplay: 'g' }),   // Mar-Jun

  mk('chinese_garlic_chives', 'Chinese Garlic Chives', SILK, 7, 72,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 2, innateAcidity: 2 },
    'Flat-leaved chives from the Silk Road. Milder than wild garlic, and stay firm in the brine.',
    ['wild_garlic_ferment'], { tags: ['PRODUCE'], mass: 250, unitDisplay: 'g' }),

  mk('wild_garlic_buds', 'Wild Garlic Buds', FORAGE_SUPPLIER.id, 9, 78,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1 },
    'Flower buds and green seed pods, picked before they open. In brine they turn into caper-like pops of garlic.',
    ['wild_garlic_ferment'], { type: IngredientType.ADDITIVE, season: [3, 4, 5], mass: 100, unitDisplay: 'g' }),   // Apr-Jun

  // --- Sweet peppers ---

  mk('jimmy_nardello', 'Jimmy Nardello', PRIME, 9, 78,
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'An Italian frying pepper carried to Connecticut in 1887. Long, red and sweet, with almost no heat.',
    ['quick_relish'], { tags: ['PRODUCE'], season: [7, 8, 9] }),   // Aug-Oct

  mk('corno_di_toro', 'Corno di Toro', PRIME, 9, 76,
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    "The bull's horn. A big sweet pepper, red or yellow, with thick flesh that stays glossy in a relish.",
    ['quick_relish'], { tags: ['PRODUCE'], season: [7, 8, 9] }),   // Aug-Oct

  mk('padron', 'Padron', PRIME, 8, 74,
    { sugarContent: 3, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'Small green Galician peppers. Mostly mild, with the occasional hot surprise.',
    ['quick_relish'], { tags: ['PRODUCE'], season: [6, 7, 8, 9] }),   // Jul-Oct

  // --- Fresh herbs (the HERB tag is what the relish asks for) and zests ---

  mk('genovese_basil', 'Genovese Basil', PRIME, 6, 74,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1 },
    'The pesto basil. Sweet, clove-scented and quick to bruise.',
    ['quick_relish'], { tags: ['HERB'], type: IngredientType.ADDITIVE, mass: 100, unitDisplay: 'g' }),

  mk('greek_basil', 'Greek Bush Basil', PRIME, 6, 72,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1 },
    'Tiny-leaved and compact. A clean, peppery basil that holds up in a jar.',
    ['quick_relish'], { tags: ['HERB'], type: IngredientType.ADDITIVE, mass: 100, unitDisplay: 'g' }),

  mk('thai_basil', 'Thai Basil', SILK, 7, 76,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1 },
    'Purple-stemmed, with aniseed in the leaf.',
    ['quick_relish'], { tags: ['HERB'], type: IngredientType.ADDITIVE, mass: 100, unitDisplay: 'g' }),

  mk('coriander_leaf', 'Coriander', PRIME, 5, 72,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1 },
    'Soapy to some, and green and bright to everyone else.',
    ['quick_relish'], { tags: ['HERB'], type: IngredientType.ADDITIVE, mass: 100, unitDisplay: 'g' }),

  mk('lovage', 'Lovage', PRIME, 8, 76,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 1, microbialDiversity: 5, fatContent: 0, proteinContent: 1 },
    'An old cottage-garden herb. Tastes of celery, but far more of it.',
    ['quick_relish'], { tags: ['HERB'], type: IngredientType.ADDITIVE, mass: 100, unitDisplay: 'g' }),

  mk('bergamot_zest', 'Bergamot Zest', PRIME, 14, 80,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 3, fatContent: 0, proteinContent: 1, innateAcidity: 3 },
    'Floral, Earl Grey and bright. A little goes a long way.',
    ['quick_relish'], { tierRequired: 2, type: IngredientType.ADDITIVE, mass: 50, unitDisplay: 'g' }),

  mk('meyer_lemon_zest', 'Meyer Lemon Zest', PRIME, 8, 76,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 3, fatContent: 0, proteinContent: 1, innateAcidity: 3 },
    'Sweeter and less sharp than a lemon, with a floral note.',
    ['quick_relish'], { type: IngredientType.ADDITIVE, mass: 50, unitDisplay: 'g' }),

  // --- Plums ---

  fruit('nanko_ume', 'Ume (Nanko)', PRIME, 24, 88, [4, 5],                        // May-Jun
    { sugarContent: 3, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 9 },
    'The Wakayama ume, the classic plum for umeboshi. Very sour and apricot-like, and the reason a sour plum has that name.',
    ['lacto_plums', 'black_apple'], 2),

  fruit('damson', 'Damson', FORAGE_SUPPLIER.id, 12, 78, [7, 8, 9],                // Aug-Oct
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 6 },
    'The hedgerow plum of northern England. Tannic and spicy, and it turns the brine inky purple.',
    ['lacto_plums']),

  fruit('greengage', 'Greengage (Reine Claude)', PRIME, 14, 80, [7, 8],           // Aug-Sep
    { sugarContent: 8, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 4 },
    'The Reine Claude, honey-green and very sweet. Ripe, it is as good as fruit gets.',
    ['lacto_plums'], 2),

  fruit('mirabelle', 'Mirabelle', PRIME, 15, 80, [7, 8],                          // Aug-Sep
    { sugarContent: 7, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 4 },
    'Small and golden, from Lorraine. Floral, and it holds its colour in a brine.',
    ['lacto_plums'], 2),

  fruit('sloe', 'Sloe', FORAGE_SUPPLIER.id, 10, 72, [8, 9, 10],                   // Sep-Nov
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 8 },
    'Blackthorn berries, blue-black and painfully astringent until the frost gets at them.',
    ['lacto_plums']),

  fruit('victoria_plum', 'Victoria Plum', PRIME, 9, 74, [7, 8, 9],                // Aug-Oct
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 4 },
    'The garden plum of every English orchard. Sweet, reliable and pink-flushed.',
    ['lacto_plums']),

  fruit('prune_plum', 'Italian Prune Plum', PRIME, 10, 76, [8, 9],                // Sep-Oct
    { sugarContent: 8, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 4 },
    'Blue-purple and freestone, dense and sugary. It goes jammy fast.',
    ['lacto_plums']),

  fruit('cherry_plum', 'Cherry Plum', FORAGE_SUPPLIER.id, 8, 70, [6, 7, 8],       // Jul-Sep
    { sugarContent: 4, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 6 },
    'The myrobalan, first plum of the year and often a wild one. Tart, small and yellow or red.',
    ['lacto_plums']),

  // --- Apples, eating and cider ---

  fruit('cox_orange_pippin', "Cox's Orange Pippin", PRIME, 9, 80, [9, 10],        // Oct-Nov
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 5 },
    'The English dessert apple. Aromatic, balanced and honeyed.',
    ['lacto_apples', 'seidr', 'cider_vinegar']),

  fruit('egremont_russet', 'Egremont Russet', PRIME, 9, 78, [9, 10],              // Oct-Nov
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 3 },
    'Golden-brown skin, a nutty, pear-like flesh.',
    ['lacto_apples', 'seidr']),

  fruit('roxbury_russet', 'Roxbury Russet', PRIME, 11, 80, [9, 10],               // Oct-Nov
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 4 },
    'The oldest American apple variety, from Massachusetts in the 1600s. A russeted, nutty, cider apple.',
    ['lacto_apples', 'seidr'], 2),

  fruit('esopus_spitzenburg', 'Esopus Spitzenburg', PRIME, 14, 84, [9, 10],       // Oct-Nov
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 6 },
    "Thomas Jefferson's favourite. Spicy, sharp and rich, and hard to find.",
    ['lacto_apples', 'seidr'], 2),

  fruit('bramley', 'Bramley', PRIME, 8, 76, [9, 10, 11],                          // Oct-Dec
    { sugarContent: 3, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 8 },
    'The English cooking apple, very sharp. Breaks down to mush in a jar.',
    ['lacto_apples', 'black_apple', 'cider_vinegar']),

  fruit('bardsey_apple', 'Bardsey Apple', PRIME, 24, 88, [9, 10],                 // Oct-Nov
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 7 },
    'Found in 1998 on the Welsh island of Bardsey, the sole survivor of an old orchard. Lemony, and no one is sure where it came from.',
    ['lacto_apples', 'seidr'], 2),

  fruit('sieversii_apple', 'Malus sieversii', FORAGE_SUPPLIER.id, 30, 90, [9, 10], // Oct-Nov
    { sugarContent: 4, starchContent: 0, nativeSalinity: 0, microbialDiversity: 7, fatContent: 0, proteinContent: 0, innateAcidity: 7 },
    'The wild apple of the Kazakh mountains, and the ancestor of every apple you have eaten. Sour, tannic and enormously varied.',
    ['lacto_apples', 'seidr'], 3),

  fruit('crab_apples', 'Crab Apples', FORAGE_SUPPLIER.id, 6, 68, [8, 9, 10],      // Sep-Nov
    { sugarContent: 3, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 9 },
    'Small, hard and hedgerow-sour. Pink flesh and an intense tartness.',
    ['lacto_apples', 'black_apple', 'seidr']),

  fruit('kingston_black', 'Kingston Black', PRIME, 14, 86, [9, 10],               // Oct-Nov
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 6, tannin: 5 },
    'The classic bittersharp, the one apple that makes a balanced cider by itself.',
    ['seidr', 'black_apple', 'cider_vinegar'], 2),

  fruit('dabinett', 'Dabinett', PRIME, 12, 82, [9, 10],                           // Oct-Nov
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 3, tannin: 6 },
    'A bittersweet from Somerset. Rich, full and tannic.',
    ['seidr', 'black_apple', 'cider_vinegar'], 2),

  fruit('yarlington_mill', 'Yarlington Mill', PRIME, 12, 80, [9, 10],             // Oct-Nov
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 3, tannin: 5 },
    'A bittersweet found growing on a mill wall. Mild, sweet and mellow.',
    ['seidr', 'black_apple', 'cider_vinegar'], 2),

  fruit('foxwhelp', 'Foxwhelp', PRIME, 16, 84, [9, 10],                           // Oct-Nov
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 8, tannin: 4 },
    'One of the oldest cider apples in England, sharp and hard to grow. Makes long-lived, complex cider.',
    ['seidr', 'cider_vinegar'], 2),

  fruit('harrison_apple', 'Harrison Apple', PRIME, 18, 86, [9, 10],               // Oct-Nov
    { sugarContent: 8, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 4, tannin: 4 },
    'The cider apple of New Jersey, nearly lost and found in a single tree. Syrupy and intense.',
    ['seidr'], 2),

  fruit('hewes_crab', "Hewe's Crab", PRIME, 14, 82, [9, 10],                      // Oct-Nov
    { sugarContent: 7, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0, innateAcidity: 7, tannin: 4 },
    'A Virginia crab apple, small and sharp, pressed for cider since the 1700s. Syrupy and intense.',
    ['seidr'], 2),

  // --- Mustard greens ---

  mk('wasabina', 'Wasabina', SILK, 9, 78,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 2, innateAcidity: 1 },
    'Japanese mustard leaves with a wasabi bite. Deep olive once fermented, limp and sinus-clearing.',
    ['wasabina_greens'], { tags: ['PRODUCE'], season: [9, 10, 11, 0, 1, 2] }),   // Oct-Mar

  mk('red_giant_mustard', 'Red Giant Mustard', SILK, 8, 76,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 7, fatContent: 0, proteinContent: 2, innateAcidity: 1 },
    'A huge purple-flushed leaf, the hottest of the mustards.',
    ['wasabina_greens'], { tags: ['PRODUCE'], season: [9, 10, 11, 0, 1] }),   // Oct-Feb

  mk('osaka_purple_mustard', 'Osaka Purple', SILK, 8, 76,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 2, innateAcidity: 1 },
    'Purple-veined and frilled. The purple bleeds into a magenta-brown brine.',
    ['wasabina_greens'], { tags: ['PRODUCE'], season: [9, 10, 11, 0, 1] }),   // Oct-Feb

  mk('green_wave_mustard', 'Green Wave', PRIME, 7, 72,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 2, innateAcidity: 1 },
    'A frilly, mild green mustard. The easy one.',
    ['wasabina_greens'], { tags: ['PRODUCE'], season: [9, 10, 11, 0, 1, 2] }),   // Oct-Mar

  mk('takana', 'Takana', SILK, 9, 78,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 3, innateAcidity: 1 },
    'The Japanese leaf mustard for takana-zuke. Big pale leaves, pungent and chewy once soured.',
    ['wasabina_greens'], { tags: ['PRODUCE'], season: [9, 10, 11, 0, 1] }),   // Oct-Feb

  // --- Carrots and beet ---

  mk('purple_black_carrot', 'Pusa Asita Black Carrot', PRIME, 9, 80,
    { sugarContent: 5, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'The black carrot of Punjab, close to the first carrots ever eaten. Ink-violet colour, and it stains the whole jar.',
    ['kanji'], { tierRequired: 2, tags: ['PRODUCE'], season: [9, 10, 11, 0, 1] }),   // Oct-Feb

  mk('afghan_purple_carrot', 'Afghan Purple Carrot', PRIME, 9, 78,
    { sugarContent: 4, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Purple outside, orange at the core. The kind the orange carrot descends from.',
    ['kanji'], { tierRequired: 2, tags: ['PRODUCE'], season: [9, 10, 11, 0, 1] }),   // Oct-Feb

  mk('cosmic_purple_carrot', 'Cosmic Purple', PRIME, 8, 76,
    { sugarContent: 5, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'A modern purple-and-orange carrot. Sweet, and colours the water without going black.',
    ['kanji'], { tags: ['PRODUCE'], season: [8, 9, 10, 11, 0] }),   // Sep-Jan

  mk('orange_carrots', 'Orange Carrots', PRIME, 5, 68,
    { sugarContent: 5, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'The supermarket carrot. Sweeter, and it makes a pink-orange drink rather than a violet one.',
    ['kanji'], { tags: ['PRODUCE'] }),

  mk('chioggia_beet', 'Chioggia Beet', PRIME, 8, 76,
    { sugarContent: 5, starchContent: 1, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'The candy-stripe beet from Chioggia. Pink and white rings inside, and less earthy than red.',
    ['kanji'], { tags: ['PRODUCE'], season: [7, 8, 9, 10, 11] }),   // Aug-Dec

  // --- Mustard seed ---

  mk('brown_mustard_seed', 'Brown Mustard Seed', NORDIC, 6, 72,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 2 },
    'Crushed, it gives the warm sinus-clearing bite kanji is known for.',
    ['kanji'], { type: IngredientType.ADDITIVE, mass: 100, unitDisplay: 'g' }),

  mk('black_mustard_seed', 'Black Mustard Seed', SILK, 7, 74,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 2 },
    'Hotter and more pungent than brown.',
    ['kanji'], { type: IngredientType.ADDITIVE, mass: 100, unitDisplay: 'g' }),

  // --- Currants and dark berries ---

  fruit('blackcurrants', 'Blackcurrants (Baldwin)', PRIME, 18, 84, [6, 7],        // Jul-Aug
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 7, tannin: 3 },
    'Baldwin, the old English blackcurrant. Dark, tart and musky, and it goes near-black in the salt.',
    ['black_boshi', 'fruit_cheong'], 2),

  fruit('redcurrants', 'Redcurrants', PRIME, 14, 78, [6, 7],                      // Jul-Aug
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 6 },
    'Bright, sharp and translucent. Goes ruby in the salt.',
    ['black_boshi', 'fruit_cheong']),

  fruit('whitecurrants', 'Whitecurrants', PRIME, 15, 78, [6, 7],                  // Jul-Aug
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 5 },
    'The albino redcurrant, mild and sweet. Stays pale gold.',
    ['black_boshi', 'fruit_cheong']),

  fruit('jostaberry', 'Jostaberry', PRIME, 16, 78, [6, 7],                        // Jul-Aug
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 5 },
    'A blackcurrant and gooseberry cross with no thorns. Mild and musky.',
    ['black_boshi']),

  fruit('aronia', 'Aronia', PRIME, 14, 76, [8, 9],                                // Sep-Oct
    { sugarContent: 4, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 5, tannin: 8 },
    'The chokeberry. Almost unbearably astringent until it has had a long time.',
    ['black_boshi', 'fruit_cheong']),

  fruit('elderberries', 'Elderberries', FORAGE_SUPPLIER.id, 8, 72, [7, 8, 9],     // Aug-Oct
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 4, tannin: 3 },
    'Small, black and hedgerow-common. Raw they are sour, cooked or fermented they are deep and winey.',
    ['black_boshi', 'wild_soda']),

  fruit('gooseberry_whinhams', "Gooseberry (Whinham's Industry)", PRIME, 12, 78, [6, 7], // Jul-Aug
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 6 },
    'An 1830s Northumbrian gooseberry, red-purple and sweet. Hairy, and goes translucent in the salt.',
    ['black_boshi'], 2),

  // --- Red shiso ---

  mk('red_shiso', 'Red Shiso', SILK, 9, 78,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 3 },
    'The purple perilla leaf that dyes umeboshi. Turns fruit vivid crimson-magenta.',
    ['black_boshi', 'lacto_plums'], { type: IngredientType.ADDITIVE, season: [5, 6, 7, 8], mass: 100, unitDisplay: 'g' }),   // Jun-Sep

  // --- Garlic ---

  mk('rocambole_garlic', 'Rocambole Garlic', PRIME, 10, 80,
    { sugarContent: 2, starchContent: 2, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 3 },
    'A hardneck with a rich, fiery flavour and easy-peel cloves. Wraps its bulbs in a loose brown skin.',
    ['honey_garlic', 'black_garlic'], { tierRequired: 2, tags: ['PRODUCE'], season: [6, 7, 8, 9, 10, 11, 0] }),   // Jul-Jan

  mk('chesnok_red', 'Chesnok Red', PRIME, 11, 82,
    { sugarContent: 2, starchContent: 2, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 3 },
    'A Georgian purple-stripe, streaked purple and rich. Roasts sweet and keeps well.',
    ['honey_garlic', 'black_garlic'], { tierRequired: 2, tags: ['PRODUCE'], season: [6, 7, 8, 9, 10, 11, 0] }),   // Jul-Jan

  mk('georgian_crystal', 'Georgian Crystal', PRIME, 12, 82,
    { sugarContent: 2, starchContent: 2, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 3 },
    'A porcelain garlic from Georgia. Big, clean and hot, with a long finish.',
    ['honey_garlic', 'black_garlic'], { tierRequired: 2, tags: ['PRODUCE'], season: [6, 7, 8, 9, 10, 11, 0] }),   // Jul-Jan

  mk('music_garlic', 'Music Garlic', PRIME, 10, 80,
    { sugarContent: 2, starchContent: 2, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 3 },
    'A hardy porcelain with huge cloves. Hot and lingering.',
    ['honey_garlic', 'black_garlic'], { tierRequired: 2, tags: ['PRODUCE'], season: [6, 7, 8, 9, 10, 11, 0] }),   // Jul-Jan

  mk('creole_garlic', 'Creole Garlic', PRIME, 10, 78,
    { sugarContent: 2, starchContent: 2, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 3 },
    'Pink-skinned and spicy, from the warm south. Stores well and cooks sweet.',
    ['honey_garlic', 'black_garlic'], { tierRequired: 2, tags: ['PRODUCE'], season: [6, 7, 8, 9, 10, 11, 0] }),   // Jul-Jan

  mk('elephant_garlic', 'Elephant Garlic', PRIME, 9, 70,
    { sugarContent: 3, starchContent: 2, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 2 },
    'Actually a leek. Mild and huge, with cloves the size of a plum.',
    ['honey_garlic'], { tags: ['PRODUCE'], season: [6, 7, 8, 9, 10, 11, 0] }),   // Jul-Jan

  // --- Honey ---

  mk('heather_honey', 'Heather Honey', NORDIC, 34, 88,
    { sugarContent: 10, starchContent: 0, nativeSalinity: 0, microbialDiversity: 1, fatContent: 0, proteinContent: 1 },
    'A thick, jelly-like honey that has to be stirred before it will pour. Amber with a toffee flavour.',
    ['honey_garlic', 'oxymel', 'fruit_mead'], { tierRequired: 2, type: IngredientType.ADDITIVE, mass: 1000, unitDisplay: 'kg' }),

  mk('chestnut_honey', 'Chestnut Honey', NORDIC, 28, 84,
    { sugarContent: 10, starchContent: 0, nativeSalinity: 0, microbialDiversity: 1, fatContent: 0, proteinContent: 1 },
    'Dark, bitter and tannic. A honey for savoury things.',
    ['honey_garlic', 'oxymel'], { tierRequired: 2, type: IngredientType.ADDITIVE, mass: 1000, unitDisplay: 'kg' }),

  mk('soba_honey', 'Buckwheat Honey', NORDIC, 24, 82,
    { sugarContent: 10, starchContent: 0, nativeSalinity: 0, microbialDiversity: 1, fatContent: 0, proteinContent: 1 },
    'Near black, with a molasses flavour.',
    ['honey_garlic', 'oxymel'], { type: IngredientType.ADDITIVE, mass: 1000, unitDisplay: 'kg' }),

  mk('acacia_honey', 'Acacia Honey', NORDIC, 26, 84,
    { sugarContent: 10, starchContent: 0, nativeSalinity: 0, microbialDiversity: 1, fatContent: 0, proteinContent: 1 },
    'Pale, delicate and slow to crystallise.',
    ['honey_garlic', 'oxymel'], { type: IngredientType.ADDITIVE, mass: 1000, unitDisplay: 'kg' }),

  mk('manuka_honey', 'Manuka Honey', PRIME, 60, 92,
    { sugarContent: 10, starchContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 1 },
    "New Zealand's medicinal honey. Dark, earthy and expensive.",
    ['honey_garlic', 'oxymel'], { tierRequired: 3, type: IngredientType.ADDITIVE, mass: 1000, unitDisplay: 'kg' }),

  mk('lavender_honey', 'Lavender Honey', PRIME, 32, 86,
    { sugarContent: 10, starchContent: 0, nativeSalinity: 0, microbialDiversity: 1, fatContent: 0, proteinContent: 1 },
    'Pale and floral, from the Provence hillsides.',
    ['honey_garlic', 'oxymel'], { tierRequired: 2, type: IngredientType.ADDITIVE, mass: 1000, unitDisplay: 'kg' }),

  // --- Persimmons ---

  fruit('hachiya_persimmon', 'Hachiya Persimmon', PRIME, 12, 78, [9, 10, 11],     // Oct-Dec
    { sugarContent: 8, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2, tannin: 6 },
    'Acorn-shaped and astringent until it is soft as jelly. Makes an orange syrup that tastes of honey and apricot.',
    ['fruit_cheong', 'gotgam', 'persimmon_vinegar']),

  fruit('fuyu_persimmon', 'Fuyu Persimmon', PRIME, 10, 76, [9, 10, 11],           // Oct-Dec
    { sugarContent: 8, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'The non-astringent flat one, crisp and sweet. Eaten hard.',
    ['fruit_cheong', 'gotgam', 'persimmon_vinegar']),

  fruit('cheongdo_bansi', 'Cheongdo Bansi', SILK, 18, 86, [9, 10, 11],            // Oct-Dec
    { sugarContent: 9, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2, tannin: 5 },
    'The flat, seedless Korean persimmon from Cheongdo. Astringent and deeply sweet once it is soft.',
    ['fruit_cheong', 'gotgam', 'persimmon_vinegar'], 2),

  fruit('american_persimmon', 'American Persimmon', FORAGE_SUPPLIER.id, 14, 80, [9, 10, 11], // Oct-Dec
    { sugarContent: 9, starchContent: 1, nativeSalinity: 0, microbialDiversity: 7, fatContent: 0, proteinContent: 1, innateAcidity: 2, tannin: 7 },
    'Diospyros virginiana, small and wild. Astringent until frost-soft, then intensely sweet.',
    ['fruit_cheong', 'gotgam', 'persimmon_vinegar'], 2),

  fruit('chocolate_persimmon', 'Chocolate Persimmon', PRIME, 16, 82, [9, 10, 11], // Oct-Dec
    { sugarContent: 8, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2, tannin: 3 },
    'Brown-streaked flesh with a cinnamon note. Dries well.',
    ['gotgam', 'fruit_cheong'], 2),

  fruit('sangju_persimmon', 'Sangju Persimmon', SILK, 20, 88, [9, 10, 11],        // Oct-Dec
    { sugarContent: 9, starchContent: 1, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2, tannin: 5 },
    "Grown on the hills around Sangju, Korea's dried-persimmon capital. Dense, sugary and made for drying.",
    ['gotgam'], 2),

  // --- Rose hips ---

  fruit('dog_rose_hips', 'Dog Rose Hips', FORAGE_SUPPLIER.id, 8, 74, [8, 9, 10],  // Sep-Nov
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 5 },
    'Rosa canina, the hedgerow rose. Coral-red, tart and full of vitamin C.',
    ['fruit_cheong']),

  fruit('rugosa_hips', 'Rugosa Hips', FORAGE_SUPPLIER.id, 10, 78, [8, 9, 10],     // Sep-Nov
    { sugarContent: 6, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 5 },
    'Rosa rugosa, the beach rose, with big, fleshy hips. Much easier to prepare.',
    ['fruit_cheong']),

  fruit('apple_rose_hips', 'Apple Rose Hips', FORAGE_SUPPLIER.id, 10, 76, [8, 9, 10], // Sep-Nov
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 6 },
    'Rosa villosa, the apple rose. Large, round and slightly hibiscus-like.',
    ['fruit_cheong']),

  // --- Sugars ---

  mk('muscovado_sugar', 'Muscovado', NORDIC, 9, 74,
    { sugarContent: 9, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 1 },
    'Unrefined, sticky and dark, with a molasses flavour.',
    ['fruit_cheong'], { type: IngredientType.ADDITIVE, mass: 1000, unitDisplay: 'kg' }),

  mk('jaggery_sugar', 'Jaggery', SILK, 10, 74,
    { sugarContent: 9, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 1 },
    'Unrefined cane or palm sugar from South Asia. Caramel and earthy.',
    ['fruit_cheong'], { type: IngredientType.ADDITIVE, mass: 1000, unitDisplay: 'kg' }),

  mk('panela_sugar', 'Panela', PRIME, 10, 74,
    { sugarContent: 9, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 1 },
    'Latin American whole cane sugar. Darker, with a grassy note.',
    ['fruit_cheong'], { type: IngredientType.ADDITIVE, mass: 1000, unitDisplay: 'kg' }),

  mk('piloncillo_sugar', 'Piloncillo', PRIME, 11, 76,
    { sugarContent: 9, starchContent: 0, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 1 },
    'Mexican cone-shaped cane sugar. Smoky and rich.',
    ['fruit_cheong'], { type: IngredientType.ADDITIVE, mass: 1000, unitDisplay: 'kg' }),

  // --- Nuts ---

  mk('tonda_gentile', 'Tonda Gentile delle Langhe', PRIME, 34, 92,
    { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 3, fatContent: 6, proteinContent: 3 },
    "Piedmont's hazelnut. The sweetest and most aromatic hazelnut there is.",
    ['miso_hazelnuts'], { tierRequired: 3 }),

  mk('tonda_giffoni', 'Tonda di Giffoni', PRIME, 24, 86,
    { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 3, fatContent: 6, proteinContent: 3 },
    'Campanian, round and reliable. A rich, roasted nut.',
    ['miso_hazelnuts'], { tierRequired: 2 }),

  mk('kentish_cob', 'Kentish Cob', PRIME, 18, 80,
    { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 3, fatContent: 6, proteinContent: 3 },
    'The English filbert, long and thin-shelled. Sweet and mild.',
    ['miso_hazelnuts'], { tierRequired: 2 }),

  mk('cosford_cob', 'Cosford', PRIME, 18, 80,
    { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 3, fatContent: 6, proteinContent: 3 },
    'A thin-shelled English hazelnut. Sweet and crisp.',
    ['miso_hazelnuts'], { tierRequired: 2 }),

  mk('walnuts', 'Walnuts', NORDIC, 14, 72,
    { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 3, fatContent: 7, proteinContent: 3 },
    'Turn bitter and tannic in a miso, and darken.',
    ['miso_hazelnuts']),

  mk('chestnuts', 'Chestnuts', NORDIC, 12, 72,
    { sugarContent: 3, starchContent: 4, nativeSalinity: 0, microbialDiversity: 3, fatContent: 1, proteinContent: 3 },
    'Go soft and sweet, and less oily than the others.',
    ['miso_hazelnuts'], { season: [9, 10, 11] }),   // Oct-Dec

  mk('almonds', 'Almonds', NORDIC, 14, 72,
    { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 3, fatContent: 6, proteinContent: 4 },
    'Clean and mild, and they take on the miso.',
    ['miso_hazelnuts']),

  mk('pecans', 'Pecans', PRIME, 18, 76,
    { sugarContent: 1, starchContent: 1, nativeSalinity: 0, microbialDiversity: 3, fatContent: 7, proteinContent: 3 },
    'Buttery, sweet and very oily.',
    ['miso_hazelnuts']),

  // --- Dried chilli pods ---

  mk('chilhuacle_negro', 'Chilhuacle Negro', PRIME, 30, 88,
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 3, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'The Oaxacan mole chilli, near-black and grown in only a few villages. Chocolatey and raisiny.',
    ['black_chilli'], { tierRequired: 2, mass: 250, unitDisplay: 'g' }),

  mk('ancho_pods', 'Ancho', PRIME, 12, 76,
    { sugarContent: 5, starchContent: 0, nativeSalinity: 0, microbialDiversity: 3, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'A dried poblano. Sweet, mild and raisiny.',
    ['black_chilli'], { mass: 250, unitDisplay: 'g' }),

  mk('pasilla_pods', 'Pasilla', PRIME, 12, 76,
    { sugarContent: 4, starchContent: 0, nativeSalinity: 0, microbialDiversity: 3, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'The little raisin. Long, black and dry, with berry and liquorice notes.',
    ['black_chilli'], { mass: 250, unitDisplay: 'g' }),

  mk('scotch_bonnet', 'Scotch Bonnet', PRIME, 14, 78,
    { sugarContent: 3, starchContent: 0, nativeSalinity: 0, microbialDiversity: 3, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'Tropical fruit and fierce heat, from the Caribbean.',
    ['black_chilli'], { mass: 250, unitDisplay: 'g' }),

  mk('aji_amarillo', 'Aji Amarillo', PRIME, 14, 78,
    { sugarContent: 4, starchContent: 0, nativeSalinity: 0, microbialDiversity: 3, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'The yellow chilli of Peru. Stays orange-bronze and fruity.',
    ['black_chilli'], { mass: 250, unitDisplay: 'g' }),

  // --- Flowers ---

  mk('meadowsweet', 'Meadowsweet', FORAGE_SUPPLIER.id, 10, 76,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Queen of the meadow. Almond, hay and wintergreen.',
    ['oxymel'], { tags: ['PRODUCE'], season: [5, 6, 7], mass: 100, unitDisplay: 'g' }),   // Jun-Aug

  mk('elderflower', 'Elderflower', FORAGE_SUPPLIER.id, 10, 78,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Lychee and muscat, and gone in a week.',
    ['oxymel'], { tags: ['PRODUCE'], season: [4, 5, 6], mass: 100, unitDisplay: 'g' }),   // May-Jul

  mk('linden_blossom', 'Linden Blossom', FORAGE_SUPPLIER.id, 10, 76,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Lime flower, honeyed and calming.',
    ['oxymel'], { tags: ['PRODUCE'], season: [5, 6, 7], mass: 100, unitDisplay: 'g' }),   // Jun-Aug

  mk('sweet_woodruff', 'Sweet Woodruff', FORAGE_SUPPLIER.id, 9, 74,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Vanilla and new-mown hay, once it has wilted.',
    ['oxymel'], { tags: ['PRODUCE'], season: [3, 4, 5], mass: 100, unitDisplay: 'g' }),   // Apr-Jun

  mk('chamomile', 'Chamomile', PRIME, 8, 72,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Apple-scented daisies.',
    ['oxymel'], { tags: ['PRODUCE'], season: [5, 6, 7, 8], mass: 100, unitDisplay: 'g' }),   // Jun-Sep

  // --- Ginger and its cousins ---

  mk('ginger_root', 'Ginger', SILK, 8, 74,
    { sugarContent: 1, starchContent: 2, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Common ginger, hot and clean. The reference for a ginger bug.',
    ['ginger_beer'], { tags: ['PRODUCE'] }),

  mk('blue_ring_ginger', 'Hawaiian Blue Ring Ginger', SILK, 16, 84,
    { sugarContent: 1, starchContent: 2, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Blue-tinged flesh, hotter and more aromatic than the common kind.',
    ['ginger_beer'], { tierRequired: 2, tags: ['PRODUCE'] }),

  mk('turmeric_root', 'Turmeric', SILK, 10, 76,
    { sugarContent: 1, starchContent: 2, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Turns the drink neon yellow. Earthy.',
    ['ginger_beer'], { tags: ['PRODUCE'] }),

  mk('galangal_root', 'Galangal', SILK, 10, 76,
    { sugarContent: 1, starchContent: 2, nativeSalinity: 0, microbialDiversity: 4, fatContent: 0, proteinContent: 1, innateAcidity: 1 },
    'Piney and citrusy, a Thai relative.',
    ['ginger_beer'], { tags: ['PRODUCE'] }),

  // --- Soda fruit ---

  mk('rhubarb_victoria', 'Rhubarb (Victoria)', PRIME, 7, 72,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 9 },
    'The old English pink stalk. Sharp, and it makes a pink soda.',
    ['wild_soda'], { tags: ['PRODUCE'], season: [3, 4, 5, 6] }),   // Apr-Jul

  mk('sumac_berries', 'Sumac Berries', FORAGE_SUPPLIER.id, 9, 74,
    { sugarContent: 1, starchContent: 0, nativeSalinity: 0, microbialDiversity: 6, fatContent: 0, proteinContent: 1, innateAcidity: 9, tannin: 3 },
    'Staghorn sumac, red and fuzzy. Steeped cold, the sumac-ade of the Native Americans, a tart pink-red drink.',
    ['wild_soda'], { tags: ['PRODUCE'], season: [7, 8, 9] }),   // Aug-Oct

  // --- Verbenas ---

  mk('lemon_verbena', 'Lemon Verbena', PRIME, 9, 78,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'The lemon-scented shrub. Rounded lemon and hay once fermented.',
    ['verbena_tea'], { tags: ['PRODUCE'], season: [5, 6, 7, 8, 9], mass: 100, unitDisplay: 'g' }),   // Jun-Oct

  mk('lemon_balm', 'Lemon Balm', PRIME, 6, 70,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'Mintier and softer. A garden weed.',
    ['verbena_tea'], { tags: ['PRODUCE'], season: [4, 5, 6, 7, 8, 9], mass: 100, unitDisplay: 'g' }),   // May-Oct

  mk('lemongrass', 'Lemongrass', SILK, 7, 72,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 2 },
    'Grassier and sharper.',
    ['verbena_tea'], { tags: ['PRODUCE'], mass: 250, unitDisplay: 'g' }),

  mk('lemon_myrtle', 'Lemon Myrtle', PRIME, 14, 82,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1, innateAcidity: 3 },
    'Australian rainforest leaf, the most intense of all the lemon leaves.',
    ['verbena_tea'], { tierRequired: 2, tags: ['PRODUCE'], mass: 100, unitDisplay: 'g' }),

  // --- Oats ---

  mk('oats', 'Oats', NORDIC, 8, 70,
    { sugarContent: 1, starchContent: 6, nativeSalinity: 0, microbialDiversity: 3, fatContent: 2, proteinContent: 3 },
    'Whole oats. Sowens is made from what is left when you sieve the husks.',
    ['sowens']),

  mk('bristle_oat', 'Bristle Oat', NORDIC, 14, 80,
    { sugarContent: 1, starchContent: 6, nativeSalinity: 0, microbialDiversity: 4, fatContent: 2, proteinContent: 3 },
    'Avena strigosa, the ancient oat of Scotland and Shetland. Thin, grey and earthy.',
    ['sowens'], { tierRequired: 2 }),

  mk('naked_oats', 'Naked Oats', NORDIC, 12, 76,
    { sugarContent: 1, starchContent: 6, nativeSalinity: 0, microbialDiversity: 3, fatContent: 3, proteinContent: 3 },
    'Hulless, so it sours quickly and cleanly.',
    ['sowens']),

  mk('black_tartarian_oat', 'Black Tartarian Oat', NORDIC, 13, 78,
    { sugarContent: 1, starchContent: 6, nativeSalinity: 0, microbialDiversity: 4, fatContent: 2, proteinContent: 3 },
    'A black-husked oat from the Russian steppe. Grey and earthy.',
    ['sowens'], { tierRequired: 2 }),

  // --- Milks ---

  mk('jersey_milk', 'Jersey Milk', NORDIC, 8, 80,
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 4, proteinContent: 3, innateAcidity: 1 },
    'Deep golden and rich, high in butterfat.',
    ['koji_butter', 'yoghurt_kefir'], { mass: 1000, unitDisplay: 'ml' }),

  mk('guernsey_milk', 'Guernsey Milk', NORDIC, 9, 82,
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 4, proteinContent: 3, innateAcidity: 1 },
    'Golden and rich in beta-carotene.',
    ['koji_butter', 'yoghurt_kefir'], { mass: 1000, unitDisplay: 'ml' }),

  mk('welsh_black_milk', 'Welsh Black Milk', NORDIC, 8, 76,
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 3, proteinContent: 3, innateAcidity: 1 },
    'A hardy hill breed. Milk that tastes of grass.',
    ['koji_butter', 'yoghurt_kefir'], { mass: 1000, unitDisplay: 'ml' }),

  mk('dexter_milk', 'Dexter Milk', NORDIC, 9, 78,
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 4, proteinContent: 3, innateAcidity: 1 },
    'Small Irish cows, with concentrated, creamy milk.',
    ['koji_butter', 'yoghurt_kefir'], { mass: 1000, unitDisplay: 'ml' }),

  mk('brown_swiss_milk', 'Brown Swiss Milk', NORDIC, 8, 78,
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 3, proteinContent: 4, innateAcidity: 1 },
    'High in protein, which makes a firm curd.',
    ['koji_butter', 'yoghurt_kefir'], { mass: 1000, unitDisplay: 'ml' }),

  mk('buffalo_milk', 'Water Buffalo Milk', PRIME, 16, 84,
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 6, proteinContent: 4, innateAcidity: 1 },
    'The creamiest, with the highest fat. Pure white butter and a mild taste.',
    ['koji_butter', 'yoghurt_kefir'], { tierRequired: 2, mass: 1000, unitDisplay: 'ml' }),

  mk('goat_milk', 'Goat Milk', NORDIC, 10, 76,
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 3, proteinContent: 3, innateAcidity: 1 },
    'Tangy and a little funky. White butter and a grassy taste.',
    ['koji_butter', 'yoghurt_kefir'], { mass: 1000, unitDisplay: 'ml' }),

  mk('sheep_milk', 'Sheep Milk', PRIME, 14, 82,
    { sugarContent: 2, starchContent: 0, nativeSalinity: 0, microbialDiversity: 4, fatContent: 5, proteinContent: 5, innateAcidity: 1 },
    'The thickest and sweetest, with the most solids.',
    ['koji_butter', 'yoghurt_kefir'], { tierRequired: 2, mass: 1000, unitDisplay: 'ml' }),

  // --- Milk cultures ---

  mk('matsoni_starter', 'Matsoni Culture', BIOLAB, 12, 80,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 1 },
    'The Georgian yoghurt culture, ferments at room temperature. Firm and mild.',
    ['yoghurt_kefir'], { tierRequired: 2, tags: ['STARTER'], type: IngredientType.ADDITIVE, mass: 50, unitDisplay: 'g' }),

  mk('bulgarian_starter', 'Bulgarian Yoghurt Culture', BIOLAB, 10, 78,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 1 },
    'Lactobacillus bulgaricus, the original. Sharp and clean.',
    ['yoghurt_kefir'], { tags: ['STARTER'], type: IngredientType.ADDITIVE, mass: 50, unitDisplay: 'g' }),

  mk('villi_starter', 'Viili Culture', BIOLAB, 14, 80,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 1 },
    'The Finnish culture that turns the milk ropey and stretchy.',
    ['yoghurt_kefir'], { tierRequired: 2, tags: ['STARTER'], type: IngredientType.ADDITIVE, mass: 50, unitDisplay: 'g' }),

  mk('filmjolk_starter', 'Filmjolk Culture', BIOLAB, 12, 78,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 1 },
    'The Swedish culture. Thin, buttery and mild.',
    ['yoghurt_kefir'], { tags: ['STARTER'], type: IngredientType.ADDITIVE, mass: 50, unitDisplay: 'g' }),

  mk('kefir_starter', 'Kefir Grains', BIOLAB, 14, 80,
    { sugarContent: 0, starchContent: 0, nativeSalinity: 0, microbialDiversity: 9, fatContent: 0, proteinContent: 1 },
    'Living grains of bacteria and yeast. Fizzy, sour and a little alcoholic.',
    ['yoghurt_kefir'], { tierRequired: 2, tags: ['STARTER'], type: IngredientType.ADDITIVE, mass: 50, unitDisplay: 'g' }),
];

/* -----------------------------------------------------------------------------
   RECIPES
   --------------------------------------------------------------------------- */

export const PANTRY_RECIPES: Recipe[] = [
  {
    id: 'hobak_kimchi',
    name: 'Autumn Hobak Kimchi',
    type: FermentType.LACTO,
    description: 'Kimchi with squash in place of cabbage, salted to about 3%. Orange chunks coated in red, sweet and earthy with chilli, sweet-sour and mild in the mouth, and soft and yielding once it has cooked through in its own brine.',
    requiredIngredients: { substrate: true, starter: null, additive: 'chili' },
    outputIngredientId: 'hobak_kimchi_jar',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 70,
    peakWindowStart: 80, peakWindowEnd: 95,
    activeIntervention: 'Clean',
    idealParams: { temp: 10, humidity: 65, salinity: 3 },
    idealFlavorProfile: { umami: 30, acidity: 58, funk: 34, sweetness: 44, safety: 98 },
    difficulty: 2,
  },
  {
    id: 'wild_garlic_ferment',
    name: 'Fermented Wild Garlic',
    type: FermentType.LACTO,
    description: 'Ramsons and their kin with about 3% salt, fermenting in their own liquid. Bright green going to dull olive with a cloudy brine; a sharp garlic hit that mellows to sour onion; lightly tangy with garlic and chive, the leaves silky-soft. Flower buds and seed pods turn into caper-like pops.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'wild_garlic_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 45,
    peakWindowStart: 78, peakWindowEnd: 94,
    activeIntervention: 'Clean',
    idealParams: { temp: 18, humidity: 60, salinity: 3 },
    idealFlavorProfile: { umami: 24, acidity: 60, funk: 30, sweetness: 10, safety: 98 },
    difficulty: 1,
  },
  {
    id: 'quick_relish',
    name: 'Quick Fermented Relish',
    type: FermentType.LACTO,
    description: 'Sweet peppers or tomatoes chopped with a handful of herbs and a little salt, ready in days. A chunky, glossy red-orange sauce flecked with green; fresh and zingy on the nose, tangy and savoury, loose and spoonable.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'relish_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 35,
    peakWindowStart: 75, peakWindowEnd: 92,
    activeIntervention: 'Stir',
    idealParams: { temp: 22, humidity: 60, salinity: 3 },
    idealFlavorProfile: { umami: 40, acidity: 62, funk: 26, sweetness: 30, safety: 98 },
    difficulty: 1,
  },
  {
    id: 'lacto_plums',
    name: 'Lacto Plums',
    type: FermentType.LACTO,
    description: 'Ripe plums packed with about 5% salt, fermenting in their own juice: lactic acid bacteria, not a pickling brine. The colour bleeds into a pink-purple liquid. Wrinkled, dulled skins; almond and wine on the nose; salty-sour-fruity like umeboshi; soft and jammy. Not the unripe green plums of the other lacto ferment: these are ripe, and they turn to jam.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'lacto_plum_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 90,
    peakWindowStart: 80, peakWindowEnd: 96,
    activeIntervention: 'Clean',
    idealParams: { temp: 18, humidity: 60, salinity: 5 },
    idealFlavorProfile: { umami: 26, acidity: 74, funk: 36, sweetness: 32, safety: 98 },
    difficulty: 2,
  },
  {
    id: 'lacto_apples',
    name: 'Lacto Apples',
    type: FermentType.LACTO,
    description: 'Sliced apples with about 3% salt, fermenting in their own juice. The flesh goes translucent at the edges and slightly beige; cidery and spiced on the nose; tart with a light fizz; firm but softened.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'lacto_apple_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 60,
    peakWindowStart: 78, peakWindowEnd: 94,
    activeIntervention: 'Clean',
    idealParams: { temp: 18, humidity: 60, salinity: 3 },
    idealFlavorProfile: { umami: 8, acidity: 68, funk: 30, sweetness: 38, safety: 98 },
    difficulty: 1,
  },
  {
    id: 'wasabina_greens',
    name: 'Wasabina Mustard Greens',
    type: FermentType.LACTO,
    description: 'Mustard leaves salted down and pressed. Deep olive-green, limp leaves; sharp and sinus-clearing on the nose; peppery and sour; chewy. The purple varieties bleed a magenta-brown brine, and Red Giant is the hottest.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'wasabina_jar',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 55,
    peakWindowStart: 80, peakWindowEnd: 95,
    activeIntervention: 'Clean',
    idealParams: { temp: 16, humidity: 60, salinity: 3 },
    idealFlavorProfile: { umami: 22, acidity: 66, funk: 30, sweetness: 8, safety: 98 },
    difficulty: 2,
  },
  {
    id: 'kanji',
    name: 'Kanji',
    type: FermentType.LACTO,
    description: 'Black carrots in salted water with mustard seed, left in the sun. An opaque, deep violet-magenta liquid; earth, sulphur and mustard on the nose; sour, salty and pungent; thin, with a slight fizz. Orange carrots make a sweeter pink-orange drink, and beet deepens it to ruby.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'kanji_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 40,
    peakWindowStart: 74, peakWindowEnd: 90,
    activeIntervention: 'Stir',
    idealParams: { temp: 27, humidity: 60, salinity: 3 },
    idealFlavorProfile: { umami: 26, acidity: 62, funk: 40, sweetness: 16, safety: 98 },
    difficulty: 1,
  },
  {
    id: 'black_boshi',
    name: 'Black Boshi',
    type: FermentType.MISO,
    description: 'Currants and other dark berries packed in salt and dried. Shrivelled, near-black fruit with a white salt bloom; sharp and winey; intensely salty-sour with tannins; chewy and wrinkled. What weeps out of the jar is a dark purple vinegar. Red shiso dyes the fruit crimson.',
    requiredIngredients: { substrate: true, starter: null, additive: 'salt' },
    outputIngredientId: 'black_boshi_jar',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 210,
    peakWindowStart: 90, peakWindowEnd: 100,
    activeIntervention: 'Flip',
    idealParams: { temp: 14, humidity: 40, salinity: 15 },
    idealFlavorProfile: { umami: 30, acidity: 84, funk: 40, sweetness: 10, safety: 98 },
    difficulty: 3,
  },
  {
    id: 'honey_garlic',
    name: 'Honey Fermented Garlic',
    type: FermentType.LACTO,
    description: 'Whole cloves in raw honey, burped daily. The cloves go from ivory to amber, and sometimes blue-green, which is harmless. The honey thins into a runny, bubbling golden syrup. Sweet and garlicky, mellow and savoury, the cloves tender.',
    requiredIngredients: { substrate: true, starter: null, additive: 'honey' },
    outputIngredientId: 'honey_garlic_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 120,
    peakWindowStart: 82, peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 20, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 24, acidity: 42, funk: 26, sweetness: 66, safety: 100 },
    difficulty: 1,
  },
  {
    id: 'fruit_cheong',
    name: 'Fruit Cheong',
    type: FermentType.ALCOHOL,
    description: 'Fruit and sugar, layered and left to draw itself into syrup. Clear, jewel-coloured syrup with softened fruit; intensely fruity; very sweet with a light tang; thick and syrupy. Persimmon makes an orange honey-and-apricot syrup, rosehip a coral-red one, blackcurrant a purple-black one.',
    requiredIngredients: { substrate: true, starter: null, additive: 'sugar' },
    outputIngredientId: 'fruit_cheong_syrup',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 100,
    peakWindowStart: 80, peakWindowEnd: 95,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 20, humidity: 50, salinity: 0 },
    idealFlavorProfile: { umami: 0, acidity: 18, funk: 8, sweetness: 94, safety: 100 },
    targetAbv: 0.5,
    difficulty: 1,
  },
  {
    id: 'gotgam',
    name: 'Gotgam',
    type: FermentType.MISO,
    description: 'Persimmons peeled, strung and dried in the cold wind. Deep orange-brown fruit under a white sugar bloom; honeyed; tastes of dates; a chewy exterior around a jammy centre.',
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: 'gotgam_string',
    requiredVesselId: 'koji_tray',
    baseDurationSeconds: 150,
    peakWindowStart: 88, peakWindowEnd: 100,
    activeIntervention: 'Flip',
    idealParams: { temp: 12, humidity: 45, salinity: 0 },
    idealFlavorProfile: { umami: 4, acidity: 10, funk: 6, sweetness: 80, safety: 98 },
    difficulty: 2,
  },
  {
    id: 'koji_ketchup',
    name: 'Koji Ketchup',
    type: FermentType.MISO,
    description: 'Tomatoes cooked down with koji instead of a lot of sugar. Brick red and glossy; tomato and sake on the nose; less sugary and more savoury than the bottle kind.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: 'sugar' },
    outputIngredientId: 'koji_ketchup_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 110,
    peakWindowStart: 84, peakWindowEnd: 100,
    activeIntervention: 'Stir',
    idealParams: { temp: 26, humidity: 60, salinity: 4 },
    idealFlavorProfile: { umami: 58, acidity: 52, funk: 30, sweetness: 34, safety: 100 },
    difficulty: 3,
  },
  {
    id: 'koji_butter',
    name: 'Koji-Cultured Butter',
    type: FermentType.LACTO,
    description: 'Cream cultured with a spoon of koji. Pale gold, and nutty like brown butter, with an intensely buttery taste. Guernsey and Jersey give a deep golden butter, buffalo a pure white and mild one, goat and sheep a tangy, grassy white.',
    requiredIngredients: { substrate: true, starter: 'koji', additive: null },
    outputIngredientId: 'koji_butter_block',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 72,
    peakWindowStart: 80, peakWindowEnd: 94,
    activeIntervention: 'Stir',
    idealParams: { temp: 22, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 36, acidity: 50, funk: 34, sweetness: 20, safety: 98 },
    difficulty: 3,
  },
  {
    id: 'miso_hazelnuts',
    name: 'Miso Hazelnuts',
    type: FermentType.MISO,
    description: 'Roasted nuts buried in miso. The nuts darken to tan with the miso still clinging; toasty and cheesy; salty and savoury; turning slightly softened and fudgy.',
    requiredIngredients: { substrate: true, starter: null, additive: 'miso' },
    outputIngredientId: 'miso_hazelnut_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 100,
    peakWindowStart: 86, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 18, humidity: 55, salinity: 6 },
    idealFlavorProfile: { umami: 60, acidity: 14, funk: 36, sweetness: 30, safety: 100 },
    difficulty: 2,
  },
  {
    id: 'black_chilli',
    name: 'Black Chilli',
    type: FermentType.BLACK,
    description: 'Whole dried chillies held warm and humid until the sugars turn. Shrivelled, matte black to deep maroon pods; balsamic, prune and smoke on the nose; sweet and fruity with the heat softened; chewy or leathery.',
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: 'black_chilli_jar',
    requiredVesselId: 'incubator',
    baseDurationSeconds: 210,
    peakWindowStart: 90, peakWindowEnd: 100,
    activeIntervention: 'Clean',
    idealParams: { temp: 60, humidity: 75, salinity: 0 },
    idealFlavorProfile: { umami: 30, acidity: 56, funk: 24, sweetness: 64, safety: 100 },
    difficulty: 2,
  },
  {
    id: 'persimmon_vinegar',
    name: 'Persimmon Vinegar',
    type: FermentType.VINEGAR,
    description: 'Soft persimmons in a barrel with a little water: yeast makes the alcohol, then Acetobacter makes the acid. An amber-orange liquid; honey and dried apricot on the nose; mellow and softly sour.',
    requiredIngredients: { substrate: true, starter: null, additive: 'water' },
    outputIngredientId: 'persimmon_vinegar_bottle',
    requiredVesselId: 'cedar_barrel',
    baseDurationSeconds: 190,
    peakWindowStart: 84, peakWindowEnd: 100,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 24, humidity: 65, salinity: 0 },
    idealFlavorProfile: { umami: 6, acidity: 86, funk: 32, sweetness: 22, safety: 100 },
    targetAbv: 0.3,
    difficulty: 3,
  },
  {
    id: 'oxymel',
    name: 'Oxymel',
    type: FermentType.VINEGAR,
    description: 'Flowers steeped in honey and vinegar. A golden syrup, sweet-sour and floral. Meadowsweet gives almond, hay and wintergreen; elderflower lychee and muscat; woodruff vanilla and hay; rose petals tint it pink.',
    requiredIngredients: { substrate: true, starter: null, additive: 'honey' },
    outputIngredientId: 'oxymel_bottle',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 60,
    peakWindowStart: 80, peakWindowEnd: 96,
    activeIntervention: 'Stir',
    idealParams: { temp: 18, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 2, acidity: 66, funk: 10, sweetness: 64, safety: 100 },
    difficulty: 1,
  },
  {
    id: 'ginger_beer',
    name: 'Ginger Beer',
    type: FermentType.ALCOHOL,
    description: 'A ginger bug fed on sugar and water for a few days. Cloudy pale gold with a lively foam; spicy lemon on the nose; dry to sweet with a throat-burning ginger bite; very fizzy. Turmeric turns it neon yellow, galangal makes it piney and citrusy.',
    requiredIngredients: { substrate: true, starter: null, additive: 'sugar' },
    outputIngredientId: 'ginger_beer_bottle',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 45,
    peakWindowStart: 74, peakWindowEnd: 90,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 22, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 2, acidity: 52, funk: 22, sweetness: 44, safety: 98 },
    targetAbv: 0.6,
    difficulty: 1,
  },
  {
    id: 'wild_soda',
    name: 'Wild Soda',
    type: FermentType.ALCOHOL,
    description: 'Fruit, sugar and water, bottled while it is still working. The drink takes the colour of the fruit and a variable fizz. Elderberry makes it purple, Victoria rhubarb pink, and sumac a tart pink-red.',
    requiredIngredients: { substrate: true, starter: null, additive: 'sugar' },
    outputIngredientId: 'wild_soda_bottle',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 40,
    peakWindowStart: 72, peakWindowEnd: 90,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 21, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 2, acidity: 56, funk: 24, sweetness: 46, safety: 98 },
    targetAbv: 0.8,
    difficulty: 1,
  },
  {
    id: 'verbena_tea',
    name: 'Fermented Verbena Tea',
    type: FermentType.LACTO,
    description: 'Lemon leaves bruised, packed damp and left to oxidise and sour before drying. The leaves go from green to olive-brown; the tea brews golden and smells of rounded lemon and hay, with a softer taste than fresh verbena.',
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: 'verbena_tea_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 50,
    peakWindowStart: 78, peakWindowEnd: 94,
    activeIntervention: 'Stir',
    idealParams: { temp: 26, humidity: 70, salinity: 0 },
    idealFlavorProfile: { umami: 6, acidity: 28, funk: 26, sweetness: 20, safety: 100 },
    difficulty: 2,
  },
  {
    id: 'seidr',
    name: 'Farmhouse Seidr',
    type: FermentType.ALCOHOL,
    description: 'Pressed apples left in a cask to ferment on their own yeast. Hazy gold to amber; barnyard, apple and a hint of smoke on the nose; dry and tannic; still or softly sparkling. Bittersharp Kingston Black is the classic, bittersweet Dabinett and Yarlington Mill are fuller.',
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: 'seidr_cask',
    requiredVesselId: 'oak_cask',
    baseDurationSeconds: 200,
    peakWindowStart: 82, peakWindowEnd: 100,
    activeIntervention: 'Ventilate',
    idealParams: { temp: 16, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 4, acidity: 54, funk: 52, sweetness: 20, safety: 98 },
    targetAbv: 6,
    difficulty: 3,
  },
  {
    id: 'sowens',
    name: 'Sowens',
    type: FermentType.LACTO,
    description: 'The starch left in the husks of the oats, soaked in water until it sours. An off-white starch that settles under a thin, cloudy liquid; sour yeasty bread on the nose; gently sour, and it cooks into a smooth, jelly-like porridge.',
    requiredIngredients: { substrate: true, starter: null, additive: 'water' },
    outputIngredientId: 'sowens_crock',
    requiredVesselId: 'onggi',
    baseDurationSeconds: 60,
    peakWindowStart: 80, peakWindowEnd: 94,
    activeIntervention: 'Stir',
    idealParams: { temp: 22, humidity: 60, salinity: 0 },
    idealFlavorProfile: { umami: 12, acidity: 54, funk: 30, sweetness: 14, safety: 100 },
    difficulty: 1,
  },
  {
    id: 'yoghurt_kefir',
    name: 'Yoghurt and Kefir Cheese',
    type: FermentType.LACTO,
    description: "Warm milk and a culture, held still. Bright white to cream; lactic and fresh on the nose; clean and sour. Strained, it becomes thick and spreadable. Sheep's milk is the thickest and sweetest, buffalo the creamiest, goat tangy and a little funky.",
    requiredIngredients: { substrate: true, starter: 'starter', additive: null },
    outputIngredientId: 'yoghurt_jar',
    requiredVesselId: 'mason_jar',
    baseDurationSeconds: 40,
    peakWindowStart: 76, peakWindowEnd: 92,
    activeIntervention: 'Clean',
    idealParams: { temp: 30, humidity: 55, salinity: 0 },
    idealFlavorProfile: { umami: 24, acidity: 58, funk: 26, sweetness: 20, safety: 100 },
    difficulty: 1,
  },
];

/* -----------------------------------------------------------------------------
   MATRIX, THE ENTRIES THAT GO FIRST

   constants.ts spreads this in right after SOIL_MATRIX, which is how the pack
   shipped. Only some of it needs to be there, and the rest is harmless:

   - quick_relish must beat lacto_tomato, which takes any tomato with salt in a
     jar; the relish is the same jar with a fresh herb in it.
   - koji_butter must beat cultured_butter, which takes cream with anything but
     salt. That one is a deliberate MOVE, and the only named recipe this file
     moves: cream and a live koji used to be a cultured butter with the koji
     ignored. Differential against HEAD over 19.5M combinations: 1,602 moved.
   - the onggi entries (hobak_kimchi, wasabina_greens, black_boshi, sowens) sit
     above nukazuke and makgeolli, which match ANY substrate, so each forbids
     the reagent that would make it one of those (rice_bran, nuruk). Without
     that a squash, a mustard, a currant or an oat with the right extra was
     swallowed by the wrong recipe, and the differential does not see it because
     none of those substrates existed at HEAD.
   - koji_ketchup forbids a scoby, or it would take tomato kombucha.

   The rest are generated-rule territory (salt in a jar, sugar in a jar) and only
   need to come before the generated rules, which is everything here.
   --------------------------------------------------------------------------- */

export const PANTRY_MATRIX: MatrixEntry[] = [
  { recipeId: 'hobak_kimchi', substrate: pOneOf(PANTRY_G.squash, 'Any winter or summer squash'),
    requires: ['chili', 'salt'], forbids: ['rice_bran'], vesselId: 'onggi' },
  { recipeId: 'wild_garlic_ferment', substrate: pOneOf(PANTRY_G.alliums, 'Wild garlic, ramps or wild leek'),
    requires: ['salt'], forbids: ['sugar', 'koji', 'spores'], vesselId: 'mason_jar' },
  { recipeId: 'quick_relish', substrate: pOneOf([...TOMATO_IDS, ...PANTRY_G.sweetpep], 'A tomato or a sweet pepper'),
    requires: ['herb', 'salt'], forbids: ['koji', 'spores', 'sugar'], vesselId: 'mason_jar' },
  { recipeId: 'lacto_plums', substrate: pOneOf(PANTRY_G.plums, 'Any ripe plum'),
    requires: ['salt'], forbids: ['sugar', 'koji', 'spores'], vesselId: 'mason_jar' },
  { recipeId: 'lacto_apples', substrate: pOneOf(PANTRY_G.apples, 'Any apple'),
    requires: ['salt'], forbids: ['sugar', 'koji', 'spores', 'water'], vesselId: 'mason_jar' },
  { recipeId: 'wasabina_greens', substrate: pOneOf(PANTRY_G.mustards, 'Mustard greens'),
    requires: ['salt'], forbids: ['sugar', 'koji', 'spores', 'rice_bran', 'nuruk'], vesselId: 'onggi' },
  { recipeId: 'kanji', substrate: pOneOf(PANTRY_G.carrots, 'Any carrot'),
    requires: ['salt', 'water'], forbids: ['sugar', 'koji', 'spores'], vesselId: 'mason_jar' },
  { recipeId: 'black_boshi', substrate: pOneOf(PANTRY_G.currants, 'Currants or dark berries'),
    requires: ['salt'], forbids: ['water', 'sugar', 'koji', 'spores', 'rice_bran'], vesselId: 'onggi' },
  { recipeId: 'honey_garlic', substrate: pOneOf(PANTRY_G.garlics, 'Any garlic'),
    requires: ['honey'], forbids: ['salt', 'koji', 'spores', 'scoby'], vesselId: 'mason_jar' },
  { recipeId: 'fruit_cheong', substrate: pOneOf(PANTRY_G.cheong_fruit, 'Persimmon, rosehip or blackcurrant'),
    requires: ['sugar'], forbids: ['water', 'salt', 'koji'], vesselId: 'mason_jar' },
  { recipeId: 'gotgam', substrate: pOneOf(PANTRY_G.persimmons, 'Any persimmon'),
    requires: [], forbids: ['salt', 'sugar', 'water', 'koji', 'spores'], vesselId: 'koji_tray' },
  // Forbids a scoby: tomato, sugar and a scoby is a tomato kombucha whatever else
  // is in the jar, and this entry sits above it.
  { recipeId: 'koji_ketchup', substrate: pOneOf(TOMATO_IDS, 'A heirloom tomato'),
    requires: ['koji', 'sugar'], forbids: ['salt', 'water', 'scoby'], vesselId: 'mason_jar' },
  { recipeId: 'koji_butter', substrate: pOneOf(PANTRY_G.creams, 'Cream or whole milk'),
    requires: ['koji'], forbids: ['salt', 'water'], vesselId: 'mason_jar' },
  { recipeId: 'miso_hazelnuts', substrate: pOneOf(PANTRY_G.nuts, 'Any nut'),
    requires: ['miso'], forbids: ['koji', 'spores', 'water'], vesselId: 'mason_jar' },
  { recipeId: 'black_chilli', substrate: pOneOf(PANTRY_G.pods, 'Whole dried chillies'),
    requires: [], forbids: ['salt', 'sugar', 'water', 'koji'], vesselId: 'incubator' },
  { recipeId: 'persimmon_vinegar', substrate: pOneOf(PANTRY_G.persimmons, 'Any persimmon'),
    requires: ['water'], forbids: ['scoby', 'honey', 'sugar', 'salt', 'koji'], vesselId: 'cedar_barrel' },
  { recipeId: 'oxymel', substrate: pOneOf(PANTRY_G.flowers, 'Meadowsweet or another flower'),
    requires: ['honey', 'vinegar'], forbids: ['salt', 'koji'], vesselId: 'mason_jar' },
  { recipeId: 'ginger_beer', substrate: pOneOf(PANTRY_G.gingers, 'Ginger, turmeric or galangal'),
    requires: ['sugar', 'water'], forbids: ['scoby', 'salt', 'honey'], vesselId: 'mason_jar' },
  { recipeId: 'wild_soda', substrate: pOneOf(PANTRY_G.soda, 'Elderberry, rhubarb or sumac'),
    requires: ['sugar', 'water'], forbids: ['scoby', 'salt', 'honey'], vesselId: 'mason_jar' },
  { recipeId: 'verbena_tea', substrate: pOneOf(PANTRY_G.verbenas, 'Lemon verbena, balm, grass or myrtle'),
    requires: [], forbids: ['salt', 'sugar', 'honey', 'koji', 'spores', 'scoby', 'water'], vesselId: 'mason_jar' },
  { recipeId: 'seidr', substrate: pOneOf(PANTRY_G.apples, 'Any apple'),
    requires: [], forbids: ['water', 'salt', 'sugar', 'honey', 'koji', 'spores', 'scoby'], vesselId: ['oak_cask', 'cedar_barrel'] },
  { recipeId: 'sowens', substrate: pOneOf(PANTRY_G.oats, 'Any oats'),
    requires: ['water'], forbids: ['salt', 'koji', 'spores', 'sugar', 'nuruk'], vesselId: ['onggi', 'mason_jar'] },
  { recipeId: 'yoghurt_kefir', substrate: pOneOf(PANTRY_G.milks, 'Any milk'),
    requires: ['starter'], forbids: ['salt', 'p_roqueforti', 'larvae', 'koji'], vesselId: 'mason_jar' },
];

/* -----------------------------------------------------------------------------
   MATRIX, THE ENTRIES THAT GO LAST

   These widen an OLD recipe to a new family of substrates, so they sit after the
   older, narrower entries for the same recipe (kimchi on napa, sauerkraut on
   white cabbage, black garlic on the plain bulb, black apple on apples and
   plums, cider vinegar on apples) and after the family modules, and never in
   front of them. Order inside the list matters too: kimchi comes before
   sauerkraut, because a savoy with chilli and salt in an onggi is a kimchi and
   the kraut entry would take it if it were asked first.
   --------------------------------------------------------------------------- */

export const PANTRY_MATRIX_LATE: MatrixEntry[] = [
  { recipeId: 'kimchi', substrate: pOneOf(PANTRY_G.cabbage, 'Napa, savoy or black cabbage'),
    requires: ['chili', 'salt'], vesselId: 'onggi' },
  { recipeId: 'sauerkraut', substrate: pOneOf(['january_king'], 'Savoy cabbage'),
    requires: ['salt'], vesselId: 'onggi' },
  { recipeId: 'black_garlic', substrate: pOneOf(PANTRY_G.black_garlics, 'A heritage garlic'),
    requires: [], forbids: ['salt'], vesselId: 'incubator' },
  { recipeId: 'black_apple', substrate: pOneOf([...HERITAGE_APPLES, ...PANTRY_G.plums], 'Heritage apples or plums'),
    requires: [], forbids: ['salt', 'sugar'], vesselId: 'incubator' },
  { recipeId: 'cider_vinegar', substrate: pOneOf(HERITAGE_APPLES, 'Heritage apples'),
    requires: ['water'], vesselId: 'cedar_barrel' },
];

/* -----------------------------------------------------------------------------
   STAGED TASTING NOTES

   [look, smell, taste, feel] for a fresh jar (before the peak window), a ripe
   one (in it) and an aged one (well past it). A recipe may give only some
   stages: a missing stage reads as the nearest one that exists, so a recipe with
   a single profile lists `ripe` and nothing else. `alt` swaps the whole set when
   the substrate is one of its ids, for a green tomato against a red one.
   --------------------------------------------------------------------------- */

type StageText = [look: string, smell: string, taste: string, feel: string];
type StageKey = 'fresh' | 'ripe' | 'aged';
type StageSet = Partial<Record<StageKey, StageText>>;
/** Where a missing stage reads from: the nearest one that exists. */
const STAGE_FALLBACK: Record<StageKey, StageKey[]> = {
  fresh: ['ripe', 'aged'],
  ripe: ['fresh', 'aged'],
  aged: ['ripe', 'fresh'],
};
type StageSpec = StageSet & { alt?: StageSet & { ids: string[] } };

export const PANTRY_STAGES: Record<string, StageSpec> = {
  kimchi: {
    fresh: [
      'pale green-white leaves streaked with bright orange-red chilli',
      'raw garlic and ginger',
      'salty, with a sharp heat',
      'very crunchy',
    ],
    ripe: [
      'the red deepened, the leaves turning slightly translucent',
      'fizzy and sour',
      'a rounded sour-umami, with a tingle on the tongue',
      'crisp-tender',
    ],
    aged: [
      'olive-grey leaves under a dull brick-red paste',
      'pungent and cheesy',
      'very sour and deep',
      'soft. Best for cooking',
    ],
  },
  lacto_tomato: {
    ripe: [
      'glossy and slightly collapsed, in a cloudy pink brine',
      'wine and ripe fruit',
      'fizzy, bright and savoury-sweet',
      'soft and juicy',
    ],
    alt: {
      ids: ['green_zebra', 'aunt_rubys_german_green', 'tomatillo'],
      ripe: [
        'pale jade turning olive-khaki',
        'dilly and sour',
        'sharp and tart, like a sour pickle',
        'firm and crisp',
      ],
    },
  },
  shiro_miso: {
    ripe: [
      'a pale cream',
      'sweet and mild',
      'sweet and mild, gentle on the salt',
      'smooth',
    ],
  },
  hatcho_miso: {
    ripe: [
      'brick to chocolate-brown',
      'soy sauce and leather',
      'deeply salty and savoury',
      'dense',
    ],
  },
  shio_koji: {
    ripe: [
      'a beige, porridge-like paste',
      'sweet like sake and ripe pear',
      'salty-sweet and deeply savoury',
      'a loose porridge',
    ],
  },
  moromi: {
    ripe: [
      'clear mahogany to near-black',
      'roasted and caramelised, with wine-like notes',
      'salty and savoury, sweet at the finish',
      'thin, pours clear',
    ],
  },
  cider_vinegar: {
    ripe: [
      'hazy gold, with a floating jelly-like mother',
      'sharp and appley',
      'tart and fruity',
      'thin, with a mother',
    ],
  },
  black_apple: {
    ripe: [
      'a glossy, near-black spread',
      'caramel, liquorice and baked apple',
      'bittersweet and tangy, with spice',
      'thick and smooth',
    ],
  },
  hobak_kimchi: {
    ripe: [
      'orange or pale-yellow chunks coated in red',
      'sweet and earthy, with chilli',
      'sweet-sour and mild',
      'soft and yielding once cooked',
    ],
  },
  wild_garlic_ferment: {
    fresh: [
      'bright green, the brine cloudy',
      'a sharp garlic hit',
      'lightly tangy, garlic and chive',
      'crisp',
    ],
    ripe: [
      'dull olive, the brine cloudy',
      'mellower, a sour onion',
      'lightly tangy, garlic and chive',
      'silky-soft leaves',
    ],
  },
  quick_relish: {
    ripe: [
      'a chunky, glossy red-orange sauce flecked with green herbs',
      'fresh and zingy',
      'tangy and savoury',
      'loose and spoonable',
    ],
  },
  lacto_plums: {
    ripe: [
      'wrinkled, dulled skins, the colour bleeding into a pink-purple brine',
      'almond and wine',
      'salty-sour-fruity, like umeboshi',
      'soft and jammy',
    ],
  },
  lacto_apples: {
    ripe: [
      'flesh turning translucent at the edges and slightly beige',
      'cidery, with spice',
      'tart, with a light fizz',
      'firm but softened',
    ],
  },
  wasabina_greens: {
    ripe: [
      'deep olive-green, limp leaves',
      'sharp and sinus-clearing',
      'peppery and sour',
      'chewy',
    ],
  },
  kanji: {
    ripe: [
      'an opaque, deep violet-magenta liquid',
      'earth, sulphur and mustard',
      'sour, salty and pungent',
      'thin, with a slight fizz',
    ],
  },
  black_boshi: {
    ripe: [
      'shrivelled, near-black fruit with a white salt bloom',
      'sharply sour and winey',
      'intensely salty-sour, with tannins',
      'chewy and wrinkled',
    ],
  },
  honey_garlic: {
    ripe: [
      'cloves gone from ivory to amber, sometimes blue-green, in a runny bubbling golden syrup',
      'sweet and garlicky',
      'mellow, sweet and savoury',
      'the cloves tender',
    ],
  },
  fruit_cheong: {
    ripe: [
      'a clear, jewel-coloured syrup with softened fruit',
      'intensely fruity',
      'very sweet, with a light tang',
      'thick and syrupy',
    ],
  },
  gotgam: {
    ripe: [
      'deep orange-brown fruit with a white sugar bloom',
      'honeyed',
      'date-like',
      'a chewy exterior around a jammy centre',
    ],
  },
  koji_ketchup: {
    ripe: [
      'brick red and glossy',
      'tomatoey, with sake notes',
      'less sugary and more savoury than the bottle kind',
      'thick and smooth',
    ],
  },
  koji_butter: {
    ripe: [
      'pale gold butter',
      'nutty, like brown butter',
      'intensely buttery',
      'smooth and dense',
    ],
  },
  miso_hazelnuts: {
    ripe: [
      'nuts darkened to tan, with miso clinging to them',
      'toasty and cheesy',
      'salty and savoury',
      'slightly softened and fudgy',
    ],
  },
  black_chilli: {
    ripe: [
      'shrivelled, matte black to deep maroon pods',
      'balsamic, prune and smoke',
      'sweet and fruity, the heat softened',
      'chewy, or leathery',
    ],
  },
  persimmon_vinegar: {
    ripe: [
      'an amber-orange liquid',
      'honey and dried apricot',
      'mellow and softly sour',
      'thin and clear',
    ],
  },
  oxymel: {
    ripe: [
      'a golden syrup',
      'floral',
      'sweet-sour',
      'syrupy',
    ],
  },
  ginger_beer: {
    ripe: [
      'cloudy pale gold with a lively foam',
      'spicy lemon',
      'dry to sweet, with a throat-burning ginger bite',
      'very fizzy',
    ],
  },
  wild_soda: {
    ripe: [
      'the colour of the fruit, with a bead on it',
      'bright and fruity',
      'sweet-sharp, tasting of the fruit',
      'a variable fizz',
    ],
  },
  verbena_tea: {
    ripe: [
      'leaves gone from green to olive-brown; the tea brews golden',
      'rounded lemon and hay',
      'softer than fresh verbena',
      'light and clean',
    ],
  },
  seidr: {
    ripe: [
      'hazy gold to amber',
      'barnyard, apple and a hint of smoke',
      'dry and tannic',
      'still or softly sparkling',
    ],
  },
  sowens: {
    ripe: [
      'off-white starch settled under a thin, cloudy liquid',
      'sour, yeasty bread',
      'gently sour',
      'cooks into a smooth, jelly-like porridge',
    ],
  },
  yoghurt_kefir: {
    ripe: [
      'bright white to cream',
      'lactic and fresh',
      'clean and sour',
      'thick and spreadable once strained',
    ],
  },
};

/**
 * Writes a pantry recipe's staged lines over the generic tasting notes. It only
 * speaks for recipes in PANTRY_STAGES, never for a spoiled batch (which keeps the
 * game's own "gone over" wording), and keeps whatever fault the generic notes
 * found on the palate and texture lines, appended after the staged one.
 */
export const applyPantryStages = (notes: TastingNote[], batch: Batch, recipe: Recipe, ings: Ingredient[]): TastingNote[] => {
  const base = PANTRY_STAGES[recipe.id];
  if (!base) return notes;

  // Spoiled is relative to the recipe's own target, exactly as generateTastingNotes has it.
  const q = batch.quality;
  const t = recipe.idealFlavorProfile;
  if (batch.status === 'spoiled' || q.safety < Math.min(60, (t.safety ?? 100) - 25)) return notes;

  const sub = ings.find(i => i.type === IngredientType.SUBSTRATE);
  const spec: StageSet = base.alt && sub && base.alt.ids.includes(sub.id) ? base.alt : base;

  const p = batch.progress ?? 0;
  const want: StageKey = p < recipe.peakWindowStart ? 'fresh' : p > recipe.peakWindowEnd + 20 ? 'aged' : 'ripe';
  const order: StageKey[] = [want, ...STAGE_FALLBACK[want]];
  const key = order.find(k => spec[k]);
  if (!key) return notes;
  // Each stage phrase is translated here, where it is capitalised and given its full stop:
  // the finished sentence exists nowhere whole.
  const [look, smell, taste, feel] = spec[key]!.map(tx);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, '');
  const find = (f: TastingNote['facet']) => notes.find(n => n.facet === f);

  const col = find('Colour');
  if (col) col.text = `${cap(look)}.`;
  else notes.unshift({ facet: 'Colour', text: `${cap(look)}.` });

  // A rancid batch keeps the generic aroma, which is where the fault is written.
  const aro = find('Aroma');
  if ((batch.rancidity ?? 0) <= 10) {
    if (aro) aro.text = `${cap(smell)}.`;
    else notes.push({ facet: 'Aroma', text: `${cap(smell)}.` });
  }

  // The generic palate line is kept as an aside unless it says nothing.
  const pal = find('Palate');
  const keep = pal && !/^(Balanced|Equilibrad)/.test(pal.text) && !/^(Nothing|Nada)/.test(pal.text) ? low(pal.text) : '';
  if (pal) pal.text = `${cap(taste)}${keep ? '; ' + keep : ''}.`;
  else notes.push({ facet: 'Palate', text: `${cap(taste)}.` });

  const tex = find('Texture');
  if (tex) tex.text = `${cap(feel)}; ${low(tex.text)}.`;
  else {
    const at = notes.findIndex(n => n.facet === 'Finish');
    notes.splice(at < 0 ? notes.length : at, 0, { facet: 'Texture', text: `${cap(feel)}.` });
  }

  return notes;
};

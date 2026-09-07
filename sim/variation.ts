import { INGREDIENTS, VESSELS, RECIPES } from '../constants';
import { processBatchTick, resolveRecipeFromMatrix, generateInitialQuality,
         calculateCriticScore, calculateBatchDynamics, getRecipeForBatch } from '../services/gameLogic';
import { Batch, Ingredient, IngredientType, WeatherState, StaffRoleType } from '../types';

const ing = (id: string) => INGREDIENTS.find(i => i.id === id)!;
const NO_STAFF = { cleaner: false, tech: false, chef: false, rd: false } as Record<StaffRoleType, boolean>;
const WEATHER: WeatherState = { type: 'Cloudy', tempModifier: 0, humidityModifier: 0, description: 'Overcast' };

/** Run a batch to completion exactly as the game loop does, then score it. */
function runBatch(ings: Ingredient[], vesselId: string, playPerfect = true) {
  const recipe = resolveRecipeFromMatrix(ings, vesselId);
  const qty: Record<string, number> = {};
  ings.forEach(i => { qty[i.id] = i.mass; });
  const { yieldVolume, totalMass } = calculateBatchDynamics(ings, qty);
  const sub = ings.find(i => i.type === IngredientType.SUBSTRATE) || ings[0];

  let b: Batch = {
    id: 'x', recipeId: recipe.id, cachedRecipe: recipe, substrateId: sub.id, starterId: null,
    inputIngredientIds: ings.map(i => i.id), ingredientQuantities: qty, totalMass, yieldVolume,
    vesselId, startTime: 0, lastTick: 0, progress: 0, status: 'active',
    // "played perfectly" = dials set to the recipe's own ideal
    params: playPerfect
      ? { ...recipe.idealParams }
      : { temp: 25, humidity: 80, salinity: 0 },
    quality: generateInitialQuality(ings),
    messages: [], generation: 1, lineageDamaged: false, stress: 0, disturbanceTimer: 0,
    flags: { isLidPropped: false }, contraband: false,
  };

  for (let t = 0; t < 4000 && b.status === 'active'; t++) {
    b = processBatchTick(b, recipe, 100, sub, ings, NO_STAFF, {}, 5, WEATHER, true);
    if (b.progress >= recipe.peakWindowStart) break;
  }
  const score = calculateCriticScore(b, recipe, NO_STAFF);
  return { recipe, batch: b, score };
}

const F = (n: number) => n.toFixed(0).padStart(4);

console.log('=== A. SAME RECIPE FAMILY, DIFFERENT SUBSTRATE (procedural miso: sub + koji + salt, onggi) ===\n');
console.log('substrate'.padEnd(20), 'prot'.padStart(5), 'sug'.padStart(4), 'div'.padStart(4), '|',
            'TARGET uma'.padStart(11), 'ACTUAL uma'.padStart(11), '|', 'score'.padStart(6), 'recipe');
const misoSubs = ['soybeans','black_soybeans','yellow_peas','barley','glutinous_rice','mackerel','anchovies','raw_milk','scallops'];
for (const id of misoSubs) {
  const s = ing(id);
  const { recipe, batch, score } = runBatch([s, s, ing('koji_rice'), ing('salt')], 'onggi');
  console.log(
    s.name.padEnd(20),
    F(s.hiddenStats.proteinContent), F(s.hiddenStats.sugarContent), F(s.hiddenStats.microbialDiversity), '|',
    F(recipe.idealFlavorProfile.umami).padStart(11), F(batch.quality.umami).padStart(11), '|',
    String(score).padStart(6), recipe.name);
}

console.log('\n=== B. SAME SUBSTRATE, DIFFERENT NAMED RECIPES (is the score always the same?) ===\n');
const fixed: [string, Ingredient[], string][] = [
  ['Colatura',       [ing('anchovies'), ing('anchovies'), ing('salt')], 'oak_cask'],
  ['Nuoc Mam',       [ing('anchovies'), ing('anchovies'), ing('salt')], 'cedar_barrel'],
  ['Bottarga',       [ing('mullet_roe'), ing('salt')], 'koji_tray'],
  ['Garum Sociorum', [ing('mackerel'), ing('mackerel'), ing('salt')], 'incubator'],
  ['Hatcho Miso',    [ing('soybeans'), ing('soybeans'), ing('koji_spores'), ing('salt')], 'cedar_barrel'],
  ['Shiro Miso',     [ing('soybeans'), ing('koji_rice'), ing('salt')], 'mason_jar'],
];
console.log('recipe'.padEnd(18), 'resolved as'.padEnd(22), 'score'.padStart(6), 'uma'.padStart(5), 'aci'.padStart(5), 'fnk'.padStart(5), 'swt'.padStart(5), 'saf'.padStart(5));
for (const [label, list, v] of fixed) {
  const { recipe, batch, score } = runBatch(list, v);
  const q = batch.quality;
  console.log(label.padEnd(18), recipe.name.padEnd(22), String(score).padStart(6),
    F(q.umami), F(q.acidity), F(q.funk), F(q.sweetness), F(q.safety));
}

console.log('\n=== C. DOES PLAYING BADLY ACTUALLY COST YOU? (same inputs, wrong dials) ===\n');
console.log('recipe'.padEnd(22), 'perfect dials'.padStart(14), 'default dials'.padStart(14), 'delta'.padStart(7));
for (const [label, list, v] of fixed) {
  const good = runBatch(list, v, true).score;
  const bad = runBatch(list, v, false).score;
  console.log(label.padEnd(22), String(good).padStart(14), String(bad).padStart(14), String(good - bad).padStart(7));
}

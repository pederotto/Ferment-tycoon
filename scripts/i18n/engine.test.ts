/**
 * npm run i18n:test
 *
 * The cases here are the ones that broke while the Spanish version was being
 * built, each fixed once and pinned so it cannot come back.
 */
import { createTranslator, OPEN, CLOSE } from '../../i18n/engine';

const T = createTranslator({
  'Fill the vessel': 'Llena el recipiente',
  'Chapter {0} · {1}': '{1} · Capítulo {0}',
  'The Bench': 'El banco',
  '{0} kg of {1} into the pantry, graded {2}.': '{0} kg de {1} a la despensa, calificados con {2}.',
  'Colatura': 'Colatura',
  'sweet and garlicky': 'dulce y ajoso',
  'ripe': 'maduro',
  'ice': 'hielo',
  'Salt': 'Sal',
  'Nothing yet.': 'Todavía nada.',
  'The window is narrow.': 'La ventana es estrecha.',
  'Hello {0}!': '¡Hola {0}!',
  'One {0}': '1 × {0}',
  'One spore, two different koji. You are choosing what it will taste like.': 'Una misma espora, dos koji distintos. Estás eligiendo a qué sabrá.',
  'Buy {0} {1} for ${2}': 'Comprar {0} {1} por ${2}',
  'Bittersweet and tangy, with spice': 'Agridulce y ácido, con especias',
  'humidity {0}': 'humedad {0}',
  'holding': 'estable',
  '{0} unit{1}': '{0} pieza{1}',
  'The Lemon House': 'La casa de los limoneros',
  '(for sale)': '(en venta)',
  '· {0} still locked': '· {0} bloqueados',
  'Dec': 'Dic', 'Mar': 'Mar',
});

let failed = 0;
const eq = (what: string, got: string, want: string) => {
  if (got === want) return;
  failed++;
  console.error(`FAIL ${what}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
};

eq('exact', T.tr('Fill the vessel'), 'Llena el recipiente');
eq('edge whitespace is kept', T.tr('  Fill the vessel  '), '  Llena el recipiente  ');
eq('template reorders its placeholders', T.tr('Chapter 3 · The Bench'), 'El banco · Capítulo 3');
eq('captured text is translated too', T.tr('12 kg of colatura into the pantry, graded 88.'), '12 kg de Colatura a la despensa, calificados con 88.'.replace('Colatura', 'colatura'));
eq('lists: a phrase with its own key beats splitting at "and"', T.tr('sweet and garlicky, ripe'), 'dulce y ajoso, maduro');
eq('"y" becomes "e" before i-', T.tr('ripe and ice'), 'maduro y hielo');
eq('runs of sentences', T.tr('Nothing yet. The window is narrow.'), 'Todavía nada. La ventana es estrecha.');
eq('case-insensitive fallback keeps case', T.tr('salt'), 'sal');
eq('element placeholder survives', T.tr(`Hello ${OPEN}0${CLOSE}!`), `¡Hola ${OPEN}0${CLOSE}!`);
// Found in play: a generic template must not swallow a whole paragraph that starts with its words.
const PARAGRAPH = 'One spore, two different koji. You are choosing what it will taste like. ' + OPEN + '0' + CLOSE;
eq('generic "One {0}" does not claim a paragraph', T.trFlat(PARAGRAPH), PARAGRAPH);
eq('the paragraph has its own key', T.tr('One spore, two different koji. You are choosing what it will taste like.'), 'Una misma espora, dos koji distintos. Estás eligiendo a qué sabrá.');
// Found in play: "A." in a genus name is not a sentence boundary.
eq('genus abbreviation inside a capture', T.tr('Buy 1 A. Oryzae Spores for $15'), 'Comprar 1 A. Oryzae Spores por $15');
// Found in play: a comma inside a key must not be split.
eq('greedy longest span over commas', T.tr('Bittersweet and tangy, with spice'), 'Agridulce y ácido, con especias');
eq('captured state word', T.tr('humidity holding'), 'humedad estable');
eq('empty placeholder (plural suffix)', T.tr('1 unit'), '1 pieza');
eq('plural suffix', T.tr('3 units'), '3 piezas');
eq('trailing parenthesis', T.tr('The Lemon House (for sale)'), 'La casa de los limoneros (en venta)');
eq('bare form of a key that starts with a separator', T.tr('4 still locked'), '4 bloqueados');
eq('en-dash ranges', T.tr('Dec–Mar'), 'Dic–Mar');

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);

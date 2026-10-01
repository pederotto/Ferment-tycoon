import { FermentType, GameState } from './types';
import { BOOKS, INGREDIENTS, RECIPES } from './constants';
import { calculateOverheads } from './services/gameLogic';
import { crewWages } from './services/crew';

/* =============================================================================
   THE STORY

   The player won a blind tasting and was offered half the name over the door of
   a craft ferment house by an older mentor, Mr. Master. The story and the
   tutorial are one thing: each chapter is a beat and a lesson, and each ends
   with something the player earned. The antagonist is not a person; it is the
   system — uniform batches, erased seasons, fields turned into suppliers.

     0. The Letter    — name entry, three pages, the terms (LetterScene.tsx)
     1. The Bench     — six koji steps, each with a margin note; the first bill
     2. The Primer    — the book, one example by it, one by instinct

   Chapters 3 to 6 (the counter, the crew, the estate, the wild) are not written.

   HOW IT REMEMBERS. Each beat fires once per run and is recorded in
   `story.seen`. A save from before the story existed carries 'legacy' in that
   list (services/persistence.ts) and is never shown a card. The clock is held
   while a card is open (App.tsx `menuHoldRef`).
   ============================================================================= */

export const MASTER = 'Mr. Master';

/** Titles for the guide's header: "Chapter 2 · The Primer · 1/4". */
export const CHAPTER_TITLES: Record<number, string> = { 1: 'The Bench', 2: 'The Primer' };

/** What the player is called after the letter; before they are asked, "partner". */
export const storyName = (g: GameState) => (g.playerName || '').trim() || 'partner';

/** The week's bill as the ledger would charge it now: rent, upkeep of what you own, wages. */
export const storyBills = (g: GameState) =>
  calculateOverheads(g.ownedVessels ?? {}, 0, crewWages(g.crew ?? [])).total;

/** The letter on the title screen: three pages, a paragraph list each. */
export const LETTER_PAGES: string[][] = [
  [
    'You won the tasting. That is not why I am writing.',
    'Twelve jars, no labels. Every person at that table could tell the old ferments from the factory ones. A child could; it is not hard to taste that something is different. You were the only one who wrote down why.',
    'The bitterness in the third jar, which you put down to barley dried in a wet August. The smoke in the fifth, that nobody had meant to put there. The sixth you called “made by someone in a hurry to leave.” Two of those were guesses. Ten were right.',
  ],
  [
    'Where you learned your trade, a ferment is measured by how fast it becomes money. It is a good system, and it is the reason no one has tasted a year in a jar for a generation.',
    'It makes every batch the same, every season disappear, and every field a supplier. It has never once had to be right about anything except the price.',
  ],
  [
    'I am the last person I know who can taste a place in a jar, and I will not be here forever. I am not offering you a job. I am offering you half the name over the door, the bench, the cellar and the land.',
    'The roof leaks and the bills are real. Come and find out what the house is trying to say.',
  ],
];

/** The margin note under each guide step, in Mr. Master's hand. Keyed by step id. */
export const STEP_NOTES: Record<string, string> = {
  inoculate: 'Barley and spores. Nothing here you can badly spoil, which is why we begin with it.',
  fill: 'Empty space is rent paid for nothing. I learned that the expensive way.',
  steer: 'One spore, two different koji. You are choosing what it will taste like before it has a taste.',
  chamber: 'A koji bed makes its own heat. Left alone it will cook itself.',
  watch: 'The trace remembers what you forgot. Trust it over your memory.',
  cellar: 'Anyone can sell a koji. Keep it, and you have made your first tool.',
  read: 'Do not read it all at once. Read the page for whatever you are about to make.',
  book: 'The first time, follow the recipe. You cannot break a rule you have not learned.',
  instinct: 'Being wrong once is allowed. It goes in the margins.',
  sell: 'The Co-op will take anything honest. Vary what you bring: a market forgets a good thing quickly.',
  report: 'Read the post-mortem before you make the next one. The useful lines are always in the margins.',
  lineage: 'In time your spores remember your bench. That is what a strain is.',
};

/* -----------------------------------------------------------------------------
   The koji product test. It lived in the guide; the story asks the same question
   (the Primer is handed over the moment the first koji is kept), so it lives here
   and the guide imports it.
   ----------------------------------------------------------------------------- */
export const hasKojiProduct = (g: GameState) =>
  Object.entries(g.inventory).some(([id, n]) =>
    n > 0 && (g.customIngredients.some(c => c.id === id && c.enzymes) ||
              INGREDIENTS.some(i => i.id === id && i.enzymes)));

/**
 * Has the player brought a koji through to the end, kept OR sold? Selling one
 * removes the batch and leaves no koji in the pantry, so every koji step that
 * reads a live batch or the pantry could never pass again, and the guide sat on
 * it for good. Sold or kept, the lesson of the bench has been had.
 */
export const madeKoji = (g: GameState) =>
  (g.analyzedRecipeIds ?? []).some(id => RECIPES.find(r => r.id === id)?.type === FermentType.KOJI);

/* -----------------------------------------------------------------------------
   THE PRIMER — one page per class of ferment: what it is, what it wants, the
   levers, one example to make, an instinct hint, and a margin note. It is the
   existing `primer_bench` book, upgraded; recipe knowledge already has three
   states and a book makes its recipes known.
   ----------------------------------------------------------------------------- */
export interface PrimerClass {
  type: FermentType;
  name: string;
  /** The recipe the page walks through. Every one is buyable with kit the player owns, or says what it needs. */
  example: string;
  what: string;
  wants: string;
  levers: string[];
  instinct: string;
  margin: string;
}

export const PRIMER_CLASSES: PrimerClass[] = [
  {
    type: FermentType.KOJI,
    name: 'Koji',
    example: 'barley_koji',
    what: 'A mould, Aspergillus oryzae, grown on steamed grain. It is not the food; it is the workforce. It makes enzymes: amylase, which turns starch into sugar, and protease, which cuts protein into the amino acids that taste savoury.',
    wants: 'Warmth around 30 degrees, damp air, and something to breathe. A bed of koji makes its own heat, and left alone it will cook itself.',
    levers: [
      'Vent sheds heat, and moisture with it.',
      'Mist adds water and cools as it dries.',
      'Warm and wet grows amylase. Cool and dry grows protease.',
    ],
    instinct: 'Any grain or bean will take spores on an open tray. Older grains make a koji with more character.',
    margin: 'Do not sell your first one. Keep it.',
  },
  {
    type: FermentType.MISO,
    name: 'Miso and pastes',
    example: 'shiro_miso',
    what: 'Koji, something rich in protein, and salt, shut in a jar. The enzymes cut the protein slowly into savour and the starch into sweetness, while the salt keeps everything else out.',
    wants: 'Enough salt to be safe and little enough to let the enzymes work, roughly five to twelve percent, and a great deal of patience. Warmer is faster and sweeter. Colder is slower and deeper.',
    levers: [
      'Salt sets safety and pace. Too little spoils; too much and nothing happens.',
      'More koji means more enzyme and a sweeter paste.',
      'Pastes mature. Time in the cellar improves them.',
    ],
    instinct: 'Koji, any protein-rich bean or nut, and salt in a jar. The bench will improvise a miso from whatever you give it.',
    margin: 'White miso is the young one. Leave it long enough and it becomes the red one.',
  },
  {
    type: FermentType.LACTO,
    name: 'Lacto-ferments',
    example: 'sauerkraut',
    what: 'Lactic acid bacteria that already live on the vegetable. Give them a little salt and no air and they sour it themselves, and crowd out everything that would rot it. It is not a pickle in vinegar, and not a brine bath. It is a living ferment.',
    wants: 'Two to five percent salt by weight, everything kept under its own liquid, and cool steady temperatures. Warm goes quickly and flat. Cool goes slowly and complex.',
    levers: [
      'Salt: two to five percent. Under two is a gamble; over five it stalls.',
      'Keep it under the liquid. Air is the only real enemy.',
      'Temperature sets the tempo. Ten degrees colder can mean a month longer.',
    ],
    instinct: 'Any firm vegetable or fruit, a little salt, a jar or a crock, and no koji. The bench will improvise it.',
    margin: 'Cabbage and salt. The simplest ferment there is, and the one most people ruin by opening it to look.',
  },
  {
    type: FermentType.ALCOHOL,
    name: 'Alcoholic ferments',
    example: 'tepache',
    what: 'Yeast eating sugar and giving back alcohol and gas. Wild yeasts ride on fruit skins, so a sweet liquid and a warm room are nearly all it asks.',
    wants: 'Sugar, warmth around twenty to twenty-six degrees, and a way for the gas to leave. Once it is alcoholic, air becomes a problem, because another organism turns it to vinegar.',
    levers: [
      'Sugar sets the strength.',
      'Ventilate: let the gas out, keep the air out.',
      'Warm is fast and rough. Cool is slow and clean.',
    ],
    instinct: 'Sugar, water and any fruit or sweet scrap in a jar, an onggi or a barrel. What you get, from soda to wine, depends on how long you wait.',
    margin: 'Pineapple rind. The cheapest lesson in the house.',
  },
  {
    type: FermentType.KOMBUCHA,
    name: 'Kombucha',
    example: 'kombucha',
    what: 'A raft of yeast and acetic bacteria, the SCOBY, floating on sweet tea. The yeast makes alcohol, the bacteria turn it to acid, and the raft keeps the air off.',
    wants: 'Sweet tea, warmth near twenty-four degrees, and a SCOBY to start it. About a week to ten days, and it keeps souring until you stop it.',
    levers: [
      'Sugar feeds it. Too little starves it; too much is wasted.',
      'Taste it often. The window between sweet and vinegar is short.',
      'The SCOBY is alive. Keep it for the next batch.',
    ],
    instinct: 'Tea, a SCOBY and sugar in a jar. Other sweet liquids work too: the fruit and tomato kombuchas are the same raft on a different food.',
    margin: 'Be patient with the first one. It always tastes like a mistake on day three.',
  },
  {
    type: FermentType.SHOYU,
    name: 'Shoyu and sauces',
    example: 'tamari',
    what: 'Soybeans, koji and strong brine, left for months and stirred. What runs from the press is soy sauce. The same idea works on mushrooms, pulses and tomatoes.',
    wants: 'Around fourteen percent salt, steady warmth, a large vessel and a season of patience. A stir now and then keeps the mash even.',
    levers: [
      'Salt near fourteen percent: strong enough to hold, weak enough to work.',
      'Stir. The mash separates, and each layer ferments differently.',
      'Press it when it is done, not when you are.',
    ],
    instinct: 'A protein-rich bean or mushroom with koji, salt and water in a crock will make an amino sauce.',
    margin: 'You are not ready for this one. Read it anyway.',
  },
  {
    type: FermentType.GARUM,
    name: 'Garum and fish sauces',
    example: 'nuoc_mam',
    what: 'Fish, or anything rich in protein, packed in a great deal of salt and left in the warm. It digests itself with its own enzymes, and what drains off is liquid savour.',
    wants: 'About a quarter salt by weight and a warm place. Or, the modern way, koji and heat near sixty degrees with far less salt. What you must never do is lower both.',
    levers: [
      'Salt is the only safety, unless you add heat.',
      'Warmth speeds the enzymes. Cold makes it a very slow year.',
      'Do not open it to look. It smells like what it is.',
    ],
    instinct: 'Any animal protein with salt in a cask or a barrel. The bench will name it after whatever you used.',
    margin: 'The Romans ran an empire on this, and there was no refrigerator in it.',
  },
  {
    type: FermentType.VINEGAR,
    name: 'Vinegar',
    example: 'cider_vinegar',
    what: 'Two organisms in a row. Yeast turns sugar into alcohol; then Acetobacter turns the alcohol into acid, and that second step needs air the whole time.',
    wants: 'A sugary starting liquid, a warm room near twenty-four degrees, and an open, breathing vessel. The jelly that forms on top, the mother, is the culture.',
    levers: [
      'Ventilate: the second step stalls without air.',
      'Warm speeds it. Too cold and it sits at alcohol.',
      'Keep the mother and start the next batch from it.',
    ],
    instinct: 'Sugary fruit and water in a barrel will come to vinegar in its own time.',
    margin: 'Every wine left too long is a vinegar. Now do it on purpose.',
  },
  {
    type: FermentType.BLACK,
    name: 'Black ferments',
    example: 'black_garlic',
    what: 'Not a ferment at all. No microbe survives it. It is the Maillard reaction, sugars meeting amino acids, run slowly for weeks in warm humid air until garlic or fruit turns black, soft and sweet.',
    wants: 'About sixty degrees and eighty percent humidity, held steady for weeks, in a chamber that can hold a temperature.',
    levers: [
      'Temperature and humidity are the whole method.',
      'Too dry and it hardens. Too wet and it stews.',
      'Nothing is alive in there, so nothing can go wrong except you.',
    ],
    instinct: 'A firm, acid fruit or a bulb, no salt and no sugar, in the chamber.',
    margin: 'Save this one for when you can afford the box.',
  },
];

/** The recipe each page walks through. Making any one of them is "by the book". */
export const PRIMER_EXAMPLES = ['shiro_miso', 'sauerkraut', 'tepache', 'kombucha', 'tamari', 'nuoc_mam', 'cider_vinegar', 'black_garlic'];

/** Everything the Primer names, read off the book so the two cannot drift. Making anything else is "by instinct". */
export const PRIMER_KNOWN: string[] = BOOKS.find(b => b.id === 'primer_bench')?.teaches ?? [];

/**
 * Which page of the Primer a recipe belongs to. A named recipe carries its own
 * type; a generated one is read off its id prefix (`lacto_…_gen`, `amino_…`).
 */
export const primerClassOf = (id: string): FermentType | undefined => {
  const r = RECIPES.find(x => x.id === id);
  if (r) return r.type;
  const byPrefix: Record<string, FermentType> = {
    lacto: FermentType.LACTO,
    miso: FermentType.MISO,
    garum: FermentType.GARUM,
    amino: FermentType.SHOYU,
    black: FermentType.BLACK,
    cheong: FermentType.ALCOHOL,
  };
  return byPrefix[String(id).split('_')[0]];
};

/**
 * Has the player made something the Primer does not name? Not a recipe from a
 * book they own, and not a failure — the bench names whatever they have made.
 */
export const instinctDone = (g: GameState) =>
  (g.analyzedRecipeIds ?? []).some(id =>
    !PRIMER_KNOWN.includes(id) &&
    !BOOKS.some(b => (g.ownedBookIds ?? []).includes(b.id) && b.teaches.includes(id)) &&
    primerClassOf(id) !== undefined &&
    primerClassOf(id) !== FermentType.FAIL);

/* -----------------------------------------------------------------------------
   THE BEATS. One card each, shown once per run, in this order of precedence.
   `when` is read against the live state; `apply` is an optional pure side effect
   (the Primer is handed over); `card` is written when the beat fires.
   ----------------------------------------------------------------------------- */
export interface StoryCardData {
  kicker: string;
  title: string;
  paras: string[];
  cta: string;
}

export interface StoryBeat {
  id: string;
  when: (g: GameState) => boolean;
  /** Pure: it runs inside a state updater, which StrictMode calls twice. */
  apply?: (g: GameState) => GameState;
  card: (g: GameState) => StoryCardData;
}

export const STORY_BEATS: StoryBeat[] = [
  {
    id: 'ch1_open',
    when: () => true,
    card: g => ({
      kicker: 'Chapter 1 · The Bench',
      title: 'Start with koji',
      paras: [
        `${storyName(g)}, the bench is yours. Do not begin with the clever things. Begin with koji: the mould that does the work in half of what is on the shelves.`,
        'It will not sell, and that is the point. It is the first thing you will make that is not a product but a tool. Watch it. Notice what it does when you think it is doing nothing.',
      ],
      cta: 'To the bench',
    }),
  },
  {
    id: 'primer',
    // Kept or sold: a player who sold their first koji would otherwise never be
    // handed the book, and the guide's Chapter 2 asks them to read it.
    when: g => hasKojiProduct(g) || madeKoji(g) || g.logbook.some(l => !!l.record),
    apply: g => {
      const b = BOOKS.find(x => x.id === 'primer_bench');
      return b && !g.ownedBookIds.includes(b.id)
        ? { ...g, ownedBookIds: [...g.ownedBookIds, b.id], unlockedRecipes: Array.from(new Set([...g.unlockedRecipes, ...b.teaches])) }
        : g;
    },
    card: g => ({
      kicker: 'Chapter 2 · The Primer',
      title: 'A parcel on the bench',
      paras: [
        hasKojiProduct(g)
          ? 'You kept it instead of selling it. Most people cannot. So I have left you something.'
          : madeKoji(g)
            ? 'You sold it. Everyone does, the first time, and it was a fair price. I have left you something all the same.'
            : 'You went to market without the koji. That is allowed, and the bench will tell you what it cost. I have left you something all the same.',
        'It is my Primer: a page for each kind of ferment, with what it wants, the levers you hold, and one example to make. My notes are in the margins. It is in your Codex now. Follow the book if you like. I would rather you also tried one thing on instinct, and were wrong once. That is how the margins got written.',
      ],
      cta: 'Thank you',
    }),
  },
  {
    id: 'first_bill',
    when: g => g.year > 1 || g.month > 2 || g.week > 1,
    card: g => {
      const bills = storyBills(g);
      const weeks = Math.max(0, Math.floor(g.money / bills));
      return {
        kicker: 'The ledger',
        title: 'The first bill',
        paras: [
          `A week has gone, and the house has taken its share: about $${bills} for rent and upkeep. It does that whether or not anything is growing.`,
          `You have $${Math.round(g.money).toLocaleString()} in the till. That is ${weeks} more weeks if the bench stays empty, and a good deal more if it does not. Fill the vessels. An idle jar costs the same as a busy one.`,
        ],
        cta: 'Understood',
      };
    },
  },
  {
    id: 'ch2_close',
    when: g => PRIMER_EXAMPLES.some(id => (g.analyzedRecipeIds ?? []).includes(id)) && instinctDone(g),
    card: g => ({
      kicker: 'Chapter 2 · The Primer',
      title: 'Two ways of knowing',
      paras: [
        "One thing the book's way, and one thing your own. I would not want you to lose either habit.",
        `The book saves you years. The instinct is the part nobody can teach you, and it is the part I saw across a table of twelve jars. Keep writing in the margins, ${storyName(g)}.`,
        'There is a great deal on the shelves you cannot buy yet. That is a matter of who trusts you. We will come to it.',
      ],
      cta: 'Continue',
    }),
  },
];

/** Record a beat as shown. Pure, and idempotent so a repeated call cannot list it twice. */
export const markSeen = (g: GameState, id: string): GameState => {
  const seen = g.story?.seen ?? [];
  return seen.includes(id) ? g : { ...g, story: { ...(g.story ?? { seen: [] }), seen: [...seen, id] } };
};

import { FermentType } from './types';

/* =============================================================================
   THE TOWN

   Twelve people from the market town, each tied to a vendor or a supplier the
   game already has. Their errands are the story of a newcomer becoming part of
   the place: the crier cries your name, the innkeeper puts you in front of the
   co-op, and by the third chapter the monk, the minstrel and the mason trust you
   with their own business. The crier closes it with the Harvest Fair.

   Every errand asks for something the rest of the game already produces — a
   sale, a batch at a score, kilos off the estate, a place owned — and pays in
   something the rest of the game already reads: standing, an introduction that
   latches a vendor open, a supplier's level, a book, cash, renown. The town adds
   no new economy; it gives the existing one faces and a route through it.

   Rewards are handed over when the player goes back and reports, never on a
   tick. That keeps the whole thing pure (see services/town.ts) and makes each
   one a small scene rather than a notice.
   ============================================================================= */

/** What an errand asks for. Checked against the game state, never tracked. */
export type TownNeed =
  | { kind: 'sold'; buyerId?: string; count?: number }
  | { kind: 'cooked'; type?: FermentType; vesselId?: string; minScore: number; distinct?: number }
  | { kind: 'deliver'; bases?: string[]; classes?: string[]; kg: number; what: string }
  | { kind: 'pay'; amount: number }
  | { kind: 'standing'; buyerId: string; value: number }
  | { kind: 'renown'; value: number }
  | { kind: 'vessels'; count: number; vesselId?: string }
  | { kind: 'places'; count: number }
  | { kind: 'found'; count: number }
  | { kind: 'tells'; count: number }
  | { kind: 'errands'; count: number };

export interface TownReward {
  money?: number;
  renown?: number;
  reputation?: number;
  heat?: number;
  /** Standing added with these buyers. */
  standing?: Record<string, number>;
  /** An introduction: latches the vendor open whatever its own route asks. */
  introduce?: string;
  /** One level with a supplier: a 5% discount and the next shelf. */
  supplier?: string;
  /** A book, with its recipes. Already owned, half its price instead. */
  book?: string;
  /** Places added to the cellar. */
  cellar?: number;
}

export interface TownStep {
  /** What they ask, in their voice. */
  ask: string;
  need: TownNeed;
  /** What they say when you come back with it. */
  thanks: string;
  reward: TownReward;
}

export interface Townsperson {
  id: string;
  /** Key into TOWN_FACES. */
  face: string;
  name: string;
  trade: string;
  /** Where they are found, a line of colour. */
  where: string;
  /** 1 from the start; 2 after three errands; 3 after eight. */
  chapter: 1 | 2 | 3;
  /** The vendor or supplier they speak for, shown on the card. */
  linked?: { buyerId?: string; supplierId?: string };
  steps: TownStep[];
}

/** Errands done before each chapter's people are about. */
export const TOWN_CHAPTER_AT: Record<1 | 2 | 3, number> = { 1: 0, 2: 3, 3: 8 };
export const TOWN_CHAPTER_NAME: Record<1 | 2 | 3, string> = {
  1: 'A new face at the market',
  2: 'Known on the quay',
  3: 'One of the town',
};

const GROWN = ['tomato', 'chili', 'berries', 'brassica', 'allium', 'pulse', 'grain', 'corn', 'orchard', 'citrus'];

export const TOWNSFOLK: Townsperson[] = [
  /* ---------------- CHAPTER ONE ---------------- */
  {
    id: 'tobias', face: 'crier', name: 'Tobias Bell', trade: 'Town crier',
    where: 'On the steps of the market cross, bell in hand.',
    chapter: 1, linked: { buyerId: 'food_blogger' },
    steps: [
      {
        ask: 'Sell a batch, any batch, to anyone who will pay for it. I do not cry the name of a workshop that has never sold a jar.',
        need: { kind: 'sold', count: 1 },
        thanks: 'Hear ye! A new culture house on the hill! I will say it twice on market day, and louder.',
        reward: { renown: 4, reputation: 3 },
      },
      {
        ask: 'Get yourself talked about. When the town knows your name without me, I will take you to the girl with the camera.',
        need: { kind: 'renown', value: 20 },
        thanks: 'She has been asking who makes the jars with the painted labels. I told her.',
        reward: { standing: { food_blogger: 15 }, renown: 5 },
      },
      {
        ask: 'Do right by this town, all of it, and at harvest I will cry you a fair. Twenty errands, and they had better be honest.',
        need: { kind: 'errands', count: 20 },
        thanks: 'OYEZ! The Harvest Fair is yours! Stalls from the cross to the quay, and every one of them pouring something you made.',
        reward: { money: 600, renown: 25, reputation: 10 },
      },
    ],
  },
  {
    id: 'marta', face: 'innkeeper', name: 'Marta Brun', trade: 'Keeps The Crooked Tap',
    where: 'Behind the bar at the Tap, where the co-op meets on Thursdays.',
    chapter: 1, linked: { buyerId: 'culinary_coop' },
    steps: [
      {
        ask: 'My hens stopped laying and the breakfast trade does not. Three kilos of eggs, and I will put a word in at the co-op.',
        need: { kind: 'deliver', bases: ['egg_yolks'], kg: 3, what: 'eggs' },
        thanks: 'Yolks like marigolds. The co-op buyer ate two and asked where they came from.',
        reward: { money: 60, standing: { culinary_coop: 10 } },
      },
      {
        ask: 'Make yourself a regular with the co-op and I will take you round to the Jar. The owner drinks here; he owes me.',
        need: { kind: 'standing', buyerId: 'culinary_coop', value: 35 },
        thanks: 'He says bring something alive. His words. I would not have said it that way.',
        reward: { introduce: 'hipster_deli', standing: { hipster_deli: 10 } },
      },
    ],
  },
  {
    id: 'pip', face: 'farmhand', name: 'Pip Garrow', trade: 'Farm lad, loads the supermarket lorry',
    where: 'At the loading bay behind SuperSave, sitting on a crate.',
    chapter: 1, linked: { buyerId: 'mega_mart', supplierId: 'nordic' },
    steps: [
      {
        ask: 'Nordic want to see what the hill grows before they give anyone a better price. Ten kilos off your own land, whatever you have.',
        need: { kind: 'deliver', classes: GROWN, kg: 10, what: 'produce grown on the estate' },
        thanks: 'I told them it was grown up at the old farmhouse. They looked at it for a long time.',
        reward: { supplier: 'nordic', standing: { mega_mart: 8 } },
      },
      {
        ask: 'Get three bits of that land working. SuperSave and the schools only buy from people who can keep up.',
        need: { kind: 'places', count: 3 },
        thanks: 'I put your name on the clipboard. Both clipboards.',
        reward: { money: 150, standing: { mega_mart: 10, school_district: 10 } },
      },
    ],
  },
  {
    id: 'bram', face: 'smith', name: 'Bram Hollis', trade: 'Blacksmith, fits out workshops',
    where: 'At the forge by the ford, in a leather apron that has seen everything.',
    chapter: 1, linked: { supplierId: 'tech' },
    steps: [
      {
        ask: 'A bench with one jar on it is a hobby. Show me three vessels working and I will vouch for you at Lab Tech.',
        need: { kind: 'vessels', count: 3 },
        thanks: 'That is a workshop. I have told Lab Tech to treat you as trade.',
        reward: { supplier: 'tech' },
      },
      {
        ask: 'Six vessels, and I will get you on their regulars list. They keep the good machines behind the counter.',
        need: { kind: 'vessels', count: 6 },
        thanks: 'Six. Your bench sounds like my forge on a Monday. Their next shelf is open to you.',
        reward: { supplier: 'tech', money: 100 },
      },
    ],
  },

  /* ---------------- CHAPTER TWO ---------------- */
  {
    id: 'nonna', face: 'spinner', name: 'Nonna Pia Ferraro', trade: 'Spinner, and keeper of old recipes',
    where: 'At her wheel in the window over the bakery, watching everyone.',
    chapter: 2, linked: { buyerId: 'fine_dining' },
    steps: [
      {
        ask: 'My chest is bad in the autumn. Two kilos of honey from your own bees, not the shop kind.',
        need: { kind: 'deliver', bases: ['honey'], kg: 2, what: 'honey' },
        thanks: 'Dark, and it tastes of the chestnuts on the hill. My mother kept bees there.',
        reward: { renown: 5, money: 40 },
      },
      {
        ask: 'When I was a girl we poured the fish sauce from a hole in the barrel. Make me a garum worth 80 and I will send it to my grandson. He cooks at L\'Etoile.',
        need: { kind: 'cooked', type: FermentType.GARUM, minScore: 80 },
        thanks: 'He telephoned. He never telephones. He wants to meet you, and you will wear a clean shirt.',
        reward: { introduce: 'fine_dining', standing: { fine_dining: 10 } },
      },
    ],
  },
  {
    id: 'wren', face: 'herbalist', name: 'Old Wren', trade: 'Herbalist and hedge-woman',
    where: 'On the lane to the woods with a basket, never where you left her.',
    chapter: 2, linked: { supplierId: 'hedge_understory' },
    steps: [
      {
        ask: 'Find three things the land grows by itself. Then we will talk about what the forager keeps under the counter.',
        need: { kind: 'found', count: 3 },
        thanks: 'Three. And you did not poison yourself. The forager will sell to you as she sells to me.',
        reward: { supplier: 'hedge_understory' },
      },
      {
        ask: 'Learn four tells: the gill, the ring, the smell, the bruise. A picker who knows the lookalikes is a picker I trust.',
        need: { kind: 'tells', count: 4 },
        thanks: 'Now you see the wood the way it is. She has put her best by for you.',
        reward: { supplier: 'hedge_understory', money: 120 },
      },
    ],
  },
  {
    id: 'aldo', face: 'captain', name: 'Captain Aldo Ferro', trade: 'Master of the coaster Stella',
    where: 'On the quay by the Silk Road warehouse, watching the tide.',
    chapter: 2, linked: { supplierId: 'asia_import' },
    steps: [
      {
        ask: 'Ship\'s cook swears by pan salt. Ten kilos from your own pans and I will carry your name to the importers.',
        need: { kind: 'deliver', bases: ['salt', 'noma_salt'], kg: 10, what: 'sea salt from your pans' },
        thanks: 'Grey and wet, like it should be. Silk Road will give you the ship\'s rate.',
        reward: { supplier: 'asia_import' },
      },
      {
        ask: 'A soy sauce that keeps a crew fed for six weeks at sea. Score it 75 or better and the whole hold is open to you.',
        need: { kind: 'cooked', type: FermentType.SHOYU, minScore: 75 },
        thanks: 'Tastes of the harbour in Kobe. The next cargo, you have first pick.',
        reward: { supplier: 'asia_import', money: 300 },
      },
    ],
  },
  {
    id: 'hob', face: 'cooper', name: 'Hob Tanner', trade: 'Cooper',
    where: 'In the yard behind the Alchemist Bar, bending hoops.',
    chapter: 2, linked: { buyerId: 'mixologist' },
    steps: [
      {
        ask: 'Buy an oak cask. Mine or anyone\'s. I want to see what you put in it.',
        need: { kind: 'vessels', count: 1, vesselId: 'oak_cask' },
        thanks: 'Good oak. The bar buys my barrels back when they are seasoned. I will tell them whose they were.',
        reward: { introduce: 'mixologist' },
      },
      {
        ask: 'Now take something out of that cask worth 80. Wood takes its time, and so will you.',
        need: { kind: 'cooked', vesselId: 'oak_cask', minScore: 80 },
        thanks: 'That is what the oak is for. They have a drink on the list now, and your cask is in it.',
        reward: { standing: { mixologist: 12 }, renown: 5 },
      },
    ],
  },

  /* ---------------- CHAPTER THREE ---------------- */
  {
    id: 'anselm', face: 'monk', name: 'Brother Anselm', trade: 'Cellarer of the abbey',
    where: 'In the abbey scriptorium, copying out the cellar book.',
    chapter: 3, linked: { buyerId: 'pharma' },
    steps: [
      {
        ask: 'Our mead has failed three years running and the abbot blames the bees. Brew me something worth 70 and prove him wrong.',
        need: { kind: 'cooked', type: FermentType.ALCOHOL, minScore: 70 },
        thanks: 'The abbot drank it and said nothing, which is his highest praise. The cellar is grateful.',
        reward: { money: 250, reputation: 5 },
      },
      {
        ask: 'The infirmary needs a vinegar sound enough for tinctures. Score 80 and I will write to the apothecaries who buy for Zenith.',
        need: { kind: 'cooked', type: FermentType.VINEGAR, minScore: 80 },
        thanks: 'Clear, and sharp enough to clean a wound. My letter is sealed and gone.',
        reward: { introduce: 'pharma', standing: { pharma: 10 } },
      },
    ],
  },
  {
    id: 'lila', face: 'minstrel', name: 'Lila Moreno', trade: 'Minstrel',
    where: 'Under the arches at the Night Market, and at the bar after.',
    chapter: 3, linked: { buyerId: 'night_market' },
    steps: [
      {
        ask: 'Sell something at the Night Market. After that I hear who is asking about you, and I will tell you.',
        need: { kind: 'sold', buyerId: 'night_market', count: 1 },
        thanks: 'The inspector\'s clerk drinks where I play. He is bored of your name now. I made sure of it.',
        reward: { heat: -20 },
      },
      {
        ask: 'Become a regular at the Alchemist and I will write you a song. The bar will pour whatever the song is about.',
        need: { kind: 'standing', buyerId: 'mixologist', value: 35 },
        thanks: 'It is called "The Jar on the Hill". They play it every night. They are sick of it.',
        reward: { renown: 10, standing: { mixologist: 8 } },
      },
    ],
  },
  {
    id: 'jory', face: 'mason', name: 'Jory Stone', trade: 'Mason',
    where: 'On a ladder at the abbey wall, or at the Tap with lime on his boots.',
    chapter: 3,
    steps: [
      {
        ask: 'My mother\'s garden is all clay. Twenty kilos of good compost and I owe you a day\'s work.',
        need: { kind: 'deliver', bases: ['compost'], kg: 20, what: 'hot compost' },
        thanks: 'She says it smells like a forest floor. She says it is the first thing I have brought home that does.',
        reward: { money: 100 },
      },
      {
        ask: 'That cellar of yours has two more bays behind the rubble. Four hundred for lime and stone and I will open them.',
        need: { kind: 'pay', amount: 400 },
        thanks: 'Two bays, dry and cool, pointed with lime so they breathe. Fill them with something old.',
        reward: { cellar: 2 },
      },
    ],
  },
  {
    id: 'sarojini', face: 'elder', name: 'Auntie Sarojini', trade: 'Spice merchant',
    where: 'At the spice stall under the clock, where every cook in town ends up.',
    chapter: 3, linked: { buyerId: 'sichuan_house' },
    steps: [
      {
        ask: 'Two kilos of chilies you grew yourself. I can tell the shop ones from across the square.',
        need: { kind: 'deliver', bases: ['chili'], kg: 2, what: 'chilies from your tunnel' },
        thanks: 'Thin skins, a good burn. Han will take a paste made with these. I will tell him.',
        reward: { standing: { korean_bbq: 10 } },
      },
      {
        ask: 'Make a paste worth 80. The red kitchens in this town are run by cooks who trust me; they will trust you after.',
        need: { kind: 'cooked', type: FermentType.MISO, minScore: 80 },
        thanks: 'This is a jang. Take my book, it is older than both of us, and go and see the Red Dragon.',
        reward: { book: 'tome_jang', introduce: 'sichuan_house' },
      },
    ],
  },
];

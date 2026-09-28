import type { GroundId, WildKind } from './types.farm';

/* =============================================================================
   THE WILD: what grows where, when, what it can be mistaken for, and how to tell

   Ported from the Understory prototype. Seasons are game months (0 = January).
   `n` is how many pieces a find carries at full patch vigour and `piece` the
   kilos of a prime one. The lookalikes are real, and so are their tells.
   Coordinates (`at`) are on each ground's own plate: the owner's paintings, all
   at 480x270.
   ============================================================================= */

export interface WildSpec { season: number[]; piece: number; n: [number, number]; kind: WildKind; note?: string }

export const WILD: Record<string, WildSpec> = {
  maitake: {"season": [8, 9, 10], "piece": 0.2, "n": [5, 8], "kind": "mushroom"},
  ceps: {"season": [7, 8, 9], "piece": 0.16, "n": [2, 5], "kind": "mushroom", "note": "The van sells ceps all year. They only grow August to October."},
  winter_ceps: {"season": [9, 10, 11, 0], "piece": 0.03, "n": [7, 10], "kind": "mushroom"},
  lions_mane: {"season": [8, 9, 10], "piece": 0.32, "n": [1, 3], "kind": "mushroom"},
  shimeji: {"season": [8, 9, 10, 11], "piece": 0.11, "n": [4, 7], "kind": "mushroom"},
  nameko: {"season": [9, 10, 11, 0, 1], "piece": 0.07, "n": [5, 8], "kind": "mushroom"},
  black_poplar: {"season": [2, 3, 4, 8, 9, 10], "piece": 0.13, "n": [4, 7], "kind": "mushroom"},
  blue_oyster: {"season": [9, 10, 11, 0, 1, 2], "piece": 0.14, "n": [4, 7], "kind": "mushroom"},
  enoki: {"season": [10, 11, 0, 1, 2], "piece": 0.05, "n": [5, 8], "kind": "mushroom", "note": "Wild enoki is the velvet shank: short, orange and velvet-stemmed, nothing like the pale cultivated threads."},
  haskap: {"season": [5, 6], "piece": 0.12, "n": [5, 8], "kind": "fruit"},
  white_strawberry: {"season": [5, 6, 7], "piece": 0.07, "n": [6, 10], "kind": "fruit"},
  king_stropharia: {"season": [4, 5, 6, 7, 8, 9], "piece": 0.2, "n": [4, 8], "kind": "mushroom"},
  sea_buckthorn: {"season": [8, 9, 10], "piece": 0.2, "n": [5, 8], "kind": "fruit"},
  cloudberries: {"season": [6, 7], "piece": 0.09, "n": [6, 10], "kind": "fruit"},
  pine_needles: {"season": [3, 4, 5], "piece": 0.05, "n": [6, 10], "kind": "tips"},
  hazelnuts: {"season": [7, 8], "piece": 0.12, "n": [5, 8], "kind": "nut"},
  mackerel: {"season": [5, 6, 7, 8], "piece": 0.35, "n": [3, 8], "kind": "fish"},
  anchovies: {"season": [6, 7, 8, 9], "piece": 0.18, "n": [4, 8], "kind": "fish"},
  herring: {"season": [8, 9, 10], "piece": 0.25, "n": [4, 8], "kind": "fish"},
  shrimp_fry: {"season": [6, 7, 8], "piece": 0.12, "n": [4, 8], "kind": "shrimp"},
};
export const WILD_ORDER = ["maitake", "ceps", "winter_ceps", "lions_mane", "shimeji", "nameko", "black_poplar", "blue_oyster", "enoki", "haskap", "white_strawberry", "king_stropharia", "sea_buckthorn", "cloudberries", "pine_needles", "hazelnuts", "mackerel", "anchovies", "herring", "shrimp_fry"];

/** What young, prime and past mean for each kind of thing. */
export const STATE_WORDS: Record<string, { young: string; prime: string; past: string; help: string }> = {
  mushroom: {"young": "young", "prime": "prime", "past": "past it", "help": "Prime is what you came for. Young pieces are next week’s, and past ones are shedding the spore that brings the patch back."},
  fruit: {"young": "unripe", "prime": "ripe", "past": "over", "help": "Take the ripe. Unripe fruit is sour and poor, and what is over feeds the birds that plant the next bushes."},
  tips: {"young": "new shoot", "prime": "soft tip", "past": "old needles", "help": "Take the soft tips. The new leading shoots are the tree’s whole year of growth: take those and the pine stalls. Old needles are bitter."},
  nut: {"young": "green", "prime": "brown", "past": "squirrelled", "help": "Brown in the husk is ripe. Green nuts are milky and will not keep. Whatever is left past mid-September is the squirrels’."},
  fish: {"young": "undersize", "prime": "prime", "past": "in roe", "help": "Undersize fish go back, and so do fish full of roe: they are next year’s shoal."},
  shrimp: {"young": "small", "prime": "prime", "past": "berried", "help": "Berried hens carry eggs under the tail. Put them back and the bar stays full."},
};

export interface IdTest { id: string; label: string; real: string; fake: string; meaning: string; needs?: string }
export interface Lookalike {
  fake: string; latin: string;
  /** What a wrong call costs: a poor thing, a ruined vessel, or a dead one. */
  stake: 'poor' | 'ruin' | 'deadly';
  fakeQ: number;
  /** The chance a find is the lookalike. */
  p: number;
  /** The same shrub every year (the hedge): real or not is fixed per estate. */
  stable?: boolean;
  base: string; tests: IdTest[];
  right: string; wrong: string; leftRight: string; leftWrong: string;
}
export const LOOKALIKES: Record<string, Lookalike> = {
  maitake: {"fake": "Giant Polypore", "latin": "Meripilus giganteus", "stake": "poor", "fakeQ": 41, "p": 0.3, "base": "A rosette of overlapping grey-brown fronds at the foot of a hardwood.", "tests": [{"id": "handle", "label": "Handle an edge", "real": "The edge stays pale where you held it.", "fake": "The edge bruises black within minutes.", "meaning": "Maitake stays pale. Giant polypore bruises black."}, {"id": "fronds", "label": "Look at the fronds", "real": "Dozens of fronds, each about the size of a spoon.", "fake": "A few broad fans, each a hand wide.", "meaning": "Maitake is many small fronds. Giant polypore is a few big fans."}, {"id": "snap", "label": "Snap a frond", "real": "Tender. It snaps cleanly.", "fake": "Tough and fibrous toward the base.", "meaning": "Maitake snaps. Giant polypore is leathery."}], "right": "Maitake. Full quality, and this tree is yours for as long as you look after it.", "wrong": "It was giant polypore: edible, harmless, leathery, and black wherever you touched it. Quality 41 against 88.", "leftRight": "Giant polypore, rightly left. Next time you will know it at a glance.", "leftWrong": "It was maitake. You left good food at the foot of the tree."},
  ceps: {"fake": "Bitter Bolete", "latin": "Tylopilus felleus", "stake": "ruin", "fakeQ": 0, "p": 0.3, "base": "A fat brown cap on a pale, swollen stem, in the grass under the oak.", "tests": [{"id": "pores", "label": "Look under the cap", "real": "Pores white, going olive-yellow with age.", "fake": "Pores flushed pink.", "meaning": "Ceps have white to yellow pores. The bitter bolete’s turn pink."}, {"id": "net", "label": "Look at the stem", "real": "A fine white net at the top of the stem.", "fake": "A coarse dark-brown net down the stem.", "meaning": "A cep’s net is fine and pale. The bitter bolete’s is coarse and dark."}, {"id": "taste", "label": "Touch a crumb to your tongue, and spit", "real": "Mild and nutty.", "fake": "Fiercely bitter. You spit twice.", "meaning": "Ceps taste of little raw. One bitter bolete ruins a whole pot."}], "right": "A cep. The best thing in this wood.", "wrong": "It was a bitter bolete: not poisonous, just bitter enough to ruin everything else in the vessel.", "leftRight": "Bitter bolete, rightly left.", "leftWrong": "It was a cep. You left $150 a pound in the grass."},
  black_poplar: {"fake": "Funeral Bell", "latin": "Galerina marginata", "stake": "deadly", "fakeQ": 0, "p": 0.35, "base": "Brown caps in a tight cluster low on a cut stump, with a ring on the stem.", "tests": [{"id": "size", "label": "Measure the caps", "real": "Caps 4 to 10 cm, wrinkling with age.", "fake": "Caps 1 to 4 cm, turning two-toned as they dry.", "meaning": "Black poplar is the bigger mushroom. Galerina is small and changes colour as it dries."}, {"id": "ring", "label": "Look at the ring", "real": "A membranous skirt, and it holds.", "fake": "Thin and fibrous, half gone already.", "meaning": "Black poplar’s ring is a skirt. Galerina’s is a thread."}, {"id": "spore", "label": "Take a spore print", "real": "The print comes up dark tobacco brown.", "fake": "The print comes up rusty brown.", "meaning": "Black poplar prints tobacco brown. Galerina prints rusty brown."}], "right": "Black poplar. Firm and nutty, and it holds its shape through a long ferment.", "wrong": "It was Galerina marginata, the funeral bell, with the same toxins as a death cap. It goes on the heap, and you go home shaken.", "leftRight": "Funeral bell, rightly left. The stump is marked on your map.", "leftWrong": "It was black poplar. With Galerina on the same wood, leaving it was a sound instinct."},
  enoki: {"fake": "Funeral Bell", "latin": "Galerina marginata", "stake": "deadly", "fakeQ": 0, "p": 0.35, "base": "Small orange-brown caps, sticky in the wet, in a clump on a winter stump.", "tests": [{"id": "stem", "label": "Feel the stem", "real": "Velvety, dark brown toward the base.", "fake": "Smooth and pale, streaked with fibres.", "meaning": "Velvet shank has a velvet stem. Galerina’s is smooth and fibrous."}, {"id": "ring", "label": "Look for a ring", "real": "No ring at all.", "fake": "A thin, fibrous ring.", "meaning": "Velvet shank has no ring. Galerina has one, however faint."}, {"id": "spore", "label": "Take a spore print", "real": "The print comes up white.", "fake": "The print comes up rusty brown.", "meaning": "Velvet shank prints white. Galerina prints rusty brown."}], "right": "Velvet shank: wild enoki.", "wrong": "It was Galerina marginata. This is the famous confusion, and the reason velvet shank is taught with a spore print.", "leftRight": "Funeral bell, rightly left.", "leftWrong": "It was velvet shank. You left it."},
  haskap: {"fake": "Black Twinberry", "latin": "Lonicera involucrata", "stake": "ruin", "fakeQ": 0, "p": 0.35, "stable": true, "base": "Dark berries on a honeysuckle shrub by the gate.", "tests": [{"id": "bloom", "label": "Rub a berry", "real": "A pale waxy bloom comes off on your thumb; it is blue underneath.", "fake": "Glossy black. Nothing comes off.", "meaning": "Haskap is blue under a bloom. Twinberry is glossy black."}, {"id": "bracts", "label": "Look behind the leaves", "real": "Single oblong berries on short stalks.", "fake": "Berries in pairs, cupped by red-purple bracts.", "meaning": "Haskap hangs singly. Twinberry sits in pairs in red bracts."}, {"id": "flower", "label": "Remember when it flowered", "real": "It flowered in March, before its leaves.", "fake": "It flowered in May, yellow, in pairs.", "meaning": "Haskap flowers in March. Twinberry flowers in May.", "needs": "flower"}], "right": "Haskap. Tart, early, and enough acid to carry a ferment on its own.", "wrong": "It was black twinberry. Bitter, and it makes people sick. In a vessel it ruins the batch.", "leftRight": "Black twinberry, rightly left.", "leftWrong": "It was haskap. You left the first fruit of the year to the blackbirds."},
  white_strawberry: {"fake": "Unripe wild strawberry", "latin": "Fragaria vesca, not ready", "stake": "poor", "fakeQ": 34, "p": 0.35, "base": "Pale little strawberries along the bank at the woodland edge.", "tests": [{"id": "smell", "label": "Smell one", "real": "Pineapple and strawberry, loud enough to find it by.", "fake": "Grass. Nothing else.", "meaning": "A ripe white alpine is the most fragrant thing on the bank. An unripe red one smells of nothing."}, {"id": "press", "label": "Press it gently", "real": "Soft, and it comes off the stalk at a touch.", "fake": "Hard, and it will not let go.", "meaning": "Ripe fruit lets go. Unripe fruit holds on."}, {"id": "seeds", "label": "Look at the seeds", "real": "Seeds gone red-brown on white skin.", "fake": "Seeds still green.", "meaning": "A white alpine is ripe when its seeds redden."}], "right": "White alpines. More sugar than anything else here, and a window of days.", "wrong": "They were red wild strawberries a week short of ripe. Hard, sour, and a poor mead.", "leftRight": "Unripe, rightly left.", "leftWrong": "They were ripe white alpines."},
  pine_needles: {"fake": "Yew", "latin": "Taxus baccata", "stake": "deadly", "fakeQ": 0, "p": 0.25, "base": "Soft young needles on a low evergreen at the edge of the ride.", "tests": [{"id": "bundle", "label": "Look at how the needles grow", "real": "In pairs, bound at the base in a papery sheath.", "fake": "Singly, flat, in two neat rows along the twig.", "meaning": "Pine needles come in bundles from a sheath. Yew needles are single and flat."}, {"id": "under", "label": "Turn a twig over", "real": "Blue-green all round.", "fake": "Two pale stripes along the underside.", "meaning": "Yew has two pale bands beneath each needle. Pine does not."}, {"id": "smell", "label": "Crush a needle and smell it", "real": "Resin and lemon.", "fake": "Almost nothing.", "meaning": "Pine smells of resin. Yew smells of very little, and every part of it but the red flesh of the berry is poisonous."}], "right": "Scots pine tips. Resin, lemon and a little vitamin C.", "wrong": "It was yew. Taxine, and no antidote. It goes on the fire, and so does the knife you cut it with.", "leftRight": "Yew, rightly left. It is the most dangerous thing on the estate, and it seeds itself among the pines.", "leftWrong": "It was a young pine. You left it."},
};

export interface Ground { id: GroundId; name: string; where: string; grows: string[]; hint: string; walk: number }
export const GROUNDS: Record<GroundId, Ground> = {
  home_oak: {"id": "home_oak", "name": "The Home Oak", "where": "An old oak at the edge of the beech hanger", "grows": ["maitake", "ceps", "winter_ceps"], "hint": "Maitake at its foot in autumn, ceps in the grass under the crown, black trumpets in the litter after frost.", "walk": 15},
  beech_hanger: {"id": "beech_hanger", "name": "The Beech Hanger", "where": "A steep wood of old beeches above the lane", "grows": ["lions_mane", "shimeji", "nameko"], "hint": "Lion’s mane on wounded beeches, shimeji on fallen ones, nameko on the stumps into winter.", "walk": 25},
  river_poplars: {"id": "river_poplars", "name": "River Poplars", "where": "Cut poplar and willow stumps on the river path", "grows": ["black_poplar", "blue_oyster", "enoki"], "hint": "Black poplar spring and autumn, oysters on fallen willow in the cold, velvet shank in the dead of winter. Galerina grows on the same wood.", "walk": 30},
  hedgerow: {"id": "hedgerow", "name": "The Long Hedge", "where": "Hawthorn, honeysuckle and a woodland bank down the lane", "grows": ["haskap", "white_strawberry"], "hint": "Haskap by the gate in June and July, white alpines on the bank into August.", "walk": 10},
  chip_track: {"id": "chip_track", "name": "Wood-chip Track", "where": "The estate track where the tree surgeons dump chip", "grows": ["king_stropharia"], "hint": "Wine cap in a bed of fresh chip, May to October, if someone lays one.", "walk": 15},
  coast_thorn: {"id": "coast_thorn", "name": "Coast Thorn", "where": "Sea buckthorn on the dunes behind the shingle", "grows": ["sea_buckthorn"], "hint": "Sea buckthorn, September to November. Strip it after the first frost, before the fieldfares do.", "walk": 50},
  bog: {"id": "bog", "name": "The Moss", "where": "Raised bog on the moor", "grows": ["cloudberries"], "hint": "Cloudberry, three weeks in July and August. The pickers do not say where.", "walk": 150},
  pine_plantation: {"id": "pine_plantation", "name": "The Pine Plantation", "where": "Scots pine in rows, a ride down the middle and an old yew by the wall", "grows": ["pine_needles"], "hint": "Soft young tips on the young pines at the ride edge, April to June. A yew seeds itself among them.", "walk": 35},
  hazel_coppice: {"id": "hazel_coppice", "name": "The Hazel Coppice", "where": "Hazel cut on a seven-year cycle below the hanger", "grows": ["hazelnuts"], "hint": "Cobnuts in late August and September. The squirrels start before you do.", "walk": 20},
  harbour: {"id": "harbour", "name": "The Harbour Wall", "where": "The old quay, the harbour mouth and the estuary bar", "grows": ["mackerel", "anchovies", "herring", "shrimp_fry"], "hint": "Mackerel in summer, anchovies at the harbour mouth, autumn herring, brown shrimp on the bar at low water.", "walk": 45},
};
export const GROUND_ORDER: GroundId[] = ["home_oak", "beech_hanger", "river_poplars", "hedgerow", "chip_track", "coast_thorn", "bog", "pine_plantation", "hazel_coppice", "harbour"];

/* -----------------------------------------------------------------------------
   WHAT YOU SEE ON EACH GROUND
   A sign is looked at once a visit. Most tell you nothing useful — that is the
   point: knowing what to ignore is the skill. A `find` is a species, if it is
   in season and the patch is not worked out; a `clue` teaches a tell for
   telling a species from its lookalike.
   --------------------------------------------------------------------------- */
export interface Signal {
  id: string;
  at: [number, number];
  label: string;
  text?: string;
  kind?: 'find' | 'bed';
  species?: string;
  lead?: string;
  out?: string;
  clue?: string;
  clueFor?: string[];
  flowerSignal?: boolean;
  timing?: boolean;
  nuts?: boolean;
  tide?: boolean;
  discovery?: boolean;
}
export interface SignalCtx { month: number; season: string; frost: boolean; lowTide: boolean }

const find = (species: string, at: [number, number], label: string, lead: string, out: string): Signal => ({ id: species, at, label, kind: 'find', species, lead, out });
/** Velvet shank takes over the poplar stumps in the dead of winter. */
export const riverStump = (month: number) => ([11, 0, 1, 2].includes(month) ? 'enoki' : 'black_poplar');

export const signalsFor = (gid: GroundId, c: SignalCtx): Signal[] => {
  const m = c.month, s = c.season;
  switch (gid) {
    case 'home_oak': return [
      { id: 'burr', at: [190, 128], label: 'The swollen burr on the trunk', text: 'A burr: a wound the tree has carried for twenty years. It is the first thing everyone looks at, and it means nothing.' },
      { id: 'bramble', at: [372, 240], label: 'The bramble', text: [7, 8].includes(m) ? 'Blackberries. Good, and nothing to do with the bench.' : 'Deer have had the bramble tips. It tells you about the deer.' },
      { id: 'hollow', at: [128, 226], label: 'A wet hollow in the roots', text: s === 'summer' ? 'Little grey caps in the wet. Nothing to do with the oak.' : 'A wet hollow between the roots. Good ground in July, the wrong month now.' },
      find('maitake', [158, 204], 'A dark mass at the buttress', 'A rosette of grey-brown fronds tucked into the buttress, and last year’s blackened one beside it. This tree is a producer.', 'Last year’s rosette, blackened at the base. Maitake comes back to the same oak: this tree is a producer, and now it is on your map.'),
      find('ceps', [330, 206], 'A brown bun in the grass under the crown', 'Where the crown ends, a fat brown cap in the grass. Ceps live on the oak’s roots, not its wood, so they come up where the roots reach.', 'Short grass under the edge of the crown. Ceps come up here in late summer.'),
      find('winter_ceps', [58, 244], 'Black holes in the leaf litter', 'What looked like holes in the litter are trumpets, black and ribbed. You only see them when you already know.', 'Leaf litter, deep and brown. Something black comes up in it after the first frost.')];
    case 'beech_hanger': return [
      find('lions_mane', [385, 96], 'The scar on the near beech', 'A white beard hanging from the scar, high on the trunk.', 'A long scar where a limb tore away. Something will use it in the autumn.'),
      find('shimeji', [262, 160], 'The fallen beech', 'Tight clusters of grey-brown caps along the fallen trunk.', 'The fallen beech, bark loosening. Something clusters along it from September.'),
      find('nameko', [86, 212], 'The old stump', 'Orange caps under a clear slime, crowded on the stump.', 'An old beech stump going soft. It will carry something orange into the winter.'),
      { id: 'woodpecker', at: [186, 52], label: 'A hole high on a trunk', text: 'A woodpecker’s hole, neat and round.' },
      { id: 'sett', at: [300, 228], label: 'Fresh earth on the slope', text: 'A badger sett. Nothing here for you.' },
      { id: 'shaft', at: [122, 150], label: 'Sun on the litter', text: 'Sun through a gap in the canopy. Mushrooms want the shade and the wood.' }];
    case 'river_poplars': {
      const st = riverStump(m);
      return [
        find(st, [230, 208], 'The middle stump', st === 'enoki' ? 'A clump of small orange caps on the stump, sticky with the wet. In January that could be velvet shank, or it could be Galerina.' : 'A tight cluster of brown caps with rings on the stems. Two things grow like this on this river.',
          st === 'enoki' ? 'A soft stump. Velvet shank comes up on it in the cold.' : 'Bare stumps. Black poplar fruits here in spring and autumn.'),
        find('blue_oyster', [330, 190], 'The fallen willow', 'Shelves of blue-grey caps stepping along the fallen willow.', 'The fallen willow. Oysters come on it when the weather turns cold.'),
        { id: 'conifer', at: [398, 244], label: 'A rotten log in the nettles', clue: 'spore', clueFor: ['black_poplar', 'enoki'], text: 'A rotten conifer log near the poplars: Galerina’s favourite wood. Whatever is on those stumps, take a spore print before you name it. Galerina’s is rusty.' },
        { id: 'beaver', at: [450, 180], label: 'A pencil-pointed willow', text: 'Fresh beaver work. It tells you about beavers.' },
        { id: 'kingfisher', at: [150, 150], label: 'A flash of blue over the water', text: 'A kingfisher. Lovely, and nothing to do with mushrooms.' }];
    }
    case 'hedgerow': return [
      { id: 'haskap', at: [310, 150], label: 'Dark berries on the shrub by the gate', kind: 'find', species: 'haskap', flowerSignal: true },
      { id: 'bracts', at: [150, 150], label: 'The shrub along the hedge', clue: 'bracts', clueFor: ['haskap'], text: 'Pairs of glossy black berries cupped in red-purple bracts: black twinberry. Now look at the shrub by the gate: does it do the same?' },
      find('white_strawberry', [40, 162], 'The bank at the woodland edge', 'Little pale strawberries along the bank, hanging under their leaves.', 'Strawberry leaves all along the bank, and nothing on them.'),
      { id: 'plums', at: [392, 196], label: 'Wasps at fallen fruit', text: 'Wasps on plums fallen from over the wall. Nothing here for you.' },
      { id: 'post', at: [452, 150], label: 'Stains on the gatepost', text: 'The blackbirds have been at something. Everything in this hedge is theirs first.' }];
    case 'chip_track': return [
      { id: 'heap', at: [100, 180], label: 'The chip heap by the gate', text: 'Fresh hardwood chip from the tree surgeons. Wine cap wants exactly this.' },
      { id: 'verge', at: [370, 228], label: 'The verge by the track', kind: 'bed', species: 'king_stropharia' },
      { id: 'barrow', at: [392, 176], label: 'A robin on the barrow', text: 'A robin, waiting for you to turn something over.' }];
    case 'coast_thorn': return [
      { id: 'thicket', at: [240, 158], label: 'The silver thicket above the shingle', kind: 'find', species: 'sea_buckthorn', timing: true },
      { id: 'fieldfares', at: [432, 198], label: 'Birds in the far thicket', text: m >= 9 && m <= 11 ? 'Fieldfares, in from Scandinavia. They strip a buckthorn in days. Take it this week.' : 'Gulls, loafing.' },
      { id: 'marram', at: [96, 148], label: 'The marram grass', text: c.frost ? 'Frost on the marram. The berries will come off the thorn cleanly now.' : 'Dew, not frost. Pull a berry now and it bursts down your sleeve.' },
      { id: 'pool', at: [124, 230], label: 'A sheen on the dune pool', text: 'An oily sheen: buckthorn oil from fallen berries. The only fruit on the coast that can turn rancid.' }];
    case 'bog': return [
      { id: 'cotton', at: [180, 158], label: 'Cotton grass', text: 'Cotton grass. It means wet, and cloudberry wants wet, with a little lift out of it.' },
      { id: 'hummocks', at: [330, 166], label: 'Red hummocks', kind: 'find', species: 'cloudberries', discovery: true },
      { id: 'knoll', at: [440, 186], label: 'A heather knoll', text: 'Too dry: cloudberry keeps its roots wet and its crown out of the water.' },
      { id: 'pools', at: [300, 214], label: 'The pools', text: 'Black water, deeper than it looks.' }];
    case 'pine_plantation': return [
      find('pine_needles', [132, 206], 'Young pines at the ride edge', 'Soft, bright tips on the young trees at the edge of the ride.', 'Dark old needles, hard and bitter. The soft tips come in April.'),
      { id: 'yew', at: [392, 128], label: 'The dark tree by the wall', clue: 'under', clueFor: ['pine_needles'], text: s === 'autumn' ? 'A yew, hung with red berries. Every part of it but the red flesh is poison, and the birds carry its seed into the pines. Look at a twig: flat needles, two pale stripes beneath.' : 'An old yew by the wall, darker than anything round it. Look at a twig: flat single needles with two pale stripes beneath. Remember that stripe.' },
      { id: 'stump', at: [56, 188], label: 'A stump weeping resin', text: 'Resin on a cut stump, sticky and loud with the smell of pine.' },
      { id: 'cones', at: [300, 178], label: 'Cones under the pines', text: 'Cones stripped to the core. A red squirrel, or crossbills.' },
      { id: 'crossbill', at: [104, 42], label: 'A red bird high up', text: 'A crossbill, twisting seeds out of a cone.' }];
    case 'hazel_coppice': return [
      { id: 'stool', at: [130, 150], label: 'The big hazel stool', kind: 'find', species: 'hazelnuts', nuts: true },
      { id: 'shells', at: [196, 200], label: 'Split shells on a stump', clue: 'squirrels', text: m >= 6 && m <= 9 ? 'Shells split cleanly in half: grey squirrels. They take them green. Whatever you leave past mid-September is theirs.' : 'Old shells, last year’s.' },
      { id: 'catkins', at: [270, 148], label: 'The far stool', text: m <= 2 ? 'Catkins, yellow in February: the first flowers of the year. A good catkin year is a good nut year.' : 'A stool cut three years ago, all straight poles.' },
      { id: 'poles', at: [320, 214], label: 'The woodpile', text: 'Coppice poles, cut and stacked: bean poles, pea sticks, hurdles.' }];
    case 'harbour': return [
      { id: 'gannets', at: [40, 124], label: 'Gannets diving far out', clue: 'birds', text: m >= 4 && m <= 9 ? 'Gannets folding into the sea: there are fish under them, sandeels and whatever is chasing them. The shoals come inshore on the flood.' : 'A lone gannet going south.' },
      find('mackerel', [300, 196], 'Nervous water off the wall', 'The water boiling with whitebait, and mackerel slashing through it. Feathers off the wall.', 'Flat water. The mackerel come inshore June to September.'),
      find('anchovies', [120, 150], 'A silver flicker at the harbour mouth', 'A shoal of anchovies turning at the harbour mouth, silver and green. A net off the steps.', 'The harbour mouth, quiet. Anchovies come in with the warm water in July.'),
      find('herring', [250, 150], 'Gulls on the drift', 'Gulls working a slick where the herring are shoaling to spawn.', 'Gulls loafing on the water. The autumn herring come in September.'),
      { id: 'bar', at: [410, 226], label: 'The estuary bar', kind: 'find', species: 'shrimp_fry', tide: c.lowTide },
      { id: 'seal', at: [214, 168], label: 'A head in the water', text: 'A grey seal. It knows where the fish are too.' }];
  }
  return [];
};

/** Where each ground (and the salt pans, and the way home) is on the painted estate map. */
export const MAP_PINS: Record<string, [number, number]> = {
  bog: [62, 42], hazel_coppice: [40, 132], beech_hanger: [182, 112], chip_track: [96, 160], home_oak: [232, 204],
  hedgerow: [60, 232], river_poplars: [322, 104], pine_plantation: [340, 42], coast_thorn: [410, 88],
  salt_pans: [420, 142], harbour: [440, 236], farm: [262, 130],
};

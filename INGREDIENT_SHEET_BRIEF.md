# Ingredient sheet — generation brief

**Fermenta Tycoon.** One image containing all 49 ingredient icons in a grid.

## Why one sheet and not 49 files

Separately generated images will not match each other — different lighting, weight
and scale — and reconciling them takes longer than drawing them. A single picture
is consistent by construction. It is also one file to embed, and the game slices
it by cell index, so adding an ingredient later means one more cell rather than a
new asset pipeline.

## The grid

- **7 columns x 8 rows = 56 cells.** 49 are used; the last 7 stay **empty** as room to grow.
- **Total canvas 1568 x 1792 px** — each cell exactly **224 x 224 px**, no gutters,
  no grid lines, no numbering, no labels.
- Each subject **centred in its cell**, filling about **70%** of it, with clear
  margin on all four sides. Consistent visual weight cell to cell: a single garlic
  bulb and a scatter of barley should read as the same "size of thing".
- **Background: solid `#15100b`** in every cell — the game's own ground colour.
  No transparency, no checkerboard, no white. Clean alpha on 49 cutouts is
  the real grind and this skips it entirely.
- **Read order is left to right, top to bottom.** Cell r1c1 is top-left. The order
  below is not negotiable — the game slices by index.

## The style

This has to sit beside vessels the game draws itself, so it should imitate them:

- **Flat fills only.** No gradients inside an object, anywhere. Volume comes from
  **three flat facets** — a lit face, a body face, a shadow face — meeting at hard
  edges. Cut paper, not rendering.
- **Contour lines in cream at low opacity** — `#f3e9d8` at roughly 25-40% over the
  fill, about 2px at this cell size. Silhouette and a few key interior edges only.
  **Never black outlines**, never uniform-weight cartoon ink.
- **No interior texture.** No wood grain, no speckle, no cross-hatching within an
  object. Board texture is applied by the game, over the top.
- **Round forms are shallow ellipses** — a jar rim or a bowl mouth at a height
  about 0.37 of its width. That is the eye level everything else in the game
  shares.
- **Fewer marks than feels right.** A bunch of anchovies is three fish, a tail and
  an eye — not scales, not fins, not a tin.
- **A faint hand-drawn wobble**, as if pen rather than ruled. The game applies
  exactly this to what it draws, at 1-2px displacement.

## Palette

Everything from this set, nothing outside it:

| role | hex |
|---|---|
| cell background | `#15100b` |
| cream, brightest | `#f4ead9` |
| cream, mid | `#c3b39a` |
| grain / substrate | `#cbb37e` |
| oak, lit face | `#8a6a3a` |
| oak, body | `#6b4a29` |
| oak, shadow face | `#4a3018` |
| moss green (living things) | `#8fb06a` |
| brick red (fish, chilies, contraband) | `#b4552f` |
| amber (heat, sugar) | `#e08a3c` |
| teal (water, brine) | `#5fa3a8` |

Living cultures may carry a little **moss**; anything contraband may carry a
little **brick**. Otherwise stay in the creams and oaks — the pantry should read
as one shelf, not as a colour chart.

## The cells, in order

### Substrates (31)

| # | cell | ingredient | what it is |
|---|---|---|---|
| 1 | r1c1 | **Pearl Barley** | Polished grains, perfect for Koji |
| 2 | r1c2 | **Yellow Soybeans** | High protein legume for Miso |
| 3 | r1c3 | **Black Soybeans** | Rich, savory beans for Douchi |
| 4 | r1c4 | **Glutinous Rice** | Sticky rice, high starch content |
| 5 | r1c5 | **Raw Milk** | Unpasteurized dairy. High risk, high reward |
| 6 | r1c6 | **Fresh Anchovies** | Oily fish, perfect for Garum |
| 7 | r1c7 | **Mackerel** | Strong flavored fish |
| 8 | r2c1 | **Mullet Roe Sack** | Precious roe for Bottarga |
| 9 | r2c2 | **Dried Scallops** | Concentrated Umami bombs |
| 10 | r2c3 | **Wild Ceps (Porcini)** | Forest mushrooms. Earthy and sweet |
| 11 | r2c4 | **Green Plums** | Unripe fruit, high acidity |
| 12 | r2c5 | **Yellow Peas** | Alternative to soy. Sweet and grassy |
| 13 | r2c6 | **Whole Garlic** | Pungent allium. Turns black with heat |
| 14 | r2c7 | **Broad Beans** | Fava beans. Key for Doubanjiang |
| 15 | r3c1 | **Krill / Shrimp Fry** | Tiny crustaceans for Bagoong |
| 16 | r3c2 | **Coconut Sap** | Sweet nectar for Tuba/Vinegar |
| 17 | r3c3 | **Young Pine Needles** | Foraged wild aromatics |
| 18 | r3c4 | **Damask Rose Petals** | Highly aromatic floral matter |
| 29 | r5c1 | **Barley Koji** | Ready-to-use inoculated barley. Grown balanced, leaning savoury |
| 30 | r5c2 | **Rice Koji** | Inoculated rice grains. Grown on starch, so it is amylase-heavy — the sweet… |
| 37 | r6c2 | **Napa Cabbage** | Loose-leaved and full of water. Salted down, it gives up its liquid and makes… |
| 38 | r6c3 | **White Cabbage** | Dense and dry-leaved. Shredded and weighted, it ferments under its own liquid… |
| 39 | r6c4 | **Pork Belly** | Fat and lean in layers. Cured and hung, the fat carries everything the… |
| 40 | r6c5 | **Baltic Herring** | Oily, and it turns fast. In a weak brine it ferments rather than cures —… |
| 41 | r6c6 | **Skipjack Bonito** | Lean, dense and almost fat-free — which is what lets it dry to something like… |
| 44 | r7c2 | **Black Tea** | Brewed strong. The tannins feed the culture as much as the sugar does —… |
| 45 | r7c3 | **Heavy Cream** | Almost pure butterfat. Nothing else in the pantry gives lipase this much to… |
| 46 | r7c4 | **Toasted Hazelnuts** | Half fat by weight, and enough protein to build a paste around it |
| 47 | r7c5 | **Egg Yolks** | Fat and protein and almost no water once the salt has had its way |
| 48 | r7c6 | **Pineapple (rind & core)** | The parts you would throw away. The yeast you need is already living on the… |
| 49 | r7c7 | **Cider Apples** | Pressed for must. Sharp, tannic and full of the sugar two successive… |

### Starters and live cultures (9)

| # | cell | ingredient | what it is |
|---|---|---|---|
| 19 | r3c5 | **A. Oryzae Spores** *(live culture)* | Standard yellow koji-kin. Even-handed: makes both amylase and protease |
| 20 | r3c6 | **Ancient Spores** *(contraband)* | Recovered from a clay pot 1000 years old. Protease-heavy and unpredictable |
| 21 | r3c7 | **Cheese Fly Larvae** *(contraband)* | Piophila casei. Illegal in most countries |
| 32 | r5c4 | **R. Oligosporus (Tempeh)** *(live culture)* | Binds cooked beans into a solid cake with white mycelium. Very little enzyme… |
| 33 | r5c5 | **B. Subtilis var. natto** *(live culture)* | A bacterium, not a mould. Wants 40°C and wet air — conditions that would kill… |
| 34 | r5c6 | **Nuruk Cake** *(live culture)* | A wild Korean starter cake: moulds, yeasts and bacteria together. Less… |
| 35 | r5c7 | **P. Roqueforti** *(live culture)* | Blue mould. Needs air in the paste to strike, which is why the cheese is… |
| 36 | r6c1 | **A. Glaucus (Katsuobushi)** *(live culture)* | Draws moisture out of dried fish over months of repeated sunning and… |
| 43 | r7c1 | **SCOBY (Kombucha mother)** *(live culture)* | A cellulose raft of yeast and acetic bacteria. The yeast makes alcohol, the… |

### Additives (9)

| # | cell | ingredient | what it is |
|---|---|---|---|
| 22 | r4c1 | **Sea Salt** | Basic NaCl. Prevents spoilage |
| 23 | r4c2 | **Trapani Sea Salt** | Hand-harvested Sicilian salt. Rich in minerals |
| 24 | r4c3 | **Filtered Water** | H2O. Essential for brine |
| 25 | r4c4 | **Cane Sugar** | Food for yeast |
| 26 | r4c5 | **Dried Chilies** | Adds heat and antibacterial properties |
| 27 | r4c6 | **Vial of Tears** *(contraband)* | Collected from the grieving. Saline and sorrowful |
| 28 | r4c7 | **Roasted Wheat** | Essential for Shoyu |
| 31 | r5c3 | **Amino Sauce (Shoyu)** | Pressed liquid savory seasoning |
| 42 | r6c7 | **Rice Bran (Nuka)** | The polishings. A bran bed lives for decades if you turn it by hand every day |

### Empty

Cells **50** to **56** (r8c1 onward) stay solid `#15100b`. Room for new
ingredients without regenerating the sheet.

## A few that are easy to get wrong

- **Barley Koji / Rice Koji** are grain *already bloomed with white mould* — a
  fuzzy pale cast over the grain. They are not plain grain; that distinction is
  the whole middle of the game.
- **A. Oryzae / Sake / Shoyu / Luchuensis koji-kin** are packets of spore powder,
  not grain. Show a small paper sachet with a spill of coloured powder — yellow,
  black for luchuensis.
- **SCOBY** is a pale rubbery disc, not a mushroom.
- **Vial of Tears** is a small stoppered glass vial, clear liquid. Nothing macabre.
- **Cheese Fly Larvae** — small, pale, and drawn with restraint. It is a real
  ingredient in a real cheese, not a horror prop.
- **Mullet Roe Sack** is an amber-orange lobed sac, not fish eggs loose.
- **Skipjack Bonito** should read as a *dried, hard* loin — angular, not a fresh fish.

## Prompt, if generating

> A single 7x8 grid sheet of 49 food ingredient icons, flat-shaded cut-paper
> illustration style, three flat tones per object, thin cream contour lines, no
> gradients, no interior texture, warm dark brown palette on a solid `#15100b`
> background, each subject centred in its cell filling 70% of it, consistent
> lighting and scale across all cells, no text, no labels, no grid lines.

Generate in one pass. If it has to be split, split by **row**, keeping the same
prompt and seed, so lighting and weight carry across.

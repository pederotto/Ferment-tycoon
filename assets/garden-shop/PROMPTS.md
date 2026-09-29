# Garden Shop — pixel art prompts

There are three images, all 16:9. Save them in this folder with these exact names. The game picks them up on its own, and until then it shows plain placeholders.

| File | What it is | Grid |
|---|---|---|
| `items.png` | 32 shop item icons | 8 columns × 4 rows |
| `ui.png` | shopkeeper portrait, nav icon, 2 machines, 4 tab icons | 4 columns × 2 rows |
| `scene.png` | the shop interior, used as the header banner | none |

**Grid rules (important):** the grid has to fill the whole frame edge to edge, with every cell the same size. There is no outer margin, border, gutter, title or label. At 1920×1080 each cell is 240×270 px. Each object sits centred in its cell with about 10% padding, and no object crosses into a neighbouring cell. The game slices the image by fractions of its size, so the resolution doesn't matter, but a crooked grid does. If the generator drifts, crop and resize to 1920×1080 before saving.

**Background:** use flat pure magenta `#FF00FF` behind the icons in both sheets so it can be keyed out. Key the magenta out to transparency and save as PNG before dropping the file in. The game draws each cell as-is, so any magenta left behind will show.

---

## Prompt 1 — `items.png` (32 icons)

```
16:9 pixel art sprite sheet, 1920x1080, an exact 8-column by 4-row grid of equal cells filling the whole image edge to edge, no margins, no borders, no text, no labels, no grid lines. Flat solid magenta #FF00FF background in every cell. One object per cell, centred, three-quarter front view, same scale and same light from the upper left in every cell, crisp hand-placed pixels, 2px dark brown outline, warm earthy palette (ochre, terracotta, olive, straw, walnut brown, cream paper), style of a cosy detailed 16-bit farming game set in the Italian countryside around 1900. Items in reading order, left to right, top to bottom:
Row 1 (seeds): 1 a folded brown paper seed packet with a hand-drawn vegetable label; 2 a wooden tray of young green plug seedlings; 3 a small bundle of strawberry crowns with roots tied with raffia; 4 a red string net bag of seed garlic bulbs; 5 a tied hessian sack of seed grain with ears of wheat poking out; 6 a bare-root rose bush wrapped in damp sacking; 7 a round tin seed canister with a paper label; 8 a small cream envelope of home-saved seed sealed with wax.
Row 2 (feeds): 9 a bulging jute sack of well-rotted dark manure; 10 a tub of chicken manure pellets; 11 a cardboard box of bone meal with a bone drawn on it; 12 a paper sack labelled with a fish, a drop of blood and a bone; 13 a paper sack of dark green seaweed meal with kelp spilling out; 14 a zinc bucket of grey wood ash; 15 a white sack of garden lime with a little powder spilled; 16 a tub of dark comfrey pellets with a comfrey leaf on the label.
Row 3 (soil and remedies): 17 a heavy sack of grey rock dust; 18 a modern plastic bag of blue NPK fertiliser granules, slightly out of place; 19 a glass bottle of amber soft soap; 20 a small bottle of golden neem oil with a neem leaf; 21 a tin of sky-blue Bordeaux mixture powder; 22 a paper packet of bright yellow sulphur dust; 23 a brass hand sprayer with a pyrethrum daisy on the label; 24 a tub of small blue-grey ferric phosphate slug pellets.
Row 4 (beneficials and machines): 25 a small foil pack of nematodes with a slug crossed out on the label; 26 a clear tube of ladybird larvae on a leaf with one red ladybird on top; 27 a paper card with pale green lacewing eggs on stalks and one green lacewing; 28 small cardboard cards of Encarsia wasp pupae hanging on a hook; 29 a sachet of Bacillus thuringiensis spray with a caterpillar crossed out; 30 a travelling rain gun: a big hose reel on a wheeled cart with a sprinkler gun; 31 a small red petrol rotavator with tines; 32 a two-wheel walking tractor with a small plough attached.
```

## Prompt 2 — `ui.png` (8 cells)

```
16:9 pixel art sprite sheet, 1920x1080, an exact 4-column by 2-row grid of equal cells filling the whole image edge to edge, no margins, no borders, no text, no grid lines. Flat solid magenta #FF00FF background in every cell except cell 1. Same style as a cosy detailed 16-bit farming game set in the Italian countryside around 1900: crisp hand-placed pixels, 2px dark brown outline, warm earthy palette, light from the upper left.
Row 1: 1 a head-and-shoulders portrait of the garden shop keeper, a weathered cheerful woman in her sixties with a straw hat, a green canvas apron and a pencil behind her ear, on a warm dark green background filling the cell, face centred for a round crop; 2 a hanging wrought-iron shop sign shaped like a watering can with a sprig of leaves, as an icon; 3 a heated propagator: a shallow tray with a clear plastic lid misted with condensation and seedlings inside; 4 an automatic greenhouse vent opener: a brass wax-piston arm on a small glass window frame.
Row 2 (small tab icons, bold and readable at 20px): 5 a fan of three seed packets; 6 a half-open sack of dark compost with a trowel; 7 a brass hand sprayer; 8 a single big red ladybird seen from above.
```

## Prompt 3 — `scene.png` (banner)

```
16:9 pixel art scene, 1920x1080, interior of a small old Italian village garden shop ("consorzio agrario") around 1900, seen straight on from the counter: wooden shelves up to a beamed ceiling crowded with seed packets in pigeonholes, tins, paper sacks of feed stacked on the floor, brass sprayers and hoes hanging on the wall, strings of garlic and dried herbs from the beams, a big set of scales on the counter, trays of seedlings by a sunny doorway, dust in warm late-morning light from a window on the right. Crisp hand-placed pixels, rich warm palette of walnut, ochre, terracotta, sage and cream, cosy detailed 16-bit farming-game style, no people, no text or readable writing. Keep the left third calmer and darker (a title is laid over it) and put the most detail in the centre and right.
```

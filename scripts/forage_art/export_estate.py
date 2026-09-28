"""Export the estate's placeholder art into the game as one TypeScript module.

    python3 scripts/forage_art/export_estate.py <scratch-dir>

Renders every farm place in every seasonal variant with the pixel renderer in
this directory, converts each plate to a lossless WebP data URI, cuts small
pixel sprites for everything the estate grows from the shipped ingredient
sheet, and writes components/estatePlates.ts with the plates, the scene
geometry (where the beds, strips, trees, hives and pans are) and the sprites.

The renderer's plates are placeholders. Where the owner's painted plates exist
(art/estate, snapped onto their own 480x270 grid by snap_plates.py) they
replace them, with geometry measured off the paintings (PAINTED_GEOM).
"""
import base64, io, json, os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
os.chdir(HERE)

import pxart
import render_all
from scenes3 import GEOM
import convert2
from convert2 import to_sprite

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

PLACES = ['walled_garden', 'polytunnel', 'top_field', 'orchard', 'orangery', 'hives', 'hen_run', 'salt_pans', 'worm_shed', 'farm_map']
VARIANTS = render_all.VARIANTS
INTERIOR = render_all.INTERIOR


def webp_uri(im):
    b = io.BytesIO()
    im.save(b, 'WEBP', lossless=True, quality=100, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def png_uri(im):
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def smallest(im):
    """WebP unless PNG is at least 8% smaller (the house rule for picture modules)."""
    w, p = webp_uri(im), png_uri(im)
    return p if len(p) < len(w) * 0.92 else w


plates = {}
for k in PLACES:
    for season, wx, name in VARIANTS:
        if k in INTERIOR and wx != 'clear':
            continue
        im = render_all.render(k, season, wx)
        plates[f'{k}:{name}'] = webp_uri(im)
pxart.WX, pxart.SEASON = 'clear', 'summer'

# What the estate grows, read from the game's own crop table so the two cannot drift.
farm_ts = open(os.path.join(REPO, 'constants.farm.ts')).read()
ids = re.findall(r"(?:tom|corn|drybean)\('([a-z_]+)'", farm_ts)
ids += re.findall(r"\{ id: '([a-z_]+)', family:", farm_ts)
ids += re.findall(r"cropId: '([a-z_]+)', gddBloom", farm_ts)
ids += ['honey', 'egg_yolks', 'salt', 'noma_salt']
# and everything the wild gives, so a find is drawn where it was spotted
wild_ts = open(os.path.join(REPO, 'constants.wild.ts')).read()
ids += re.findall(r"^  ([a-z_]+): \{\"season\"", wild_ts, re.M)
ids = list(dict.fromkeys(ids))

sprites = {}
LIGHT_OUT = {'black_beluga_lentils', 'hopi_blue_corn'}
for i in ids:
    try:
        if i in LIGHT_OUT:
            convert2.OUT = np.array([150, 132, 100], np.float32)
        small = Image.fromarray(to_sprite(i, 20, k=6))
        tiny = Image.fromarray(to_sprite(i, 12, k=5, erode=3, rim=False))
        sprites[i] = {'small': smallest(small), 'tiny': smallest(tiny)}
    except Exception as e:  # a missing sheet cell is not fatal: the scene falls back to a drawn dot
        print('no sprite for', i, e)
    finally:
        convert2.OUT = np.array([27, 18, 10], np.float32)

geom = {k: GEOM[k] for k in PLACES if k in GEOM}

# --- The owner's painted plates (art/estate, snapped by snap_plates.py) -------
# They replace the placeholders one for one, at their own 480x270 grid, with
# the geometry measured off the pictures. `horizon` and `k` give the scale of a
# thing standing at a given y: pixels per unit of drawn size = k * (y - horizon).
PAINTED_SIZE = [480, 270]


def lane(near, far, horizon, k, n):
    """n plants at equal real spacing along a bed receding from `near` to `far`."""
    dn, df = 1 / (near[1] - horizon), 1 / (far[1] - horizon)
    out = []
    for i in range(n):
        y = horizon + 1 / (dn + (df - dn) * i / (n - 1))
        x = near[0] + (far[0] - near[0]) * (y - near[1]) / (far[1] - near[1])
        out.append([round(x), round(y), round(k * (y - horizon), 2)])
    return out


def hull(pts):
    pts = sorted(set(pts))
    def half(ps):
        h = []
        for q in ps:
            while len(h) >= 2 and (h[-1][0] - h[-2][0]) * (q[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (q[0] - h[-2][0]) <= 0:
                h.pop()
            h.append(q)
        return h
    lo, hi = half(pts), half(pts[::-1])
    return [list(q) for q in lo[:-1] + hi[:-1]]


def bay_hit(pts):
    corners = []
    for x, y, sc in pts:
        corners += [(round(x - 9 * sc), round(y + 4)), (round(x + 9 * sc), round(y + 4)),
                    (round(x - 9 * sc), round(y - 46 * sc)), (round(x + 9 * sc), round(y - 46 * sc))]
    return hull(corners)


# The tunnel: the tomato strings hang to two lines of plants, one each side of
# the path, measured from where the strings end. Four plants a bay, near first.
T_H, T_K = 98, 0.019
left = lane((130, 222), (214, 153), T_H, T_K, 8)
right = lane((335, 215), (265, 153), T_H, T_K, 8)
tunnel_beds = [left[:4], left[4:], right[:4], right[4:]]

PAINTED_GEOM = {
    'walled_garden': {
        'size': PAINTED_SIZE, 'horizon': 70, 'k': 0.0163,
        # soil inside each raised bed: TL, TR, BR, BL. Back row, middle pair, front pair.
        'beds': [
            [[153, 129], [188, 129], [186, 138], [146, 138]],
            [[222, 129], [260, 129], [261, 138], [221, 138]],
            [[288, 130], [331, 130], [336, 139], [292, 139]],
            [[118, 150], [205, 150], [200, 164], [107, 164]],
            [[278, 150], [358, 150], [372, 164], [282, 164]],
            [[82, 185], [188, 185], [176, 224], [40, 224]],
            [[291, 185], [396, 185], [450, 224], [300, 224]],
        ],
        # the bed along the west wall: far wall, far board, near board, near wall
        'rose': [[117, 121], [132, 124], [0, 197], [0, 170]],
    },
    'polytunnel': {
        'size': PAINTED_SIZE, 'horizon': T_H, 'k': T_K,
        'beds': tunnel_beds,
        'hits': [bay_hit(b) for b in tunnel_beds],
    },
    'top_field': {
        # three strips running to a vanishing point off the left edge; each
        # quad runs past the frame and the canvas clips it. Far, middle, near.
        'size': PAINTED_SIZE, 'horizon': 47, 'k': 0.0875,
        'strips': [
            [[136, 90], [207, 90], [719, 170], [496, 170]],
            [[72, 90], [127, 90], [725, 270], [411, 270]],
            [[18, 82], [64, 82], [284, 270], [50, 270]],
        ],
    },
    'hives': {
        # each painted hive: [centre x, foot y, roof-top y, width], near hives bigger
        'size': PAINTED_SIZE,
        'hives': [[159, 170, 114, 50], [258, 188, 116, 62], [384, 208, 122, 76]],
    },
    'salt_pans': {
        # each pan's floor as a quad (TL, TR, BR, BL), far to near, in perspective
        'size': PAINTED_SIZE,
        'pans': [
            [[145, 123], [312, 123], [328, 139], [126, 139]],
            [[118, 145], [332, 145], [358, 170], [84, 170]],
            [[76, 182], [380, 182], [448, 238], [22, 238]],
        ],
    },
    'orchard': {
        # canopy ellipses (cx, cy, rx, ry), measured off the painted summer plate; the
        # akebi's is the top of its pergola. Blossom and fruit are drawn into these.
        'size': PAINTED_SIZE,
        'trees': {
            'apple_old': [80, 118, 70, 50], 'apple_young': [170, 140, 22, 24],
            'plum_near': [213, 110, 34, 30], 'akebi_pergola': [272, 108, 22, 10],
            'plum_far': [318, 122, 44, 36], 'yuzu_wall': [432, 185, 34, 38],
        },
    },
    'orangery': {
        # canopy ellipses (cx, cy, rx, ry) back to front, and each pot's box
        'size': PAINTED_SIZE,
        'trees': {
            'finger_limes': [304, 123, 21, 18], 'calamansi': [330, 117, 28, 22],
            'buddhas_hand': [352, 117, 36, 30], 'black_sapote': [394, 120, 44, 40],
        },
        'pots': {
            'finger_limes': [290, 160, 325, 190], 'calamansi': [305, 170, 350, 205],
            'buddhas_hand': [322, 182, 378, 222], 'black_sapote': [355, 200, 425, 262],
        },
        'stove': [165, 176],
    },
    'hen_run': {
        # the scratched floor the hens wander, the nest box and the coop door
        'size': PAINTED_SIZE, 'run': [150, 186, 440, 258], 'nest': [62, 150], 'coop': [140, 150],
    },
    'worm_shed': {
        # two worm towers at left, two soldier-fly bins at right, the bench between
        'size': PAINTED_SIZE,
        'worms': [[42, 165, 100, 240], [102, 156, 146, 216]],
        'bsf': [[306, 152, 364, 214], [370, 152, 426, 214]],
        'bench': [192, 160, 298, 174],
    },
    'farm_map': {
        'size': PAINTED_SIZE,
        'places': {
            'walled_garden': [20, 18, 130, 122], 'polytunnel': [260, 48, 380, 100], 'orangery': [395, 38, 462, 98],
            'orchard': [8, 136, 135, 262], 'hives': [166, 124, 230, 150], 'hen_run': [150, 184, 250, 262],
            'worm_shed': [252, 168, 300, 265], 'top_field': [306, 120, 474, 265],
        },
    },
}

# The wild grounds: the owner's plates where they came, and the pine plantation
# from the renderer until its painting does. Their signs are placed in
# constants.wild.ts on each plate's own grid.
GROUNDS = ['home_oak', 'beech_hanger', 'river_poplars', 'hedgerow', 'chip_track', 'coast_thorn', 'bog', 'hazel_coppice', 'harbour', 'pine_plantation', 'wild_map']
for g in GROUNDS:
    PAINTED_GEOM[g] = {'size': PAINTED_SIZE}

painted = {}
for f in sorted(os.listdir(os.path.join(REPO, 'art', 'estate'))):
    m = re.match(r'([a-z_]+)-([a-z_]+)\.png$', f)
    if m and m.group(1) in PAINTED_GEOM:
        painted[f'{m.group(1)}:{m.group(2)}'] = Image.open(os.path.join(REPO, 'art', 'estate', f)).convert('RGB')
for k in PAINTED_GEOM:
    for key in [x for x in plates if x.startswith(k + ':')]:
        del plates[key]
for key, im in painted.items():
    plates[key] = webp_uri(im)
geom.update(PAINTED_GEOM)

# The owner's crop sheets, cut into seven stages a family by cut_crops.py.
crops_dir = os.path.join(REPO, 'art', 'estate', 'crops')
crop_stages, crop_extra = {}, {}
for f in sorted(os.listdir(crops_dir)):
    m = re.match(r'([a-z_]+)-(\d)\.png$', f)
    im = Image.open(os.path.join(crops_dir, f)).convert('RGBA')
    entry = {'src': smallest(im), 'w': im.width, 'h': im.height}
    if m:
        crop_stages.setdefault(m.group(1), [None] * 7)[int(m.group(2))] = entry
    else:
        crop_extra[f[:-4]] = entry

ts = [
    '/* Generated by scripts/forage_art/export_estate.py — do not edit by hand.',
    '   The estate plates, one per place and season (plus snow, and hoarfrost',
    '   where a placeholder has it): the owner\'s painted plates at 480x270 where',
    '   they exist (art/estate), placeholder pixel plates at 384x216 elsewhere.',
    '   Each place\'s geometry is measured off its own plate, and `size` says',
    '   which grid it is on. Plus small pixel sprites for everything grown. */',
    '',
    'export const ESTATE_PLATES: Record<string, string> = ' + json.dumps(plates, indent=0) + ';',
    '',
    'export const ESTATE_GEOM: Record<string, any> = ' + json.dumps(geom) + ';',
    '',
    'export const CROP_SPRITES: Record<string, { small: string; tiny: string }> = ' + json.dumps(sprites, indent=0) + ';',
    '',
    '/** The owner\'s crop sheets: seven stages a family (sown, young, growing, flowering, fruiting, ripe, over), with their pixel sizes. */',
    'export type StageSprite = { src: string; w: number; h: number };',
    'export const CROP_STAGES: Record<string, StageSprite[]> = ' + json.dumps(crop_stages, indent=0) + ';',
    '/** Ripe tomatoes in their own colours, and white pineberries. */',
    'export const CROP_EXTRA: Record<string, StageSprite> = ' + json.dumps(crop_extra, indent=0) + ';',
    '',
]
dest = os.path.join(REPO, 'components', 'estatePlates.ts')
open(dest, 'w').write('\n'.join(ts))
print('plates', len(plates), 'sprites', len(sprites), 'KB', os.path.getsize(dest) // 1024)

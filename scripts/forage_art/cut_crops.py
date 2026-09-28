"""Cut the owner's crop sheets into stage sprites: art/estate/crops/<set>-<stage>.png

    python3 scripts/forage_art/cut_crops.py [folder of generated images]

Stages are the game's seven: 0 sown, 1 young, 2 growing, 3 flowering,
4 fruiting (or heading, unripe), 5 ripe, 6 over. Each set lists the sheet cell
(row.column, as rows_of numbers them) for each stage; a cell may repeat where a
sheet has fewer stages than the game. Tomatoes also get their ripe colours, one
per variety, and grain its field patches.
"""
import os, sys, glob, shutil
import numpy as np
from PIL import Image
from cut_sheet import cut, rows_of

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DEST = os.path.join(REPO, 'art', 'estate', 'crops')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads')

SHEETS = {
    'tall': 'Gemini_Generated_Image_cy615icy615icy61 (7).jpeg',   # beans, tomatoes, corn, chili, roses
    'comp': 'Gemini_Generated_Image_70loqb70loqb70lo.jpeg',       # cabbage, garlic, strawberry, grain
}
# The third sheet is cut on its GRID, not by blobs: the tall tomatoes nearly touch the
# row below, and blobs merged them across rows. Column centres and row bands are in the
# source image's pixels, measured off it (the rows are uneven: each crop has its height).
GRID_SHEET = 'Gemini_Generated_Image_zb08x8zb08x8zb08.jpeg'
GRID_COLS = [97, 300, 497, 690, 885, 1080, 1280]
GRID_ROWS = {'tomato': (0, 190), 'fava': (190, 322), 'chickpea': (322, 425), 'lentil': (425, 505), 'pea': (505, 640), 'napa': (640, 768)}
# which grid column is each of the game's seven stages. Broad beans are grown dry, so ripe
# is the black pod; napa's column 3 is the first flower spike of a bolting head, so it is skipped.
GRID_SETS = {
    'tomato':   [0, 1, 2, 3, 4, 5, 6],
    'fava':     [0, 1, 2, 3, 5, 6, 6],
    'chickpea': [0, 1, 2, 3, 4, 5, 6],
    'lentil':   [0, 1, 2, 3, 4, 5, 6],
    'pea':      [0, 1, 2, 3, 4, 5, 6],
    'napa':     [0, 1, 2, 4, 4, 5, 6],
}
# a variety's ripe colour, painted onto the red fruit of the grid tomato
TOMATO_TINT = {'red': None, 'pink': (232, 120, 140), 'black': (96, 44, 44), 'green': (150, 184, 70),
               'cream': (240, 222, 150), 'orange': (240, 140, 40), 'plum': (176, 36, 52)}
SETS = {
    'bean':       ('tall', ['0.0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6']),
    'corn':       ('tall', ['2.0', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6']),
    'chili':      ('tall', ['3.0', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6']),
    'rose':       ('comp', ['5.0', '5.1', '5.1', '5.2', '5.2', '5.3', '5.4']),
    'cabbage':    ('comp', ['0.0', '0.1', '0.2', '0.3', '0.3', '0.5', '0.6']),
    'garlic':     ('comp', ['1.0', '1.1', '1.2', '1.4', '1.5', '1.7', '1.8']),
    'strawberry': ('comp', ['3.9', '3.9', '3.10', '3.11', '3.11', '3.12', '3.14']),
}
EXTRA = {'pineberry_ripe': ('comp', '3.13')}
# the grain patches: one merged blob of seven tiles
GRAIN = ('comp', '4.0', 7)


def crop(rgba, b):
    im = Image.fromarray(rgba[b[1]:b[3], b[0]:b[2]])
    return im


if __name__ == '__main__':
    shutil.rmtree(DEST, ignore_errors=True)
    os.makedirs(DEST)
    cells = {}
    for k, f in SHEETS.items():
        rgba, boxes = cut(os.path.join(SRC, f))
        rows = rows_of(boxes, 6)
        cells[k] = (rgba, {f'{ri}.{ci}': b for ri, r in enumerate(rows) for ci, b in enumerate(r)})
    def get(sheet, cell):
        rgba, idx = cells[sheet]
        return crop(rgba, idx[cell])
    for name, (sheet, stages) in SETS.items():
        for i, c in enumerate(stages):
            get(sheet, c).save(os.path.join(DEST, f'{name}-{i}.png'))
    # the grid sheet: snapped and keyed like the others, cut by band and column, trimmed
    from snap_plates import snap, PITCH
    from cut_sheet import key
    g = key(snap(os.path.join(SRC, GRID_SHEET), palette=False).convert('RGB'))
    # Between leaves the ground shows through and the upscaler blends it into a dark
    # purple the edge peel never reaches: on this sheet any clearly magenta-tinted
    # pixel goes, inside the plant as well as on its rim.
    gi = g.astype(int)
    inner = (gi[..., 0] - gi[..., 1] > 40) & (gi[..., 2] - gi[..., 1] > 40)
    g[..., 3] = np.where(inner, 0, g[..., 3])
    def cell(row, col):
        y0, y1 = (int(v / PITCH) for v in GRID_ROWS[row])
        cx = GRID_COLS[col] / PITCH; half = 98 / PITCH
        x0, x1 = int(cx - half), int(cx + half)
        sub = g[y0:y1, x0:x1]
        ys, xs = np.nonzero(sub[..., 3])
        return Image.fromarray(sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    for name, cols in GRID_SETS.items():
        for i, c in enumerate(cols):
            cell(name, c).save(os.path.join(DEST, f'{name}-{i}.png'))
    ripe = np.asarray(cell('tomato', 5)).astype(float)
    r, gg, b = ripe[..., 0], ripe[..., 1], ripe[..., 2]
    fruit = (ripe[..., 3] > 0) & (r > gg + 45) & (r > b + 25)
    lum = (r + gg + b) / 3 / 255
    for colour, tint in TOMATO_TINT.items():
        out = ripe.copy()
        if tint:
            k = np.clip(0.45 + 1.1 * lum, 0.35, 1.5)
            for ch in range(3):
                out[..., ch] = np.where(fruit, np.clip(tint[ch] * k, 0, 255), out[..., ch])
        Image.fromarray(out.astype(np.uint8)).save(os.path.join(DEST, f'tomato_ripe-{colour}.png'))
    for name, (sheet, c) in EXTRA.items():
        get(sheet, c).save(os.path.join(DEST, f'{name}.png'))
    rgba, idx = cells[GRAIN[0]]
    b = idx[GRAIN[1]]
    w = (b[2] - b[0]) / GRAIN[2]
    for i in range(GRAIN[2]):
        x0 = int(round(b[0] + i * w)) + 2; x1 = int(round(b[0] + (i + 1) * w)) - 2
        Image.fromarray(rgba[b[1] + 2:b[3] - 2, x0:x1]).save(os.path.join(DEST, f'grain-{i}.png'))
    # Last pass over everything: magenta the edge peel missed, blended into the dark
    # between leaves and stalks. Stamped hundreds of times across a field strip it read
    # as a purple speckle. On a grain tile (a solid patch) it is recoloured to straw; on a
    # plant it goes. A rose is pink for real, so roses are left alone.
    for fn in os.listdir(DEST):
        if fn.startswith('rose'):
            continue
        path = os.path.join(DEST, fn)
        a = np.asarray(Image.open(path).convert('RGBA')).astype(int)
        r_, g_, b_ = a[..., 0], a[..., 1], a[..., 2]
        if fn.startswith('grain'):
            tint = (a[..., 3] > 0) & (r_ - g_ > 20) & (b_ - g_ > 10)
            lum = (r_ + g_ + b_) / 3
            for ch, k in enumerate((1.05, 0.9, 0.55)):
                a[..., ch] = np.where(tint, np.clip(lum * k, 0, 255), a[..., ch])
        else:
            tint = (a[..., 3] > 0) & (r_ - g_ > 40) & (b_ - g_ > 40)
            a[..., 3] = np.where(tint, 0, a[..., 3])
        Image.fromarray(a.astype(np.uint8)).save(path)
    print(len(os.listdir(DEST)), 'sprites in', DEST)

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
SETS = {
    'bean':       ('tall', ['0.0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6']),
    'tomato':     ('tall', ['0.7', '0.8', '0.9', '0.10', '0.11', '0.12', '0.13']),
    'pea':        ('tall', ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6']),
    'corn':       ('tall', ['2.0', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6']),
    'chili':      ('tall', ['3.0', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6']),
    'rose':       ('comp', ['5.0', '5.1', '5.1', '5.2', '5.2', '5.3', '5.4']),
    'cabbage':    ('comp', ['0.0', '0.1', '0.2', '0.3', '0.3', '0.5', '0.6']),
    'garlic':     ('comp', ['1.0', '1.1', '1.2', '1.4', '1.5', '1.7', '1.8']),
    'strawberry': ('comp', ['3.9', '3.9', '3.10', '3.11', '3.11', '3.12', '3.14']),
}
# ripe tomato colours on the tall sheet, row 1 right
TOMATO_RIPE = {'red': '1.7', 'pink': '1.8', 'black': '1.9', 'green': '1.10', 'cream': '1.11', 'orange': '1.12', 'plum': '1.13'}
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
    for colour, c in TOMATO_RIPE.items():
        get('tall', c).save(os.path.join(DEST, f'tomato_ripe-{colour}.png'))
    for name, (sheet, c) in EXTRA.items():
        get(sheet, c).save(os.path.join(DEST, f'{name}.png'))
    rgba, idx = cells[GRAIN[0]]
    b = idx[GRAIN[1]]
    w = (b[2] - b[0]) / GRAIN[2]
    for i in range(GRAIN[2]):
        x0 = int(round(b[0] + i * w)) + 2; x1 = int(round(b[0] + (i + 1) * w)) - 2
        Image.fromarray(rgba[b[1] + 2:b[3] - 2, x0:x1]).save(os.path.join(DEST, f'grain-{i}.png'))
    print(len(os.listdir(DEST)), 'sprites in', DEST)

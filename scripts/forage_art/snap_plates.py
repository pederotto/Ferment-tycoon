"""Snap the owner's generated place plates onto their own pixel grid.

    python3 scripts/forage_art/snap_plates.py <folder of generated images>

The generator paints at 480x268 and upscales to 1376x768 by 2.867, so the
art's pixels sit on that grid; measured by FFT of the edge profile, every plate
has the same pitch and the same phase (cell edges at x = -0.48 + k*2.867,
y = -0.61 + k*2.867). Each cell is read as the median of the four source pixels
round its centre, which throws away the upscaler's blur and most of the JPEG
noise, then one row is repeated top and bottom to make a true 16:9 480x270, and
the plate is cut to 64 colours with no dithering (the art is already flat
colour; this only removes what the JPEG added).

Output: art/estate/<place>-<variant>.png (64-colour palette PNGs), the sources
export_estate.py ships as lossless WebP (~47 KB a plate).

A new batch needs only a line in SOURCES: the image stem, the place, and the
order its five versions were saved in (summer, spring, autumn, winter, snow is
what the brief asked for and what came).
"""
import os, re, sys, glob
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DEST = os.path.join(REPO, 'art', 'estate')

ORDER = ['summer', 'spring', 'autumn', 'winter', 'winter_snow']
SOURCES = {
    '3mn8t93': ('home_oak', ORDER),
    'l14jrwl': ('beech_hanger', ORDER),
    '2sm3j42': ('river_poplars', ORDER),
    'juhxqij': ('hedgerow', ORDER),
    'oh0u3lo': ('chip_track', ORDER),
    'n9c343': ('coast_thorn', ORDER),
    'otucuso': ('bog', ORDER),
    'rdfzhyr': ('hazel_coppice', ORDER),            # (5) is a second copy of the snow
    'd4p1g3': ('harbour', ORDER),
    '7rp4a27': ('polytunnel', ORDER),
    'ai7n02': ('top_field', ORDER),
    't1yf76': ('walled_garden', ORDER),
    'tt4gcw': ('orangery', ['summer', 'spring', 'autumn', 'winter_snow']),  # no clear winter came
    # the second batch; a sixth image in a set is a sprite sheet, not a plate
    'r92u4r': ('hen_run', ORDER),
    'wzj3y2': ('worm_shed', ORDER),
    'cy615i': ('pine_plantation', ORDER),
    'xxfz5j': ('wild_map', ORDER),
    # (3) is the map-parts sheet and (4) a copy of (2); autumn and spring came third
    'hp0qrm': ('farm_map', ['winter', 'winter_snow', 'summer', None, None, 'autumn', 'spring']),
    # the third batch: (5)-(9) are copies of the first five
    'vyipot': ('orchard', ORDER),
}

W, H = 480, 268
PITCH = 1376 / 480
CX = 0.95 + np.arange(W) * PITCH
CY = 0.82 + np.arange(H) * PITCH


def snap(path: str, palette: bool = True) -> Image.Image:
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    if a.shape[:2] != (768, 1376):
        raise ValueError(f'{path}: expected 1376x768, got {a.shape[1]}x{a.shape[0]}')
    x0 = np.clip(np.floor(CX - 0.5).astype(int), 0, a.shape[1] - 2)
    y0 = np.clip(np.floor(CY - 0.5).astype(int), 0, a.shape[0] - 2)
    st = np.stack([a[y0[:, None] + dy, x0[None, :] + dx] for dy in (0, 1) for dx in (0, 1)])
    n = np.median(st, axis=0)
    n = np.concatenate([n[:1], n, n[-1:]], axis=0)          # 268 -> 270, a true 16:9
    im = Image.fromarray(np.clip(n + 0.5, 0, 255).astype(np.uint8))
    # A sprite sheet keeps its colours: a palette cut on a sheet that is mostly
    # magenta spends its colours on the ground and tints every sprite.
    return im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) if palette else im


def index(path: str) -> int:
    m = re.search(r'\((\d+)\)', path)
    return int(m.group(1)) if m else 0


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads')
    os.makedirs(DEST, exist_ok=True)
    for stem, (place, order) in SOURCES.items():
        files = sorted(glob.glob(os.path.join(src, f'Gemini_Generated_Image_{stem}*.jpeg')), key=index)
        for f in files:
            i = index(f)
            if i >= len(order) or order[i] is None:
                continue
            out = os.path.join(DEST, f'{place}-{order[i]}.png')
            snap(f).save(out, optimize=True)
            print(os.path.basename(out), os.path.getsize(out) // 1024, 'KB')

"""Render every ground and farm plate in every season, plus the weather that changes how it looks:
winter snow, and hoarfrost in spring and autumn. Interiors only take the seasons."""
import sys, time
from PIL import Image
import pxart
from scenes2 import SCENES
from scenes3 import SCENES3, GEOM
import json

ALL = dict(SCENES); ALL.update(SCENES3)
VARIANTS = [('spring', 'clear', 'spring'), ('summer', 'clear', 'summer'), ('autumn', 'clear', 'autumn'), ('winter', 'clear', 'winter'),
            ('winter', 'snow', 'winter_snow'), ('spring', 'frost', 'spring_frost'), ('autumn', 'frost', 'autumn_frost')]
INTERIOR = {'polytunnel'}

def render(k, season, wx):
    pxart.WX, pxart.SEASON = wx, season
    cv = ALL[k](season)
    cv.grade()
    # pixel art keeps a palette: snapping back to one also keeps the plate small
    # (blended frost otherwise produced ~1,600 colours and three times the bytes)
    return Image.fromarray(cv.out()).quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')

if __name__ == '__main__':
    D = sys.argv[1]
    which = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] != 'all' else list(ALL)
    only = sys.argv[3].split(',') if len(sys.argv) > 3 else None
    t0 = time.time()
    for k in which:
        for season, wx, name in VARIANTS:
            if only and name not in only: continue
            if k in INTERIOR and wx != 'clear': continue
            render(k, season, wx).save(f'{D}/scene_{k}_{name}.png')
    pxart.WX, pxart.SEASON = 'clear', 'summer'
    json.dump(GEOM, open(f'{D}/geom.json', 'w'))
    print('rendered in', round(time.time() - t0, 1), 's')

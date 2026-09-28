import base64, io, json, sys
import numpy as np
from PIL import Image
sys.path.insert(0, '.')
import convert2
from convert2 import to_sprite
from pxart import Canvas, P

def uri(im, fmt):
    b = io.BytesIO()
    if fmt == 'WEBP': im.save(b, 'WEBP', lossless=True, quality=100, method=6)
    else: im.save(b, 'PNG', optimize=True)
    return f"data:image/{fmt.lower()};base64," + base64.b64encode(b.getvalue()).decode()

scenes = ['home_oak','beech_hanger','river_poplars','hedgerow','chip_track','coast_thorn','bog','map',
          'pine_plantation','hazel_coppice','harbour','salt_pans','walled_garden','polytunnel','top_field','orchard','orangery','hives','hen_run','farm_map']
art = {'plates': {}, 'sprites': {}, 'geom': json.load(open('out/geom.json'))}
import os
for k in scenes:
    for s in ['spring','summer','autumn','winter','winter_snow','spring_frost','autumn_frost']:
        f = f'out/scene_{k}_{s}.png'
        if os.path.exists(f):
            art['plates'][f'{k}:{s}'] = uri(Image.open(f).convert('RGB'), 'WEBP')
ids = list(json.loads(open('species.js').read()[len('window.GAME_SPECIES='):-1]).keys())
LIGHT_OUT = {'black_beluga_lentils', 'hopi_blue_corn'}
for i in ids:
    if i in LIGHT_OUT:
        convert2.OUT = np.array([150, 132, 100], np.float32)
    art['sprites'][i] = {'big': uri(Image.fromarray(to_sprite(i, 40)), 'PNG'),
                         'small': uri(Image.fromarray(to_sprite(i, 20, k=6)), 'PNG'),
                         'tiny': uri(Image.fromarray(to_sprite(i, 12, k=5, erode=3, rim=False)), 'PNG')}
    convert2.OUT = np.array([27, 18, 10], np.float32)
cv = Canvas(72, 22, seed=5); mask = np.zeros((22, 72), bool)
for k in range(26):
    x = 6 + k * 2.4 + np.random.default_rng(k).uniform(-2, 2)
    cv.sphere(x, 13 + np.random.default_rng(k + 9).uniform(-2, 2), np.random.default_rng(k + 3).uniform(4, 6.5), P['chip'], rough=0.35, seed=k, tex=0.35, freq=9, mask_out=mask)
rgba = np.zeros((22, 72, 4), np.uint8); rgba[..., :3] = cv.out(); rgba[..., 3] = mask * 255
art['bed'] = uri(Image.fromarray(rgba), 'PNG')
s = 'window.ART=' + json.dumps(art) + ';'
open('assets2.js', 'w').write(s)
print('assets2.js KB', len(s) // 1024, '| plates', len(art['plates']), '| sprites', len(art['sprites']))

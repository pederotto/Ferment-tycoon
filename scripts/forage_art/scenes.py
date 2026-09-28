import math, sys
import numpy as np
from PIL import Image
from pxart import Canvas, P, W, H, hx, mix, fade, season_leaf, season_grass, INK

SKY_FOR = {'spring': 'sky_clear', 'summer': 'sky_clear', 'autumn': 'sky_autumn', 'winter': 'sky_winter'}


def darken_ellipse(cv, cx, cy, rx, ry, amt):
    m = (((cv.xx - cx) / rx) ** 2 + ((cv.yy - cy) / ry) ** 2) < 1
    d = amt * (1 - np.clip((((cv.xx - cx) / rx) ** 2 + ((cv.yy - cy) / ry) ** 2), 0, 1))
    cv.px[m] = cv.px[m] * (1 - d[m][:, None]) + np.array([20, 16, 24], np.float32) * d[m][:, None]


def warm_light(cv, cx, cy, rad, amt, col=(255, 214, 150)):
    d = np.sqrt((cv.xx - cx) ** 2 + (cv.yy - cy) ** 2) / rad
    t = np.clip(1 - d, 0, 1) ** 2 * amt
    cv.px = cv.px * (1 - t[..., None]) + np.array(col, np.float32) * t[..., None]


def oak(cv, x, base, season, seed, scale=1.0):
    """The Home Oak: broad, low and old, a short massive trunk and a crown wider than the frame."""
    rng = np.random.default_rng(seed)
    top = base - 58 * scale
    def hw(y):
        t = (y - top) / (base - top)
        w = (15 + 5 * t) * scale
        if y > base - 18 * scale:
            k = (y - (base - 18 * scale)) / (18 * scale)
            w += k * k * 20 * scale
        return w
    tips = []
    for (a, ln, wd) in [(-2.75, 80, 12), (-2.3, 70, 11), (-1.85, 60, 10), (-1.35, 62, 10), (-0.85, 72, 11), (-0.4, 82, 12)]:
        cv.branch(x + math.cos(a) * 8, top + 10 * scale, a, ln * scale * 0.5, wd * scale, P['bark'], 5, rng, tips=tips, spread=0.45)
    leaf = season_leaf(season)
    if leaf is not None:
        clumps = []
        for (tx, ty) in tips:
            clumps.append((tx + rng.uniform(-3, 3), ty + rng.uniform(-2, 4), rng.uniform(9, 14) * scale, rng.uniform(0.35, 1)))
        for _ in range(70):
            a = rng.uniform(math.pi, math.pi * 2) if rng.random() < 0.85 else rng.uniform(0.15, math.pi - 0.15)
            r = math.sqrt(rng.random())
            ry = 62 if math.sin(a) < 0 else 22
            clumps.append((x + math.cos(a) * r * 150 * scale, top - 18 * scale + math.sin(a) * r * ry * scale, rng.uniform(11, 17) * scale, rng.uniform(0, 0.55)))
        if season == 'autumn':
            ramps = [P['leaf_russet'], P['leaf_bronze'], P['leaf_olive'], P['leaf_autumn']]
            weights = [0.42, 0.28, 0.2, 0.1]
            buckets = [[] for _ in ramps]
            for c in clumps:
                buckets[rng.choice(len(ramps), p=weights)].append(c)
            # draw everything back to front across ramps so the mix interleaves
            order = sorted([(c[3], i, c) for i, b in enumerate(buckets) for c in b], key=lambda k: k[0])
            mask = np.zeros((cv.h, cv.w), bool)
            glob = (x - 30, top - 30, 120)
            for n, (dep, i, c) in enumerate(order):
                cv.sphere(c[0], c[1], c[2], ramps[i], rough=0.16, seed=seed + n * 13, darken=(1 - dep) * 0.2, mask_out=mask, tex=0.06, freq=5 + n % 3, glob=glob)
            cv.shade_edge(mask, P['leaf_russet'][0], P['leaf_russet'][1])
        else:
            cv.foliage(clumps, leaf, seed=seed + 2)
    cv.cylinder(x, top, base + 1, hw, P['bark'], seed=seed, fissures=11)
    return tips

def bramble(cv, x, y, season, seed, w=26):
    rng = np.random.default_rng(seed)
    leaf = season_leaf(season) or [mix(a, hx('#2a1e2a'), 0.55) for a in P['leaf_summer']]
    if season == 'autumn':
        leaf = [mix(a, b, 0.45) for a, b in zip(P['leaf_summer'], P['leaf_autumn'])]
    clumps = [(x + rng.uniform(-w, w), y + rng.uniform(-12, 2), rng.uniform(6, 10), rng.random()) for _ in range(14)]
    cv.foliage(clumps, leaf, seed=seed)
    if season in ('summer', 'autumn'):
        for _ in range(18):
            bx, by = x + rng.uniform(-w, w), y + rng.uniform(-10, 2)
            c = hx('#1c1426') if season == 'autumn' else hx('#8a2430')
            cv.put(bx, by, c); cv.put(bx + 1, by, c); cv.put(bx, by - 1, hx('#5a4a70') if season == 'autumn' else hx('#c04a4a'))
    # arching canes
    for k in range(5):
        a0 = rng.uniform(-2.8, -0.4)
        for s in range(int(w * 0.9)):
            t = s / (w * 0.9)
            px = x + math.cos(a0) * s; py = y - 6 + math.sin(a0) * s * 0.6 + t * t * 14
            cv.put(px, py, hx('#5a2a30') if k % 2 else hx('#6a3a34'))


def home_oak(season):
    cv = Canvas(seed=11)
    sky = P[SKY_FOR[season]]
    horizon = 124
    cv.sky(sky, horizon + 4, clouds=[(60, 26, 70, 10), (250, 16, 90, 12), (340, 44, 50, 7)], seed=3)
    sky_c = sky[3]
    # far hill and the hanger behind
    for x in range(W):
        y = 112 + math.sin(x / 50) * 4 + math.sin(x / 17 + 1) * 1.5
        land = P['snow'][4] if cv.wx == 'snow' else mix(P['rime'][3], P['grass_' + season][3], 0.4) if cv.wx == 'frost' else P['grass_' + season][3]
        cv.rect(x, y, 1, horizon + 2 - y, mix(land, sky_c, 0.5))
    leaf = season_leaf(season)
    hanger = P['leaf_bronze'] if season == 'autumn' else (leaf or P['beech'])
    for band in range(3):
        cv.treeline(horizon - 30 + band * 12, hanger, seed=5 + band, height=(12, 22), width=(8, 13), sky=sky_c, fade_t=0.62 - band * 0.12, bare=leaf is None, x0=0, x1=160 - band * 30)
    cv.treeline(horizon - 2, hanger, seed=8, height=(12, 22), width=(8, 14), sky=sky_c, fade_t=0.5, bare=leaf is None)
    cv.treeline(horizon + 4, leaf or P['beech'], seed=6, height=(10, 18), width=(9, 15), sky=sky_c, fade_t=0.3, bare=leaf is None, x0=0, x1=110)
    cv.treeline(horizon + 4, leaf or P['beech'], seed=7, height=(10, 18), width=(9, 15), sky=sky_c, fade_t=0.3, bare=leaf is None, x0=280, x1=W)
    cv.ground(horizon, season_grass(season), seed=9, far_fade=0.5, sky=sky_c)
    rng = np.random.default_rng(21)
    if season in ('autumn', 'winter'):
        drift = cv.noise(26, 31, 3)
        lit = P['litter'] if season == 'autumn' else [mix(c, hx('#4a4034'), 0.55) for c in P['litter']]
        cv.leaves(horizon + 10, drift, 0.5 if season == 'autumn' else 0.6, lit, density=0.5 if season == 'autumn' else 0.25, seed=33)
    elif season == 'spring':
        for _ in range(80):
            x, y = rng.integers(0, W), rng.integers(horizon + 30, H)
            cv.put(x, y, hx('#f0ecd8')); cv.put(x, y - 1, hx('#e8d060') if rng.random() > 0.6 else hx('#f6f2e0'))
    # shadow the canopy casts
    darken_ellipse(cv, 186, 186, 170, 24, 0.5)
    # the wet hollow, front left
    darken_ellipse(cv, 92, 198, 44, 9, 0.55 if cv.wx != 'snow' else 0.25)
    for _ in range(40 if cv.wx != 'snow' else 0):
        x, y = rng.uniform(56, 128), rng.uniform(192, 205)
        cv.put(x, y, hx('#3e5a2c') if rng.random() > 0.5 else hx('#2c4222'))
    oak(cv, 186, 180, season, seed=40)
    # roots across the ground
    cv.root([(160, 178), (132, 184), (106, 190), (88, 191)], 4.5, 1.2, P['bark'], seed=70)
    cv.root([(212, 178), (240, 185), (266, 192), (284, 194)], 4.5, 1.2, P['bark'], seed=71)
    cv.root([(188, 181), (184, 192), (178, 204)], 3.5, 1.2, P['bark'], seed=72)
    bramble(cv, 326, 184, season, seed=60, w=34)
    # bracken in the corners, in shade because it is nearest
    if season == 'autumn':
        br = [mix(c, hx('#140c08'), 0.25) for c in P['leaf_russet']]
    elif season == 'winter':
        br = [mix(c, hx('#3a3228'), 0.45) for c in P['leaf_russet']]
    else:
        br = [mix(c, hx('#0c140a'), 0.25) for c in season_leaf(season)]
    for (x, y, sz, f, sd) in [(-6, 218, 46, 1, 1), (20, 220, 40, 1, 2), (8, 222, 30, 1, 3), (392, 218, 46, -1, 4), (366, 221, 38, -1, 5), (382, 222, 28, -1, 6)]:
        cv.bracken(x, y, sz, br, flip=f, seed=sd)
    for _ in range(14):
        cv.tuft(rng.uniform(0, W), rng.uniform(186, 214), season_grass(season), h=rng.uniform(4, 8), rng=rng)
    warm_light(cv, 40, -20, 260, 0.16 if season != 'winter' else 0.06)
    return cv


def save(cv, path, scale=3):
    im = Image.fromarray(cv.out())
    im.save(path)
    im.resize((W * scale, H * scale), Image.NEAREST).save(path.replace('.png', '@3x.png'))


if __name__ == '__main__':
    D = sys.argv[1]
    for s in sys.argv[2:] or ['autumn']:
        save(home_oak(s), f'{D}/home_oak_{s}.png')
        print('ok', s)

import math, sys, json
import numpy as np
from PIL import Image
from pxart import Canvas, P, W, H, hx, mix, fade, season_leaf, season_grass, INK, BAYER, LIGHT
from scenes import darken_ellipse, warm_light, oak, bramble, SKY_FOR, home_oak

BEECH_LEAF = {
    'spring': ['#1e3418', '#2c4c1e', '#447024', '#62942c', '#86b438', '#acd052', '#d2e67a'],
    'summer': ['#15261a', '#1f3820', '#2c4e26', '#3e662c', '#548034', '#6e983e', '#90b04e'],
    'autumn': ['#2a140c', '#482010', '#6e3014', '#984618', '#bc6220', '#d8842e', '#eeae4a'],
    'winter': None,
}
BEECH_LEAF = {k: ([hx(c) for c in v] if v else None) for k, v in BEECH_LEAF.items()}
BEECH_BARK = [hx(c) for c in ['#232622', '#343832', '#474b44', '#5c6058', '#73766c', '#8c8d82', '#a6a698']]
MARCESCENT = [hx(c) for c in ['#2e1a10', '#4a2a16', '#6a3c1c', '#8a5224', '#a86a30', '#c4863e']]


def sky_for(cv, season, weather_y, clouds, seed=3):
    sky = P[SKY_FOR[season]]
    cv.sky(sky, weather_y, clouds=clouds, seed=seed)
    return sky, sky[3]


def log(cv, x0, y0, x1, y1, rad, r, seed=0, end_left=True):
    """A fallen trunk: a tapered horizontal cylinder with end grain showing."""
    n = len(r); steps = int(math.hypot(x1 - x0, y1 - y0) * 1.4) + 1
    for i in range(steps + 1):
        t = i / steps; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
        rr = rad * (1 - 0.25 * t)
        for dy in range(-int(rr), int(rr) + 1):
            v = 0.74 - 0.6 * (dy + rr) / (2 * rr + 0.01)
            if abs(dy) >= int(rr):
                v -= 0.22
            if (int(x) * 7 + dy * 3) % 11 == 0:
                v -= 0.12
            yy, xx = int(round(y + dy)), int(round(x))
            if 0 <= xx < cv.w and 0 <= yy < cv.h:
                fv = max(0, min(0.999, v)) * (n - 1); b = int(fv)
                cv.px[yy, xx] = r[min(n - 1, b + (1 if (fv - b) > BAYER[yy % 4, xx % 4] else 0))]
                if cv.wx == 'snow' and dy <= -int(rr) + 1:
                    cv.px[yy, xx] = P['snow'][6 if dy == -int(rr) else 5]
                elif cv.wx == 'frost' and dy == -int(rr):
                    cv.px[yy, xx] = P['rime'][4]
        cv.put(x, y + rr + 1, r[0])
    ex, ey = (x0, y0) if end_left else (x1, y1)
    er = rad if end_left else rad * 0.75
    for dy in range(-int(er), int(er) + 1):
        for dx in range(-int(er * 0.45), int(er * 0.45) + 1):
            d = math.hypot(dx / max(0.5, er * 0.45), dy / er)
            if d <= 1:
                ring = int(d * 4) % 2
                cv.put(ex + dx, ey + dy, P['chip'][4] if ring else P['chip'][3])


def stump(cv, x, base, hw, h, r, top_r=None, seed=0):
    top = base - h
    cv.cylinder(x, top, base + 1, lambda y: hw + (2 if y > base - 3 else 0), r, seed=seed, fissures=4)
    tr = top_r or P['chip']
    for dy in range(-3, 4):
        for dx in range(-int(hw), int(hw) + 1):
            e = (dx / hw) ** 2 + (dy / 3.2) ** 2
            if e <= 1:
                ring = int(math.sqrt(e) * 5) % 2
                c = tr[2] if e > 0.8 else (tr[4] if ring else tr[3])
                if cv.wx == 'snow':
                    c = P['snow'][6] if dy < 1 else P['snow'][4]
                elif cv.wx == 'frost' and e > 0.6:
                    c = P['rime'][4]
                cv.put(x + dx, top + dy - (1 if cv.wx == 'snow' and dy < 0 else 0), c)
    darken_ellipse(cv, x + 3, base + 2, hw + 6, 3, 0.45 if cv.wx != 'snow' else 0.2)


def beech(cv, x, base, height, season, seed, hw=6, fade_t=0.0, sky_c=None, wound=None, crown=True):
    rng = np.random.default_rng(seed)
    r = fade(BEECH_BARK, sky_c, fade_t) if sky_c is not None else BEECH_BARK
    top = base - height
    cv.cylinder(x, top, base + 1, lambda y: hw + max(0, (y - (base - 8)) * 0.35) ** 1.2, r, seed=seed, fissures=0, streaks=False)
    for side in (-1, 1):
        for k in range(7):
            cv.put(x + side * (hw + k * 0.9), base - 3 + k * 0.45, r[2]); cv.put(x + side * (hw + k * 0.9), base - 2 + k * 0.45, r[1])
    # algae and moss on the side away from the light
    for yy in range(int(top), int(base)):
        if rng.random() < 0.55:
            cv.put(x + hw * rng.uniform(0.35, 0.85), yy, mix(r[2], hx('#4a6a34'), 0.45))
    # beech bark: smooth, with pale horizontal lenticels
    for _ in range(int(height / 6)):
        yy = rng.uniform(top + 4, base - 4); xx = x + rng.uniform(-hw * 0.6, hw * 0.5)
        cv.rect(xx, yy, rng.integers(2, 4), 1, r[4])
    if wound:
        wy = wound
        for dy in range(-7, 8):
            for dx in range(-3, 4):
                e = (dx / 3.2) ** 2 + (dy / 7.5) ** 2
                if e <= 1:
                    cv.put(x - hw * 0.2 + dx, wy + dy, P['bark'][2] if e > 0.55 else P['bark'][1])
        for dy in range(-8, 9):
            cv.put(x - hw * 0.2 - 4, wy + dy, r[4]); cv.put(x - hw * 0.2 + 4, wy + dy, r[2])
    if not crown:
        return
    leaf = BEECH_LEAF[season]
    tips = []
    for a in (-2.2, -1.7, -1.3, -0.9):
        cv.branch(x, top + 6, a, height * 0.16, hw * 0.9, r, 4, rng, tips=tips, spread=0.4)
    if leaf is not None:
        lr = fade(leaf, sky_c, fade_t) if sky_c is not None else leaf
        cl = [(tx + rng.uniform(-2, 2), ty, rng.uniform(8, 13), rng.random()) for (tx, ty) in tips]
        cv.foliage(cl, lr, seed=seed + 3, outline=fade_t < 0.2)
    elif rng.random() < 0.6:
        # young beeches keep their dead leaves all winter
        mr = fade(MARCESCENT, sky_c, fade_t) if sky_c is not None else MARCESCENT
        for (tx, ty) in tips[: len(tips) // 2]:
            cv.sphere(tx, ty + 3, 3.5, mr, rough=0.4, seed=seed + int(tx), tex=0.2, freq=7)


def beech_hanger(season):
    cv = Canvas(seed=21)
    sky, sky_c = sky_for(cv, season, 80, [(80, 18, 60, 8), (300, 30, 70, 9)], seed=5)
    # inside a wood the distance is not sky but green-gold haze
    haze = {'spring': ['#3c4c2c', '#58703a', '#86a052', '#b4c47a'], 'summer': ['#26341e', '#3a4e2a', '#5a7040', '#86985e'],
            'autumn': ['#3a2a1a', '#5e4424', '#8e6c38', '#c09a5a'], 'winter': ['#3a3a3a', '#555654', '#7a7c76', '#a4a69c']}[season]
    haze = [hx(c) for c in haze]
    cv.ramp_fill(cv.yy < 200, np.clip(0.95 - np.abs(cv.yy - 96) / 110, 0, 1), haze)
    sky_c = haze[2]
    # the slope: ground rises to the left
    def gy(x):
        return 150 - x * 0.2 + math.sin(x / 40) * 3
    rng = np.random.default_rng(3)
    # distant trunks in haze
    for i in range(22):
        x = rng.uniform(-10, W + 10); b = gy(x) - rng.uniform(10, 26)
        beech(cv, x, b, rng.uniform(80, 130), season, seed=100 + i, hw=rng.uniform(2, 3.5), fade_t=0.7, sky_c=sky_c, crown=False)
    for i in range(12):
        x = rng.uniform(-10, W + 10); b = gy(x) - rng.uniform(2, 10)
        beech(cv, x, b, rng.uniform(110, 150), season, seed=150 + i, hw=rng.uniform(3, 4.5), fade_t=0.5, sky_c=sky_c, crown=False)
    # the canopy overhead, in shade from below
    leaf = BEECH_LEAF[season]
    if leaf is not None:
        cl = [(rng.uniform(-20, W + 20), rng.uniform(-14, 30), rng.uniform(14, 24), rng.random() * 0.6) for _ in range(46)]
        cv.foliage(cl, [mix(c, hx('#0e140c'), 0.2) for c in leaf], seed=7)
    else:
        for i in range(10):
            cv.branch(rng.uniform(0, W), -5, rng.uniform(0.6, 2.5), 50, 3, P['beech'], 5, rng, spread=0.7)
    # the forest floor: a carpet of copper litter, beech woods have little else
    mask = cv.yy >= np.array([[gy(x) for x in range(W)]])
    n = cv.noise(18, 4, 3)
    floor = P['litter'] if season != 'spring' else [mix(a, b, 0.5) for a, b in zip(P['litter'], P['grass_spring'][:6])]
    if season == 'winter':
        floor = [mix(c, hx('#5a5048'), 0.35) for c in P['litter']]
    depth = np.clip((cv.yy - 120) / 96, 0, 1)
    cv.ramp_fill(mask, np.clip(0.55 - 0.3 * depth + (n - 0.5) * 0.3, 0, 1), floor)
    cv.horizon = 110
    cv.snow_fill(mask, seed=12, straw=floor, density=0.85)
    cv.leaves(110, cv.noise(10, 9, 2), 0.35, floor, density=0.35, seed=12)
    if season == 'spring':
        # bluebells under the beeches
        for _ in range(420):
            x = rng.integers(0, W); y = int(gy(x) + rng.uniform(4, 60))
            if y < H:
                cv.put(x, y, hx('#5a5aa8') if rng.random() > 0.3 else hx('#7a7ac8')); cv.put(x, y + 1, hx('#3a5a2a'))
    # middle trunks
    for i, x in enumerate([40, 118, 236, 300]):
        beech(cv, x, gy(x) + 8, 160, season, seed=200 + i, hw=5 + i % 2, fade_t=0.3, sky_c=sky_c, crown=False)
    # the fallen beech, midground
    log(cv, 150, gy(150) + 22, 262, gy(262) + 34, 7, P['beech'], seed=9, end_left=True)
    # stump at left, for nameko
    stump(cv, 62, gy(62) + 44, 10, 14, P['beech'], seed=4)
    # the wounded beech, near and right
    beech(cv, 330, 214, 240, season, seed=300, hw=13, wound=120, crown=False)
    beech(cv, 16, 218, 240, season, seed=301, hw=11, crown=False)
    # light through the canopy
    if season != 'winter':
        for (x0, w0) in [(120, 16), (190, 10), (250, 20)]:
            for y in range(0, 190):
                x = x0 + y * 0.45
                for k in range(int(w0)):
                    if 0 <= x + k < W and (int(x + k) + y) % 2 == 0:
                        cv.px[y, int(x + k)] = cv.px[y, int(x + k)] * 0.88 + np.array([250, 230, 170], np.float32) * 0.12
    warm_light(cv, 60, -40, 280, 0.1 if season != 'winter' else 0.04)
    return cv


def pollard(cv, x, base, season, seed, fade_t=0.0, sky_c=None):
    rng = np.random.default_rng(seed)
    r = fade(P['bark'], sky_c, fade_t) if sky_c is not None else P['bark']
    top = base - 26
    cv.cylinder(x, top, base + 1, lambda y: 6 + (3 if y < top + 5 else 0), r, seed=seed, fissures=5)
    cv.sphere(x, top, 9, r, rough=0.3, seed=seed, tex=0.2, freq=7)
    leaf = season_leaf(season)
    tw = fade(P['twig'], sky_c, fade_t) if sky_c is not None else P['twig']
    for k in range(18):
        a = -math.pi / 2 + rng.uniform(-0.75, 0.75); ln = rng.uniform(18, 34)
        cv.line(x + rng.uniform(-6, 6), top, x + math.cos(a) * ln, top + math.sin(a) * ln, tw[3] if season == 'winter' else tw[2])
    if leaf is not None:
        wl = [mix(c, hx('#8a9a7a'), 0.35) for c in leaf]
        wl = fade(wl, sky_c, fade_t) if sky_c is not None else wl
        cl = [(x + rng.uniform(-18, 18), top - rng.uniform(10, 30), rng.uniform(8, 12), rng.random()) for _ in range(14)]
        cv.foliage(cl, wl, seed=seed, outline=fade_t < 0.2)


def black_poplar(cv, x, base, h, season, seed, fade_t=0.0, sky_c=None):
    rng = np.random.default_rng(seed)
    r = fade(P['bark'], sky_c, fade_t) if sky_c is not None else P['bark']
    top = base - h
    cv.cylinder(x, top + h * 0.3, base + 1, lambda y: 3 + (y - top) / h * 3, r, seed=seed, fissures=3)
    tips = []
    for a in (-2.3, -1.95, -1.6, -1.25, -0.9):
        cv.branch(x, top + h * 0.38, a, h * 0.3, 3, r, 4, rng, tips=tips, spread=0.3)
    leaf = season_leaf(season)
    if leaf is not None:
        lr = fade(leaf, sky_c, fade_t) if sky_c is not None else leaf
        if season == 'autumn':
            lr = fade(P['leaf_bronze'], sky_c, fade_t) if sky_c is not None else P['leaf_bronze']
        cl = [(tx, ty, rng.uniform(9, 13), rng.random()) for (tx, ty) in tips]
        cl += [(x + rng.uniform(-22, 22), top + rng.uniform(0, h * 0.4), rng.uniform(10, 14), rng.random() * 0.5) for _ in range(8)]
        cv.foliage(cl, lr, seed=seed, outline=fade_t < 0.2)


def river_poplars(season):
    cv = Canvas(seed=31)
    sky, sky_c = sky_for(cv, season, 96, [(60, 20, 80, 10), (280, 12, 60, 8)], seed=8)
    far_y = 96
    # far bank: water meadow, pollards and tall poplars
    cv.rect(0, 88, W, 12, mix(season_grass(season)[3], sky_c, 0.45))
    cv.horizon = 88
    cv.snow_fill((cv.yy >= 88) & (cv.yy < 100), seed=3)
    cv.treeline(far_y, season_leaf(season) or P['beech'], seed=30, height=(14, 24), width=(9, 14), sky=sky_c, fade_t=0.55, bare=season == 'winter')
    for i, x in enumerate([34, 170, 262]):
        black_poplar(cv, x, far_y, 74 + 12 * (i % 2), season, seed=10 + i, fade_t=0.38, sky_c=sky_c)
    for i, x in enumerate([100, 214, 330]):
        pollard(cv, x, far_y + 1, season, seed=20 + i, fade_t=0.3, sky_c=sky_c)
    snapshot = cv.px.copy()
    cv.water_band(100, 128, P['water'], sky_c, seed=4, reflect=snapshot)
    cv.ground(128, season_grass(season), seed=6)
    cv.horizon = 128
    # reeds at the water's edge
    rng = np.random.default_rng(9)
    reed = P['reed'] if season != 'winter' else [mix(c, hx('#8a7a5a'), 0.3) for c in P['reed']]
    for _ in range(90):
        x = rng.uniform(0, W)
        if 150 < x < 200:
            continue
        cv.tuft(x, rng.uniform(129, 134), reed, h=rng.uniform(6, 14), n=4, rng=rng)
    if season in ('summer', 'autumn'):
        for _ in range(8):
            x = rng.uniform(0, W); y = rng.uniform(116, 122)
            cv.rect(x, y - 3, 1, 3, reed[2]); cv.rect(x - 0.5, y - 5, 2, 3, hx('#4a3020'))
    # the fallen willow along the near bank
    log(cv, 206, 162, 330, 170, 7, P['bark'], seed=5, end_left=True)
    # cut poplar stumps
    stump(cv, 96, 176, 11, 12, P['poplar'], seed=1)
    stump(cv, 176, 156, 13, 14, P['poplar'], seed=2)
    stump(cv, 40, 200, 9, 8, P['bark'], seed=3)
    # the beaver's pencil-point willow
    b = 150; x = 348
    cv.cylinder(x, b - 22, b + 1, lambda y: 4, P['bark'], seed=7, fissures=3)
    for k in range(8):
        cv.rect(x - 4 + k, b - 22 - (8 - abs(k - 4) * 2), 1, 8 - abs(k - 4) * 2, P['chip'][4 if k < 4 else 3])
    cv.cap(x - 4, x + 4, b - 23, thick=1)
    for _ in range(14):
        cv.put(x + rng.uniform(-14, 14), b + rng.uniform(0, 4), P['chip'][4])
    # a rotten conifer log in the nettles
    log(cv, 250, 202, 330, 206, 5, [mix(c, hx('#3a2a1a'), 0.3) for c in P['bark']], seed=8, end_left=False)
    nettle = {'autumn': [mix(c, hx('#4a3a24'), 0.5) for c in P['leaf_olive']], 'winter': P['grass_winter']}.get(season, season_leaf(season))
    for _ in range(30):
        cv.tuft(rng.uniform(240, 340), rng.uniform(206, 214), nettle, h=rng.uniform(5, 10), n=3, rng=rng)
    # kingfisher on a snag over the water
    cv.line(128, 112, 142, 104, P['bark'][2])
    cv.rect(136, 101, 4, 3, hx('#1f86b0')); cv.put(139, 101, hx('#5cc0e0')); cv.rect(136, 104, 3, 1, hx('#d06a2a')); cv.put(140, 102, hx('#1a1a1a'))
    for (x, y, sz, f, sd) in [(-4, 218, 36, 1, 1), (390, 218, 34, -1, 2)]:
        cv.bracken(x, y, sz, [mix(c, hx('#0c140a'), 0.3) for c in (season_leaf(season) or P['leaf_russet'])], flip=f, seed=sd)
    warm_light(cv, 40, -20, 260, 0.1 if season != 'winter' else 0.04)
    return cv


def hawthorn_hedge(cv, x0, x1, y, season, seed, height=30):
    rng = np.random.default_rng(seed)
    leaf = {'spring': season_leaf('spring'), 'summer': season_leaf('summer'),
            'autumn': [mix(a, b, 0.5) for a, b in zip(P['leaf_olive'], P['leaf_russet'])],
            'winter': [mix(c, hx('#3a3030'), 0.55) for c in P['twig']]}[season]
    cl = []
    x = x0
    while x < x1:
        cl.append((x, y - rng.uniform(4, height * 0.8), rng.uniform(8, 13), rng.random()))
        x += rng.uniform(5, 9)
    m = cv.foliage(cl, leaf, seed=seed)
    ys, xs = np.where(m)
    if season == 'spring':
        for i in rng.choice(len(xs), min(len(xs), 500), replace=False):
            cv.put(xs[i], ys[i], hx('#f4f0e2') if rng.random() > 0.3 else hx('#e6dcc8'))
    if season == 'autumn' or season == 'winter':
        for i in rng.choice(len(xs), min(len(xs), 260 if season == 'autumn' else 90), replace=False):
            cv.put(xs[i], ys[i], hx('#9a1e1e')); cv.put(xs[i] + 1, ys[i], hx('#c03a2a'))
    return m


def honeysuckle(cv, x, y, season, seed, kind, fruit):
    """kind 'haskap' or 'twinberry'. Fruit only when in season."""
    rng = np.random.default_rng(seed)
    leaf = {'autumn': P['leaf_olive'], 'winter': [mix(c, hx('#4a4038'), 0.6) for c in P['leaf_olive']]}.get(season, season_leaf(season))
    cl = [(x + rng.uniform(-14, 14), y + rng.uniform(-14, 2), rng.uniform(6, 9), rng.random()) for _ in range(9)]
    cv.foliage(cl, leaf, seed=seed)
    if fruit:
        for _ in range(16):
            bx, by = x + rng.uniform(-14, 14), y + rng.uniform(-14, 2)
            if kind == 'haskap':
                cv.rect(bx, by, 2, 3, hx('#34406e')); cv.put(bx, by, hx('#8c9ab8'))
            else:
                cv.rect(bx - 1, by + 1, 4, 1, hx('#8a2a48'))
                cv.put(bx, by, hx('#16141c')); cv.put(bx + 2, by, hx('#16141c')); cv.put(bx, by - 1, hx('#5a5a70'))


def long_hedge(season, fruit=None):
    cv = Canvas(seed=41)
    sky, sky_c = sky_for(cv, season, 92, [(70, 18, 70, 9), (260, 26, 80, 10)], seed=11)
    # the field beyond the gate
    cv.rect(0, 84, W, 20, mix(season_grass(season)[4], sky_c, 0.35))
    cv.horizon = 84
    cv.snow_fill((cv.yy >= 84) & (cv.yy < 104), seed=4)
    cv.treeline(86, season_leaf(season) or P['beech'], seed=12, height=(8, 14), width=(8, 12), sky=sky_c, fade_t=0.55, bare=season == 'winter')
    cv.ground(100, season_grass(season), seed=13)
    # the woodland edge on the left, with its bank
    oak(cv, 30, 150, season, seed=44, scale=0.7)
    # an ash standard in the hedge
    rng = np.random.default_rng(5)
    tips = []
    cv.cylinder(250, 40, 124, lambda y: 3 + (y - 40) / 84 * 3, P['beech'], seed=2, fissures=4)
    for a in (-2.3, -1.9, -1.5, -1.1, -0.8):
        cv.branch(250, 60, a, 34, 3, P['beech'], 4, rng, tips=tips, spread=0.4)
    leaf = season_leaf(season)
    if leaf is not None:
        ashleaf = leaf if season != 'autumn' else [mix(a, b, 0.5) for a, b in zip(P['leaf_olive'], P['leaf_bronze'])]
        cl = [(tx, ty, rng.uniform(8, 11), rng.random()) for (tx, ty) in tips]
        cl += [(250 + rng.uniform(-40, 40), 40 + rng.uniform(-30, 14), rng.uniform(10, 14), rng.random() * 0.5) for _ in range(12)]
        cv.foliage(cl, ashleaf, seed=3)
    hawthorn_hedge(cv, 60, 214, 128, season, seed=7)
    hawthorn_hedge(cv, 296, W + 10, 128, season, seed=8)
    # the five-bar gate between the hedges
    fr = P['fence']
    cv.rect(214, 96, 5, 36, fr[3]); cv.rect(214, 96, 1, 36, fr[1]); cv.rect(290, 96, 5, 36, fr[3]); cv.rect(294, 96, 1, 36, fr[1])
    for k in range(5):
        cv.rect(219, 102 + k * 6, 71, 2, fr[4]); cv.rect(219, 103 + k * 6, 71, 1, fr[2])
        cv.cap(219, 290, 101 + k * 6, thick=1, seed=k)
    cv.line(219, 126, 289, 102, fr[4], 2)
    cv.cap(214, 219, 95, thick=2); cv.cap(290, 295, 95, thick=2)
    # the honeysuckles
    honeysuckle(cv, 196, 126, season, 17, 'haskap' if fruit != 'twinberry' else 'twinberry', fruit is not None and season == 'summer')
    honeysuckle(cv, 118, 124, season, 18, 'twinberry', season == 'summer')
    # the lane
    for y in range(140, H):
        t = (y - 140) / (H - 140)
        cv.rect(0, y, W, 1, mix(P['soil'][4], P['soil'][3], t))
    cv.ramp_fill((cv.yy >= 140), np.clip(0.6 - (cv.yy - 140) / 300 + (cv.noise(9, 3, 2) - 0.5) * 0.35, 0, 1), P['soil'])
    cv.snow_fill(cv.yy >= 140, seed=21)
    # two ruts and the grass that grows between them
    gm = cv.noise(5, 2, 2)
    for y in (range(140, H) if cv.wx != 'snow' else []):
        t = (y - 140) / (H - 140)
        for (c0, w0) in [(0.3, 0.06), (0.7, 0.06)]:
            pass
        band = 10 + t * 12
        mid = 176 - t * 10
        for x in range(W):
            if abs(y - mid) < band * 0.18 and gm[y, x] > 0.3:
                cv.px[y, x] = season_grass(season)[3 + int(gm[y, x] * 4) % 3]
            elif abs(y - (mid - band * 0.5)) < 1.2 or abs(y - (mid + band * 0.55)) < 1.6:
                cv.px[y, x] = P['soil'][1]
    # verge between the hedge and the lane
    vm = (cv.yy >= 132) & (cv.yy < 142)
    cv.ramp_fill(vm, np.clip(0.55 + (cv.noise(4, 8, 2) - 0.5) * 0.5, 0, 1), season_grass(season))
    cv.snow_fill(vm, seed=22, straw=season_grass(season))
    if cv.wx == 'snow':
        # two wheel ruts, wandering, with the lane's mud showing in the bottom of them
        for (y0, ph) in ((157, 0.0), (169, 1.7)):
            for x in range(W):
                y = y0 + math.sin(x / 31.0 + ph) * 1.6 + math.sin(x / 9.0 + ph) * 0.5
                if (x * 13 + int(ph * 10)) % 37 < 3:
                    continue
                cv.put(x, y, P['snow'][2]); cv.put(x, y + 1, P['snow'][3])
                if (x * 7) % 11 == 0:
                    cv.put(x, y + 1, P['soil'][3])
    # the bank at the woodland edge
    bank = (((cv.xx - 20) / 76) ** 2 + ((cv.yy - 150) / 22) ** 2) < 1
    shade = np.clip(0.75 - ((cv.xx - 0) / 160) - (cv.yy - 130) / 90 + (cv.noise(6, 5, 2) - 0.5) * 0.3, 0, 1)
    cv.ramp_fill(bank, shade, season_grass(season))
    cv.snow_fill(bank, seed=23, straw=season_grass(season))
    # gatepost with the blackbirds' stains
    cv.rect(310, 118, 6, 34, fr[3]); cv.rect(310, 118, 2, 34, fr[4]); cv.put(312, 119, hx('#e8e0d0')); cv.put(314, 122, hx('#6a3a6a'))
    cv.cap(310, 316, 117, thick=2)
    # fallen plums over the wall at the right
    for _ in range(10):
        x, y = rng.uniform(330, 370), rng.uniform(170, 186)
        cv.rect(x, y, 2, 2, hx('#4a2040')); cv.put(x, y, hx('#7a3a60'))
    for (x, y, sz, f, sd) in [(-4, 218, 36, 1, 1), (392, 218, 36, -1, 2)]:
        cv.bracken(x, y, sz, [mix(c, hx('#0c140a'), 0.3) for c in (season_leaf(season) or P['leaf_russet'])], flip=f, seed=sd)
    warm_light(cv, 40, -20, 260, 0.12 if season != 'winter' else 0.04)
    return cv


def chip_track(season):
    cv = Canvas(seed=51)
    sky, sky_c = sky_for(cv, season, 90, [(90, 16, 70, 9), (300, 30, 60, 8)], seed=13)
    leaf = season_leaf(season)
    cv.treeline(92, leaf or P['beech'], seed=14, height=(22, 36), width=(10, 16), sky=sky_c, fade_t=0.4, bare=leaf is None)
    cv.ground(92, season_grass(season), seed=15)
    # the track, receding into the wood
    for y in range(92, H):
        t = (y - 92) / (H - 92)
        cx = 214 - t * 60; hw = 6 + t * 90
        for x in range(int(cx - hw), int(cx + hw)):
            if 0 <= x < W:
                u = (x - (cx - hw)) / (2 * hw)
                v = 0.55 + 0.1 * math.sin(u * 20) - (0.2 if abs(u - 0.25) < 0.05 or abs(u - 0.75) < 0.05 else 0)
                fv = max(0, min(0.999, v + (cv.rng.random() - 0.5) * 0.15)) * (len(P['soil']) - 1); b = int(fv)
                cv.px[y, x] = P['soil'][min(len(P['soil']) - 1, b + (1 if fv - b > BAYER[y % 4, x % 4] else 0))]
            if 0 <= x < W and 0.42 < ((x - (cx - hw)) / (2 * hw)) < 0.58 and cv.rng.random() < 0.7:
                cv.px[y, x] = season_grass(season)[3 + int(cv.rng.random() * 2)]
    cv.snow_fill((cv.yy >= 96), seed=31, density=0.95)
    if cv.wx == 'snow':
        for y in range(100, H):
            t = (y - 100) / 100; cx = 214 - t * 60; hw = 6 + t * 90
            for u in (0.25, 0.75):
                x = cx - hw + 2 * hw * u
                cv.put(x, y, P['snow'][2]); cv.put(x + 1, y, P['snow'][3])
    # woodland edge left and right
    for i, x in enumerate([20, 60, 330, 372]):
        rng = np.random.default_rng(60 + i)
        cv.cylinder(x, 30, 132 + i % 2 * 6, lambda y: 4, P['bark'], seed=60 + i, fissures=5)
        if leaf is None:
            for a in (-2.2, -1.6, -1.0):
                cv.branch(x, 60, a, 22, 2.5, P['bark'], 4, rng, spread=0.5)
    if leaf is not None:
        rng = np.random.default_rng(70)
        cv.foliage([(rng.uniform(-10, 90), rng.uniform(-10, 60), rng.uniform(12, 18), rng.random()) for _ in range(16)], leaf, seed=71)
        cv.foliage([(rng.uniform(300, 400), rng.uniform(-10, 60), rng.uniform(12, 18), rng.random()) for _ in range(16)], leaf, seed=72)
    # the chip heap by the yard gate
    rng = np.random.default_rng(80)
    for k in range(18):
        cv.sphere(70 + rng.uniform(-26, 26), 150 - rng.uniform(0, 10) + abs(rng.uniform(-8, 8)), rng.uniform(7, 11), P['chip'], rough=0.3, seed=80 + k, tex=0.3, freq=9)
    fr = P['stone']
    cv.rect(96, 118, 3, 40, fr[3]); cv.rect(140, 118, 3, 40, fr[3])
    for k in range(4):
        cv.rect(99, 124 + k * 8, 41, 2, fr[5 - (k % 2)])
        cv.cap(99, 140, 123 + k * 8, thick=1, seed=k)
    cv.cap(96, 99, 117); cv.cap(140, 143, 117)
    # the barrow and its robin
    cv.rect(300, 168, 26, 10, hx('#4a5a5a')); cv.rect(300, 168, 26, 2, hx('#6a7a7a')); cv.cap(300, 326, 167, thick=3); cv.sphere(298, 180, 4, P['stone'][:5], rough=0.05, seed=1)
    cv.line(326, 170, 344, 178, P['fence'][4], 2)
    cv.rect(334, 162, 4, 4, hx('#6a4a2a')); cv.rect(334, 164, 3, 2, hx('#d0602a')); cv.put(337, 162, hx('#1a1a1a'))
    for (x, y, sz, f, sd) in [(-4, 218, 40, 1, 1), (392, 218, 36, -1, 2)]:
        cv.bracken(x, y, sz, [mix(c, hx('#0c140a'), 0.3) for c in (leaf or P['leaf_russet'])], flip=f, seed=sd)
    warm_light(cv, 60, -20, 260, 0.1 if season != 'winter' else 0.04)
    return cv


def buckthorn(cv, x, y, w, h, season, berries, seed):
    rng = np.random.default_rng(seed)
    cl = [(x + rng.uniform(-w, w), y + rng.uniform(-h, h * 0.2), rng.uniform(5, 8), rng.random()) for _ in range(int(w / 2.5))]
    r = P['silver'] if season != 'winter' else [mix(c, hx('#5a5048'), 0.4) for c in P['silver']]
    m = cv.foliage(cl, r, seed=seed)
    # thorny stems poke out
    for _ in range(10):
        a = rng.uniform(-2.8, -0.3); sx, sy = x + rng.uniform(-w, w) * 0.7, y
        cv.line(sx, sy, sx + math.cos(a) * 12, sy + math.sin(a) * 12, P['bark'][3])
    ys, xs = np.where(m)
    for i in rng.choice(len(xs), min(len(xs), berries), replace=False):
        cv.put(xs[i], ys[i], P['berry'][3]); cv.put(xs[i] + 1, ys[i], P['berry'][2]); cv.put(xs[i], ys[i] - 1, P['berry'][5])
    return m


def coast_thorn(season, month=9, frost=False):
    cv = Canvas(seed=61)
    sky, sky_c = sky_for(cv, season, 86, [(60, 22, 90, 11), (230, 12, 70, 9), (340, 36, 50, 7)], seed=17)
    # the sea
    cv.water_band(84, 112, P['water'], sky_c, seed=7, freezes=False)
    for k in range(4):
        y = 104 + k * 2
        for x in range(W):
            if (x + k * 13) % 23 < 12:
                cv.put(x, y, P['water'][-1] if k % 2 else P['water'][-2])
    # shingle
    for y in range(112, 124):
        for x in range(W):
            c = P['stone'][int(cv.rng.random() * 4) + 2]
            cv.put(x, y, c)
    # dunes
    cv.ramp_fill(cv.yy >= 122, np.clip(0.62 - (cv.yy - 122) / 280 + (cv.noise(16, 3, 3) - 0.5) * 0.45, 0, 1), P['sand'])
    for (cx, cy, rx, ry) in [(80, 146, 110, 16), (280, 136, 120, 14), (200, 196, 180, 16)]:
        d = ((cv.xx - cx) / rx) ** 2 + ((cv.yy - cy) / ry) ** 2
        m = d < 1
        cv.ramp_fill(m & (cv.yy < cy), np.clip(0.8 - d * 0.3, 0, 1), P['sand'])
    cv.horizon = 112
    cv.snow_fill(cv.yy >= 114, seed=41, straw=P['sand'], density=0.9)
    rng = np.random.default_rng(4)
    marram = P['reed'] if season != 'winter' else [mix(c, hx('#9a9478'), 0.4) for c in P['reed']]
    for _ in range(80):
        x, y = rng.uniform(0, W), rng.uniform(128, 214)
        if 150 < x < 250 and 120 < y < 160:
            continue
        cv.tuft(x, y, [mix(c, hx('#a8b070'), 0.25) for c in marram], h=rng.uniform(5, 12), n=6, rng=rng, lean=0.25)
    berries = 0
    if season == 'autumn':
        berries = 220 if month in (8, 9) else 110
    buckthorn(cv, 200, 140, 40, 16, season, berries, seed=21)
    buckthorn(cv, 110, 168, 28, 12, season, int(berries * 0.8), seed=22)
    buckthorn(cv, 330, 158, 30, 13, season, int(berries * 0.5), seed=23)
    # fieldfares on the far thicket in October and after
    if season in ('autumn', 'winter'):
        for (bx, by) in [(318, 144), (330, 141), (342, 146), (324, 150)]:
            cv.rect(bx, by, 4, 3, hx('#6a5a4a')); cv.rect(bx, by, 2, 1, hx('#8a8a92')); cv.put(bx + 3, by + 2, hx('#c8a878'))
    # the dune pool
    darken_ellipse(cv, 60, 200, 36, 7, 0.3)
    m = (((cv.xx - 60) / 30) ** 2 + ((cv.yy - 200) / 5) ** 2) < 1
    cv.px[m] = cv.px[m] * 0.25 + (P['ice'][4] if season == 'winter' and cv.wx != 'clear' else P['water'][4]) * 0.75
    if season == 'autumn':
        for _ in range(16):
            cv.put(rng.uniform(40, 80), rng.uniform(198, 203), [hx('#c08ab0'), hx('#8ab0c0'), hx('#d8c870')][rng.integers(0, 3)])
    # a gull
    cv.line(150, 40, 156, 44, hx('#e8e8e0')); cv.line(156, 44, 162, 40, hx('#e8e8e0'))
    warm_light(cv, 40, -20, 300, 0.1 if season != 'winter' else 0.04)
    return cv


def moss(season):
    cv = Canvas(seed=71)
    sky, sky_c = sky_for(cv, season, 104, [(80, 30, 110, 13), (290, 20, 90, 11)], seed=19)
    # blue hills, far and farther
    for (amp, base, t, sd) in [(10, 92, 0.65, 1), (8, 100, 0.45, 2)]:
        for x in range(W):
            y = base + math.sin(x / 60 + sd) * amp * 0.5 + math.sin(x / 23 + sd * 2) * amp * 0.25
            cv.rect(x, y, 1, 110 - y, mix(P['snow'][4] if cv.wx == 'snow' else P['heather'][3], sky_c, t))
    # the moss itself
    hv = P['heather'] if season != 'winter' else [mix(c, hx('#6a6460'), 0.45) for c in P['heather']]
    n = cv.noise(12, 5, 3)
    grassy = cv.noise(20, 6, 2)
    m = cv.yy >= 106
    depth = np.clip((cv.yy - 106) / 110, 0, 1)
    cv.ramp_fill(m, np.clip(0.55 - 0.25 * depth + (n - 0.5) * 0.35, 0, 1), hv)
    grassy = cv.noise(9, 6, 3)
    fine = cv.noise(2.5, 11, 1)
    prob = np.clip((grassy - 0.45) * 3, 0, 0.85)
    g = m & (cv.rng.random((H, W)) < prob)
    gr = season_grass(season)
    cv.ramp_fill(g, np.clip(0.5 - 0.2 * depth + (fine - 0.5) * 0.5, 0, 1), [mix(a, b, 0.4) for a, b in zip(gr, [hx('#8a7a4a')] * len(gr))])
    # tussocks nearer the viewer
    rng0 = np.random.default_rng(12)
    for _ in range(40):
        cv.tuft(rng0.uniform(0, W), rng0.uniform(170, 214), [mix(a, hx('#8a7a4a'), 0.4) for a in gr], h=rng0.uniform(4, 8), n=6, rng=rng0)
    cv.horizon = 106
    cv.snow_fill(m, seed=51, straw=hv, density=0.9)
    # pools holding the sky
    rng = np.random.default_rng(8)
    for (px, py, rx, ry) in [(48, 124, 26, 3), (150, 116, 30, 3), (262, 122, 22, 3), (110, 176, 40, 6), (320, 190, 34, 6), (220, 150, 18, 3)]:
        pm = (((cv.xx - px) / rx) ** 2 + ((cv.yy - py) / ry) ** 2) < 1
        cv.px[pm] = mix(sky[2], P['water'][2], 0.35) if not (season == 'winter' and cv.wx != 'clear') else mix(P['ice'][4], P['ice'][2], 0.3)
        top = pm & ~np.roll(pm, 1, axis=0)
        cv.px[top] = P['heather'][1]
        for k in range(int(rx)):
            cv.put(px - rx * 0.5 + k * 0.6, py, sky[4])
    # cotton grass
    for _ in range(70):
        x, y = rng.uniform(64, 140), rng.uniform(140, 170)
        cv.line(x, y, x + rng.uniform(-1, 1), y - 6, hx('#7a8a5a'))
        if season in ('spring', 'summer'):
            cv.rect(x - 1, y - 8, 3, 2, hx('#eeece2')); cv.put(x, y - 9, hx('#ffffff')); cv.put(x + 1, y - 7, hx('#d8d6cc'))
    # the hummocks: red sphagnum
    for (hx_, hy, rx, ry) in [(210, 164, 16, 7), (234, 160, 12, 6), (222, 154, 10, 5), (196, 158, 9, 5)]:
        cv.sphere(hx_, hy, rx, P['sphagnum'], rough=0.2, seed=int(hx_), tex=0.25, freq=8, flat_bottom=hy + ry * 0.6)
    if season in ('spring', 'summer', 'autumn'):
        lf = season_leaf(season) if season != 'autumn' else P['leaf_russet']
        for _ in range(26):
            x, y = rng.uniform(192, 244), rng.uniform(150, 166)
            cv.rect(x, y, 3, 2, lf[4]); cv.put(x + 1, y, lf[5])
    # the dry heather knoll
    cv.sphere(330, 138, 28, hv, rough=0.25, seed=3, tex=0.3, freq=10, flat_bottom=146)
    if season == 'summer':
        for _ in range(60):
            cv.put(rng.uniform(306, 356), rng.uniform(116, 144), hx('#b07ab0'))
    # a stunted birch
    cv.cylinder(30, 110, 150, lambda y: 2.5, [hx(c) for c in ['#3a3a38', '#8a8a84', '#c8c8c0', '#e6e6e0', '#f2f2ee']], seed=4, fissures=2)
    tips = []
    cv.branch(30, 116, -1.8, 16, 2, P['twig'], 4, rng, tips=tips)
    if season_leaf(season) is not None:
        cv.foliage([(tx, ty, 5, rng.random()) for (tx, ty) in tips], season_leaf(season) if season != 'autumn' else P['leaf_bronze'], seed=5)
    # a curlew over the moss
    x, y = 170, 50
    cv.rect(x, y, 6, 2, hx('#6a5a44')); cv.line(x - 6, y - 3, x, y, hx('#7a6a50')); cv.line(x + 6, y - 3, x + 2, y, hx('#7a6a50'))
    cv.line(x + 6, y + 1, x + 11, y + 4, hx('#2a2018'))
    warm_light(cv, 40, -20, 300, 0.08 if season != 'winter' else 0.03)
    return cv


# -------------------------------------------------------------- the map
def estate_map(season):
    cv = Canvas(seed=81)
    g = season_grass(season)
    n = cv.noise(16, 1, 3)
    cv.ramp_fill(np.ones((H, W), bool), np.clip(0.55 + (n - 0.5) * 0.3, 0, 1), g)
    cv.horizon = 0
    cv.snow_fill(np.ones((H, W), bool), seed=6)
    rng = np.random.default_rng(3)
    # fields with hedgerows
    fields = [(100, 150, 60, 40), (170, 176, 60, 34), (280, 70, 30, 50)]
    for i, (x, y, w, h) in enumerate(fields):
        fm = (cv.xx >= x) & (cv.xx < x + w) & (cv.yy >= y) & (cv.yy < y + h)
        crop = g if i % 2 else [mix(c, hx('#a89a58'), 0.35 if season in ('summer', 'autumn') else 0.1) for c in g]
        cv.ramp_fill(fm, np.clip(0.5 + ((cv.yy % 4) < 2) * 0.12 + (n - 0.5) * 0.1, 0, 1), crop)
        cv.snow_fill(fm, seed=i + 20)
        hed = {'autumn': [mix(a, b, 0.5) for a, b in zip(P['leaf_olive'], P['leaf_russet'])], 'winter': P['twig']}.get(season, season_leaf(season))
        for k in range(0, w, 3):
            cv.sphere(x + k, y, 2, hed[1:5], rough=0.3, seed=k + i, tex=0.2)
            cv.sphere(x + k, y + h, 2, hed[1:5], rough=0.3, seed=k + i + 50, tex=0.2)
        for k in range(0, h, 3):
            cv.sphere(x, y + k, 2, hed[1:5], rough=0.3, seed=k + i + 90, tex=0.2)
    # the moss, top left
    moor = (cv.yy + cv.xx * 0.62 < 96)
    cv.ramp_fill(moor, np.clip(0.5 + (cv.noise(8, 2, 2) - 0.5) * 0.5, 0, 1), P['heather'])
    cv.snow_fill(moor, seed=7)
    for (px, py) in [(20, 16), (54, 10), (30, 44), (70, 30)]:
        cv.sphere(px, py, 3, P['water'][1:5], rough=0.3, seed=px)
    # the sea and the coast, right
    for y in range(H):
        cx = 330 + math.sin(y / 19) * 6 - (y > 130) * (y - 130) * 0.35
        for x in range(int(cx - 18), W):
            if x < cx - 5:
                cv.put(x, y, P['sand'][3 + (x + y) % 2])
            elif x < cx - 1:
                cv.put(x, y, P['stone'][4])
            elif x < cx:
                cv.put(x, y, P['water'][6])
            else:
                v = 0.4 - min(0.3, (x - cx) / 200)
                fv = v * 6; b = int(fv)
                cv.put(x, y, P['water'][b + (1 if fv - b > BAYER[y % 4, x % 4] else 0)])
        if y % 5 == 0:
            cv.put(cx + 6 + (y * 7) % 30, y, P['water'][5])
    for _ in range(40):
        y = rng.uniform(10, 210); x = 330 + math.sin(y / 19) * 6 - (y > 130) * (y - 130) * 0.35 - rng.uniform(8, 16)
        cv.sphere(x, y, 2, P['silver'][1:6], rough=0.3, seed=int(y))
        if season == 'autumn':
            cv.put(x + 1, y, P['berry'][3])
    # the river
    pts = [(236, -2), (226, 40), (246, 80), (230, 118), (262, 160), (300, 200), (312, 218)]
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        for s in range(60):
            t = s / 60; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            cv.rect(x - 2, y, 5, 2, P['water'][3]); cv.put(x - 1, y, P['water'][5])
    for (x, y) in [(238, 100), (222, 90), (250, 124), (216, 56)]:
        cv.sphere(x, y, 3, (season_leaf(season) or P['twig'])[1:6], rough=0.2, seed=x)
    # the beech hanger, a wood on the slope
    leaf = season_leaf(season)
    wood = [(rng.uniform(88, 190), rng.uniform(34, 96), rng.uniform(4, 6), rng.random()) for _ in range(90)]
    wood = [c for c in wood if ((c[0] - 140) / 56) ** 2 + ((c[1] - 64) / 32) ** 2 < 1]
    for c in sorted(wood, key=lambda c: c[1]):
        cv.sphere(c[0] + 2, c[1] + 2, c[2], [hx('#141a10')] * 3, rough=0.2, seed=int(c[0]))
    cv.foliage(wood, (BEECH_LEAF[season] or P['twig']), seed=4)
    # the Home Oak, alone at the edge of the hanger
    cv.sphere(206, 104, 7, [hx('#141a10')] * 3, rough=0.2, seed=1)
    cv.foliage([(203, 100, 7, 1), (208, 98, 5, 0.6), (200, 96, 5, 0.4)], P['leaf_russet'] if season == 'autumn' else (leaf or P['twig']), seed=6)
    # the lane with its hedge
    for s in range(120):
        t = s / 120; x = 170 - t * 160; y = 150 + t * 60
        cv.rect(x, y, 3, 3, P['soil'][4])
        if s % 3 == 0:
            cv.sphere(x - 2, y - 4, 2.5, (season_leaf(season) or P['leaf_olive'])[1:6], rough=0.3, seed=s)
    # the track to the wood
    for s in range(40):
        t = s / 40; x = 176 - t * 36; y = 140 - t * 36
        if s % 2 == 0:
            cv.rect(x, y, 2, 2, P['soil'][5])
    # the pine plantation, top right of the river
    pm = []
    for i in range(70):
        x, y = rng.uniform(252, 306), rng.uniform(8, 56)
        pm.append((x, y, rng.uniform(3, 4.5), rng.random()))
    for c in sorted(pm, key=lambda c: c[1]):
        cv.sphere(c[0] + 1, c[1] + 2, c[2], [hx('#0a120c')] * 3, rough=0.2, seed=int(c[0] * 7))
    cv.foliage(pm, [hx(c) for c in ['#0e1a14', '#15261c', '#1e3624', '#2a4a2c', '#3a6036', '#4e7a40', '#6a944e']], seed=91)
    # the hazel coppice, bottom left
    hz = [(rng.uniform(16, 80), rng.uniform(98, 140), rng.uniform(3, 5), rng.random()) for _ in range(30)]
    cv.foliage(hz, (season_leaf(season) if season != 'autumn' else P['leaf_bronze']) or P['twig'], seed=92)
    # the salt pans in the dunes
    for k in range(3):
        cv.rect(306 + k * 7, 116, 5, 12, P['stone'][4]); cv.rect(307 + k * 7, 117, 3, 10, hx('#8aa6b0'))
    # the harbour wall and its boats, bottom right
    cv.line(292, 204, 330, 188, P['stone'][4], 3); cv.line(292, 205, 330, 189, P['stone'][2], 1)
    for (bx, by) in [(318, 198), (334, 204), (340, 180)]:
        cv.rect(bx, by, 7, 3, hx('#2a4a6a')); cv.put(bx + 3, by - 2, hx('#e8e4dc'))
    # the workshop: a stone farmhouse with a slate roof
    fx, fy = 176, 132
    cv.rect(fx, fy, 24, 14, P['stone'][4]); cv.rect(fx, fy, 24, 1, P['stone'][5])
    for k in range(9):
        cv.rect(fx - 2 + k, fy - 1 - k, 28 - 2 * k, 1, P['stone'][1] if k % 2 else P['stone'][2])
    cv.rect(fx + 4, fy + 5, 3, 3, hx('#f2c97a')); cv.rect(fx + 16, fy + 5, 3, 3, hx('#f2c97a')); cv.rect(fx + 10, fy + 7, 3, 7, P['fence'][2])
    cv.rect(fx + 24, fy + 4, 10, 10, P['stone'][3]); cv.rect(fx + 24, fy + 3, 10, 1, P['stone'][1])
    return cv


SCENES = {'home_oak': home_oak, 'beech_hanger': beech_hanger, 'river_poplars': river_poplars, 'hedgerow': long_hedge,
          'chip_track': chip_track, 'coast_thorn': coast_thorn, 'bog': moss, 'map': estate_map}

if __name__ == '__main__':
    D = sys.argv[1]
    which = sys.argv[2].split(',') if len(sys.argv) > 2 else list(SCENES)
    seasons = sys.argv[3].split(',') if len(sys.argv) > 3 else ['spring', 'summer', 'autumn', 'winter']
    for k in which:
        for s in seasons:
            im = Image.fromarray(SCENES[k](s).out())
            im.save(f'{D}/scene_{k}_{s}.png')
        print('ok', k)

"""The new grounds and the farm. Farm plates are drawn EMPTY where the game puts
things (beds are bare soil, trees carry no fruit, pans hold no salt): the page
draws what you have grown into them, from the geometry exported in GEOM."""
import math, sys, json
import numpy as np
from PIL import Image
from pxart import Canvas, P, W, H, hx, mix, fade, season_leaf, season_grass, INK, BAYER, LIGHT
from scenes import darken_ellipse, warm_light, oak, SKY_FOR
from scenes2 import sky_for, log, stump, beech, BEECH_LEAF, hawthorn_hedge, pollard

GEOM = {}
BRICK = [hx(c) for c in ['#3a1a14', '#58281c', '#744028', '#8e5232', '#a8663e', '#c2804e', '#d89a66']]
SCOTS = [hx(c) for c in ['#2a1a12', '#4a2a1a', '#6e3e22', '#944e28', '#b0642e', '#c67c3c', '#d89a54']]
PINE = [hx(c) for c in ['#0e1a14', '#15261c', '#1e3624', '#2a4a2c', '#3a6036', '#4e7a40', '#6a944e']]
YEW = [hx(c) for c in ['#070e0a', '#0c1810', '#132416', '#1a301c', '#243e24', '#30502e', '#40663a']]
GLASS = [hx(c) for c in ['#2a3634', '#3a4a48', '#54686a', '#728a8a', '#94acaa', '#bcd0cc', '#e2ecea']]
TIMBER = [hx(c) for c in ['#1e150e', '#302116', '#46311f', '#5e432a', '#785837', '#937046', '#ad8a58']]


def rect_fill(cv, x0, y0, x1, y1, r, noise_scale=6, seed=0, base=0.5, amp=0.35):
    m = (cv.xx >= x0) & (cv.xx < x1) & (cv.yy >= y0) & (cv.yy < y1)
    cv.ramp_fill(m, np.clip(base + (cv.noise(noise_scale, seed, 2) - 0.5) * amp, 0, 1), r)
    return m


def brick_wall(cv, x0, y0, x1, y1, seed=0, light=0.55):
    m = rect_fill(cv, x0, y0, x1, y1, BRICK, 5, seed, light, 0.25)
    rng = np.random.default_rng(seed)
    for y in range(int(y0), int(y1)):
        if (y - int(y0)) % 4 == 3:
            for x in range(int(x0), int(x1)):
                cv.put(x, y, BRICK[1])
        else:
            off = 0 if ((y - int(y0)) // 4) % 2 else 4
            for x in range(int(x0) + off, int(x1), 8):
                cv.put(x, y, BRICK[1])
    for _ in range(int((x1 - x0) * (y1 - y0) / 60)):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        cv.put(x, y, BRICK[rng.integers(3, 6)])
    cv.rect(x0, y0 - 2, x1 - x0, 2, P['stone'][4]); cv.rect(x0, y0 - 1, x1 - x0, 1, P['stone'][2])
    cv.cap(x0, x1, y0 - 3, thick=3, seed=seed)


def raised_bed(cv, x0, y0, x1, y1):
    m = rect_fill(cv, x0 + 2, y0 + 2, x1 - 2, y1 - 1, P['soil'], 3, int(x0), 0.42, 0.4)
    cv.snow_fill(m, seed=int(x0), density=0.9)
    for x in range(int(x0), int(x1)):
        cv.put(x, y0, TIMBER[5]); cv.put(x, y0 + 1, TIMBER[4]); cv.put(x, y1 - 1, TIMBER[3]); cv.put(x, y1, TIMBER[1])
    for y in range(int(y0), int(y1) + 1):
        cv.put(x0, y, TIMBER[4]); cv.put(x0 + 1, y, TIMBER[3]); cv.put(x1 - 1, y, TIMBER[2]); cv.put(x1, y, TIMBER[1])
    for x in range(int(x0) + 4, int(x1) - 3, 5):
        if cv.wx != 'snow':
            cv.put(x, y0 + 4 + (x % 3), P['soil'][5])
    cv.cap(x0, x1 + 1, y0 - 1, thick=2, seed=int(x1))


def pine_tree(cv, x, base, h, season, seed, fade_t=0.0, sky_c=None, young=False):
    rng = np.random.default_rng(seed)
    bark = fade(SCOTS, sky_c, fade_t) if sky_c is not None else SCOTS
    lf = fade(PINE, sky_c, fade_t) if sky_c is not None else PINE
    top = base - h
    if young:
        # a young pine: a cone of whorled branches right to the ground
        for k in range(8):
            yy = base - 4 - k * (h / 9); w = (8 - k) * 2.4 + 3
            cv.sphere(x, yy, w, lf, rough=0.35, seed=seed + k, tex=0.15, freq=11, flat_bottom=yy + 2)
        cv.rect(x - 1, base - 4, 3, 5, bark[2])
        return
    lower = [mix(c, hx('#3a3230'), 0.35) for c in bark]
    cv.cylinder(x, top + h * 0.3, base + 1, lambda y: 3 + (y - top) / h * 2.2, bark, seed=seed, fissures=3)
    for y in range(int(top + h * 0.62), int(base)):
        for dx in range(-5, 6):
            if abs(dx) <= 3 + (y - top) / h * 2.2 and rng.random() < 0.55:
                cv.put(x + dx, y, lower[rng.integers(1, 4)])
    cl = [(x + rng.uniform(-18, 18), top + rng.uniform(0, h * 0.35), rng.uniform(8, 13), rng.random()) for _ in range(9)]
    cv.foliage(cl, lf, seed=seed, outline=fade_t < 0.2)


def yew(cv, x, base, season, seed, arils=False):
    rng = np.random.default_rng(seed)
    cv.cylinder(x, base - 30, base + 1, lambda y: 7, [mix(c, hx('#6a3020'), 0.3) for c in P['bark']], seed=seed, fissures=6)
    cl = [(x + rng.uniform(-36, 36), base - rng.uniform(26, 78), rng.uniform(12, 18), rng.random()) for _ in range(20)]
    m = cv.foliage(cl, YEW, seed=seed)
    if arils:
        ys, xs = np.where(m)
        for i in rng.choice(len(xs), min(len(xs), 70), replace=False):
            cv.put(xs[i], ys[i], hx('#c0182a')); cv.put(xs[i] + 1, ys[i], hx('#e03040'))


def pine_plantation(season):
    cv = Canvas(seed=91)
    sky, sky_c = sky_for(cv, season, 84, [(120, 16, 60, 8), (300, 28, 70, 9)], seed=23)
    haze = [hx(c) for c in (['#2a3a2a', '#3e523a', '#607858', '#8ea282'] if season != 'winter' else ['#343a38', '#4c5452', '#6e7876', '#98a09c'])]
    cv.ramp_fill(cv.yy < 150, np.clip(0.9 - np.abs(cv.yy - 96) / 90, 0, 1), haze)
    hz = haze[2]
    rng = np.random.default_rng(4)
    for i in range(26):
        x = rng.uniform(-10, W + 10)
        if 150 < x < 234:
            continue
        pine_tree(cv, x, 118 + rng.uniform(-4, 6), rng.uniform(90, 120), season, seed=300 + i, fade_t=0.6, sky_c=hz)
    # the canopy closes overhead
    cl = [(rng.uniform(-20, W + 20), rng.uniform(-18, 20), rng.uniform(14, 22), rng.random() * 0.5) for _ in range(40)]
    cl = [c for c in cl if not (160 < c[0] < 224 and c[1] > 0)]
    cv.foliage(cl, [mix(c, hx('#0a120c'), 0.25) for c in PINE], seed=5)
    # the ride and the needle floor
    floor = [hx(c) for c in ['#24160e', '#382214', '#50321c', '#6a4424', '#84582e', '#9c6e3c', '#b48a52']]
    cv.ramp_fill(cv.yy >= 118, np.clip(0.52 - (cv.yy - 118) / 400 + (cv.noise(7, 3, 2) - 0.5) * 0.3, 0, 1), floor)
    cv.horizon = 118
    cv.snow_fill(cv.yy >= 118, seed=61, straw=floor, density=0.7)
    for y in range(118, H):
        t = (y - 118) / (H - 118); cx = 192; hw = 10 + t * 70
        for x in range(int(cx - hw), int(cx + hw)):
            if 0 <= x < W and cv.rng.random() < 0.7:
                cv.put(x, y, mix(floor[4], season_grass(season)[4], 0.55) if cv.wx != 'snow' else P['snow'][5 + (cv.rng.random() < 0.3)])
    # bilberry in the corners
    bil = season_leaf(season) or [mix(c, hx('#5a2a3a'), 0.4) for c in P['leaf_olive']]
    for _ in range(40):
        cv.sphere(rng.uniform(0, 90), rng.uniform(186, 214), rng.uniform(3, 6), bil, rough=0.3, seed=int(rng.integers(0, 999)), tex=0.2)
    # near trunks
    for i, x in enumerate([22, 128, 262, 356]):
        pine_tree(cv, x, 216, 230, season, seed=400 + i, fade_t=0.15 if i in (1, 2) else 0.0, sky_c=hz)
    # young pines at the ride edge, with fresh tips in spring
    for i, (x, b, h) in enumerate([(104, 160, 36), (80, 168, 28), (232, 158, 30)]):
        pine_tree(cv, x, b, h, season, seed=500 + i, young=True)
        if season == 'spring':
            for _ in range(30):
                tx, ty = x + rng.uniform(-14, 14), b - rng.uniform(4, h)
                cv.put(tx, ty, hx('#a8d66a')); cv.put(tx, ty - 1, hx('#cce88a'))
    # the old yew by the wall on the right
    cv.rect(270, 150, W - 270, 22, P['stone'][3]); rect_fill(cv, 270, 150, W, 172, P['stone'], 3, 7, 0.55, 0.5)
    cv.cap(270, W, 149, thick=3)
    yew(cv, 322, 170, season, 60, arils=season == 'autumn')
    # a resinous stump and cones on the ride
    stump(cv, 200, 198, 12, 8, SCOTS, seed=3)
    for _ in range(12):
        x, y = 170 + rng.uniform(0, 30), 166 + rng.uniform(0, 8)
        cv.rect(x, y, 3, 2, hx('#6a4426')); cv.put(x, y, hx('#8a5c32'))
    # a crossbill
    cv.rect(68, 58, 4, 3, hx('#b83a2a')); cv.put(72, 59, hx('#3a2a1a'))
    warm_light(cv, 190, -30, 200, 0.12 if season != 'winter' else 0.05)
    return cv


def hazel_stool(cv, x, base, season, seed, scale=1.0):
    rng = np.random.default_rng(seed)
    stem = [hx(c) for c in ['#2a2420', '#3e3630', '#564c44', '#706458', '#8a7c6c', '#a4967e']]
    tips = []
    for k in range(9):
        a = -math.pi / 2 + rng.uniform(-0.55, 0.55)
        ln = rng.uniform(40, 62) * scale
        sx = x + rng.uniform(-6, 6) * scale
        cv.line(sx, base, sx + math.cos(a) * ln, base + math.sin(a) * ln, stem[3 if k % 2 else 4], 2 if scale > 0.8 else 1)
        if cv.wx in ('snow', 'frost'):
            for t in range(0, int(ln), 3):
                cv.put(sx + math.cos(a) * t - 1, base + math.sin(a) * t, P['snow'][6] if cv.wx == 'snow' else P['rime'][4])
        tips.append((sx + math.cos(a) * ln, base + math.sin(a) * ln))
    leaf = season_leaf(season)
    if leaf is not None:
        if season == 'autumn':
            leaf = [mix(a, b, 0.6) for a, b in zip(P['leaf_bronze'], P['leaf_olive'])]
        cl = [(tx + rng.uniform(-6, 6), ty + rng.uniform(0, 14), rng.uniform(8, 12) * scale, rng.random()) for (tx, ty) in tips]
        cv.foliage(cl, leaf, seed=seed)
    elif season == 'winter':
        # catkins, the first thing in flower in the year
        for (tx, ty) in tips:
            for _ in range(3):
                cx, cy = tx + rng.uniform(-6, 6), ty + rng.uniform(0, 10)
                cv.rect(cx, cy, 1, 3, hx('#d8c060')); cv.put(cx, cy + 3, hx('#b89a40'))
    darken_ellipse(cv, x, base + 2, 18 * scale, 3, 0.5)


def hazel_coppice(season):
    cv = Canvas(seed=101)
    sky, sky_c = sky_for(cv, season, 114, [(90, 18, 70, 9), (300, 26, 60, 8)], seed=29)
    leaf = season_leaf(season)
    cv.treeline(96, leaf or P['beech'], seed=31, height=(20, 34), width=(10, 16), sky=sky_c, fade_t=0.45, bare=leaf is None)
    oak(cv, 330, 118, season, seed=77, scale=0.55)
    cv.ground(112, season_grass(season), seed=33)
    rng = np.random.default_rng(6)
    if season == 'spring':
        for _ in range(900):
            x, y = rng.integers(0, W), rng.integers(126, H)
            cv.put(x, y, hx('#5a5aa8') if rng.random() > 0.3 else hx('#7a7ac8'))
    if season in ('autumn', 'winter'):
        cv.leaves(118, cv.noise(18, 8, 2), 0.45, P['litter'] if season == 'autumn' else [mix(c, hx('#4a4034'), 0.5) for c in P['litter']], density=0.4, seed=9)
    hazel_stool(cv, 190, 150, season, 11, 1.0)
    hazel_stool(cv, 96, 140, season, 12, 0.8)
    hazel_stool(cv, 270, 144, season, 13, 0.85)
    hazel_stool(cv, 30, 200, season, 14, 1.2)
    # the cut stump the squirrels use as a table
    stump(cv, 286, 188, 10, 8, P['bark'], seed=8)
    for _ in range(8):
        x, y = 280 + rng.uniform(0, 12), 178 + rng.uniform(0, 3)
        cv.rect(x, y, 2, 1, hx('#8a5c32')); cv.put(x + 1, y + 1, hx('#e8d8b0'))
    # a woodpile of coppice poles
    for k in range(6):
        cv.line(330, 196 - k * 3, 380, 192 - k * 3, P['bark'][4 - k % 2], 3)
        cv.sphere(330, 196 - k * 3, 1.6, P['chip'][2:], rough=0, seed=k)
    cv.cap(330, 381, 178, thick=3)
    for (x, y, sz, f, sd) in [(-4, 218, 40, 1, 1), (392, 218, 34, -1, 2)]:
        cv.bracken(x, y, sz, [mix(c, hx('#0c140a'), 0.3) for c in (leaf or P['leaf_russet'])], flip=f, seed=sd)
    warm_light(cv, 60, -20, 280, 0.12 if season != 'winter' else 0.05)
    return cv


def harbour(season):
    cv = Canvas(seed=111)
    sky, sky_c = sky_for(cv, season, 76, [(70, 16, 90, 10), (260, 28, 80, 10), (350, 12, 40, 6)], seed=31)
    # the headland and its lighthouse
    for x in range(0, 140):
        y = 64 + (x / 140) ** 2 * 12 + math.sin(x / 9) * 1.5
        cv.rect(x, y, 1, 78 - y, mix(P['snow'][4] if cv.wx == 'snow' else P['grass_' + season][2], sky_c, 0.45))
    cv.rect(30, 50, 5, 16, hx('#e8e4dc')); cv.rect(30, 48, 5, 2, hx('#b83a2a')); cv.rect(31, 46, 3, 2, hx('#f2d890'))
    cv.water_band(76, 176, P['water'], sky_c, seed=12, freezes=False)
    for k in range(6):
        y = 90 + k * 11
        for x in range(W):
            if (x + k * 29) % 47 < 18:
                cv.put(x, y, P['water'][5])
    # the estuary bar on the right, at low water
    bar = (cv.xx > 250 - (cv.yy - 150) * 0.6) & (cv.yy >= 140)
    cv.ramp_fill(bar, np.clip(0.5 + (cv.noise(8, 4, 2) - 0.5) * 0.35, 0, 1), P['sand'][:6])
    for k in range(4):
        for x in range(260, W):
            y = 162 + k * 12 + math.sin(x / 12 + k) * 3
            cv.put(x, y, P['water'][4]); cv.put(x, y + 1, P['water'][3])
    # the harbour wall across the foreground
    wall_top = 172
    rect_fill(cv, 0, wall_top, 250, H, P['stone'], 3, 5, 0.5, 0.45)
    for y in range(wall_top, H, 6):
        for x in range(0, 250):
            cv.put(x, y, P['stone'][1])
        off = 0 if ((y - wall_top) // 6) % 2 else 7
        for x in range(off, 250, 14):
            for yy in range(y, min(H, y + 6)):
                cv.put(x, yy, P['stone'][1])
    cv.rect(0, wall_top - 3, 250, 3, P['stone'][5]); cv.rect(0, wall_top, 250, 1, P['stone'][2])
    cv.cap(0, 250, wall_top - 4, thick=3)
    for bx in (40, 150):
        cv.rect(bx, wall_top - 9, 6, 7, hx('#2a2a2a')); cv.rect(bx - 1, wall_top - 10, 8, 2, hx('#3a3a3a')); cv.cap(bx - 1, bx + 7, wall_top - 11, thick=2)
    for k in range(6):
        cv.rect(214, wall_top + k * 7, 12, 1, hx('#4a3a2a'))
    cv.rect(214, wall_top, 1, 44, hx('#4a3a2a')); cv.rect(225, wall_top, 1, 44, hx('#4a3a2a'))
    # a boat at her mooring
    cv.rect(300, 118, 36, 6, hx('#2a4a6a')); cv.rect(304, 124, 28, 3, hx('#1a2a3a')); cv.rect(316, 104, 1, 14, hx('#6a5a4a')); cv.rect(306, 116, 22, 2, hx('#c8c0b0'))
    # gannets diving far out, and gulls
    for (x, y) in [(252, 82), (262, 86), (270, 80)]:
        cv.line(x, y - 4, x, y, hx('#f4f4f0')); cv.put(x, y - 5, hx('#e8c870'))
    for (x, y) in [(170, 40), (190, 30), (330, 50)]:
        cv.line(x - 4, y, x, y + 2, hx('#e8e8e0')); cv.line(x, y + 2, x + 4, y, hx('#e8e8e0'))
    warm_light(cv, 300, -30, 300, 0.14 if season != 'winter' else 0.05)
    return cv


def salt_pans(season):
    cv = Canvas(seed=121)
    sky, sky_c = sky_for(cv, season, 90, [(100, 20, 90, 10), (300, 14, 60, 8)], seed=37)
    cv.water_band(86, 118, P['water'], sky_c, seed=13, freezes=False)
    cv.rect(0, 118, W, 8, P['stone'][3]); rect_fill(cv, 0, 118, W, 126, P['stone'], 2, 3, 0.55, 0.6)
    gm = rect_fill(cv, 0, 126, W, H, [mix(c, hx('#8a7a60'), 0.4) for c in season_grass(season)], 8, 5, 0.5, 0.3)
    cv.horizon = 118
    cv.snow_fill(gm, seed=71, straw=season_grass(season))
    pans = [(24, 140, 124, 176), (142, 138, 242, 174), (260, 140, 360, 176)]
    GEOM['salt_pans'] = {'pans': [list(p) for p in pans]}
    for (x0, y0, x1, y1) in pans:
        pm = rect_fill(cv, x0, y0, x1, y1, [hx(c) for c in ['#3a3128', '#4e4236', '#645646', '#7a6a58', '#908068']], 4, int(x0), 0.5, 0.4)
        if cv.wx == 'snow':
            cv.snow_fill(pm, seed=int(x0))
        for x in range(x0 - 2, x1 + 2):
            cv.put(x, y0 - 2, P['stone'][5]); cv.put(x, y0 - 1, P['stone'][3]); cv.put(x, y1 + 1, P['stone'][2])
        for y in range(y0 - 2, y1 + 2):
            cv.put(x0 - 2, y, P['stone'][4]); cv.put(x1 + 1, y, P['stone'][2])
    # the hut, rakes and a heap under a board
    cv.rect(330, 96, 40, 24, P['stone'][4]); cv.rect(326, 92, 48, 5, hx('#3a3530')); cv.rect(342, 106, 7, 14, TIMBER[2]); cv.cap(326, 374, 91, thick=3)
    for k in range(3):
        cv.line(40 + k * 10, 200, 52 + k * 10, 186, TIMBER[4]); cv.rect(50 + k * 10, 184, 7, 2, TIMBER[3])
    cv.sphere(300, 202, 14, P['snow'], rough=0.2, seed=2, flat_bottom=206, tex=0.15)
    warm_light(cv, 200, -30, 300, 0.14 if season != 'winter' else 0.05)
    return cv


# ------------------------------------------------------------------ the farm
def walled_garden(season):
    cv = Canvas(seed=131)
    sky, sky_c = sky_for(cv, season, 60, [(100, 14, 60, 7), (300, 22, 70, 8)], seed=41)
    leaf = season_leaf(season)
    cv.treeline(34, leaf or P['beech'], seed=42, height=(16, 26), width=(10, 16), sky=sky_c, fade_t=0.4, bare=leaf is None)
    brick_wall(cv, 0, 30, W, 102, seed=1)
    # the door and an espalier pear
    cv.rect(180, 58, 24, 44, TIMBER[3]); cv.rect(180, 58, 24, 2, TIMBER[5]); cv.rect(191, 58, 1, 44, TIMBER[1]); cv.put(200, 80, hx('#d8b060'))
    for side in (-1, 1):
        x0 = 110 if side < 0 else 274
        cv.line(x0, 100, x0, 44, P['bark'][3], 2)
        for k in range(4):
            y = 52 + k * 12
            cv.line(x0, y, x0 - 34, y, P['bark'][3], 1); cv.line(x0, y, x0 + 34, y, P['bark'][3], 1)
            if leaf is not None:
                for xx in range(x0 - 34, x0 + 35, 3):
                    cv.put(xx, y - 1, leaf[4]); cv.put(xx + 1, y - 2, leaf[3])
            elif season == 'spring':
                pass
    # the rose border along the foot of the wall
    rm = rect_fill(cv, 0, 102, W, 116, P['soil'], 3, 9, 0.45, 0.4)
    cv.horizon = 100
    cv.snow_fill(rm, seed=81)
    rng = np.random.default_rng(3)
    rose_leaf = leaf or [mix(c, hx('#3a2a28'), 0.5) for c in P['leaf_olive']]
    for x in range(10, W - 10, 22):
        cv.foliage([(x + rng.uniform(-4, 4), 104 + rng.uniform(-3, 2), rng.uniform(6, 8), rng.random()) for _ in range(3)], rose_leaf, seed=x)
    # gravel
    gv = rect_fill(cv, 0, 116, W, H, [hx(c) for c in ['#5a5448', '#6e675a', '#847c6c', '#9a927f', '#b0a892', '#c6bea6']], 2, 11, 0.55, 0.55)
    cv.snow_fill(gv, seed=82)
    beds = [(56, 122, 136, 144), (152, 122, 232, 144), (248, 122, 328, 144), (26, 158, 128, 198), (142, 158, 244, 198), (258, 158, 360, 198)]
    for b in beds:
        raised_bed(cv, *b)
    GEOM['walled_garden'] = {'beds': [list(b) for b in beds], 'rose': [8, 96, W - 8, 114]}
    # water butt and a barrow
    cv.cylinder(372, 128, 158, lambda y: 8, [hx(c) for c in ['#1a2a1e', '#243a28', '#2e4a32', '#3a5e3e', '#4a744c', '#5e8a5e']], seed=2, fissures=0, streaks=False)
    cv.rect(4, 200, 18, 8, hx('#4a5a5a')); cv.rect(4, 200, 18, 1, hx('#6a7a7a'))
    warm_light(cv, 60, -30, 300, 0.12 if season != 'winter' else 0.05)
    return cv


def polytunnel(season):
    cv = Canvas(seed=141)
    vx, vy = 192, 84
    # the plastic: a milky skin lit through, bright at the far door
    skin = [hx(c) for c in ['#6a7068', '#838a80', '#9ea49a', '#b8bcb2', '#d0d2c8', '#e6e6dc']]
    if season == 'winter':
        skin = [mix(c, hx('#8a9aa6'), 0.3) for c in skin]
    d = np.sqrt((cv.xx - vx) ** 2 + ((cv.yy - vy) * 1.4) ** 2)
    cv.ramp_fill(np.ones((H, W), bool), np.clip(0.95 - d / 260, 0, 1), skin)
    # hoops receding to the door
    for k in range(9):
        t = (k / 8) ** 1.6
        rx = 200 * (1 - t) + 22 * t; ry = 190 * (1 - t) + 26 * t; cy = 230 * (1 - t) + (vy + 18) * t
        for a in np.linspace(math.pi, 2 * math.pi, 400):
            x = vx + math.cos(a) * rx; y = cy + math.sin(a) * ry
            cv.put(x, y, hx('#7a7e78')); cv.put(x, y + 1, hx('#5a5e58'))
    # the far door, open, with the day beyond
    cv.rect(vx - 14, vy - 6, 28, 30, season_grass(season)[4]); cv.rect(vx - 14, vy - 6, 28, 12, P[SKY_FOR[season]][3])
    cv.rect(vx - 16, vy - 8, 32, 2, TIMBER[3]); cv.rect(vx - 16, vy - 8, 2, 34, TIMBER[3]); cv.rect(vx + 14, vy - 8, 2, 34, TIMBER[3])
    # floor: a path between two beds
    floor = (cv.yy >= vy + 24)
    cv.ramp_fill(floor, np.clip(0.4 + (cv.noise(5, 3, 2) - 0.5) * 0.3, 0, 1), P['soil'])
    def x_at(y, frac):
        t = (y - (vy + 24)) / (H - (vy + 24))
        return vx + (frac * 200) * t + frac * 12 * (1 - t)
    beds = []
    for side in (-1, 1):
        for y in range(vy + 24, H):
            xa, xb = x_at(y, side * 0.22), x_at(y, side * 0.95)
            lo, hi = min(xa, xb), max(xa, xb)
            for x in range(int(lo), int(hi)):
                v = 0.3 + 0.15 * math.sin(x * 0.7 + y) + (cv.rng.random() - 0.5) * 0.2
                n = len(P['soil']); fv = max(0, min(0.999, v)) * (n - 1); b = int(fv)
                if 0 <= x < W:
                    cv.px[y, x] = P['soil'][min(n - 1, b + (1 if fv - b > BAYER[y % 4, x % 4] else 0))]
            cv.put(xa, y, TIMBER[4]); cv.put(xa + side, y, TIMBER[2])
    # strings for the tomatoes, from the hoops
    for side in (-1, 1):
        for k in range(6):
            t = (k + 0.5) / 6
            y = vy + 24 + (H - vy - 24) * (1 - t) ** 1.3
            x = x_at(y, side * 0.6)
            top = vy - 60 * (1 - t) - 10
            cv.line(x, top, x, y, hx('#c8c0a8'))
    # four beds: left near, left far, right near, right far; plants stand at these points
    for side in (-1, 1):
        for part in (0, 1):
            pts = []
            for k in range(4):
                t = (k + 0.5) / 4 * 0.5 + (0.5 if part == 0 else 0)
                y = vy + 24 + (H - vy - 24) * t ** 1.3
                pts.append([round(x_at(y, side * 0.6)), round(y), round(0.35 + 0.65 * t, 2)])
            beds.append(pts)
    GEOM['polytunnel'] = {'beds': [beds[0], beds[1], beds[2], beds[3]]}
    cv.cylinder(40, 170, 212, lambda y: 7, [hx(c) for c in ['#1a2a3a', '#243a4e', '#2e4a62', '#3a5e78', '#4a748e', '#5e8aa4']], seed=1, fissures=0, streaks=False)
    return cv


def top_field(season):
    cv = Canvas(seed=151)
    sky, sky_c = sky_for(cv, season, 102, [(80, 24, 100, 12), (280, 16, 80, 10), (360, 44, 40, 6)], seed=43)
    for (amp, base, t, sd) in [(8, 90, 0.6, 1), (6, 98, 0.4, 2)]:
        for x in range(W):
            y = base + math.sin(x / 70 + sd) * amp * 0.6
            cv.rect(x, y, 1, 108 - y, mix(season_grass(season)[3], sky_c, t))
    leaf = season_leaf(season)
    cv.treeline(108, leaf or P['beech'], seed=45, height=(10, 16), width=(8, 12), sky=sky_c, fade_t=0.4, bare=leaf is None)
    cv.ground(106, season_grass(season), seed=46)
    strips = [(20, 114, 364, 128), (8, 136, 376, 158), (0, 168, W, 214)]
    for (x0, y0, x1, y1) in strips:
        sm = rect_fill(cv, x0, y0, x1, y1, P['soil'], 3, int(y0), 0.45, 0.3)
        for y in range(y0, y1, max(2, (y1 - y0) // 7)):
            for x in range(x0, x1):
                cv.put(x, y, P['soil'][2])
        if cv.wx == 'snow':
            cv.snow_fill(sm, seed=int(y0))
            for y in range(y0, y1, max(2, (y1 - y0) // 7)):
                for x in range(x0, x1):
                    cv.put(x, y, P['snow'][3])
        elif cv.wx == 'frost':
            cv.frost_fill(sm, seed=int(y0))
    GEOM['top_field'] = {'strips': [list(s) for s in strips]}
    hawthorn_hedge(cv, -10, W + 10, 112, season, seed=47, height=10)
    for (x, y, sz, f, sd) in [(-4, 218, 30, 1, 1), (392, 218, 30, -1, 2)]:
        cv.bracken(x, y, sz, [mix(c, hx('#0c140a'), 0.3) for c in (leaf or P['leaf_russet'])], flip=f, seed=sd)
    warm_light(cv, 60, -30, 320, 0.12 if season != 'winter' else 0.05)
    return cv


def fruit_tree(cv, x, base, h, crown, season, seed, blossom=None):
    rng = np.random.default_rng(seed)
    tips = []
    cv.cylinder(x, base - h * 0.45, base + 1, lambda y: 3.5, P['bark'], seed=seed, fissures=4)
    for a in (-2.5, -2.1, -1.75, -1.4, -1.05, -0.7, -0.45):
        cv.branch(x, base - h * 0.42, a, crown * 0.4, 3, P['bark'], 4, rng, tips=tips, spread=0.4)
    leaf = season_leaf(season)
    if leaf is not None:
        cl = [(tx + rng.uniform(-3, 3), ty + rng.uniform(0, 6), rng.uniform(8, 12), rng.random()) for (tx, ty) in tips]
        cl += [(x + rng.uniform(-crown * 0.5, crown * 0.5), base - h * 0.42 - crown * 0.22 + rng.uniform(-crown * 0.25, crown * 0.2), rng.uniform(9, 13), rng.random() * 0.5) for _ in range(14)]
        m = cv.foliage(cl, leaf, seed=seed)
        if blossom and season == 'spring':
            ys, xs = np.where(m)
            for i in rng.choice(len(xs), min(len(xs), 260), replace=False):
                cv.put(xs[i], ys[i], blossom[rng.integers(0, len(blossom))])
    return (x, base - h * 0.42 - crown * 0.22, crown * 0.62, crown * 0.36)


def orchard(season):
    cv = Canvas(seed=161)
    sky, sky_c = sky_for(cv, season, 96, [(90, 18, 80, 10), (300, 26, 70, 9)], seed=47)
    leaf = season_leaf(season)
    cv.treeline(100, leaf or P['beech'], seed=48, height=(14, 22), width=(9, 14), sky=sky_c, fade_t=0.45, bare=leaf is None)
    cv.ground(98, season_grass(season), seed=49)
    if season == 'spring':
        rng = np.random.default_rng(3)
        for _ in range(300):
            x, y = rng.integers(0, W), rng.integers(120, H)
            cv.put(x, y, hx('#f2e070') if rng.random() > 0.5 else hx('#f6f2e2'))
    # a south wall on the right for the yuzu, a pergola for the akebi
    brick_wall(cv, 318, 70, W, 150, seed=5, light=0.6)
    apple_bl = [hx('#f6e8ea'), hx('#e8b8c4'), hx('#ffffff')]
    plum_bl = [hx('#ffffff'), hx('#f2f2ea')]
    crowns = {}
    crowns['apple_1'] = fruit_tree(cv, 62, 176, 90, 70, season, 1, apple_bl)
    crowns['plum_1'] = fruit_tree(cv, 150, 140, 70, 54, season, 2, plum_bl)
    crowns['apple_2'] = fruit_tree(cv, 226, 172, 86, 66, season, 3, apple_bl)
    crowns['plum_2'] = fruit_tree(cv, 110, 206, 94, 60, season, 4, plum_bl)
    yx, yb = 346, 148
    cv.cylinder(yx, yb - 30, yb + 1, lambda y: 2.5, P['bark'], seed=9, fissures=2)
    rng = np.random.default_rng(9)
    cv.foliage([(yx + rng.uniform(-16, 16), yb - rng.uniform(28, 56), rng.uniform(7, 10), rng.random()) for _ in range(9)],
               [hx(c) for c in ['#0e1e12', '#16301a', '#1f4224', '#2c5a30', '#3c743c', '#50904a', '#6aa85a']], seed=9)
    crowns['yuzu'] = (yx, yb - 42, 17, 14)
    # the akebi on its pergola
    px0 = 262
    for k in (0, 38):
        cv.rect(px0 + k, 120, 4, 80, TIMBER[3]); cv.rect(px0 + k, 120, 1, 80, TIMBER[5])
    cv.rect(px0 - 6, 118, 54, 4, TIMBER[4]); cv.cap(px0 - 6, px0 + 48, 117, thick=2)
    if leaf is not None:
        ak = [hx(c) for c in ['#162a16', '#20401e', '#2e5828', '#3e7032', '#52883c', '#6aa04a', '#86b85a']]
        cv.foliage([(px0 + rng.uniform(-6, 44), 116 + rng.uniform(-8, 14), rng.uniform(5, 8), rng.random()) for _ in range(14)], ak, seed=10)
        for k in range(6):
            cv.line(px0 + rng.uniform(0, 40), 122, px0 + rng.uniform(0, 40), 170, ak[3])
    crowns['akebi'] = (px0 + 20, 126, 26, 12)
    GEOM['orchard'] = {'trees': {k: [round(v, 1) for v in c] for k, c in crowns.items()}}
    warm_light(cv, 60, -30, 320, 0.12 if season != 'winter' else 0.05)
    return cv


def orangery(season):
    cv = Canvas(seed=171)
    sky = P[SKY_FOR[season]]
    # glazing: sky and garden through glass, white bars
    cv.sky(sky, 150, clouds=[(90, 30, 70, 9), (280, 40, 60, 8)], seed=51)
    leaf = season_leaf(season)
    cv.treeline(150, leaf or P['beech'], seed=52, height=(30, 50), width=(14, 22), sky=sky[3], fade_t=0.35, bare=leaf is None)
    cv.px[:150] = cv.px[:150] * 0.82 + np.array([230, 240, 236], np.float32) * 0.18
    for x in range(0, W, 32):
        cv.rect(x, 0, 3, 150, hx('#e8e6de')); cv.rect(x + 2, 0, 1, 150, hx('#b8b6ae'))
    for y in (40, 96):
        cv.rect(0, y, W, 3, hx('#e8e6de')); cv.rect(0, y + 2, W, 1, hx('#b8b6ae'))
    if cv.wx in ('snow', 'frost'):
        rng0 = np.random.default_rng(5)
        for cx0 in range(0, W, 32):
            for _ in range(10 if cv.wx == 'frost' else 5):
                x, y = cx0 + 3 + rng0.uniform(0, 8), 146 - rng0.uniform(0, 30); a = -math.pi / 2 + rng0.uniform(-0.8, 0.8)
                for k in range(int(rng0.uniform(6, 14))):
                    x += math.cos(a); y += math.sin(a); a += rng0.uniform(-0.5, 0.5)
                    cv.put(x, y, P['rime'][5])
                    if k % 2: cv.put(x + 1, y, P['rime'][4])
    brick_wall(cv, 0, 148, W, 162, seed=7, light=0.5)
    outside_wx = cv.wx; cv.wx = 'clear'
    # terracotta tiles in a chequer
    tiles = [hx(c) for c in ['#6a2e1a', '#843c22', '#9c4c2c', '#b45e38', '#c87248']]
    for y in range(162, H):
        for x in range(W):
            ch = ((x // 16) + (y - 162) // 10) % 2
            cv.px[y, x] = tiles[2 + ch] if (x % 16 and (y - 162) % 10) else tiles[0]
    cv.px[162:] = cv.px[162:] * 0.85 + np.array([40, 20, 10], np.float32) * 0.15
    # the stove
    cv.rect(14, 128, 24, 44, hx('#1e1e20')); cv.rect(16, 146, 20, 12, hx('#2e2e30')); cv.rect(20, 150, 12, 5, hx('#e8702a')); cv.rect(22, 60, 6, 68, hx('#2a2a2c'))
    crowns = {}
    rng = np.random.default_rng(3)
    citrus = [hx(c) for c in ['#0c1c10', '#132c16', '#1c401e', '#285628', '#367034', '#488a42', '#62a456']]
    for i, (key, x, base, s) in enumerate([('finger_limes', 84, 196, 0.9), ('calamansi', 166, 186, 0.8), ('buddhas_hand', 248, 196, 1.0), ('black_sapote', 330, 188, 1.1)]):
        cv.sphere(x, base - 6, 13 * s, [hx(c) for c in ['#4a1e10', '#6a2e18', '#8a4024', '#a85630', '#c06e40']], rough=0.02, seed=i, flat_bottom=base, tex=0.05)
        cv.rect(x - 14 * s, base - 20 * s, 28 * s, 3, hx('#a85630'))
        cv.line(x, base - 18 * s, x, base - 44 * s, P['bark'][3], 2)
        cl = [(x + rng.uniform(-22, 22) * s, base - rng.uniform(46, 78) * s, rng.uniform(9, 13) * s, rng.random()) for _ in range(10)]
        cv.foliage(cl, citrus, seed=10 + i)
        crowns[key] = (x, base - 62 * s, 24 * s, 16 * s)
    GEOM['orangery'] = {'trees': {k: [round(v, 1) for v in c] for k, c in crowns.items()}}
    cv.wx = outside_wx
    cv.season = 'summer' if outside_wx != 'clear' else cv.season   # the grade is for outdoors; indoors stays warm
    return cv


def wbc_hive(cv, x, base):
    """A WBC hive: the white, stepped, pagoda-roofed hive of every English garden."""
    white = [hx(c) for c in ['#6a6860', '#8a8878', '#a8a694', '#c6c4b0', '#e2e0cc', '#f4f2e2']]
    cv.rect(x - 3, base - 6, 2, 6, TIMBER[2]); cv.rect(x + 17, base - 6, 2, 6, TIMBER[2])
    for k, (w, h) in enumerate([(24, 8), (22, 7), (22, 7), (24, 6)]):
        y = base - 6 - sum(hh for _, hh in [(24, 8), (22, 7), (22, 7), (24, 6)][:k + 1])
        cv.rect(x - 2 - (w - 22) / 2, y, w, h, white[4]); cv.rect(x - 2 - (w - 22) / 2, y + h - 1, w, 1, white[2]); cv.rect(x - 2 - (w - 22) / 2, y, 1, h, white[5])
    ty = base - 34
    for k in range(6):
        cv.rect(x - 4 + k, ty - k, 28 - 2 * k, 1, white[3] if k % 2 else white[4])
    cv.cap(x + 1, x + 19, ty - 6, thick=3, seed=int(x))
    cv.rect(x + 3, base - 9, 12, 2, hx('#2a2420'))
    return (x + 9, base - 20)


def hives(season):
    cv = Canvas(seed=181)
    sky, sky_c = sky_for(cv, season, 96, [(80, 20, 80, 10), (290, 28, 70, 9)], seed=53)
    leaf = season_leaf(season)
    cv.treeline(104, leaf or P['beech'], seed=54, height=(18, 30), width=(10, 16), sky=sky_c, fade_t=0.4, bare=leaf is None)
    hawthorn_hedge(cv, -10, W + 10, 122, season, seed=55, height=16)
    cv.ground(118, season_grass(season), seed=56)
    rng = np.random.default_rng(5)
    flowers = {'spring': ['#f2e070', '#f6f2e2', '#e87a9a'], 'summer': ['#b07ab0', '#e8e060', '#f0f0f0', '#d84a3a', '#6a7ad8'], 'autumn': ['#b07ab0', '#e0c050'], 'winter': []}[season]
    for _ in range(700 if season == 'summer' else 300):
        if not flowers:
            break
        x, y = rng.integers(0, W), rng.integers(128, H)
        cv.put(x, y, hx(flowers[rng.integers(0, len(flowers))])); cv.put(x, y + 1, season_grass(season)[2])
    spots = []
    for (x, b) in [(78, 172), (170, 164), (262, 170)]:
        spots.append(wbc_hive(cv, x, b))
    GEOM['hives'] = {'hives': [list(s) for s in spots]}
    for (x, y, sz, f, sd) in [(-4, 218, 30, 1, 1), (392, 218, 30, -1, 2)]:
        cv.bracken(x, y, sz, [mix(c, hx('#0c140a'), 0.3) for c in (leaf or P['leaf_russet'])], flip=f, seed=sd)
    warm_light(cv, 60, -30, 320, 0.14 if season != 'winter' else 0.05)
    return cv


def hen_run(season):
    cv = Canvas(seed=191)
    sky, sky_c = sky_for(cv, season, 90, [(90, 16, 70, 9), (300, 24, 70, 9)], seed=57)
    leaf = season_leaf(season)
    cv.treeline(98, leaf or P['beech'], seed=58, height=(16, 26), width=(10, 14), sky=sky_c, fade_t=0.4, bare=leaf is None)
    cv.ground(96, season_grass(season), seed=59)
    # the run: scratched earth inside a wire fence
    run = (cv.xx > 120) & (cv.xx < 370) & (cv.yy > 128) & (cv.yy < 204)
    cv.ramp_fill(run, np.clip(0.45 + (cv.noise(5, 6, 2) - 0.5) * 0.45, 0, 1), P['soil'])
    cv.snow_fill(run, seed=91, density=0.8)
    for x in range(120, 371, 12):
        cv.rect(x, 112, 2, 94, TIMBER[3]); cv.cap(x, x + 2, 111, thick=2, seed=x)
    for y in range(112, 204, 4):
        for x in range(120, 370):
            if (x + y) % 4 == 0:
                cv.put(x, y, hx('#8a8a82'))
    cv.rect(120, 112, 250, 1, hx('#aaa9a0'))
    # the hen house on legs
    hx0, hy0 = 22, 104
    cv.rect(hx0 + 4, hy0 + 44, 3, 20, TIMBER[2]); cv.rect(hx0 + 80, hy0 + 44, 3, 20, TIMBER[2])
    cv.rect(hx0, hy0 + 10, 90, 36, TIMBER[4])
    for x in range(hx0, hx0 + 90, 6):
        cv.rect(x, hy0 + 10, 1, 36, TIMBER[2])
    for k in range(12):
        cv.rect(hx0 - 4 + k, hy0 + 10 - k, 98 - 2 * k, 1, hx('#3a3530') if k % 2 else hx('#4a4540'))
    if cv.wx == 'snow':
        for k in range(10):
            cv.rect(hx0 - 2 + k, hy0 + 8 - k, 94 - 2 * k, 1, P['snow'][6 if k > 6 else 5])
    cv.cap(hx0 + 90, hx0 + 114, hy0 + 16, thick=2)
    cv.rect(hx0 + 60, hy0 + 26, 12, 16, TIMBER[1]); cv.line(hx0 + 72, hy0 + 44, hx0 + 100, hy0 + 72, TIMBER[3], 3)
    cv.rect(hx0 + 90, hy0 + 18, 24, 18, TIMBER[3]); cv.rect(hx0 + 90, hy0 + 17, 24, 2, TIMBER[5])
    GEOM['hen_run'] = {'run': [128, 132, 364, 200], 'nest': [hx0 + 102, hy0 + 26], 'coop': [hx0 + 45, hy0 + 30]}
    # a feeder and a dust bath
    cv.rect(300, 176, 10, 16, hx('#6a7a7a')); cv.rect(296, 190, 18, 3, hx('#4a5a5a'))
    darken_ellipse(cv, 200, 188, 18, 5, 0.3)
    warm_light(cv, 60, -30, 320, 0.12 if season != 'winter' else 0.05)
    return cv


def farm_map(season):
    cv = Canvas(seed=201)
    g = season_grass(season)
    cv.ramp_fill(np.ones((H, W), bool), np.clip(0.55 + (cv.noise(14, 2, 3) - 0.5) * 0.3, 0, 1), g)
    leaf = season_leaf(season)
    cv.horizon = 0
    cv.snow_fill(np.ones((H, W), bool), seed=5)
    # lanes
    for s in range(200):
        t = s / 200
        cv.rect(0 + t * W, 108 + math.sin(t * 6) * 4, 3, 4, P['soil'][4])
        cv.rect(188 + math.sin(t * 5) * 3, t * H, 4, 3, P['soil'][4])
    places = {}
    def plot(name, x0, y0, x1, y1):
        places[name] = [x0, y0, x1, y1]
    # walled garden: brick square with beds
    x0, y0 = 70, 20
    cv.rect(x0, y0, 76, 60, BRICK[3]); cv.rect(x0 + 3, y0 + 3, 70, 54, hx('#8a8272'))
    for i in range(3):
        for j in range(2):
            cv.rect(x0 + 8 + i * 22, y0 + 10 + j * 22, 16, 14, P['soil'][3] if cv.wx != 'snow' else P['snow'][5]); cv.rect(x0 + 8 + i * 22, y0 + 10 + j * 22, 16, 1, TIMBER[5])
    plot('walled_garden', x0, y0, x0 + 76, y0 + 60)
    # polytunnel
    x0, y0 = 214, 18
    for k in range(10):
        cv.rect(x0, y0 + k, 70, 1, mix(hx('#e6e6dc'), hx('#9ea49a'), abs(k - 3) / 8))
    for k in range(0, 70, 7):
        cv.rect(x0 + k, y0, 1, 10, hx('#8a8e88'))
    plot('polytunnel', x0, y0, x0 + 70, y0 + 10)
    # orangery
    x0, y0 = 300, 20
    cv.rect(x0, y0, 44, 28, hx('#bcd0cc')); cv.rect(x0, y0 + 24, 44, 4, BRICK[3])
    for k in range(0, 44, 6):
        cv.rect(x0 + k, y0, 1, 24, hx('#f2f0e8'))
    cv.rect(x0, y0 + 12, 44, 1, hx('#f2f0e8'))
    plot('orangery', x0, y0, x0 + 44, y0 + 28)
    # orchard
    rng = np.random.default_rng(3)
    for i in range(3):
        for j in range(3):
            tx, ty = 26 + i * 22 + (j % 2) * 8, 128 + j * 22
            cv.sphere(tx + 2, ty + 2, 6, [hx('#141a10')] * 3, rough=0.2, seed=i * 3 + j)
            cv.foliage([(tx, ty, 6, 1)], leaf or P['twig'], seed=i * 3 + j)
    plot('orchard', 14, 118, 100, 190)
    # the top field, striped
    x0, y0 = 214, 126
    for y in range(y0, y0 + 80):
        for x in range(x0, x0 + 160):
            if cv.wx == 'snow':
                cv.put(x, y, P['snow'][4] if ((x - x0 + y // 2) // 5) % 2 else P['snow'][6])
            else:
                cv.put(x, y, P['soil'][3] if ((x - x0 + y // 2) // 5) % 2 else P['soil'][4])
    plot('top_field', x0, y0, x0 + 160, y0 + 80)
    # hives in the meadow
    for k in range(3):
        cv.rect(118 + k * 10, 150, 6, 6, hx('#f2f0e2')); cv.rect(117 + k * 10, 149, 8, 1, hx('#8a8878'))
    plot('hives', 110, 140, 150, 162)
    # hen run
    cv.rect(150, 176, 40, 26, P['soil'][4])
    for x in range(150, 191, 4):
        cv.put(x, 176, hx('#aaa9a0')); cv.put(x, 201, hx('#aaa9a0'))
    cv.rect(152, 178, 12, 8, TIMBER[3]); cv.rect(151, 177, 14, 1, hx('#3a3530'))
    plot('hen_run', 150, 176, 190, 202)
    # the workshop
    fx, fy = 168, 76
    cv.rect(fx, fy, 30, 18, P['stone'][4])
    for k in range(10):
        cv.rect(fx - 2 + k, fy - 1 - k, 34 - 2 * k, 1, P['stone'][1] if k % 2 else P['stone'][2])
    cv.rect(fx + 5, fy + 6, 4, 4, hx('#f2c97a')); cv.rect(fx + 20, fy + 6, 4, 4, hx('#f2c97a'))
    # the barn and its lean-to shed, beside the workshop
    bx, by = 204, 82
    cv.rect(bx, by, 22, 14, P['stone'][3])
    for k in range(7):
        cv.rect(bx - 1 + k, by - 1 - k, 24 - 2 * k, 1, P['stone'][1] if k % 2 else P['stone'][2])
    cv.rect(bx + 22, by + 5, 10, 9, hx('#2e2b28')); cv.rect(bx + 23, by + 8, 3, 5, TIMBER[4]); cv.rect(bx + 27, by + 8, 3, 5, hx('#1e1b18'))
    plot('worm_shed', bx, by - 6, bx + 34, by + 14)
    GEOM['farm_map'] = {'places': places}
    if season == 'winter':
        snow = cv.rng.random((H, W)) < 0.08
        cv.px[snow] = cv.px[snow] * 0.4 + P['snow'][4] * 0.6
    return cv


def worm_shed(season):
    """The worm and fly shed: a lean-to against the stone barn, open at the front,
    worm towers on the left and black soldier fly bins on the right."""
    cv = Canvas(seed=231)
    sky, sky_c = sky_for(cv, season, 70, [(80, 14, 60, 8), (280, 20, 70, 9)], seed=61)
    leaf = season_leaf(season)
    cv.treeline(72, leaf or P['beech'], seed=62, height=(12, 20), width=(10, 14), sky=sky_c, fade_t=0.45, bare=leaf is None)
    cv.ground(70, season_grass(season), seed=63)
    # the barn wall: rough stone, lime pointing
    wall = rect_fill(cv, 0, 58, W, 170, P['stone'], 5, 11, 0.5, 0.4)
    for y in range(62, 170, 7):
        off = 0 if (y // 7) % 2 else 9
        for x in range(off, W, 18):
            cv.put(x, y, P['stone'][1]); cv.put(x + 1, y, P['stone'][1])
    # the lean-to roof, slate, sloping down towards us
    for k in range(18):
        cv.rect(0, 58 + k, W, 1, hx('#2e2b28') if k % 3 else hx('#44403a'))
    cv.cap(0, W, 57, thick=3)
    # the dark inside of the lean-to
    for y in range(76, 172):
        t = (y - 76) / 96
        for x in range(8, W - 8):
            c = cv.px[y, x]
            cv.px[y, x] = c * (0.55 + 0.25 * t)
    # posts
    for x in (6, 128, 256, 374):
        cv.rect(x, 74, 4, 100, TIMBER[3]); cv.rect(x, 74, 1, 100, TIMBER[5])
    # floor: packed earth and a scatter of straw
    floor = rect_fill(cv, 0, 170, W, H, P['soil'], 6, 12, 0.5, 0.35)
    cv.snow_fill(floor, seed=97, density=0.5)
    # worm towers, three tiers each
    worms = []
    for i, x0 in enumerate((26, 76)):
        for tier in range(3):
            y0 = 128 - tier * 16
            cv.rect(x0, y0, 42, 15, TIMBER[4]); cv.rect(x0, y0, 42, 1, TIMBER[6]); cv.rect(x0, y0 + 14, 42, 1, TIMBER[1])
            for x in range(x0 + 3, x0 + 42, 7):
                cv.put(x, y0 + 7, TIMBER[2])
        cv.rect(x0 - 2, 94, 46, 3, TIMBER[5])
        cv.rect(x0 + 4, 143, 4, 26, TIMBER[2]); cv.rect(x0 + 34, 143, 4, 26, TIMBER[2])
        worms.append([x0, 94, x0 + 42, 143])
    # the fly bins: big dark boxes with a ramp to a bucket, a mesh cage over the first
    bsf = []
    for i, x0 in enumerate((196, 284)):
        cv.rect(x0, 118, 70, 44, hx('#2a2622')); cv.rect(x0, 118, 70, 2, hx('#4a443c')); cv.rect(x0 + 2, 122, 66, 38, hx('#1e1b18'))
        cv.line(x0 + 66, 124, x0 + 84, 150, hx('#5a524a'), 2)
        cv.rect(x0 + 80, 150, 12, 12, hx('#3a4a52')); cv.rect(x0 + 80, 150, 12, 1, hx('#6a7a82'))
        cv.rect(x0 + 6, 162, 4, 8, TIMBER[2]); cv.rect(x0 + 60, 162, 4, 8, TIMBER[2])
        bsf.append([x0, 118, x0 + 70, 162])
    cx0 = 196
    for y in range(82, 118, 3):
        for x in range(cx0 + 2, cx0 + 68):
            if (x + y) % 3 == 0:
                cv.put(x, y, hx('#6a6a62'))
    cv.rect(cx0, 80, 70, 2, TIMBER[4]); cv.rect(cx0, 80, 2, 38, TIMBER[4]); cv.rect(cx0 + 68, 80, 2, 38, TIMBER[4])
    # sacks and a bench
    cv.sphere(150, 166, 10, [hx(c) for c in ['#4a3a24', '#6a5434', '#8a7048', '#a88a5c', '#c2a472', '#d8bc8a', '#e8d2a2']], rough=0.3, seed=3, flat_bottom=170, tex=0.2)
    cv.sphere(172, 168, 8, [hx(c) for c in ['#4a3a24', '#6a5434', '#8a7048', '#a88a5c', '#c2a472', '#d8bc8a', '#e8d2a2']], rough=0.3, seed=4, flat_bottom=170, tex=0.2)
    cv.rect(132, 132, 52, 4, TIMBER[5]); cv.rect(136, 136, 3, 30, TIMBER[2]); cv.rect(178, 136, 3, 30, TIMBER[2])
    GEOM['worm_shed'] = {'worms': worms, 'bsf': bsf, 'bench': [132, 132, 184, 136]}
    warm_light(cv, 120, -30, 300, 0.10 if season != 'winter' else 0.04)
    return cv


SCENES3 = {'pine_plantation': pine_plantation, 'hazel_coppice': hazel_coppice, 'harbour': harbour, 'salt_pans': salt_pans,
           'walled_garden': walled_garden, 'polytunnel': polytunnel, 'top_field': top_field, 'orchard': orchard,
           'orangery': orangery, 'hives': hives, 'hen_run': hen_run, 'farm_map': farm_map, 'worm_shed': worm_shed}

if __name__ == '__main__':
    D = sys.argv[1]
    which = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] != 'all' else list(SCENES3)
    seasons = sys.argv[3].split(',') if len(sys.argv) > 3 else ['spring', 'summer', 'autumn', 'winter']
    for k in which:
        for s in seasons:
            Image.fromarray(SCENES3[k](s).out()).save(f'{D}/scene_{k}_{s}.png')
        print('ok', k)
    json.dump(GEOM, open(f'{D}/geom.json', 'w'))

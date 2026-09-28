"""A small pixel-art renderer for the foraging grounds.

Everything is drawn into a 384x216 RGB array from hue-shifted ramps (cool
shadows, warm highlights), lit from the top left, dithered with a 4x4 Bayer
matrix where one tone gives way to the next. Nothing is anti-aliased.
"""
import math
import numpy as np

W, H = 384, 216
WX = 'clear'        # 'clear' | 'frost' (hoarfrost) | 'snow' -- set by the runner before a scene is drawn
SEASON = 'summer'
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16.0
LIGHT = np.array([-0.55, -0.72, 0.42]); LIGHT = LIGHT / np.linalg.norm(LIGHT)


def hx(s):
    s = s.lstrip('#'); return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def ramp(*cols):
    return [hx(c) for c in cols]


def mix(a, b, t):
    return a * (1 - t) + b * t


def fade(r, sky, t):
    """Aerial perspective: pull a whole ramp toward the sky colour."""
    return [mix(c, sky, t) for c in r]


# ---------------------------------------------------------------- palettes
INK = hx('#1a130b')
P = {
    'sky_clear':  ramp('#56789a', '#6f90ad', '#8eacc0', '#b2c8cf', '#d2dcd6'),
    'sky_grey':   ramp('#5e676c', '#737c7e', '#8b9290', '#a4a8a0', '#bdbeb2'),
    'sky_winter': ramp('#6e7d8a', '#8494a0', '#9eacb4', '#bcc6c8', '#d8dedc'),
    'sky_autumn': ramp('#6a7e92', '#8497a4', '#a4b0b0', '#c6c6b4', '#e0d6bc'),
    'cloud':      ramp('#8e979a', '#aeb4b2', '#ccd0c8', '#e6e4d8', '#f6f2e6'),
    'leaf_summer': ramp('#16261a', '#213a22', '#2f5129', '#446a30', '#5e8438', '#7fa043', '#a4ba58'),
    'leaf_spring': ramp('#1e3220', '#2d4a28', '#44682e', '#628a36', '#86aa42', '#aac658', '#d0de7a'),
    'leaf_autumn': ramp('#2e1a14', '#4e2618', '#76361a', '#a2521e', '#c87426', '#e49a34', '#f6c45a'),
    'leaf_russet': ramp('#22140e', '#3a2014', '#583018', '#7a441e', '#9a5c26', '#b87a34', '#d49c4a'),
    'leaf_bronze': ramp('#1e1a0e', '#322a14', '#4c3e1a', '#6a5622', '#8a702c', '#a88c3a', '#c6aa52'),
    'leaf_olive':  ramp('#262616', '#3a3a1e', '#525026', '#6c682c', '#8a8236', '#a89e46', '#c8ba5e'),
    'bark':   ramp('#140e0a', '#231913', '#34261b', '#4a3726', '#634a33', '#7e6246', '#9a7c5a'),
    'beech':  ramp('#2a2a2a', '#3e3e3a', '#55554e', '#6e6d64', '#88867a', '#a3a092', '#bebaa8'),
    'poplar': ramp('#2a2824', '#3e3b34', '#56524a', '#706a5e', '#8c8676', '#aaa392'),
    'grass_summer': ramp('#1c2a18', '#26381e', '#344a26', '#46602e', '#5c7836', '#779440', '#98b050'),
    'grass_spring': ramp('#223420', '#2e4626', '#3e5c2c', '#527634', '#6c923c', '#8aae48', '#aec65c'),
    'grass_autumn': ramp('#2a2618', '#3a341e', '#4e4626', '#655a2e', '#7e7036', '#988840', '#b4a052'),
    'grass_winter': ramp('#2a2820', '#3c3828', '#524a32', '#6a5e3e', '#80724a', '#958658', '#ab9c6c'),
    'snow':    ramp('#5e6c84', '#7888a0', '#96a6ba', '#b4c2d0', '#d0dae2', '#e8eef2', '#fafcfc'),
    'rime':    ramp('#8a9aa6', '#a8b8c2', '#c6d2d8', '#dde6ea', '#eef4f6', '#fbfdfd'),
    'ice':     ramp('#4e6270', '#6a808c', '#8aa0aa', '#aabec4', '#c8d6da', '#e2ecee', '#f4f8f8'),
    'sky_snow':  ramp('#7e868e', '#929aa0', '#a8adb0', '#bdbfbe', '#d0cfca'),
    'sky_frost': ramp('#4a6a92', '#6a8aac', '#94aec2', '#c4ccca', '#ecd6be'),
    'cloud_snow': ramp('#8a9098', '#9ea4aa', '#b2b6b8', '#c4c6c4', '#d4d4d0'),
    'soil':   ramp('#1c150f', '#2a2017', '#3b2d20', '#4f3d2b', '#665038', '#806648', '#9c805c'),
    'litter': ramp('#2a1810', '#482616', '#6a381c', '#8c4e22', '#ac6a2c', '#c88a3c'),
    'water':  ramp('#15232e', '#1e3240', '#284454', '#355a68', '#4a767e', '#6c989a', '#a6c6c0'),
    'sand':   ramp('#5e5038', '#7a6a4a', '#968460', '#b09e76', '#c8b68c', '#dccca2', '#ece0bc'),
    'stone':  ramp('#2e2d2a', '#44423e', '#5c5a54', '#76736a', '#918d82', '#aca79a', '#c6c0b0'),
    'heather': ramp('#241a24', '#352436', '#4a3248', '#62425a', '#7a546c', '#946a80', '#ae8496'),
    'sphagnum': ramp('#3a1614', '#57221c', '#783224', '#9a442c', '#b85c38', '#d27c4a', '#e6a064'),
    'silver': ramp('#262c26', '#363e36', '#4a5448', '#606c5c', '#7a8672', '#96a08a', '#b4bca4'),
    'berry':  ramp('#6a2a0c', '#963e10', '#c05a16', '#e07c1e', '#f4a232', '#fcc85a'),
    'fence':  ramp('#1e1812', '#2e241a', '#443526', '#5c4833', '#765e44', '#907656'),
    'chip':   ramp('#3a2414', '#58361c', '#7a4c26', '#9c6632', '#ba8242', '#d4a05a'),
    'twig':   ramp('#1e1a1e', '#2e282c', '#433a3c', '#5a4e4c', '#72645e', '#8a7a70', '#a4948a'),
    'reed':   ramp('#2a2a18', '#3e3c20', '#56522a', '#706a34', '#8c8440', '#aaa050'),
}


def season_leaf(season):
    return {'spring': P['leaf_spring'], 'summer': P['leaf_summer'], 'autumn': P['leaf_autumn'], 'winter': None}[season]


def season_grass(season):
    return P['grass_' + season]


# ---------------------------------------------------------------- canvas
class Canvas:
    def __init__(self, w=W, h=H, seed=1):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 3), np.float32)
        self.rng = np.random.default_rng(seed)
        self.wx, self.season = WX, SEASON
        self.sky_ref = None; self.horizon = None
        yy, xx = np.mgrid[0:h, 0:w]
        self.yy, self.xx = yy, xx
        self.bayer = BAYER[yy % 4, xx % 4]

    # --- low level
    def put(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y, x] = c

    def rect(self, x, y, w, h, c):
        x0, y0 = max(0, int(x)), max(0, int(y)); x1, y1 = min(self.w, int(x + w)), min(self.h, int(y + h))
        if x1 > x0 and y1 > y0:
            self.px[y0:y1, x0:x1] = c

    def ramp_fill(self, mask, value, r):
        """value 0..1 per pixel -> ramp index, dithered."""
        n = len(r)
        v = np.clip(value, 0, 0.9999) * (n - 1)
        base = np.floor(v); frac = v - base
        idx = (base + (frac > self.bayer)).astype(int)
        idx = np.clip(idx, 0, n - 1)
        R = np.array(r)
        self.px[mask] = R[idx[mask]]

    def line(self, x0, y0, x1, y1, c, w=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0), 1))
        for i in range(n + 1):
            t = i / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            self.rect(x - w // 2, y - w // 2, w, w, c)

    def blit(self, sprite, x, y):
        """sprite: HxWx4 uint8. x,y = top-left."""
        h, w = sprite.shape[:2]
        for j in range(h):
            for i in range(w):
                if sprite[j, i, 3] > 0:
                    self.put(x + i, y + j, sprite[j, i, :3].astype(np.float32))

    def out(self):
        return np.clip(self.px, 0, 255).astype(np.uint8)

    # --- noise
    def noise(self, scale=8.0, seed=0, octaves=3):
        """Value noise over the whole canvas, 0..1."""
        rng = np.random.default_rng(seed)
        acc = np.zeros((self.h, self.w), np.float32); amp = 1.0; tot = 0
        for o in range(octaves):
            s = scale / (2 ** o)
            gh, gw = int(self.h / s) + 3, int(self.w / s) + 3
            g = rng.random((gh, gw)).astype(np.float32)
            fy = self.yy / s; fx = self.xx / s
            y0 = np.floor(fy).astype(int); x0 = np.floor(fx).astype(int)
            ty = fy - y0; tx = fx - x0
            ty = ty * ty * (3 - 2 * ty); tx = tx * tx * (3 - 2 * tx)
            a = g[y0, x0]; b = g[y0, x0 + 1]; c = g[y0 + 1, x0]; d = g[y0 + 1, x0 + 1]
            acc += amp * (a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty)
            tot += amp; amp *= 0.5
        return acc / tot

    # --- sky
    def sky(self, r, y1, clouds=None, cloud_r=None, seed=0):
        if self.wx == 'snow':
            r, cloud_r = P['sky_snow'], P['cloud_snow']
        elif self.wx == 'frost':
            r = P['sky_frost']; clouds = (clouds or [])[:1]
        elif self.season == 'winter':
            cloud_r = [mix(c, hx('#8a949c'), 0.55) for c in P['cloud']]
            clouds = [(cx, cy, cw * 1.8, ch * 0.7) for (cx, cy, cw, ch) in (clouds or [])]
        t = np.clip(self.yy / max(1, y1), 0, 1)
        mask = self.yy < y1
        self.ramp_fill(mask, t * 0.999, r)
        if clouds:
            for (cx, cy, cw, ch) in clouds:
                if self.wx == 'snow':
                    ch, cw = ch * 1.6, cw * 1.8
                self.cloud(cx, cy, cw, ch, cloud_r or P['cloud'], seed=seed + int(cx))
        if self.wx == 'frost':
            # a low winter sun just off the left of the frame
            d = np.sqrt(((self.xx + 40) / 1.6) ** 2 + (self.yy - y1 * 0.9) ** 2)
            glow = np.clip(1 - d / 200, 0, 1) ** 2 * 0.35
            m = mask & (glow > 0)
            self.px[m] = self.px[m] * (1 - glow[m][:, None]) + np.array([255, 224, 180], np.float32) * glow[m][:, None]
        self.sky_ref = self.px.copy()

    def cloud(self, cx, cy, cw, ch, r, seed=0):
        rng = np.random.default_rng(seed)
        puffs = []
        n = max(3, int(cw / 7))
        for i in range(n):
            px = cx - cw / 2 + (i + 0.5) * cw / n + rng.uniform(-3, 3)
            rr = ch * (0.55 + 0.45 * math.sin(math.pi * (i + 0.5) / n)) * rng.uniform(0.8, 1.1)
            puffs.append((px, cy - rr * 0.35, rr))
        for (px, py, rr) in puffs:
            self.sphere(px, py, rr, r, flat_bottom=cy + ch * 0.25, rough=0.06, seed=seed + int(px), weather=False)

    # --- shaded forms
    def sphere(self, cx, cy, rad, r, flat_bottom=None, rough=0.15, seed=0, darken=0.0, mask_out=None, tex=0.10, freq=5.0, glob=None, gw=0.45, weather=True):
        x0, x1 = int(cx - rad - 2), int(cx + rad + 3); y0, y1 = int(cy - rad - 2), int(cy + rad + 3)
        x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(self.w, x1), min(self.h, y1)
        if x1 <= x0 or y1 <= y0:
            return None
        yy, xx = np.mgrid[y0:y1, x0:x1]
        dx = (xx - cx) / rad; dy = (yy - cy) / rad
        ang = np.arctan2(dy, dx)
        h = np.sin(ang * freq + seed) * 0.45 + np.sin(ang * (freq * 2.3) + seed * 1.7) * 0.3 + np.sin(ang * (freq * 4.1) + seed * 0.3) * 0.25
        edge = 1 + rough * h
        d = np.sqrt(dx * dx + dy * dy)
        m = d < edge
        if flat_bottom is not None:
            m &= yy <= flat_bottom
        dd = np.clip(d / edge, 0, 1)
        nz = np.sqrt(np.clip(1 - dd * dd, 0, 1))
        lam = dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]
        rng = np.random.default_rng(seed + 7)
        t = rng.random(m.shape) * 2 - 1
        v = 0.5 + 0.55 * lam
        if glob is not None:
            gx, gy, gr = glob
            gdx = (xx - gx) / gr; gdy = (yy - gy) / gr
            gl = np.clip(-(gdx * 0.62 + gdy * 0.78), -1, 1)
            v = (1 - gw) * v + gw * (0.5 + 0.5 * gl)
        v = np.clip(v + tex * t - darken, 0, 1)
        full = np.zeros((self.h, self.w), bool); full[y0:y1, x0:x1] = m
        val = np.zeros((self.h, self.w), np.float32); val[y0:y1, x0:x1] = v
        self.ramp_fill(full, val, r)
        if weather and self.wx == 'snow':
            # a cap of snow on whatever faces the sky; ragged, thicker on big forms
            wob = np.sin(dx * 9 + seed) * 0.12 + rng.random(m.shape) * 0.1
            cap = m & (dy < -0.18 + wob) & (dd < 0.98)
            cm = np.zeros((self.h, self.w), bool); cm[y0:y1, x0:x1] = cap
            cv_ = np.zeros((self.h, self.w), np.float32); cv_[y0:y1, x0:x1] = np.clip(0.55 + 0.45 * lam, 0, 1)
            self.ramp_fill(cm, cv_, P['snow'])
        elif weather and self.wx == 'frost':
            rim = m & (lam > 0.3) & (rng.random(m.shape) < 0.45)
            edge = m & (dd > 0.8) & (dy < -0.25) & (rng.random(m.shape) < 0.7)
            fm = np.zeros((self.h, self.w), bool); fm[y0:y1, x0:x1] = rim
            em = np.zeros((self.h, self.w), bool); em[y0:y1, x0:x1] = edge
            self.px[fm] = self.px[fm] * 0.5 + P['rime'][3] * 0.5
            self.px[em] = P['rime'][4]
        if mask_out is not None:
            mask_out |= full
        return full

    def foliage(self, clumps, r, seed=0, outline=True, depth_dark=0.18):
        """clumps: list of (x, y, radius, depth 0 back .. 1 front)."""
        mask = np.zeros((self.h, self.w), bool)
        xs = [c[0] for c in clumps]; ys = [c[1] for c in clumps]
        glob = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, max(20, (max(xs) - min(xs) + max(ys) - min(ys)) / 3))
        for i, (x, y, rad, dep) in sorted(enumerate(clumps), key=lambda k: k[1][3]):
            self.sphere(x, y, rad, r, rough=0.16, seed=seed + i * 13, darken=(1 - dep) * depth_dark, mask_out=mask, tex=0.06, freq=5 + (i % 3), glob=glob)
        if outline:
            self.shade_edge(mask, r[0], r[1])
        return mask

    def shade_edge(self, mask, dark, mid):
        """Selective outline: only on the edges that face away from the light."""
        m = mask
        below = np.zeros_like(m); below[:-1] = m[1:]
        right = np.zeros_like(m); right[:, :-1] = m[:, 1:]
        edge_b = m & ~below
        edge_r = m & ~right
        self.px[edge_b] = dark
        self.px[edge_r & ~edge_b] = mid

    def cylinder(self, x_center, y_top, y_bot, half_w_fn, r, seed=0, streaks=True, knots=0, fissures=9):
        """A vertical trunk; half_w_fn(y) gives the half width at each row. Furrowed bark:
        wandering dark fissures with a lit ridge on the side that faces the light."""
        rng = np.random.default_rng(seed)
        fk = [(rng.uniform(-0.95, 0.95), rng.uniform(0.03, 0.08), rng.uniform(0, 6), rng.uniform(0.04, 0.09)) for _ in range(fissures)]
        n = len(r)
        for y in range(int(y_top), int(y_bot)):
            hw = half_w_fn(y)
            if hw <= 0:
                continue
            for x in range(int(x_center - hw), int(x_center + hw) + 1):
                if not (0 <= x < self.w and 0 <= y < self.h):
                    continue
                u = max(-1, min(1, (x - x_center) / max(hw, 0.5)))
                nz = math.sqrt(max(0, 1 - u * u))
                lam = u * LIGHT[0] + nz * LIGHT[2] + 0.1
                v = 0.42 + 0.5 * lam
                if streaks:
                    for (u0, amp, ph, f) in fk:
                        uk = u0 + amp * math.sin(y * f + ph) + 0.03 * math.sin(y * 0.31 + ph * 2)
                        dist = u - uk
                        if abs(dist) < 0.055:
                            v -= 0.34
                            break
                        if -0.16 < dist < -0.055:
                            v += 0.07
                if abs(u) > 0.86:
                    v -= 0.2
                v = max(0, min(0.999, v + (rng.random() - 0.5) * 0.06))
                fv = v * (n - 1); b = int(fv)
                idx = b + (1 if (fv - b) > BAYER[y % 4, x % 4] else 0)
                self.px[y, x] = r[min(n - 1, idx)]
                if self.wx == 'snow' and u < -0.62 and rng.random() < 0.75:
                    self.px[y, x] = P['snow'][5 if u < -0.8 else 4]
                elif self.wx == 'frost' and u < -0.78 and rng.random() < 0.6:
                    self.px[y, x] = P['rime'][3]

    def root(self, pts, r0, r1, r, seed=0):
        """A root lying on the ground: a tapered log, lit on its top, dark underneath."""
        total = len(pts) - 1; n = len(r)
        steps = int(sum(math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) for k in range(total)) * 1.5) + 2
        for i in range(steps + 1):
            t = i / steps; k = min(total - 1, int(t * total)); u = t * total - k
            x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u; y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u
            rad = r0 + (r1 - r0) * t
            for dy in range(-int(rad), int(rad) + 1):
                v = 0.72 - 0.55 * (dy + rad) / (2 * rad + 0.01)
                if abs(dy) == int(rad):
                    v -= 0.2
                yy = int(round(y + dy)); xx = int(round(x))
                if 0 <= xx < self.w and 0 <= yy < self.h:
                    fv = max(0, min(0.999, v)) * (n - 1); b = int(fv)
                    self.px[yy, xx] = r[min(n - 1, b + (1 if (fv - b) > BAYER[yy % 4, xx % 4] else 0))]
                    if self.wx == 'snow' and dy <= -int(rad) + 1:
                        self.px[yy, xx] = P['snow'][6 if dy == -int(rad) else 5]
                    elif self.wx == 'frost' and dy == -int(rad):
                        self.px[yy, xx] = P['rime'][4]
            self.put(x, y + rad + 1, r[0])

    def bracken(self, x, y, size, r, flip=1, seed=0, droop=0.9):
        """A bracken frond: a curved stem with paired leaflets, shaded, for foregrounds."""
        rng = np.random.default_rng(seed)
        if self.wx == 'snow':
            r = [mix(c, P['snow'][5], 0.35) for c in r]; size *= 0.75
        elif self.wx == 'frost':
            r = [mix(c, P['rime'][3], 0.4) for c in r]
        steps = int(size)
        ang0 = -math.pi / 2 + flip * 0.25
        px, py = x, y
        for i in range(steps):
            t = i / steps
            ang = ang0 + flip * t * droop
            px += math.cos(ang); py += math.sin(ang)
            self.put(px, py, r[1])
            if i > 3 and i % 2 == 0:
                ln = (1 - t) * size * 0.32 + 2
                for side in (-1, 1):
                    a2 = ang + side * 1.25
                    for k in range(int(ln)):
                        lx = px + math.cos(a2) * k; ly = py + math.sin(a2) * k + k * 0.25
                        c = r[2 + (1 if side < 0 else 0) + (1 if k < ln * 0.5 else 0)]
                        self.put(lx, ly, c)
                        if k % 2 == 1:
                            self.put(lx, ly + 1, r[1])

    def branch(self, x, y, ang, length, width, r, depth, rng, twigs=True, tips=None, spread=0.55):
        """Recursive branching, drawn with thickness; tips collects leaf positions."""
        if depth == 0 or length < 3 or width < 0.6:
            if tips is not None:
                tips.append((x, y))
            return
        x2 = x + math.cos(ang) * length; y2 = y + math.sin(ang) * length
        steps = int(length) + 1
        for i in range(steps + 1):
            t = i / steps
            px = x + (x2 - x) * t; py = y + (y2 - y) * t
            ww = width * (1 - 0.35 * t)
            for k in range(-int(ww // 2), int(math.ceil(ww / 2))):
                nx = px + (-math.sin(ang)) * k; ny = py + math.cos(ang) * k
                side = k / max(1, ww / 2)
                c = r[4] if side < -0.3 else r[2] if side > 0.3 else r[3]
                if self.wx == 'snow' and side < -0.2 and math.sin(ang) < 0.5:
                    c = P['snow'][6] if (int(px) + int(py)) % 3 else P['snow'][5]
                elif self.wx == 'frost' and side < -0.2:
                    c = P['rime'][4]
                self.put(nx, ny, c)
            if ww < 1.5:
                tw = r[2]
                if self.wx == 'snow' and (int(px * 3 + py) % 3 == 0):
                    tw = P['snow'][6]
                elif self.wx == 'frost' and (int(px + py * 2) % 2 == 0):
                    tw = P['rime'][5]
                self.put(px, py, tw)
        n = 2 if depth > 1 else rng.integers(1, 3)
        for j in range(n):
            na = ang + rng.uniform(-spread, spread) + (j - (n - 1) / 2) * 0.5
            self.branch(x2, y2, na, length * rng.uniform(0.62, 0.8), width * 0.66, r, depth - 1, rng, twigs, tips, spread)

    # --- ground
    def ground(self, y_h, r, seed=0, blades=True, far_fade=None, sky=None, tuft_r=None):
        """Ground from y_h to the bottom: darker and more textured toward the viewer."""
        self.horizon = y_h
        mask = self.yy >= y_h
        if self.wx == 'snow':
            self.snow_fill(mask, seed=seed, straw=r)
            return
        depth = np.clip((self.yy - y_h) / max(1, (self.h - y_h)), 0, 1)
        n = self.noise(14, seed, 3)
        v = 0.60 - 0.26 * depth + (n - 0.5) * 0.22
        self.ramp_fill(mask, np.clip(v, 0, 1), r)
        if far_fade is not None and sky is not None:
            fm = mask & (depth < 0.12)
            t = (1 - depth[fm] / 0.12) * far_fade
            self.px[fm] = self.px[fm] * (1 - t[:, None]) + sky * t[:, None]
        if self.wx == 'frost':
            self.frost_fill(mask, seed=seed)
        if blades:
            rng = np.random.default_rng(seed + 3)
            count = int((self.h - y_h) * self.w * 0.03)
            for _ in range(count):
                x = rng.integers(0, self.w); y = rng.integers(int(y_h) + 2, self.h)
                dep = (y - y_h) / (self.h - y_h)
                if rng.random() > dep * dep * 1.1:
                    continue
                ln = 1 + int(dep * 3 * rng.random())
                hi = r[min(len(r) - 1, 5 + (rng.random() > 0.6))] if dep > 0.3 else r[4]
                if self.wx == 'frost':
                    hi = P['rime'][5]
                for k in range(ln):
                    self.put(x + (k if rng.random() > 0.8 else 0) * 0, y - k, hi if k == ln - 1 else r[4 if dep > 0.5 else 3])
                self.put(x, y + 1, r[1])

    def tuft(self, x, y, r, h=6, n=7, rng=None, lean=0.0):
        rng = rng or self.rng
        if self.wx == 'snow':
            r = [mix(c, hx('#8a7a58'), 0.5) for c in r]
        for i in range(n):
            ang = -math.pi / 2 + (i - n / 2) * 0.16 + lean + rng.uniform(-0.08, 0.08)
            ln = h * rng.uniform(0.6, 1.0)
            for k in range(int(ln)):
                if self.wx == 'snow' and k < ln * 0.45:
                    continue
                px = x + (i - n / 2) * 0.8 + math.cos(ang) * k; py = y + math.sin(ang) * k
                c = r[min(len(r) - 1, 2 + int(4 * k / ln))]
                if self.wx == 'frost' and k > ln * 0.6:
                    c = P['rime'][4 + (k % 2)]
                if self.wx == 'snow' and k == int(ln) - 1:
                    c = P['snow'][6]
                self.put(px, py, c)

    def fern(self, x, y, size, r, flip=1, rng=None):
        rng = rng or self.rng
        for f in range(5):
            ang = -math.pi / 2 + flip * (0.35 + f * 0.28)
            ln = size * (1 - f * 0.12)
            for k in range(int(ln)):
                t = k / ln
                bend = ang + flip * t * 0.6
                px = x + math.cos(bend) * k; py = y + math.sin(bend) * k + t * t * size * 0.35
                c = r[2 + int(3 * (1 - t))] if f % 2 else r[3 + int(2 * (1 - t))]
                self.put(px, py, c)
                if k % 2 == 0 and k > 2:
                    self.put(px + math.cos(bend + 1.3) * 1.5, py + math.sin(bend + 1.3) * 1.5, r[2])
                    self.put(px + math.cos(bend - 1.3) * 1.5, py + math.sin(bend - 1.3) * 1.5, r[3])

    def scatter(self, y0, y1, n, cols, rng=None, size=1, x0=0, x1=None):
        rng = rng or self.rng
        x1 = self.w if x1 is None else x1
        for _ in range(n):
            x = rng.integers(x0, x1); y = rng.integers(int(y0), int(y1))
            c = cols[rng.integers(0, len(cols))]
            self.put(x, y, c)
            if size > 1:
                self.put(x + 1, y, c)

    def leaves(self, y0, drift, thresh, r, density=0.18, seed=0):
        rng = np.random.default_rng(seed)
        if self.wx == 'snow':
            return
        if self.wx == 'frost':
            r = [mix(c, P['rime'][3], 0.45) for c in r]
        for y in range(int(y0), self.h):
            dep = (y - y0) / max(1, self.h - y0)
            for x in range(0, self.w):
                d = drift[y, x]
                if d < thresh:
                    continue
                p = density * min(1, (d - thresh) * 6) * (0.4 + dep)
                if rng.random() > p:
                    continue
                c = r[rng.integers(2, len(r))]
                big = dep > 0.35 and rng.random() < 0.5
                self.put(x, y + 1, r[0])
                self.put(x, y, c)
                if big:
                    self.put(x + 1, y, c); self.put(x + 1, y + 1, r[1])

    def snow_fill(self, mask, seed=0, straw=None, density=1.0):
        """Lying snow: drifts from low-frequency noise, blue shadow in the hollows, lit crests,
        and a little straw showing where it lies thin."""
        if self.wx != 'snow':
            if self.wx == 'frost':
                self.frost_fill(mask, seed=seed)
            return
        n = self.noise(26, seed + 51, 3); f = self.noise(5, seed + 52, 2)
        depth = np.clip((self.yy - (self.horizon or 0)) / max(1, self.h - (self.horizon or 0)), 0, 1)
        # drifts are lit on their windward face and blue in their lee
        gy = np.zeros_like(n); gy[1:] = n[1:] - n[:-1]
        v = 0.74 + (n - 0.5) * 0.55 - gy * 9.0 - 0.1 * depth + (f - 0.5) * 0.1
        # wind ripples: long shallow bands across the drift
        rip = np.sin(self.yy * 0.9 + np.sin(self.xx / 23.0 + seed) * 3 + n * 6)
        v = v - (rip > 0.93) * 0.16
        m = mask
        if density < 1:
            m = mask & (self.noise(9, seed + 53, 2) < density * 1.1)
        self.ramp_fill(m, np.clip(v, 0, 1), P['snow'])
        spark = m & (np.random.default_rng(seed + 55).random((self.h, self.w)) < 0.004) & (v > 0.75)
        self.px[spark] = np.array([255, 255, 255], np.float32)
        if straw is not None:
            rng = np.random.default_rng(seed + 54)
            ys, xs = np.where(m & (n < 0.42))
            if len(xs):
                for i in rng.choice(len(xs), min(len(xs), int(len(xs) * 0.05)), replace=False):
                    self.put(xs[i], ys[i], straw[3]); self.put(xs[i], ys[i] - 1, straw[4])

    def frost_fill(self, mask, seed=0, amount=0.5):
        """Hoarfrost: the colour kept underneath, every surface paled and crisp."""
        if self.wx not in ('frost', 'snow'):
            return
        rng = np.random.default_rng(seed + 61)
        n = self.noise(14, seed + 62, 3)
        t = amount * (0.55 + 0.55 * n)
        m = mask
        lum = (self.px * np.array([0.3, 0.59, 0.11])).sum(-1)
        # dark hollows hold the frost longest
        t = np.clip(t + (lum < 70) * 0.12, 0, 0.85)
        self.px[m] = self.px[m] * (1 - t[m][:, None]) + P['rime'][3] * t[m][:, None]
        sp = m & (rng.random((self.h, self.w)) < 0.012)
        self.px[sp] = P['rime'][5]

    def ice(self, mask, seed=0, drift=False):
        n = self.noise(12, seed + 71, 2)
        depth = np.clip((self.yy - self.yy[mask].min()) / max(1, self.yy[mask].max() - self.yy[mask].min() + 1), 0, 1) if mask.any() else self.yy * 0
        self.ramp_fill(mask, np.clip(0.55 + (n - 0.5) * 0.3 - depth * 0.15, 0, 1), P['ice'])
        rng = np.random.default_rng(seed + 72)
        ys, xs = np.where(mask)
        if len(xs):
            for _ in range(int(len(xs) / 260)):
                i = rng.integers(0, len(xs)); x, y = xs[i], ys[i]; a = rng.uniform(-0.4, 0.4)
                for k in range(rng.integers(6, 18)):
                    x += math.cos(a) * 1.5; y += math.sin(a) * 0.5; a += rng.uniform(-0.6, 0.6)
                    if 0 <= int(y) < self.h and 0 <= int(x) < self.w and mask[int(y), int(x)]:
                        self.px[int(y), int(x)] = P['ice'][6] if k % 3 else P['ice'][2]
            if drift:
                top = mask & ~np.roll(mask, 1, axis=0)
                for y, x in zip(*np.where(top)):
                    for k in range(int(2 + 2 * math.sin(x / 7) ** 2)):
                        if y + k < self.h and mask[y + k, x]:
                            self.px[y + k, x] = P['snow'][5 - (k > 1)]

    def cap(self, x0, x1, y, thick=2, seed=0):
        """Snow on a flat top (a wall coping, a roof, a rail, a hive), or a line of rime."""
        if self.wx == 'frost':
            for x in range(int(x0), int(x1)):
                self.put(x, y, P['rime'][5 if (x % 3) else 4])
            return
        if self.wx != 'snow':
            return
        rng = np.random.default_rng(seed + int(x0) * 7 + int(y))
        for x in range(int(x0), int(x1)):
            t = thick + (1 if rng.random() < 0.35 else 0)
            if x == int(x0) or x == int(x1) - 1:
                t = max(1, t - 1)
            for k in range(t):
                self.put(x, y - k, P['snow'][6] if k == t - 1 else P['snow'][5])
            self.put(x, y + 1, P['snow'][2])

    def grade(self):
        """Winter light: everything below the sky cooled and drained of colour; mist along the horizon."""
        if self.season != 'winter' and self.wx == 'clear':
            return
        amt = {'clear': (0.22, 0.08), 'frost': (0.18, 0.07), 'snow': (0.3, 0.1)}[self.wx]
        if self.season != 'winter':
            amt = (amt[0] * 0.5, amt[1] * 0.6)
        m = np.ones((self.h, self.w), bool)
        if self.sky_ref is not None:
            m &= np.any(np.abs(self.px - self.sky_ref) > 0.5, axis=-1)
        lum = (self.px * np.array([0.3, 0.59, 0.11])).sum(-1, keepdims=True)
        des = self.px * (1 - amt[0]) + lum * amt[0]
        cold = des * (1 - amt[1]) + np.array([118, 134, 156], np.float32) * amt[1]
        self.px[m] = cold[m]
        if self.horizon and self.wx != 'snow' and self.season == 'winter':
            self.haze(self.horizon - 12, self.horizon + 8, np.array([196, 204, 210], np.float32), 0.24)

    def haze(self, y0, y1, colour, strength):
        """Horizontal band of aerial haze."""
        mid = (y0 + y1) / 2
        for y in range(max(0, int(y0)), min(self.h, int(y1))):
            t = strength * (1 - abs(y - mid) / max(1, (y1 - y0) / 2))
            self.px[y] = self.px[y] * (1 - t) + colour * t

    def treeline(self, y_base, r, seed=0, height=(8, 20), width=(6, 12), sky=None, fade_t=0.0, bare=False, x0=0, x1=None):
        rng = np.random.default_rng(seed)
        x1 = self.w if x1 is None else x1
        rr = fade(r, sky, fade_t) if sky is not None else r
        x = x0 - 6
        clumps = []
        while x < x1 + 6:
            hgt = rng.uniform(*height); wd = rng.uniform(*width)
            clumps.append((x, y_base - hgt * 0.55, wd * 0.62, rng.random() * 0.6))
            x += wd * rng.uniform(0.7, 1.0)
        if bare:
            tw = fade(P['twig'], sky, fade_t) if sky is not None else P['twig']
            if self.wx == 'snow':
                tw = [mix(c, P['snow'][4], 0.35) for c in tw]
            elif self.wx == 'frost':
                tw = [mix(c, P['rime'][3], 0.4) for c in tw]
            mask = np.zeros((self.h, self.w), bool)
            for i, (cx, cy, rad, dep) in enumerate(clumps):
                self.sphere(cx, cy, rad, tw, rough=0.35, seed=seed + i * 7, darken=0.1, mask_out=mask, tex=0.22, freq=9)
            # a few trunks showing through the base of the mass
            for (cx, cy, rad, _) in clumps[::2]:
                self.rect(cx, cy + rad * 0.3, 1, y_base - cy - rad * 0.3, tw[1])
        else:
            self.foliage(clumps, rr, seed=seed, outline=False, depth_dark=0.1)
        self.rect(x0, y_base - 2, (x1 - x0), 3, rr[1])

    def water_band(self, y0, y1, r, sky_c, seed=0, reflect=None, freezes=True):
        mask = (self.yy >= y0) & (self.yy < y1)
        if freezes and (self.wx == 'snow' or (self.wx == 'frost' and self.season == 'winter')):
            self.ice(mask, seed=seed, drift=self.wx == 'snow')
            return
        n = self.noise(10, seed, 2)
        depth = np.clip((self.yy - y0) / max(1, (y1 - y0)), 0, 1)
        v = 0.55 - 0.25 * depth + (n - 0.5) * 0.2
        self.ramp_fill(mask, v, r)
        rng = np.random.default_rng(seed)
        for _ in range(int((y1 - y0) * self.w * 0.02)):
            x = rng.integers(0, self.w); y = rng.integers(int(y0), int(y1))
            ln = rng.integers(2, 7)
            for k in range(ln):
                self.put(x + k, y, r[-2] if rng.random() > 0.5 else r[-1])
        if freezes and self.wx == 'frost':
            edge = mask & ((self.yy < y0 + 2) | (self.yy >= y1 - 3))
            self.px[edge] = self.px[edge] * 0.3 + P['ice'][5] * 0.7
        if reflect is not None:
            # a darkened, flipped slice of what stands on the far bank
            src = reflect
            for y in range(int(y0), int(y1)):
                sy = int(y0) - (y - int(y0)) - 1
                if sy < 0:
                    break
                t = 0.5 * (1 - (y - y0) / (y1 - y0))
                wob = int(round(math.sin(y * 1.3) * 1.2))
                row = np.roll(src[sy], wob, axis=0)
                self.px[y] = self.px[y] * (1 - t) + row * t * 0.75

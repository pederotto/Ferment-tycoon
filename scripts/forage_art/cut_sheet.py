"""Cut a magenta sprite sheet from the generator into its sprites, on the native grid.

The sheets come off the same generator as the plates (480x268 upscaled by
2.867), so they are snapped the same way, then the magenta is keyed out and the
sprites found as connected blobs. Blobs closer than `merge` pixels are one sprite
(a flower that floats off its stem). Returns sprites sorted into rows (by the
vertical centre) and, within a row, left to right.
"""
import numpy as np
from PIL import Image
from snap_plates import snap, W, H


def key(im: Image.Image) -> np.ndarray:
    a = np.asarray(im.convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 150) & (b > 150) & (g < 110) & (abs(r - b) < 90)
    # the fringe: pixels on a sprite's edge still carrying the magenta the
    # upscaler blended in. Two passes peel the outer ring of them.
    tint = (r - g > 45) & (b - g > 45)
    for _ in range(2):
        edge = np.zeros_like(mag)
        edge[1:] |= mag[:-1]; edge[:-1] |= mag[1:]; edge[:, 1:] |= mag[:, :-1]; edge[:, :-1] |= mag[:, 1:]
        mag = mag | (edge & tint)
    rgba = np.dstack([a, np.where(mag, 0, 255)]).astype(np.uint8)
    return rgba


def blobs(alpha: np.ndarray, merge: int = 2):
    h, w = alpha.shape
    lab = np.zeros((h, w), int)
    n = 0
    boxes = []
    for y in range(h):
        for x in range(w):
            if alpha[y, x] and not lab[y, x]:
                n += 1
                stack = [(y, x)]; lab[y, x] = n
                x0 = x1 = x; y0 = y1 = y; cnt = 0
                while stack:
                    cy, cx = stack.pop(); cnt += 1
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and alpha[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n; stack.append((ny, nx))
                if cnt >= 4:
                    boxes.append([x0, y0, x1 + 1, y1 + 1])
    # merge boxes that touch or nearly do
    changed = True
    while changed:
        changed = False
        out = []
        while boxes:
            b = boxes.pop()
            for o in boxes:
                if b[0] - merge <= o[2] and o[0] - merge <= b[2] and b[1] - merge <= o[3] and o[1] - merge <= b[3]:
                    boxes.remove(o)
                    b = [min(b[0], o[0]), min(b[1], o[1]), max(b[2], o[2]), max(b[3], o[3])]
                    changed = True
                    break
            out.append(b)
        boxes = out
    return boxes


def cut(path: str, merge: int = 3, min_px: int = 30):
    rgba = key(snap(path, palette=False).convert('RGB'))
    alpha = rgba[..., 3] > 0
    boxes = [b for b in blobs(alpha, merge) if (b[2] - b[0]) * (b[3] - b[1]) >= min_px]
    return rgba, boxes


def rows_of(boxes, tol=None):
    """Group boxes into rows by their bottom edge (plants stand on a line)."""
    boxes = sorted(boxes, key=lambda b: b[3])
    rows = []
    for b in boxes:
        if rows and abs(rows[-1][-1][3] - b[3]) <= (tol if tol is not None else 8):
            rows[-1].append(b)
        else:
            rows.append([b])
    return [sorted(r, key=lambda b: b[0]) for r in rows]

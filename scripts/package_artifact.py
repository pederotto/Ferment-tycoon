#!/usr/bin/env python3
"""Fold the Vite build into the ONE page the artifact host expects.

The host wraps every upload in its own <!doctype html><head><body> skeleton, so
the upload is CONTENT ONLY: a <title> in the first 8 KB, the Google Fonts
stylesheet (the one font host its CSP admits — dropping this link is why the
published game rendered on fallback fonts for its whole life), the CSS, the
#root the app mounts into, and the module script. An earlier version reused a
downloaded page as a template, which double-wrapped everything and — worse —
cut out the #root that sat between </style> and <script>, so the app threw on
load and showed only the background.
"""
import pathlib, sys, re
dist = pathlib.Path('dist')
index = (dist/'index.html').read_text()
fonts = re.search(r'<link href="(https://fonts\.googleapis\.com/css2[^"]+)"', index).group(1)
css = next(dist.glob('assets/*.css')).read_text()
js = next(dist.glob('assets/*.js')).read_text()

# The page must not depend on the host declaring UTF-8. Players saw "Sunny Â· 5â€“19 Â°C"
# and "The wild â†’" in the weather strip: the middle dot, dash, degree sign, sun and arrow
# decoded as Windows-1252. Every non-ASCII character in the script is written as a \uXXXX
# escape (astral ones as the surrogate pair JavaScript stores them as), which means the same
# thing in a string, a template or a regex. A backslash right before one would change its
# meaning, so that is asserted rather than handled.
def ascii_js(src: str) -> str:
    out = []
    for i, c in enumerate(src):
        o = ord(c)
        if o < 128:
            out.append(c); continue
        assert src[i - 1] != '\\', f'escaped non-ASCII at {i}: {src[i-8:i+8]!r}'
        if o > 0xFFFF:
            o -= 0x10000
            out.append(f'\\u{0xD800 + (o >> 10):04x}\\u{0xDC00 + (o & 0x3FF):04x}')
        else:
            out.append(f'\\u{o:04x}')
    return ''.join(out)
js = ascii_js(js)
assert css.isascii(), 'non-ASCII in the CSS: escape it as \\XXXXXX there'
page = ('<title>Fermenta Tycoon</title>\n'
        f'<link rel="stylesheet" href="{fonts}">\n'
        f'<style>{css}</style>\n'
        '<div id="root"></div>\n'
        f'<script type="module">{js}</script>\n')
for tag in ('<!doctype', '<!DOCTYPE', '<html', '<head>', '<body'):
    assert tag not in page[:4096], f'{tag} would be double-wrapped'
assert page.count('<div id="root"></div>') == 1, 'the app has nowhere to mount'
assert page.index('<div id="root">') < page.index('<script type="module">'), 'root must precede the script'
assert page.isascii(), 'the page must be pure ASCII so no host charset can garble it'
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/artifact/index.html')
out.parent.mkdir(parents=True, exist_ok=True); out.write_text(page)
print(f'{out} - {len(page)/1024/1024:.2f} MB, fonts linked, #root present, pure ASCII')

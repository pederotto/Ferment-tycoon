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
page = ('<title>Fermenta Tycoon</title>\n'
        f'<link rel="stylesheet" href="{fonts}">\n'
        f'<style>{css}</style>\n'
        '<div id="root"></div>\n'
        f'<script type="module">{js}</script>\n')
for tag in ('<!doctype', '<!DOCTYPE', '<html', '<head>', '<body'):
    assert tag not in page[:4096], f'{tag} would be double-wrapped'
assert page.count('<div id="root"></div>') == 1, 'the app has nowhere to mount'
assert page.index('<div id="root">') < page.index('<script type="module">'), 'root must precede the script'
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/artifact/index.html')
out.parent.mkdir(parents=True, exist_ok=True); out.write_text(page)
print(f'{out} — {len(page)/1024/1024:.2f} MB, fonts linked, #root present')

#!/usr/bin/env python3
"""Wrap the packaged page for GitHub Pages: dist/artifact/index.html -> dist/site/index.html.

This is the step that used to be done by hand ("wrap in the shell taken from the
current published index.html"). The shell is the plain doctype/head/body the page
has always been served in, kept here so nothing has to be copied out of a
published file again. The packaged page (scripts/package_artifact.py) is content
only and must not carry its own doctype, html, head or body.

    python3 scripts/publish_site.py                      write dist/site/index.html
    python3 scripts/publish_site.py --check live.html    prove the wrapper reproduces
                                                         a published page byte for byte
"""
import pathlib, sys

SHELL_HEAD = (
    '<!doctype html><html><head><meta charset=utf8>'
    '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    '<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);'
    'padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}'
    'body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}'
    'img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>'
    '</head><body>\n'
)
SHELL_TAIL = '\n\n</body></html>\n'


def wrap(page: str) -> str:
    assert page.startswith('<title>Fermenta Tycoon</title>'), 'not a packaged page (no title first)'
    for tag in ('<!doctype', '<!DOCTYPE', '<html', '<head>', '<body'):
        assert tag not in page[:4096], f'{tag} would be double-wrapped'
    assert page.count('<div id="root"></div>') == 1, 'the app has nowhere to mount'
    assert page.index('<div id="root">') < page.index('<script type="module">'), 'root must precede the script'
    assert 'fonts.googleapis.com/css2' in page, 'the Google Fonts link is missing'
    assert page.isascii(), 'the page must be pure ASCII'
    return SHELL_HEAD + page + SHELL_TAIL


def inner(published: str) -> str:
    assert published.startswith(SHELL_HEAD), 'the published page does not start with the known shell'
    assert published.endswith(SHELL_TAIL), 'the published page does not end with the known shell'
    return published[len(SHELL_HEAD):-len(SHELL_TAIL)]


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--check':
        live = pathlib.Path(sys.argv[2]).read_text()
        assert wrap(inner(live)) == live, 'the wrapper does not reproduce the published page'
        print(f'ok - wrap(inner(live)) is byte-identical to {sys.argv[2]} ({len(live)/1024/1024:.2f} MB)')
        sys.exit(0)
    src = pathlib.Path('dist/artifact/index.html')
    assert src.exists(), 'run `npm run package` first'
    out = pathlib.Path('dist/site/index.html')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(wrap(src.read_text()))
    # Without this Pages runs Jekyll over the output; there is nothing for it to do.
    (out.parent / '.nojekyll').write_text('')
    print(f'{out} - {out.stat().st_size/1024/1024:.2f} MB, wrapped in the shell, .nojekyll written')

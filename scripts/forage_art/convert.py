import re, sys, json
import numpy as np
from PIL import Image, ImageFilter
ROOT='/Users/rubykim/fermenta-tycoon'
src=open(ROOT+'/components/ingredientSheet.ts').read()
body=src[src.index('SHEET_ORDER: string[] = ['):src.index('];', src.index('SHEET_ORDER'))]
IDS=re.findall(r"'([a-z_]+)'", body)
import os as _os, base64 as _b64, io as _io
def _shipped_sheet():
    """The sheet the game ships: decoded from components/ingredientSheet.ts, so it is always current."""
    here = _os.path.dirname(_os.path.abspath(__file__))
    cache = _os.path.join(here, 'shipped_sheet.png')
    if not _os.path.exists(cache):
        src = open(ROOT + '/components/ingredientSheet.ts').read()
        b64 = re.search(r'INGREDIENT_SHEET = "data:image/webp;base64,([^"]+)"', src).group(1)
        Image.open(_io.BytesIO(_b64.b64decode(b64))).convert('RGB').save(cache)
    return Image.open(cache).convert('RGB')
SHEET=np.asarray(_shipped_sheet()).astype(np.int32)
GROUND=np.array([26,19,11])
OUT=np.array([26,17,9])

def cell(id_):
    i=IDS.index(id_); c,r=i%7,i//7
    return SHEET[r*138:(r+1)*138, c*138:(c+1)*138].copy()

def neighbours(m):
    p=np.pad(m,1)
    return (p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:])

def to_sprite(id_, size, ncol=12, peel=4, sharpen=True):
    a=cell(id_)
    d=np.sqrt(((a-GROUND)**2).sum(-1))
    mask=d>38
    # peel the painted cream outline off the silhouette, but only where it is cream
    lum=a.mean(-1); sat=a.max(-1)-a.min(-1)
    cream=(lum>175)&(sat<70)
    for _ in range(peel):
        edge=mask & ~(~neighbours(~mask) | False)
        # edge = mask pixels touching background
        bg=~mask; edge=mask & neighbours(bg)
        kill=edge & cream
        if not kill.any(): break
        mask=mask & ~kill
    # drop specks
    ys,xs=np.where(mask)
    y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    a=a[y0:y1,x0:x1]; mask=mask[y0:y1,x0:x1]
    h,w=mask.shape; s=max(h,w)
    # bleed colour outward so resampling does not pull in the dark ground
    rgb=a.astype(np.float32).copy(); m=mask.copy()
    for _ in range(6):
        p=np.pad(rgb,((1,1),(1,1),(0,0)),mode='edge'); pm=np.pad(m,1)
        acc=np.zeros_like(rgb); n=np.zeros(m.shape,np.float32)
        for dy,dx in ((0,1),(2,1),(1,0),(1,2)):
            sl=pm[dy:dy+m.shape[0],dx:dx+m.shape[1]]
            acc+=p[dy:dy+m.shape[0],dx:dx+m.shape[1]]*sl[...,None]; n+=sl
        grow=(~m)&(n>0)
        rgb[grow]=acc[grow]/n[grow][:,None]; m=m|grow
    sq=np.zeros((s,s,3),np.float32); sq[:]=rgb.mean((0,1))
    sm=np.zeros((s,s),np.float32)
    oy,ox=(s-h)//2,(s-w)//2
    sq[oy:oy+h,ox:ox+w]=rgb; sm[oy:oy+h,ox:ox+w]=mask
    # leave a pixel of room for the outline
    inner=size-2
    im=Image.fromarray(np.clip(sq,0,255).astype(np.uint8))
    if sharpen: im=im.filter(ImageFilter.UnsharpMask(radius=2,percent=120,threshold=2))
    im=im.resize((inner,inner),Image.LANCZOS)
    al=Image.fromarray((sm*255).astype(np.uint8)).resize((inner,inner),Image.BOX)
    al=np.asarray(al)>118
    # quantise to the sprite's own colours
    q=im.quantize(colors=ncol,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGB')
    q=np.asarray(q).astype(np.int32)
    # remove orphan pixels
    nb=np.zeros(al.shape,int); p=np.pad(al,1)
    for dy in range(3):
        for dx in range(3):
            if dy==1 and dx==1: continue
            nb+=p[dy:dy+inner,dx:dx+inner]
    al=al&(nb>=2)
    out=np.zeros((size,size,4),np.uint8)
    out[1:-1,1:-1,:3]=q; out[1:-1,1:-1,3]=al*255
    A=out[...,3]>0
    ring=(~A)&neighbours(A)
    # coloured outline: the neighbour's hue, sunk toward the ink
    rgbf=out[...,:3].astype(np.float32)
    pr=np.pad(rgbf,((1,1),(1,1),(0,0))); pa=np.pad(A,1)
    acc=np.zeros_like(rgbf); n=np.zeros(A.shape,np.float32)
    for dy,dx in ((0,1),(2,1),(1,0),(1,2)):
        sl=pa[dy:dy+size,dx:dx+size]; acc+=pr[dy:dy+size,dx:dx+size]*sl[...,None]; n+=sl
    col=acc/np.maximum(n,1)[...,None]
    ink=(col*0.28+OUT*0.72)
    out[ring,:3]=ink[ring].astype(np.uint8); out[ring,3]=255
    return out

if __name__=='__main__':
    D=sys.argv[1]; size=int(sys.argv[2]) if len(sys.argv)>2 else 32
    ids=['maitake','ceps','winter_ceps','lions_mane','shimeji','nameko','black_poplar','blue_oyster','enoki','haskap','white_strawberry','king_stropharia','sea_buckthorn','cloudberries']
    sc=6; cols=7
    sheet=Image.new('RGBA',((size*sc+12)*cols,(size*sc+12)*2),(31,26,19,255))
    for k,i in enumerate(ids):
        sp=Image.fromarray(to_sprite(i,size)).resize((size*sc,size*sc),Image.NEAREST)
        sheet.alpha_composite(sp,((k%cols)*(size*sc+12)+6,(k//cols)*(size*sc+12)+6))
    sheet.save(f'{D}/px_contact_{size}.png')

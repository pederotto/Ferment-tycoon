import sys
import numpy as np
from PIL import Image, ImageFilter
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from convert import cell, neighbours, GROUND

OUT=np.array([27,18,10],np.float32)

def kmeans(px, k, it=14, seed=3):
    rng=np.random.default_rng(seed)
    w=np.array([0.30,0.59,0.11])*3
    # init: spread along luminance
    lum=(px*w).sum(1); order=np.argsort(lum)
    c=px[order[np.linspace(0,len(px)-1,k).astype(int)]].copy()
    for _ in range(it):
        d=(((px[:,None,:]-c[None])**2)*np.array([1.0,1.2,0.8])).sum(-1)
        lab=d.argmin(1)
        for j in range(k):
            s=px[lab==j]
            if len(s): c[j]=s.mean(0)
    return c, lab

def despeckle(idx, alpha, passes=2):
    h,w=idx.shape
    for _ in range(passes):
        p=np.pad(idx,1,mode='edge'); pa=np.pad(alpha,1)
        new=idx.copy()
        for y in range(h):
            for x in range(w):
                if not alpha[y,x]: continue
                nb=[p[y,x+1],p[y+2,x+1],p[y+1,x],p[y+1,x+2]]
                na=[pa[y,x+1],pa[y+2,x+1],pa[y+1,x],pa[y+1,x+2]]
                vals=[v for v,a in zip(nb,na) if a]
                if len(vals)>=3 and idx[y,x] not in vals:
                    new[y,x]=max(set(vals),key=vals.count)
        idx=new
    return idx

def to_sprite(id_, size, k=7, erode=3, rim=True, smooth=3):
    a=cell(id_).astype(np.float32)
    d=np.sqrt(((a-GROUND)**2).sum(-1))
    mask=d>40
    # the painted halo is a fixed band (a blended pixel, one or two of cream):
    # erode it off geometrically and land on the painting's own dark contour
    for _ in range(erode):
        mask &= ~(mask & neighbours(~mask))
    ys,xs=np.where(mask); y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    a=a[y0:y1,x0:x1]; mask=mask[y0:y1,x0:x1]
    h,w=mask.shape; s=max(h,w)+2
    # bleed paint outward
    rgb=a.copy(); m=mask.copy()
    for _ in range(8):
        p=np.pad(rgb,((1,1),(1,1),(0,0)),mode='edge'); pm=np.pad(m,1)
        acc=np.zeros_like(rgb); n=np.zeros(m.shape,np.float32)
        for dy,dx in ((0,1),(2,1),(1,0),(1,2)):
            sl=pm[dy:dy+h,dx:dx+w]; acc+=p[dy:dy+h,dx:dx+w]*sl[...,None]; n+=sl
        g=(~m)&(n>0); rgb[g]=acc[g]/n[g][:,None]; m|=g
    sq=np.zeros((s,s,3),np.float32); sq[:]=rgb[mask].mean(0); sm=np.zeros((s,s),np.float32)
    oy,ox=(s-h)//2,(s-w)//2; sq[oy:oy+h,ox:ox+w]=rgb; sm[oy:oy+h,ox:ox+w]=mask
    im=Image.fromarray(np.clip(sq,0,255).astype(np.uint8))
    if smooth: im=im.filter(ImageFilter.MedianFilter(smooth))
    inner=size-2
    im=np.asarray(im.resize((inner,inner),Image.BOX)).astype(np.float32)
    al=np.asarray(Image.fromarray((sm*255).astype(np.uint8)).resize((inner,inner),Image.BOX))>110
    # tidy the silhouette: fill pinholes, drop orphans
    p=np.pad(al,1); nb=sum(p[dy:dy+inner,dx:dx+inner].astype(int) for dy in range(3) for dx in range(3))-al
    al=(al&(nb>=2))|((~al)&(nb>=6))
    if al.sum() < 6:
        # tiny scattered subjects (lentils) vanish under the tidy-up: keep every trace instead
        al=np.asarray(Image.fromarray((sm*255).astype(np.uint8)).resize((inner,inner),Image.BOX))>40
    px=im[al]
    k=max(2,min(k,len(px)))
    cents,lab=kmeans(px,k)
    idx=np.full((inner,inner),-1); idx[al]=lab
    idx=despeckle(idx,al)
    rgbq=np.zeros((inner,inner,3),np.float32); rgbq[al]=cents[idx[al]]
    # light from the top left: a one-pixel rim where the silhouette faces it
    if rim:
        pa=np.pad(al,1)
        up=~pa[0:inner,1:inner+1]; left=~pa[1:inner+1,0:inner]
        lit=al&(up|left)&~(~pa[2:,1:inner+1])
        rgbq[lit]=np.minimum(255,rgbq[lit]*1.18+14)
    out=np.zeros((size,size,4),np.uint8)
    out[1:-1,1:-1,:3]=np.clip(rgbq,0,255); out[1:-1,1:-1,3]=al*255
    A=out[...,3]>0; ring=(~A)&neighbours(A)
    rgbf=out[...,:3].astype(np.float32); pr=np.pad(rgbf,((1,1),(1,1),(0,0))); pa=np.pad(A,1)
    acc=np.zeros_like(rgbf); n=np.zeros(A.shape,np.float32)
    for dy,dx in ((0,1),(2,1),(1,0),(1,2)):
        sl=pa[dy:dy+size,dx:dx+size]; acc+=pr[dy:dy+size,dx:dx+size]*sl[...,None]; n+=sl
    col=acc/np.maximum(n,1)[...,None]
    out[ring,:3]=(col*0.30+OUT*0.70)[ring].astype(np.uint8); out[ring,3]=255
    return out

IDS=['maitake','ceps','winter_ceps','lions_mane','shimeji','nameko','black_poplar','blue_oyster','enoki','haskap','white_strawberry','king_stropharia','sea_buckthorn','cloudberries']
if __name__=='__main__':
    D=sys.argv[1]; size=int(sys.argv[2])
    sc=max(3,192//size); cols=7; cw=size*sc+14
    sheet=Image.new('RGBA',(cw*cols,cw*2),(31,26,19,255))
    for n,i in enumerate(IDS):
        sp=Image.fromarray(to_sprite(i,size)).resize((size*sc,size*sc),Image.NEAREST)
        sheet.alpha_composite(sp,((n%cols)*cw+7,(n//cols)*cw+7))
    sheet.save(f'{D}/px2_contact_{size}.png')

#!/usr/bin/env python3
"""All static PNG pixel types, Adam7 and all five filters, independent libpng QA."""
from pathlib import Path
import struct
import subprocess
import tempfile
import zlib
import numpy as np
import imagecodecs

ROOT=Path(__file__).resolve().parents[1]
rng=np.random.default_rng(77)
count=0

def chunk(name,data):
    return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data))

def encode(a,bits,color,interlace,filter_kind,palette=None,transparency=None):
    h,w,nc=a.shape
    passes=[(0,0,8,8),(4,0,8,8),(0,4,4,8),(2,0,4,4),(0,2,2,4),(1,0,2,2),(0,1,1,2)] if interlace else [(0,0,1,1)]
    rows=bytearray(); bpp=max(1,(nc*bits+7)//8)
    for xs,ys,dx,dy in passes:
        previous=None
        for y in range(ys,h,dy):
            values=a[y,xs::dx].ravel()
            if len(values)==0: continue
            if bits==16: row=values.astype('>u2').tobytes()
            elif bits==8: row=values.astype('u1').tobytes()
            else:
                packed=bytearray((len(values)*bits+7)//8)
                for i,v in enumerate(values): packed[i*bits//8] |= int(v)<<(8-bits-(i*bits%8))
                row=bytes(packed)
            if previous is None: previous=bytes(len(row))
            filtered=bytearray()
            for i,v in enumerate(row):
                left=row[i-bpp] if i>=bpp else 0; up=previous[i]; ul=previous[i-bpp] if i>=bpp else 0
                pred=left+up-ul
                diffs=[abs(pred-left),abs(pred-up),abs(pred-ul)]
                paeth=[left,up,ul][diffs.index(min(diffs))]
                prediction=[0,left,up,(left+up)//2,paeth][filter_kind]
                filtered.append((v-prediction)&255)
            rows.extend(bytes([filter_kind])+filtered); previous=row
    out=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,bits,color,0,0,int(interlace)))
    if palette is not None: out+=chunk(b'PLTE',palette)
    if transparency is not None: out+=chunk(b'tRNS',transparency)
    packed=zlib.compress(rows)
    middle=len(packed)//2
    out+=chunk(b'IDAT',packed[:middle])+chunk(b'IDAT',packed[middle:])+chunk(b'IEND',b'')
    return out

with tempfile.TemporaryDirectory() as tmp:
    p=Path(tmp)
    layouts=[(0,b,1) for b in [1,2,4,8,16]]+[(c,b,n) for c,n in [(2,3),(4,2),(6,4)] for b in [8,16]]+[(3,b,1) for b in [1,2,4,8]]
    for color,bits,nc in layouts:
        a=rng.integers(0,2**bits,(17,19,nc),dtype=np.uint16)
        palette=rng.integers(0,256,(2**bits,3),dtype=np.uint8).tobytes() if color==3 else None
        transparency=bytes(range(2**bits)) if color==3 else struct.pack('>H',int(a[0,0,0])) if color==0 else struct.pack('>HHH',*a[0,0]) if color==2 else None
        for interlace in [False,True]:
            for filter_kind in range(5):
                data=encode(a,bits,color,interlace,filter_kind,palette,transparency)
                (p/'in.png').write_bytes(data)
                reference=imagecodecs.png_decode(data)
                result=subprocess.run([str(ROOT/'build/codecs'),str(p/'in.png'),str(p/'raw'),'png',str(p/'out.png')],capture_output=True,text=True,timeout=30)
                assert result.returncode==0,(color,bits,interlace,filter_kind,result.stderr)
                raw=(p/'raw').read_bytes(); dims=struct.unpack_from('<III',raw)
                actual=np.frombuffer(raw,dtype='<f8',offset=12).reshape(reference.shape)
                np.testing.assert_array_equal(actual,reference)
                np.testing.assert_array_equal(imagecodecs.png_decode((p/'out.png').read_bytes()),reference)
                count+=1
print(f'PASS {count} PNG bit-depth/color/filter/Adam7/transparency cases')

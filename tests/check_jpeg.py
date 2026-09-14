#!/usr/bin/env python3
from pathlib import Path
import struct
import subprocess
import tempfile
import numpy as np
import imagecodecs
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
rng=np.random.default_rng(74)
count=0
with tempfile.TemporaryDirectory() as tmp:
    p=Path(tmp)
    for mode in ['L','RGB','CMYK']:
        for w,h in [(1,1),(7,9),(37,35),(64,49)]:
            a=rng.integers(0,256,(h,w) if mode=='L' else (h,w,4 if mode=='CMYK' else 3),dtype=np.uint8)
            im=Image.frombytes(mode,(w,h),a.tobytes())
            for progressive in [False,True]:
                for subsampling in ([0] if mode in ['L','CMYK'] else [0,1,2]):
                    for restart in [0,3]:
                        im.save(p/'in.jpg',quality=95,progressive=progressive,subsampling=subsampling,restart_marker_blocks=restart)
                        with Image.open(p/'in.jpg') as opened: reference=np.array(opened.convert('RGB') if mode=='CMYK' else opened).astype(float)
                        result=subprocess.run([str(ROOT/'build/codecs'),str(p/'in.jpg'),str(p/'raw'),'jpg',str(p/'out.jpg')],capture_output=True,text=True,timeout=30)
                        assert result.returncode==0,(mode,w,h,progressive,subsampling,restart,result.stderr)
                        data=(p/'raw').read_bytes(); shape=struct.unpack_from('<III',data)
                        actual=np.frombuffer(data,dtype='<f8',offset=12).reshape(reference.shape)
                        assert np.max(np.abs(actual-reference))<=4,(mode,w,h,progressive,subsampling,restart,np.max(np.abs(actual-reference)))
                        with Image.open(p/'out.jpg') as opened: encoded=np.array(opened).astype(float)
                        assert np.mean(np.abs(encoded-actual))<6,(mode,w,h,'encoding',np.mean(np.abs(encoded-actual)))
                        count+=1
    a=rng.integers(0,256,(35,37,4),dtype=np.uint8)
    for subsampling in ['444','422','420']:
        data=imagecodecs.jpeg8_encode(a,level=95,colorspace='CMYK',outcolorspace='YCCK',subsampling=subsampling)
        (p/'in.jpg').write_bytes(data)
        with Image.open(p/'in.jpg') as opened: reference=np.array(opened.convert('RGB')).astype(float)
        result=subprocess.run([str(ROOT/'build/codecs'),str(p/'in.jpg'),str(p/'raw'),'jpg',str(p/'out.jpg')],capture_output=True,text=True,timeout=30)
        assert result.returncode==0,('YCCK',subsampling,result.stderr)
        actual=np.frombuffer((p/'raw').read_bytes(),dtype='<f8',offset=12).reshape(reference.shape)
        assert np.max(np.abs(actual-reference))<=4,('YCCK',subsampling,np.max(np.abs(actual-reference)))
        count+=1
print(f'PASS {count} independent JPEG cases (sequential/progressive/subsampling/restarts)')

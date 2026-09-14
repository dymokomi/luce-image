#!/usr/bin/env python3
"""Orientation, multi-page/part navigation and preserved resource budgets."""
from pathlib import Path
import subprocess
import tempfile
import numpy as np
import tifffile
import OpenEXR

ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    p=Path(tmp)
    parts=[]
    with tifffile.TiffWriter(p/'pages.tif',bigtiff=True) as output:
        for w,h,value in [(7,5,10),(13,9,20)]:
            a=np.full((h,w,3),value,dtype=np.uint8)
            output.write(a,photometric='rgb',compression='deflate',rowsperstrip=2)
            parts.append(OpenEXR.Part({'compression':OpenEXR.ZIP_COMPRESSION,
                'displayWindow':(np.array([0,0],np.int32),np.array([12,8],np.int32))},
                {name:a[:,:,i].astype(np.float32) for i,name in enumerate(['R','G','B'])},str(value)))
    OpenEXR.File(parts).write(str(p/'parts.exr'))
    subprocess.run([str(ROOT/'build/navigation'),str(p)],check=True,timeout=30)
    a=np.arange(7*5*3,dtype=np.uint8).reshape(5,7,3)
    expected=[a,a[:,::-1],a[::-1,::-1],a[::-1],np.swapaxes(a,0,1),
              np.rot90(a,-1),np.swapaxes(a[::-1,::-1],0,1),np.rot90(a,1)]
    for orientation in range(1,9):
        for planar in ['contig','separate']:
            tifffile.imwrite(p/'in.tif',a if planar=='contig' else np.moveaxis(a,2,0),
                photometric='rgb',planarconfig=planar,rowsperstrip=2,
                extratags=[(274,'H',1,orientation,False)])
            subprocess.run([str(ROOT/'build/codecs'),str(p/'in.tif'),str(p/'raw'),'tiff',str(p/'out.tif')],check=True,timeout=30)
            actual=np.frombuffer((p/'raw').read_bytes(),dtype='<f8',offset=12).reshape(expected[orientation-1].shape)
            np.testing.assert_array_equal(actual,expected[orientation-1])
print('PASS 16 TIFF orientation/planar cases')

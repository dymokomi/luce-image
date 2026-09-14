#!/usr/bin/env python3
from pathlib import Path
import struct
import subprocess
import tempfile
import numpy as np
import tifffile

ROOT=Path(__file__).resolve().parents[1]
rng=np.random.default_rng(75)
count=0
with tempfile.TemporaryDirectory() as tmp:
    p=Path(tmp)
    for dtype in [np.uint8,np.uint16,np.uint32,np.int8,np.int16,np.int32,np.float16,np.float32,np.float64]:
        a=(rng.random((35,37,3))*100).astype(dtype)
        if np.issubdtype(dtype,np.signedinteger) or np.issubdtype(dtype,np.floating): a-=25
        for byteorder in ['<','>']:
            for planar in ['contig','separate']:
                for tile in [None,(16,16)]:
                    for compression in [None,'deflate','lzw','packbits']:
                        pixels=a if planar=='contig' else np.moveaxis(a,2,0)
                        options=dict(photometric='rgb',planarconfig=planar,byteorder=byteorder,tile=tile,compression=compression,rowsperstrip=7)
                        tifffile.imwrite(p/'in.tif',pixels,**options)
                        result=subprocess.run([str(ROOT/'build/codecs'),str(p/'in.tif'),str(p/'raw'),'tiff',str(p/'out.tif')],capture_output=True,text=True,timeout=30)
                        assert result.returncode==0,(dtype,byteorder,planar,tile,compression,result.stderr)
                        raw=(p/'raw').read_bytes(); dims=struct.unpack_from('<III',raw)
                        assert dims==(37,35,3)
                        actual=np.frombuffer(raw,dtype='<f8',offset=12).reshape(a.shape)
                        np.testing.assert_array_equal(actual,a)
                        np.testing.assert_array_equal(tifffile.imread(p/'out.tif'),a)
                        count+=1
    for dtype,predictor in [(np.uint16,2),(np.uint32,2),(np.float32,3),(np.float64,3)]:
        a=(rng.random((35,37,3))*100).astype(dtype)
        for byteorder in ['<','>']:
            tifffile.imwrite(p/'in.tif',a,photometric='rgb',compression='deflate',predictor=predictor,byteorder=byteorder,rowsperstrip=7)
            result=subprocess.run([str(ROOT/'build/codecs'),str(p/'in.tif'),str(p/'raw'),'tiff',str(p/'out.tif')],capture_output=True,text=True,timeout=30)
            assert result.returncode==0,(dtype,predictor,byteorder,result.stderr)
            actual=np.frombuffer((p/'raw').read_bytes(),dtype='<f8',offset=12).reshape(a.shape)
            np.testing.assert_array_equal(actual,a)
            count+=1
print(f'PASS {count} TIFF type/endian/planar/tile/compression/predictor cases')

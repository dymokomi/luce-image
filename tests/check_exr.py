#!/usr/bin/env python3
"""Compare Base EXR against the upstream OpenEXR implementation."""
from pathlib import Path
import struct
import subprocess
import tempfile
import numpy as np
import OpenEXR

ROOT = Path(__file__).resolve().parents[1]
rng = np.random.default_rng(73)
count=0
with tempfile.TemporaryDirectory() as tmp:
    p=Path(tmp); w,h=39,67
    for dtype in [np.float16,np.float32,np.uint32]:
        channels={name: ((rng.random((h,w))*50).astype(dtype) if dtype!=np.uint32 else rng.integers(0,2**32,(h,w),dtype=dtype)) for name in ['A','B','G','R','Z']}
        reference=np.stack([channels[name] for name in sorted(channels)],axis=-1).astype(np.float64)
        for compression in [OpenEXR.NO_COMPRESSION,OpenEXR.RLE_COMPRESSION,OpenEXR.ZIPS_COMPRESSION,OpenEXR.ZIP_COMPRESSION,OpenEXR.PIZ_COMPRESSION,OpenEXR.PXR24_COMPRESSION]:
            header={'compression':compression,'hello':'metadata','dataWindow':(np.array([-12,17],np.int32),np.array([w-13,h+16],np.int32))}
            OpenEXR.File(header,dict(channels)).write(str(p/'in.exr'))
            # PXR24 intentionally quantizes FLOAT; compare with its decoded pixels.
            expected=OpenEXR.File(str(p/'in.exr'),separate_channels=True).channels()
            reference=np.stack([expected[name].pixels for name in sorted(expected)],axis=-1).astype(np.float64)
            for output in ['exr','exrtile','piz','piztile','rle','zips','none']:
                result=subprocess.run([str(ROOT/'build/codecs'),str(p/'in.exr'),str(p/'raw'),output,str(p/'out.exr')],capture_output=True,text=True,timeout=30)
                assert result.returncode==0,(dtype,compression,output,result.stderr)
                data=(p/'raw').read_bytes(); dims=struct.unpack_from('<III',data)
                assert dims==(w,h,5)
                actual=np.frombuffer(data,dtype='<f8',offset=12).reshape(h,w,5)
                np.testing.assert_array_equal(actual,reference)
                out=OpenEXR.File(str(p/'out.exr'),separate_channels=True)
                for name,channel in out.channels().items():
                    np.testing.assert_array_equal(channel.pixels,expected[name].pixels)
                assert out.header()['hello']=='metadata'
                np.testing.assert_array_equal(out.header()['dataWindow'][0],[-12,17])
                again=subprocess.run([str(ROOT/'build/codecs'),str(p/'out.exr'),str(p/'again'),'exr',str(p/'again.exr')],capture_output=True,text=True,timeout=30)
                assert again.returncode==0,(dtype,compression,output,'reread',again.stderr)
                assert (p/'again').read_bytes()==data
                count+=1
    # Mixed type, multipart and upstream-written tile tables.
    parts=[]
    for tiled in [False,True]:
        channels={'half':rng.random((h,w)).astype(np.float16),
                  'float':rng.random((h,w)).astype(np.float32),
                  'uint':rng.integers(0,2**32,(h,w),dtype=np.uint32)}
        header={'compression':OpenEXR.PIZ_COMPRESSION,'type':OpenEXR.tiledimage if tiled else OpenEXR.scanlineimage}
        if tiled:
            tile=OpenEXR.TileDescription(); tile.xSize=16; tile.ySize=16
            header['tiles']=tile
        parts.append(OpenEXR.Part(header,channels,'tiles' if tiled else 'scanlines'))
    OpenEXR.File(parts).write(str(p/'in.exr'))
    for index,part in enumerate(parts):
        result=subprocess.run([str(ROOT/'build/codecs'),str(p/'in.exr'),str(p/'raw'),'exr',str(p/'out.exr'),str(index)],capture_output=True,text=True,timeout=30)
        assert result.returncode==0,('multipart',index,result.stderr)
        actual=np.frombuffer((p/'raw').read_bytes(),dtype='<f8',offset=12).reshape(h,w,3)
        expected=np.stack([part.channels[name].pixels for name in sorted(part.channels)],axis=-1)
        np.testing.assert_array_equal(actual,expected)
        count+=1
    # Force actual compressed PIZ output, not only legal raw-chunk fallback.
    for dtype in [np.float16,np.float32,np.uint32]:
        pixels=np.zeros((67,39),dtype=dtype)
        OpenEXR.File({'compression':OpenEXR.NO_COMPRESSION},{'Y':pixels}).write(str(p/'in.exr'))
        subprocess.run([str(ROOT/'build/codecs'),str(p/'in.exr'),str(p/'raw'),'piz',str(p/'out.exr')],check=True,timeout=30)
        assert (p/'out.exr').stat().st_size < (p/'in.exr').stat().st_size
        out=OpenEXR.File(str(p/'out.exr'),separate_channels=True)
        np.testing.assert_array_equal(out.channels()['Y'].pixels,pixels)
        count+=1
print(f'PASS {count} upstream EXR interoperability cases')

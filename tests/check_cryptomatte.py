#!/usr/bin/env python3
"""Compare every extracted mask pixel against Psyop's official EXR fixtures."""
from pathlib import Path
import json
import struct
import subprocess
import tempfile
import re
import numpy as np
import OpenEXR

ROOT=Path(__file__).resolve().parents[1]
count=0
with tempfile.TemporaryDirectory() as tmp:
    for path in sorted((ROOT/'tests/fixtures/cryptomatte').glob('*.exr')):
        result=subprocess.run([str(ROOT/'build/crypto_fixture'),str(path),tmp],capture_output=True,text=True,timeout=90)
        assert result.returncode==0,(path,result.stderr)
        output=result.stdout.splitlines()
        image=OpenEXR.File(str(path),separate_channels=True); header=image.header(); channels=image.channels()
        for index in range(len(output)//2):
            layer,selected=output[index*2:index*2+2]
            prefix=next(k[:-4] for k,v in header.items() if k.startswith('cryptomatte/') and k.endswith('/name') and v==layer)
            manifest=json.loads(header[prefix+'manifest']) if prefix+'manifest' in header else json.loads((path.parent/header[prefix+'manif_file']).read_text())
            bits=int(manifest[selected],16)
            if (bits>>23)&255 in [0,255]: bits^=1<<23
            expected=None
            for name,channel in channels.items():
                if not re.fullmatch(re.escape(layer)+r'\d+\.(R|r|red|B|b|blue)',name): continue
                suffix={'R':'G','r':'g','red':'green','B':'A','b':'a','blue':'alpha'}[name.rsplit('.',1)[1]]
                coverage=channels[name.rsplit('.',1)[0]+'.'+suffix].pixels
                part=np.where(channel.pixels.view(np.uint32)==bits,coverage,0).astype(np.float64)
                expected=part if expected is None else expected+part
            actual=OpenEXR.File(str(Path(tmp)/f'mask{index}.exr'),separate_channels=True).channels()['Y'].pixels
            np.testing.assert_allclose(actual,np.clip(expected,0,1),rtol=0,atol=6e-8)
            count+=1
print(f'PASS {count} full-image matte comparisons from official Psyop fixtures')

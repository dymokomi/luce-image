#!/usr/bin/env python3
"""Corrupt inputs must be recoverable errors, never traps or unbounded work."""
from pathlib import Path
import argparse
import random
import subprocess
import tempfile
from PIL import Image
import numpy as np
import OpenEXR

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--validator',type=Path,default=ROOT/'build/validate')
validator=parser.parse_args().validator.resolve()
rng=random.Random(76)
count=0
with tempfile.TemporaryDirectory() as tmp:
    p=Path(tmp); corpus=[]
    image=Image.frombytes('RGB',(19,21),rng.randbytes(19*21*3))
    for fmt in ['PNG','JPEG','TIFF']:
        image.save(p/'source',format=fmt)
        corpus.append((p/'source').read_bytes())
    for compression in [OpenEXR.ZIP_COMPRESSION,OpenEXR.PIZ_COMPRESSION]:
        a=np.arange(19*21,dtype=np.float32).reshape(21,19)
        OpenEXR.File({'compression':compression},{'R':a}).write(str(p/'source'))
        corpus.append((p/'source').read_bytes())
    for original in corpus:
        cases=[original[:n] for n in [0,1,2,3,4,8,16,24,32,len(original)//2,len(original)-1]]
        cases += [rng.randbytes(rng.randrange(1024)) for _ in range(10)]
        for _ in range(100):
            value=bytearray(original)
            for _ in range(rng.randrange(1,6)):
                value[rng.randrange(len(value))]=rng.randrange(256)
            cases.append(bytes(value))
        for data in cases:
            (p/'input').write_bytes(data)
            result=subprocess.run([str(validator),str(p/'input')],capture_output=True,timeout=5)
            assert result.returncode in [0,2],(count,result.returncode,result.stderr)
            assert b'trap:' not in result.stderr,(count,result.stderr)
            count+=1
print(f'PASS {count} truncated/random/mutated inputs with recoverable errors')

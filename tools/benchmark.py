#!/usr/bin/env python3
"""Measure decode concurrency; report observations, not guaranteed speedups."""
from pathlib import Path
import argparse
import json
import platform
import statistics
import subprocess
import tempfile
import numpy as np
import tifffile
import OpenEXR

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--size',type=int,default=1024)
args=parser.parse_args()
subprocess.run([str(ROOT/'build/toolchain/luce-base'),'build',str(ROOT/'src/luce_image/benchmark.lucb'),'--opt','3','-o',str(ROOT/'build/benchmark')],check=True)
results={'host':platform.platform(),'size':[args.size,args.size],'results':[]}
with tempfile.TemporaryDirectory() as tmp:
    p=Path(tmp); rng=np.random.default_rng(78)
    values=rng.random((args.size,args.size,3)).astype(np.float32)
    tifffile.imwrite(p/'image.tif',values,photometric='rgb',compression='deflate',rowsperstrip=64)
    OpenEXR.File({'compression':OpenEXR.ZIP_COMPRESSION},{name:values[:,:,i] for i,name in enumerate(['R','G','B'])}).write(str(p/'image.exr'))
    for path in [p/'image.tif',p/'image.exr']:
        for threads in [1,2,4]:
            runs=[]
            for _ in range(3):
                text=subprocess.check_output([str(ROOT/'build/benchmark'),str(path),str(threads)],text=True)
                runs.append(list(map(int,text.split())))
            results['results'].append({'format':path.suffix,'threads':threads,'open_ms':statistics.median(r[0] for r in runs)/1e6,'decode_ms':statistics.median(r[1] for r in runs)/1e6,'workers_used':max(r[2] for r in runs)})
print(json.dumps(results,indent=2))

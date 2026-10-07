#!/usr/bin/env python3
"""The codec oracles, run by tests/oracles/main.luc (`luc test`): build the deflate and
codec drivers and the Luce API, validation and navigation programs, then compare their
output with Pillow, tifffile, imagecodecs and OpenEXR (tests/check_*.py). Exits 77 when
those Python packages are missing, which the program reports as a skip."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[2]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--opt',type=int,choices=range(4),default=0,help='the native optimization level')
    args=parser.parse_args()
    for dependency in ['PIL','numpy','tifffile','imagecodecs','OpenEXR']:
        try: __import__(dependency)
        except ImportError:
            print(f'skip: the oracles need {dependency} (python3 -m venv build/test-env; build/test-env/bin/python -m pip install -r tests/requirements.txt)')
            raise SystemExit(77)
    args.base=Path(os.environ.get('LUCE_BASE','luce-base')); args.luce=Path(os.environ.get('LUCE','luce'))
    env=dict(os.environ)
    modes=[['--native','--opt',str(args.opt)]]
    (ROOT/'build').mkdir(exist_ok=True)
    def run(command,timeout=180):
        subprocess.run([str(x) for x in command],check=True,cwd=ROOT,env=env,timeout=timeout)
    # The test command accepts backend selection but not build optimization flags.
    # Regression drivers are regenerated for each mode; no stale binary can pass.
    for flags in modes:
        print('MODE '+' '.join(flags),flush=True)
        for source,target in [('deflate_tests','deflate'),('codec_tests','codecs')]:
            run([args.base,'build',ROOT/f'tests/{source}.lucb',*flags,'-o',ROOT/f'build/{target}'])
        with tempfile.TemporaryDirectory(prefix='luce-image-tests-') as tmp:
            for source,target in [('api','api'),('validate','validate'),('navigation','navigation')]:
                run([args.luce,'build',ROOT/f'tests/{source}.luc',*flags,'-o',ROOT/f'build/{target}'])
                if source == 'api': run([ROOT/f'build/{target}',tmp])
            for test in ['deflate','raster','png','tiff','jpeg','exr','navigation','malformed']:
                run([sys.executable,ROOT/f'tests/check_{test}.py'],timeout=300)
    print('PASS luce-image codec oracles',flush=True)


if __name__=='__main__': main()

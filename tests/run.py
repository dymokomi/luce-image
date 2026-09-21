#!/usr/bin/env python3
"""Full native opt 0-3 and C comparison gates, using independent codec oracles."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base',type=Path,default=Path(os.environ.get('LUCE_BASE_COMPILER',ROOT/'build/toolchain/luce-base')))
    parser.add_argument('--luce',type=Path,default=Path(os.environ.get('LUCE_COMPILER',ROOT/'build/toolchain/luce')))
    parser.add_argument('--opt',type=int,choices=range(4),help='Run one native optimization level only')
    parser.add_argument('--backend',choices=['native','c'],default='native')
    args=parser.parse_args()
    for dependency in ['PIL','numpy','tifffile','imagecodecs','OpenEXR']:
        try: __import__(dependency)
        except ImportError: raise SystemExit(f'Missing {dependency}; install tests/requirements.txt in a virtual environment and run with that Python.')
    if not args.base.is_file() or not args.luce.is_file():
        raise SystemExit('Build isolated compilers with python3 tools/bootstrap.py, or supply --base and --luce.')
    env=dict(os.environ, LUCE_BASE=str(args.base.resolve()),
             LUCE_STD=str(ROOT.parent / 'luce-base/src/std'),
             LUCE_CACHE=str(ROOT / 'build/cache'))
    modes=([['--backend=c']] if args.backend=='c' else [['--native','--opt',str(args.opt)]] if args.opt is not None else
           [['--native','--opt',str(i)] for i in range(4)]+[['--backend=c'],['--backend=c','--release']])
    (ROOT/'build').mkdir(exist_ok=True)
    def run(command,timeout=180):
        subprocess.run([str(x) for x in command],check=True,cwd=ROOT,env=env,timeout=timeout)
    # The test command accepts backend selection but not build optimization flags.
    for backend in sorted({flags[0] for flags in modes}):
        run([args.base.resolve(),'test',ROOT/'src/luce_image/manifest_tests.lucb',backend])
    # Regression drivers are regenerated for each mode; no stale binary can pass.
    for flags in modes:
        print('MODE '+' '.join(flags),flush=True)
        for source,target in [('deflate_tests','deflate'),('codec_tests','codecs')]:
            run([args.base.resolve(),'build',ROOT/f'src/luce_image/{source}.lucb',*flags,'-o',ROOT/f'build/{target}'])
        with tempfile.TemporaryDirectory(prefix='luce-image-tests-') as tmp:
            for source,target in [('api','api'),('crypto_api','cryptomatte'),('crypto_fixture','crypto_fixture'),('validate','validate'),('navigation','navigation')]:
                run([args.luce.resolve(),'build',ROOT/f'tests/{source}.luc',*flags,'-o',ROOT/f'build/{target}'])
                if source in ['api','crypto_api']: run([ROOT/f'build/{target}',tmp])
            for test in ['deflate','raster','png','tiff','jpeg','exr','navigation','cryptomatte','malformed']:
                run([sys.executable,ROOT/f'tests/check_{test}.py'],timeout=300)
    print(f'PASS all {len(modes)} compiler modes',flush=True)


if __name__=='__main__': main()

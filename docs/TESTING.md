# Tests and toolchains

Prerequisites: sibling `luce-base` and `luce` checkouts at the revisions in
`bootstrap/`, a host C compiler, Python with venv/pip, and the test-only packages
in `tests/requirements.txt`. Bootstrap supports Apple Silicon macOS and x86_64
Linux. Other hosts can supply prebuilt compilers.

```sh
python3 tools/bootstrap.py
python3 -m venv build/test-env
build/test-env/bin/python -m pip install -r tests/requirements.txt
./test.sh                 # native opt 0/1/2/3, C, C release
./test.sh --opt 0         # quicker one-mode local pass
./test.sh --backend c     # C backend comparison
./test.sh --base /path/to/luce-base --luce /path/to/luce --opt 3
```

`LUCE_BASE_COMPILER` and `LUCE_COMPILER` also override test compiler paths. The
runner sets `LUCE_BASE` for the high-level compiler. Bootstrap reads siblings but
places stage0, Base and Luce binaries only under `build/toolchain/`. Source pins
are checked, never automatically updated. C-backend tests compile the same Base
sources; they do not link native image libraries.

## Gates

- Base unit tests: official hash vectors, exponent remapping, malformed JSON,
  Unicode/surrogate pairs, all finite HALF encodings and infinities, rounding ties,
  bounded-buffer failure. The Base `test` CLI supports backend but not optimization
  flags; these run once per backend.
- Both Base codec drivers and real Luce consumers rebuild for every selected
  compiler mode. Tests use fresh temporary input/output directories.
- 40 independent DEFLATE cases against Python zlib.
- 100 PNG/TIFF cross-reader/writer cases, including Base re-reading its own output.
- 150 PNG bit-depth/color/filter/Adam7/transparency cases against libpng.
- 296 TIFF sample type/byte order/planar/tile/compression/predictor cases against
  tifffile/imagecodecs, plus 16 orientation/layout cases.
- 83 JPEG sequential/progressive/subsampling/restart/CMYK/YCCK cases against Pillow.
  Pixel tolerance accounts for different legal IDCT/upsampling rounding.
- 131 EXR upstream cases including every offered output compression, forced
  compressed PIZ (not just raw fallback), PXR24, HALF/FLOAT/
  UINT, mixed-type multipart/tiled files and nonzero data windows.
- Real Luce `Image` ownership, operations and four-format I/O tests; transactional
  TIFF page/EXR part seek and retained limits.
- Cryptomatte weighted samples/ranking/selection/roundtrip tests and five full-image
  mask comparisons from upstream Psyop fixtures.
- 605 truncated/random/mutated assets: subprocess timeout, bounded decoding,
  recoverable errors instead of crashes/traps. A mutation that remains valid may
  succeed. This is deterministic regression fuzzing, not exhaustive fuzz coverage.

The libpng oracle currently prints an interlace-handling warning on Adam7 cases;
its resulting pixels are still checked. It is not a warning from luce-image.

## Performance

```sh
build/test-env/bin/python tools/benchmark.py --size 1024
```

The script creates deterministic float32 RGB TIFF/EXR fixtures using independent
writers, compiles the Base benchmark with native opt 3, and reports median open
and decode times from three fresh processes each at 1/2/4 threads. File I/O and
decoding are reported separately. Run with no concurrent test/compiler jobs.
`workers_used` verifies actual worker participation. Results are host/workload
observations, not promises of a fixed speedup.
See [recorded measurements](BENCHMARK.md).

## CI

The GitHub workflow runs on Apple Silicon macOS and x86_64 Linux, bootstraps the
pinned sibling languages, and executes the full matrix. If language repositories
are private, configure `LUCE_READ_TOKEN` with read-only Contents access to both;
the default workflow token cannot read unrelated private repositories.

`tests/regressions/` contains intentionally failing compiler reproducers and is
not part of the package's green gate. Run these separately when auditing/fixing
the language; package-local workarounds keep the image library usable meanwhile.

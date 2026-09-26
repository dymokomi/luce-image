# Decode benchmark — 2026-09-14

Host: macOS 15.7.3 arm64. Base revision
`162ff10fce15997abe38337029069971643614b2`, native opt 3.
1024×1024 RGB float32, deterministic random pixels, TIFF DEFLATE with 64-row
strips and EXR ZIP. Median of three fresh processes per configuration, with
encoded file reading/probing measured separately from pixel decode.

| Format | Threads | Open/probe ms | Decode ms | Workers used |
| --- | ---: | ---: | ---: | ---: |
| TIFF | 1 | 3.573 | 900.807 | 1 |
| TIFF | 2 | 3.918 | 483.594 | 2 |
| TIFF | 4 | 3.585 | 250.192 | 4 |
| EXR | 1 | 1.616 | 392.982 | 1 |
| EXR | 2 | 1.554 | 207.392 | 2 |
| EXR | 4 | 1.585 | 113.447 | 4 |

Four-worker decode was 3.60× faster for TIFF and 3.46× for EXR in this run.
This compares luce-image with itself, **not** with mature native codecs. It is
not a claim about other images, storage devices, larger working sets, compression
schemes or CPUs. The Base implementations still have substantial optimization
opportunities. OS caching affects the open figures.

Reproduce with `build/test-env/bin/python tools/benchmark.py --size 1024`.

## Larger image: 4096×4096

Same source/compiler, host, fixture construction and three-process median
method, run with no other local test/compiler jobs. RGB f64 pixel storage alone
is 384 MiB; encoded bytes and worker scratch are additional.

| Format | Threads | Open/probe ms | Decode ms | Workers used |
| --- | ---: | ---: | ---: | ---: |
| TIFF | 1 | 68.402 | 14846.770 | 1 |
| TIFF | 2 | 67.377 | 7660.427 | 2 |
| TIFF | 4 | 65.863 | 3992.463 | 4 |
| EXR | 1 | 25.095 | 6494.080 | 1 |
| EXR | 2 | 24.178 | 3306.574 | 2 |
| EXR | 4 | 24.510 | 1696.354 | 4 |

Four-worker decode was 3.72× faster for TIFF and 3.83× for EXR. Absolute times
still leave room for substantial codec optimization. Reproduce with
`build/test-env/bin/python tools/benchmark.py --size 4096`.

## Opening a very large picture as a document — 2026-09-26

`src/luce_image/open_benchmark.lucb` opens a picture with `Canvas.open` and draws
it fitted into a 1600×1000 view a frame each 1/60 s, as the editor window does,
until it is whole: milliseconds to the first frame showing the top rows and to
the whole picture, with peak resident memory (RSS) and macOS's peak footprint
(which counts GPU memory too) from `/usr/bin/time -l`. Apple M4 Max, one run
each. Pictures: generated RGB, PNG at zlib level 1 by another encoder (no
`luPD` bands, the general path), baseline and progressive JPEG from `cjpeg -quality 90`.

Before is luce-image 0.35.0: the first draw decoded the whole picture. After is
0.36.0 with background loading (the window's setting, `--background`): a worker
decodes band by band and each frame uploads what is ready (canvas/opening).

| Picture | Before: first = whole | After: first | After: whole | RSS before → after | Footprint before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| PNG 18000×12000 (277 MB) | 4106 ms | 270 ms | 2374 ms | 1.79 → 0.51 GB | 3.19 → 3.47 GB |
| PNG 15000×24000 (462 MB) | 6527 ms | 389 ms | 4031 ms | 2.61 → 0.66 GB | 4.85 → 5.04 GB |
| JPEG 18000×12000 | 2310 ms | 50 ms | 739 ms | 1.34 → 0.44 GB | 3.18 → 3.36 GB |
| JPEG 15000×24000 | 3814 ms | 58 ms | 1212 ms | 1.96 → 0.42 GB | 5.02 → 4.75 GB |
| Progressive JPEG 18000×12000 | 2769 ms | 1070 ms | 1383 ms | 1.37 → 1.40 GB | 3.27 → 3.56 GB |

The footprint is mostly the document's own half-float tiles (8 bytes a pixel:
1.67 GB at 216 MP, 2.77 GB at 360 MP) and the pyramid and composite caches
(budgeted, about 0.6–0.8 GB here), which the memory governor keeps within
Settings › Memory usage. What the open itself holds besides the file's bytes is
a few rows of tiles: three packed bands, the inflate window and a band of
samples. A progressive JPEG still decodes every scan before its first row.

Reproduce: `luce-base build src/luce_image/open_benchmark.lucb --native --release -o build/open_benchmark`,
then `/usr/bin/time -l build/open_benchmark PICTURE [--background]`.

## Opening and placing, files read in pieces — 2026-09-26 (later)

The same harness and pictures (generated RGB 18000×12000 = 216 MP and
15000×24000 = 360 MP; PNG at zlib level 1 by another encoder; JPEG and
progressive JPEG from `cjpeg -quality 90`; an Adam7-interlaced PNG written
with numpy), Apple M4 Max, `--background` as the window loads. Before is
luce-image 0.36.1; after is 0.36.3 (luce-png 0.3.1, luce-jpeg 0.4.0).

- **Files read in pieces.** A PNG or JPEG is opened from its start alone (up to
  its first IDAT, or through its frame header) and decoded from the file a
  megabyte block at a time (png/jpeg `decode_rows_at`): the open never holds the
  file's bytes.
- **Progressive JPEG and interlaced PNG first sight.** The first scans (or the
  first Adam7 pass) give the picture at 1/8 size, shown through a stand-in for the
  layer until its rows are in. A progressive picture's coefficients are an
  allocation an MCU row, let go as the rows render; its planes are a ring.
- **Place.** File › Import and a drop on Layers load the same way; off the cells'
  grid the picture's bands land a row of cells at a time (`land_rows`).

| Picture (file) | First visible | Whole | Peak RSS | Peak footprint |
| --- | ---: | ---: | ---: | ---: |
| PNG 216 MP (261 MB) | 404 → 71 ms | 2095 → 2037 ms | 0.47 → 0.21 GB | 3.47 → 3.20 GB |
| PNG 360 MP (478 MB) | 383 → 76 ms | 3385 → 3508 ms | 0.67 → 0.21 GB | 5.05 → 4.56 GB |
| JPEG 216 MP (55 MB) | 49 → 50 ms | 780 → 799 ms | 0.46 → 0.43 GB | 3.39 → 3.34 GB |
| JPEG 360 MP (92 MB) | 61 → 53 ms | 1268 → 1330 ms | 0.45 → 0.37 GB | 4.79 → 4.68 GB |
| Progressive JPEG 216 MP | 1222 → 128 ms | 1532 → 1744 ms | 1.40 → 1.10 GB | 3.57 → 3.42 GB |
| Progressive JPEG 360 MP | 1893 → 221 ms | 2443 → 2823 ms | 1.79 → 1.57 GB | 5.23 → 4.78 GB |
| Interlaced PNG 216 MP (246 MB) | 3206 → 50 ms | 3484 → 3206 ms | 2.22 → 0.91 GB | 5.12 → 3.97 GB |

Placing on a new layer of a document 500 pixels bigger each way (`--place`), so
off the cells' grid; before, the window was blocked for the whole decode:

| Picture | Blocked before | First visible | Whole | Peak footprint |
| --- | ---: | ---: | ---: | ---: |
| PNG 216 MP | 2277 ms | 100 ms | 2016 ms | 4.43 → 3.86 GB |
| PNG 360 MP | 4152 ms | 99 ms | 3705 ms | 6.81 → 5.01 GB |
| JPEG 216 MP | 1072 ms | 82 ms | 821 ms | 4.44 → 3.84 GB |
| JPEG 360 MP | 1951 ms | 64 ms | 1384 ms | 6.82 → 4.96 GB |
| Progressive JPEG 216 MP | 1939 ms | 126 ms | 1779 ms | 4.45 → 3.60 GB |

Whole times move within run-to-run noise (about ±5%), except progressive JPEG,
about 8–14% longer whole: its coefficients are now an allocation an MCU row (so
they can go as rows render) and it renders a coarse picture first. Reproduce with
`open_benchmark PICTURE [--background] [--place]`.

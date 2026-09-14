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

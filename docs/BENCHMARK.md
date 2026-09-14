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

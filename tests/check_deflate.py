#!/usr/bin/env python3
"""Cross-check Base DEFLATE against Python's independent zlib."""
import random
import subprocess
import tempfile
from pathlib import Path
import zlib

ROOT = Path(__file__).resolve().parents[1]
random_source = random.Random(20060914)
cases = [b"", b"a", b"abc" * 100000, bytes(range(256)) * 1000]
cases += [random_source.randbytes(n) for n in [2, 17, 257, 4096, 32768, 65537]]
with tempfile.TemporaryDirectory() as tmp:
    paths = [Path(tmp) / name for name in ["raw", "zlib", "base"]]
    for data in cases:
        for level in [0, 1, 6, 9]:
            paths[0].write_bytes(data)
            paths[1].write_bytes(zlib.compress(data, level))
            subprocess.run([str(ROOT / "build/deflate"), *map(str, paths)], check=True, timeout=30)
            assert zlib.decompress(paths[2].read_bytes()) == data
print(f"PASS {len(cases)*4} independent DEFLATE cases")

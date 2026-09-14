#!/usr/bin/env python3
"""Independent PNG/TIFF fixtures; compare decoded samples and encoded output."""
from pathlib import Path
import random
import struct
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
rng = random.Random(72)
count = 0
with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    for mode in ["L", "LA", "RGB", "RGBA", "I;16"]:
        w, h = 37, 131
        source = Image.frombytes(mode, (w, h), rng.randbytes(w*h*len(Image.new(mode,(1,1)).getbands())*(2 if mode=="I;16" else 1)))
        expected = list(source.get_flattened_data())
        for fmt, codec in [("PNG", None), ("TIFF", "raw"), ("TIFF", "tiff_lzw"), ("TIFF", "tiff_adobe_deflate"), ("TIFF", "packbits")]:
            inp, raw, out = root/"input", root/"raw", root/"out"
            source.save(inp, format=fmt, **({"compression":codec} if codec else {}))
            for output in ["png", "tiff", "tile", "big"]:
                result = subprocess.run([str(ROOT/"build/codecs"), str(inp), str(raw), output, str(out)], capture_output=True, text=True, timeout=30)
                assert result.returncode == 0, (mode, fmt, codec, output, result.stderr)
                data=raw.read_bytes(); width,height,nc=struct.unpack_from("<III",data)
                values=struct.unpack_from(f"<{w*h*nc}d",data,12)
                reference=[v for pixel in expected for v in (pixel if isinstance(pixel,tuple) else (pixel,))]
                assert (width,height)==(w,h) and list(values)==reference, (mode,fmt,codec,"decode")
                with Image.open(out) as check:
                    actual=list(check.get_flattened_data())
                    assert actual==expected, (mode,fmt,codec,output,"encode")
                reread=subprocess.run([str(ROOT/"build/codecs"),str(out),str(root/"again"),"png",str(root/"again.png")],capture_output=True,text=True,timeout=30)
                assert reread.returncode==0,(mode,fmt,codec,output,"Base reread",reread.stderr)
                assert (root/"again").read_bytes()==data
                count+=1
print(f"PASS {count} PNG/TIFF interoperability cases")

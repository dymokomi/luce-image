# luce-image

JPEG, PNG, TIFF and OpenEXR image I/O for Luce, implemented in Luce Base, with a
Pillow-inspired owning `Image` API and Cryptomatte 1.2 reading and authoring.

**Every file format is its own package.** luce-image's `Image` opens and saves
through `luce-png`, `luce-jpeg`, `luce-tiff` and `luce-exr` (and reads Photoshop
documents through `luce-psd`), which share `luce-raster` (the pixel model, byte
readers and error codes) and `luce-compress`; each depends only on the standard
library and those two. luce-image adds the owning `Image` API, threaded decoding,
Cryptomatte and the layered-document engine.

**All runtime codec internals are Luce Base.** There are no libjpeg, libpng,
libtiff, OpenEXR, zlib or Python bindings in the library. The Base standard
library supplies memory, file I/O, math and threads. Independent established
codecs are used **only by the test suite**.

Status: experimental. The supported profiles below are implemented, not native
fallbacks. This is not yet a complete replacement for every TIFF/OpenEXR profile;
unsupported encodings return errors. See [format coverage](docs/FORMATS.md).

## Use from Luce

Keep this repository alongside the application, `luce-base`, and `luce`. In the
application's `luce.toml`:

```toml
[dependencies]
luce_image = "../luce-image"
```

The repository name is `luce-image`; its public import is `image`, following the
existing `luce-ui` → `ui` package convention. No language syntax changes are needed.

```luce
from image import Image

pub func main(arguments: list[str]) -> int!:
    let image = Image.open(arguments[0], threads = 4)
    print(image.size())
    let preview = image.convert("RGB").resize(512, 512, resample = "bilinear")
    preview.save(arguments[1])
    return 0
```

`open` snapshots encoded bytes and reads the header; pixels decode lazily on
`load`, pixel access, transformation or save. TIFF strips/tiles and EXR chunks
decode across a bounded number of Base threads. JPEG/PNG decoding and all
encoding are currently single-threaded. `workers_used()` reports how many workers
actually completed chunks, not just how many were requested.

The managed Luce handle owns the Base image. `close()` is idempotent and closes
all aliases; use `copy()` for independent pixels. No manual freeing is needed in
Luce. Native Base consumers release their `interop.Reference`.

## Layered documents: `Canvas`

The editor engine behind luced-2d, all Luce Base on the GPU (`std.gpu`), with a
Luce-facing `Canvas` object:

- A layer tree of 256×256 rgba16 tiles in linear light, straight alpha; the 26
  Photoshop blend modes, opacity, visibility, layer masks and clipping masks,
  composited per tile through one shader with a cache keyed on what each tile
  depends on, and a pyramid for zoomed-out views.
- Per-pixel selections (rectangle, ellipse, polygon/lasso, magic wand; add,
  subtract, intersect, invert, expand, contract, feather) that painting, fills
  and crops respect, drawn as marching ants.
- GPU brush and eraser strokes with soft edges; destructive adjustments
  (brightness/contrast, hue/saturation/lightness, invert, levels, curves,
  desaturate, threshold, posterize), Gaussian blur, free transform, move,
  canvas and image resize, text from `std.fonts`; each undoable, and each
  previewable live on the layer's original pixels before it is kept.
- Layer styles — drop shadow, outer glow, stroke — rendered under the layer by
  the compositor, non-destructively.
- Documents open from any picture, from `.l2d` packages (`document.prisma` and
  one PNG per layer and mask) and from Photoshop `.psd` files (through the luce-psd package); they save as
  `.l2d` or flatten to a picture.

## Cryptomatte

```luce
from image import Image
from cryptomatte import Cryptomatte

pub func main(arguments: list[str]) -> int!:
    let render = Image.open(arguments[0], threads = 8)
    let objects = Cryptomatte(render, "CryptoObject")
    let mask = objects.extract(["hero", "floor"])
    mask.save(arguments[1])  # use .exr to preserve FLOAT coverage
    return 0
```

Includes MurmurHash3 and float-ID conversion, embedded/sidecar manifests, Unicode
JSON, layer discovery, all-rank extraction, picking, and a weighted-sample builder
that aggregates IDs, sorts coverage and truncates ranks without renormalization.
See [Cryptomatte API and semantics](docs/CRYPTOMATTE.md).

## Build and test

```sh
python3 tools/bootstrap.py
python3 -m venv build/test-env
build/test-env/bin/python -m pip install -r tests/requirements.txt
./test.sh
```

Bootstrap verifies the sibling compiler revisions against `bootstrap/BASE` and
`bootstrap/LUCE`, then writes compilers only inside this repo's ignored `build/`.
It does not build into, modify, or update the language repositories. Supply
`--base /path/to/luce-base --luce /path/to/luce` to the test runner to test other
compiler versions instead. See [testing](docs/TESTING.md) for dependencies and CI.

Documentation: [API](docs/API.md), [formats](docs/FORMATS.md),
[design and limits](docs/DESIGN.md), [upstream attribution](THIRD_PARTY.md).
[Measured thread scaling](docs/BENCHMARK.md) records the initial benchmark.
[Validation results](docs/VALIDATION.md) distinguish local checks from CI.

Original package code is MIT licensed; ported OpenEXR algorithms and upstream
Cryptomatte fixtures retain their BSD notices. See [LICENSE](LICENSE) and
[LICENSES](LICENSES).

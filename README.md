# luce-image

The layered-document engine behind luced-2d, and the Pillow-inspired owning
`Image` API it opens pictures through, implemented in Luce Base.

**Every file format is its own package.** luce-image's `Image` opens and saves
through `luce-png`, `luce-jpeg`, `luce-tiff` and `luce-exr` (and reads Photoshop
documents through `luce-psd`), which share `luce-raster` (the pixel model, byte
readers and error codes) and `luce-compress`; each depends only on the standard
library and those two. luce-image adds the owning `Image` API, threaded decoding
and the layered-document engine. The brush engine is
[luce-painting](https://github.com/dymokomi/luce-painting), vector layers are
[luce-vector](https://github.com/dymokomi/luce-vector), Cryptomatte is luce-exr's
and SVG rendering luce-svg's.

**All runtime codec internals are Luce Base.** There are no libjpeg, libpng,
libtiff, OpenEXR, zlib or Python bindings in the library. The Base standard
library supplies memory, file I/O, math and threads. Independent established
codecs are used **only by the test suite**.

Status: experimental. The supported profiles below are implemented, not native
fallbacks. This is not yet a complete replacement for every TIFF/OpenEXR profile;
unsupported encodings return errors. See [format coverage](docs/FORMATS.md).

## Use from Luce

Depend on it from the application's `package.prisma`:

```
def dependency "luce-image" {
    str owner = "dymokomi"
    str version = "^0.41.0"
}
```

Its public imports are `image` (the `Image` API), `canvas` (the layered-document
engine) and `brush_files` (brush masks from pictures and files, kept as PNG).

```luce
from luce_image.image import Image

pub func main(arguments: list[str]) -> int!:
    let image = Image.open(arguments[0], threads = 4)
    print(image.size())
    let preview = image.convert("RGB").resize(512, 512, resample = "bilinear")
    preview.save(arguments[1])
    return 0
```

`open` snapshots encoded bytes and reads the header; pixels decode lazily on
`load`, pixel access, transformation or save. TIFF strips/tiles and EXR chunks
decode on luce-canvas's worker pool, at most `threads` at once. JPEG/PNG decoding
and all encoding are currently single-threaded. `workers_used()` reports how many
threads the chunks were spread over.

The managed Luce handle owns the Base image. `close()` is idempotent and closes
all aliases; use `copy()` for independent pixels. No manual freeing is needed in
Luce. Native Base consumers release their `interop.Reference`.

## Layered documents: `Canvas`

The editor engine behind luced-2d, all Luce Base on the GPU (`std.gpu`), with a
Luce-facing `Canvas` object:

- A layer tree of 256×256 rgba16 tiles in linear light, straight alpha; the 26
  Photoshop blend modes, opacity, visibility, layer masks and clipping masks,
  composited per tile through one shader with a cache keyed on what each tile
  depends on, and a pyramid for zoomed-out views. Colors mix as their
  sRGB-encoded values wherever they mix, as Photoshop's do, unless the
  document blends with gamma 1.0 (`set_linear_blend`; see
  [how colors blend](docs/BLENDING.md)).
- Per-pixel selections (rectangle, ellipse, polygon/lasso, magic wand; add,
  subtract, intersect, invert, expand, contract, feather) that painting, fills
  and crops respect, drawn as marching ants.
- GPU brush and eraser strokes as spaced dabs with Photoshop's controls — tip angle and roundness, spacing, smoothing, size/angle/roundness/flow/color jitter, scattering, and dynamics that drive size, flow, opacity, angle, roundness, scatter, texture depth and color jitter from the pen's pressure, tilt, azimuth, barrel rotation and airbrush wheel, the stroke's direction and velocity, or a fade, each with a minimum and a response curve (`set_brush_dynamics`, `set_brush_dynamic`, strokes taking the pen per point); sampled grayscale tips up to 1024 px and texture images tiled in document space, built-in or the brush's own, multiplied or subtracted per dab on the GPU (`set_brush_tip`, `set_brush_texture_image`, `set_brush_texture`); luce-painting's `BrushMask` to paint, invert and preview tips and textures, opened and kept as PNG through `brush_files`, and `selection_image` for Define Brush Preset; destructive adjustments
  (brightness/contrast, hue/saturation/lightness, invert, levels, curves,
  desaturate, threshold, posterize), Gaussian blur, free transform, move,
  canvas and image resize, text from `std.fonts`; each undoable, and each
  previewable live on the layer's original pixels before it is kept.
- Layer styles — drop shadow, outer glow, stroke — rendered under the layer by
  the compositor, non-destructively.
- Documents open from any picture, from `.l2d` documents (one file of the
  layers' half-float tiles, a manifest and a preview; see
  [the .l2d format](docs/FORMATS.md#the-l2d-document)) and from Photoshop `.psd`
  files (through the luce-psd package); they save as `.l2d` or flatten to a picture.

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

The GPU shaders are GLSL under `src/shaders/`; after changing one, regenerate
`src/shaders.lucb` with luce-gpu's generator (needs `glslangValidator` and `spirv-cross`):
`python3 ../luce-gpu/tools/embed_shaders.py --public -I ../luce-color/shaders src/shaders.lucb src/shaders/composite.frag src/shaders/adjust.frag src/shaders/blur.frag src/shaders/ants.frag src/shaders/warp.frag src/shaders/spread.frag src/shaders/style.frag src/shaders/lift.frag src/shaders/mask_mix.frag src/shaders/adjust_mix.frag src/shaders/resample.frag src/shaders/float.frag src/shaders/encode.frag src/shaders/liquify.frag src/shaders/quickmask.frag src/shaders/mesh.frag src/shaders/channels.frag src/shaders/transfer.frag` (this order keeps the generated file stable). `srgb.glsl`, the sRGB curve the
shaders mix through, is luce-color's.

Documentation: [API](docs/API.md), [formats](docs/FORMATS.md),
[design and limits](docs/DESIGN.md), [how colors blend](docs/BLENDING.md),
[upstream attribution](THIRD_PARTY.md).
[Measured thread scaling](docs/BENCHMARK.md) records the initial benchmark.
[Validation results](docs/VALIDATION.md) distinguish local checks from CI.

MIT licensed; see [LICENSE](LICENSE).

# How colors blend

Photoshop mixes the colors of an 8- or 16-bit RGB document as their gamma-encoded
values, unless Color Settings › Advanced › "Blend RGB Colors Using Gamma 1.0" is
on. luce-image does the same. A document blends in sRGB by default. With
`Canvas.set_linear_blend(true)`, which is that setting, it blends in linear light,
as luce-image did before 0.39.

Half-opacity black over white shows why this matters. Mixing the encoded values
gives 128. Mixing linear light gives 188, which is visibly lighter than Photoshop.

## The model

- **Tiles stay linear light.** Every tile is still rgba16f with straight alpha,
  and holds linear light, so file I/O, adjustments, the histogram, the Info
  readouts and the display are unchanged. Only mixing changes.
- **Each mixing shader encodes what it mixes, mixes, and decodes the result.**
  The shaders share one transfer function, `shaders/srgb.glsl` (IEC 61966-2-1),
  through `#include`. A push constant `srgb` (1 or 0) picks the space. The branch
  is uniform, so it costs a few ALU operations per fragment. Compositing is bound
  by memory traffic, so this does not show in timings (see below).
- **One flag per document.** `Document.linear_blend` is carried in the history's
  tree state (`TreeState`), so turning it on or off is one undo step. The
  compositor's cache keys and the layer-effects keys include it. The `.l2d`
  manifest stores it as `/document/linear_blend`, which is why the package format
  is now version 5. `Document.mixing(on_mask)` hands each edit a `Mixing` value
  (blending.lucb) that holds the flag and converts the colors the edit brings.
- **Masks are gray levels, never encoded.** A mask's or selection's values are
  coverage. They mix as they are in both modes. A color painted into a mask lands
  as its encoded level, as in Photoshop: 50% gray paints 50%.
- **CPU paths do the same.** Smudge encodes a cell's samples as it reads them in.
  It uses a 64K table of half floats and decodes through a 4097-step table, so
  a dab costs no power functions. Spot healing, Bloom and Tonal Contrast, and the
  whole-picture export matte encode and decode directly.

## Where colors mix

| Path | Where |
| --- | --- |
| Layer compositing, all 26 blend modes, opacity and fill, masks, clipping, groups | `composite.frag` |
| Adjustment layers mixed back by opacity and mask; the Blur layer | `adjust_mix.frag`, `blur.frag` |
| Merge Down | `composite.frag` |
| Brush and eraser: dab colors and flow build-up (dabs carry encoded colors), the opacity cap, the stroke over the layer | `dab.frag`, `paint.frag` |
| Clone Stamp, blur tool, dodge/burn, healing laid through the stroke | `paint.frag` (effect modes) |
| Smudge | `warp.lucb` (CPU) |
| Spot healing's patch | `retouch_effects.lucb` (CPU) |
| Fills at any opacity, and feathered selection edges | `paint.frag` |
| Gradients: the stops interpolate as encoded values | `gradient.frag` |
| Edits kept within a soft selection (adjustments, filters, previews) | `mask_mix.frag` |
| Move and copy of selected pixels | `lift.frag` |
| Gaussian blur: the first pass encodes, the second decodes | `blur.frag` |
| Motion Blur, Lens Correction | `resample.frag` |
| Bloom, Tonal Contrast | `light_filters.lucb` |
| Free Transform, Distort, floating selections, and their previews | `warp.frag`, `float.frag` |
| Liquify, Warp, Puppet Warp | `liquify.frag`, `mesh.frag` |
| Image Size, resampling smoothly: the pieces are encoded, filtered, then decoded | `transfer.frag` + `extent.relocate` |
| Layer styles: shadow, glows, stroke, overlay, inner shadow | `style.frag` |
| Export over a matte (JPEG) | `encode.frag`, `files.lucb` |
| The view: the picture over the checkerboard (`Canvas.set_checker`), and Quick Mask's and the shown alpha channels' red tints, in the same draw | `channels.frag` |
| Select and Mask's overlay, on black and on white; selection previews | `quickmask.frag`, which reads the composite under it |

The view draws the checkerboard itself, so that transparent pixels mix with it the
way the document blends. When a checkerboard is set, `Canvas.draw` blends the
composite over it together with Quick Mask's tint and up to three shown alpha
channels, in one pass per cell. Its output is opaque. Blend.over on an sRGB target
could only mix in linear light. `draw_selection` still draws the ants, and
Select and Mask's mattes, which read the composite under them and mix with it.

## Left linear on purpose

- **Pyramid levels (luce-canvas `halve.frag`).** The pyramid is the view's
  zoomed-out cache. It is shared by colors, masks and selection coverage, and
  averages 2×2 texels in linear light. Zoomed out, fine high-contrast detail looks
  a little lighter than in Photoshop's view. The document's pixels are not
  affected.
- **Transient previews drawn straight onto the view.** During a Move-tool drag,
  the layer is drawn over the rest with `draw_image`. Blend.over mixes it in
  linear light until the move is kept. The kept result is composited like
  anything else.
- **The GPU's own texture filtering.** When the view draws at less than a texel
  a point, the sampler blends neighboring texels in linear light.
- **Adjustments' own math.** It was already defined on encoded values (Levels,
  Curves, Hue/Saturation and the rest) or on light itself (Exposure), and is
  unchanged. Only how an adjustment layer mixes back is affected.
- **Node graphs' Color Gradient.** It steps shape colors from one parameter to
  another, which is not a mix of pixels.

## Cost

Measured with `src/luce_image/view_benchmark.lucb` on a 15000×24000 (360 MP)
JPEG with a Multiply layer over it, on an Apple M4 Max. The numbers are the
median of three runs; see [BENCHMARK.md](BENCHMARK.md). Composites, pans,
opacity drags and brush strokes are within run-to-run noise of linear blending
and of luce-image 0.38.2.

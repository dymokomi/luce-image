# Architecture

luce-image is the layered-document engine behind luced-2d, plus the owning
`Image` API it opens pictures through. Everything is Luce Base; the file
formats are their own packages (luce-png, luce-jpeg, luce-tiff, luce-exr,
luce-psd, luce-heic, luce-raw, luce-svg), and pixels live in luce-canvas's
shared 256-pixel GPU tiles.

## Layers of the engine

| Part | Modules | Owns |
| --- | --- | --- |
| Facade | `canvas/` (one module, fragments in `ORDER`) | `Canvas`, the one object an editor drives: layers, tools, previews, history, files, drawing |
| Document | `document`, `curves`, `geometry`, `extent` | the layer tree, masks, styles, canvas size and layers past the canvas |
| Compositing | `composite`, `stand_in`, `blending` | per-tile compositing through one shader with a content-keyed cache; how colors mix (sRGB-encoded or gamma 1.0, [BLENDING.md](BLENDING.md)) |
| Selection | `selection*`, `live_wire`, `color_range`, `selection_passes` | per-pixel selections kept in 256-pixel cells, their GPU mirror, and the passes that apply them |
| Painting | `brush`, `dynamics`, `brush_images`, `brush_mask`, `warp*`, `heal` | dab strokes, fills and gradients, pen dynamics, tips and textures, smudge, healing |
| Filters | `adjust`, `filter`, `filter_preview`, `light_filters`, `style` | adjustments, blurs and layer styles |
| Transforms | `projective`, `transform*`, `liquify*`, `mesh_*`, `puppet`, `warp_patch` | free transform, distort, liquify, mesh and puppet warps |
| Pictures | `image`, `file_source`, `streaming`, `parallel`, `svg_*` | the `Image` API, pictures read in pieces, SVG import |
| Cryptomatte | `cryptomatte`, `manifest`, `crypto_hash` | Cryptomatte 1.2 reading and authoring |
| Shaders | `shaders` and `shaders/*.frag` | the embedded GPU programs (see the README for regenerating them) |

The Canvas's methods are small and delegate to the engine objects (Document,
Composer, Painter, Adjuster, Filters, Transformer); a larger body lives in the
fragment for its concern.

## Resources

- A layer's pixels are luce-canvas `Tiles`: immutable 256×256 rgba16 tiles in
  linear light, straight alpha, shared between copies. A change makes new
  tiles, so an undo step is the old tiles kept. The residency governor moves
  tiles between the GPU and RAM within the budgets the app sets.
- Work sized by the document (a selection, a smudge, a flatten) goes a cell or a
  band at a time, so a 360 MP canvas costs its edges, not its area.
- Worker threads are joined before what they wrote is published or freed.
  Pictures decode on bounded workers; a load shown while it runs goes a band
  at a time.
- `Image` stores interleaved f64 pixels, preserving UINT32, HALF, FLOAT and
  DOUBLE values (Cryptomatte IDs round-trip exactly). `max_bytes` (1 GiB) bounds
  each primary buffer, not the sum; `max_pixels` (268,435,456), 1,000,000 a side
  and 1024 channels are further checks a caller can raise.

The test corpus and mutation suite are not a security certification: process
hostile files in a resource-limited process. Sidecar path checks are lexical,
not symlink confinement.

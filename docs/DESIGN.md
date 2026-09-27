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
| Document | `document/`, `curves`, `geometry`, `extent` | the layer tree, masks, styles, canvas size and layers past the canvas |
| Compositing | `composite/`, `stand_in`, `digest` | per-tile compositing through one shader with a content-keyed cache; colors mix as luce-painting's `mixing` says (sRGB-encoded or gamma 1.0, [BLENDING.md](BLENDING.md)) |
| Selection | `selection*`, `live_wire`, `color_range`, `selection_passes` | per-pixel selections kept in 256-pixel cells, their GPU mirror, and the passes that apply them |
| Painting | luce-painting; here `fill`, `brush_files` | strokes, dynamics, tips and textures, smudge and healing are luce-painting's; the canvas finds the tiles a stroke paints (`PaintTarget`). Fills and gradients over the document, and brush masks from files, are here |
| Vector layers | luce-vector | shapes, paths, elements and node graphs drawn cell by cell; the canvas keeps them on its layers with their history |
| Filters | `adjust`, `filter`, `filter_preview`, `light_filters`, `style` | adjustments, blurs and layer styles |
| Transforms | `projective`, `transform*`, `liquify*`, `mesh_*`, `puppet`, `warp_patch` | free transform, distort, liquify, mesh and puppet warps |
| Pictures | `image/`, `file_source`, `streaming`, `parallel` | the `Image` API, format dispatch, pictures read in pieces (each format's reading is its own package's; SVG drawing is luce-svg's) |
| Shaders | `shaders` and `shaders/*.frag` | the embedded GPU programs (see the README for regenerating them) |

The Canvas's methods live in the fragment of their concern under `extend Canvas:`
and delegate to the engine objects (Document, Composer, Painter, Adjuster,
Filters, Transformer); `document/`, `composite/` and `image/` are split the same
way.

## Resources

- A layer's pixels are luce-canvas `Tiles`: immutable 256×256 rgba16 tiles in
  linear light, straight alpha, shared between copies. A change makes new
  tiles, so an undo step is the old tiles kept. The residency governor moves
  tiles between the GPU and RAM within the budgets the app sets.
- Work sized by the document (a selection, a smudge, a flatten) goes a cell or a
  band at a time, so a 360 MP canvas costs its edges, not its area.
- Work spread over the processors runs on luce-canvas's one persistent
  worker pool, and is done before what it wrote is published or freed.
  Pictures decode on it; a load shown while it runs goes a band at a time.
- `Image` stores interleaved f64 pixels, preserving UINT32, HALF, FLOAT and
  DOUBLE values exactly. `max_bytes` (1 GiB) bounds
  each primary buffer, not the sum; `max_pixels` (268,435,456), 1,000,000 a side
  and 1024 channels are further checks a caller can raise.

The test corpus and mutation suite are not a security certification: process
hostile files in a resource-limited process.

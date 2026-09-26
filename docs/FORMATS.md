# Format coverage

Every implemented codec below runs in Luce Base, including entropy coding,
compression, transforms, predictors, checksums and container parsing. There is
no runtime external-codec fallback.

| Format | Read | Write |
| --- | --- | --- |
| JPEG | 8-bit sequential baseline and progressive Huffman; grayscale, RGB/YCbCr, CMYK/YCCK; subsampling and restart markers | Baseline grayscale or RGB, 4:4:4, quality 1–100 |
| PNG | Static PNG, grayscale/indexed/RGB/alpha; legal 1/2/4/8/16-bit layouts; all filters; Adam7; palette and tRNS | 8/16-bit grayscale, gray-alpha, RGB, RGBA; noninterlaced, Sub filter, DEFLATE |
| TIFF | Classic TIFF and BigTIFF, both byte orders; pages; strips/tiles; planar separate/contiguous; all eight orientations; grayscale, palette, RGB/alpha; none/LZW/DEFLATE/PackBits; integer and float predictors | One page, classic or BigTIFF; strips or square tiles; uncompressed or DEFLATE; grayscale, RGB/alpha |
| OpenEXR | Flat scanline/tiled ONE_LEVEL; multipart selection; mixed named UINT/HALF/FLOAT channels; NONE/RLE/ZIPS/ZIP/PIZ/PXR24; nonzero/negative data windows | One flat part, scanline/tiled ONE_LEVEL; named UINT/HALF/FLOAT; NONE/RLE/ZIPS/ZIP/PIZ; typed metadata preservation |

TIFF samples: unsigned packed 1/2/4-bit (expanded), unsigned 8/16/32-bit,
signed 8/16/32-bit, and IEEE float 16/32/64-bit. The TIFF writer supports
8/16/32-bit unsigned/signed and 16/32/64-bit float, not packed output.
TIFF palette output is expanded RGB16; low-bit grayscale is expanded to uint8.

PXR24 is lossy for FLOAT. Reading it reproduces the values recovered by OpenEXR;
it cannot recover bits discarded by the original writer. It is not offered as
an output option, particularly because Cryptomatte requires exact FLOAT IDs.

## Not implemented

- JPEG arithmetic coding, lossless JPEG and 12-bit JPEG; CMYK output.
- APNG animation and interlaced/palette PNG output.
- TIFF fax/JPEG compression, YCbCr/CMYK photometrics, SubIFD pyramids,
  writing multiple pages, LZW/PackBits output.
- EXR deep samples, subsampled channels, mipmaps/ripmaps, B44/B44A,
  DWA and HTJ2K compression, and writing multipart files.
- ICC color management and EXIF interpretation/preservation. PNG ancillary
  metadata and general TIFF tags are not round-tripped. EXR typed attributes
  are retained; structural fields are regenerated for the actual output.

Malformed supported encodings return recoverable errors. Unsupported profiles
return explicit errors rather than being delegated to C codecs. Metadata that
has no implemented interpretation is not proof that a file's pixels are color
managed. JPEG decoding does not apply EXIF orientation; TIFF orientation is
normalized to top-left pixels during decode.

## Save choices

`Image.save(path, file_format="", compression="zip", quality=90, tile=0,
bigtiff=false)` infers the format from the extension unless explicitly supplied.

- TIFF: `compression="none"` or `"zip"`/`"deflate"`; `tile=16` (or another
  valid tile size) selects tiled output; `bigtiff=true` selects BigTIFF.
- EXR: `compression="none"`, `"rle"`, `"zips"`, `"zip"` or `"piz"`;
  `tile=16` selects tiles.
- JPEG uses `quality`; PNG uses the Base DEFLATE encoder. The compression
  parameter is not a JPEG quality or PNG compression-level setting.

Saving a selected TIFF page or EXR part writes that image only. It does not
preserve other pages/parts from the source container.

## The .l2d document

`Canvas.save_package` writes a document as one `.l2d` file and `Canvas.open`
reads it back. It keeps everything the editor does: every layer's pixels and
mask as the canvas holds them (16-bit half floats, so nothing is lost to 8-bit),
cells past the canvas, groups, adjustment layers, text, shapes and paths, styles,
guides, alpha channels, resolution and profile. Nothing the size of the document is made in either
direction: tiles are read back, compressed and written a batch at a time, and
come back the same way, within the memory budget.

Layout, all numbers little-endian:

| Part | Content |
|---|---|
| header | 16 bytes: `LUCED2D1`, the format version (u32, now 2), reserved (u32) |
| tiles | one record per stored tile, back to back |
| preview | a PNG of the flattened document, at most 256 pixels a side |
| manifest | the document as Prism text: size, resolution, profile, layers (name, visibility, opacity, blend, clipping, mask flags, group and parent, adjustment and its parameters or curves, text, shape and path values, style fields), guides, alpha channels (name, shown) |
| index | the blob table, then the cell table |
| trailer | 64 bytes: `L2DINDEX`, then offset and length (u64 each) of the manifest, the preview and the index, then 8 reserved bytes |

The index:

- `u32` blob count, then per blob: `u64` offset, `u32` length, `u16` rows,
  `u8` filter (1 a tile record, 2 a channel's coverage record), `u8` 0.
- `u32` cell count, then per cell: `u32` layer (its place in the manifest), `u32`
  plane (0 pixels on the canvas grid, 1 pixels past the canvas, 2 and 3 the
  mask's; 4 an alpha channel's cell with an edge, 5 one selected throughout,
  its blob unused, `layer` then the channel's place in the manifest), `i32`
  column, `i32` row, `u32` blob.

A tile record is a 256-texel-wide cell of rgba16f texels, `rows` rows (the
canvas's last row of cells may be shorter). Each 16-bit sample is replaced by its
difference from the same channel of the texel to its left, the result split into
a plane of low bytes then one of high bytes, then deflated as raw DEFLATE at level
1. Unpainted cells have no entry (a mask's are white). A tile shared by several
cells, or layers, is stored once: cells refer to its blob, and a layer's cells that
share a blob come back sharing one tile.

An alpha channel is a saved selection, a coverage byte per pixel. A cell of one
with an edge is a coverage record: its bytes, 256 to a row and `rows` rows,
deflated as raw DEFLATE with no filter. A cell selecting nothing has no entry,
and a block of coverage several cells or channels share is stored once and comes
back shared. Channels need no GPU, so they are read when the file opens.

Saving writes `<name>.l2d.saving` beside the target and renames it over the target
only when complete, so a failed save leaves the previous file as it was. Opening
reads the trailer, manifest and index, builds the layers, and loads their tiles
when the document is first bound to a GPU, building each layer's coarser levels
as it goes.

There is no reader for earlier layouts (the `.l2d` folders of PNGs): saving over
one replaces the folder with the file.


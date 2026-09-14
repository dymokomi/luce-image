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

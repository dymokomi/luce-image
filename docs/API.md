# Image API

Import `Image`, `Pixel` and `SampleType` from `image`. Calls that can fail use
Luce's normal fallible-function/error handling. In Base, import the same types
from `luce_image.image` and use explicit `try` and reference release.

## Constructors

- `Image.open(path, threads=4, frame=0, max_bytes=1073741824,
  max_pixels=268435456)` snapshots the encoded file and probes the selected page
  or part. Pixel decoding is lazy.
- `Image.open_bytes(data, threads=4, frame=0, max_bytes=1073741824,
  max_pixels=268435456)` copies encoded bytes. There is no source directory for
  resolving Cryptomatte sidecars.
- `Image.create(mode, width, height, color=none, max_bytes=1073741824)` allocates
  initialized pixels. Default is black with full alpha where applicable.
- `Image.create_channels(width, height, names, kind=SampleType.float32,
  max_bytes=1073741824)` creates zero-valued named channels, e.g. AOVs. Mixed
  channel types are read from EXR; this constructor gives all channels one type.

Modes: `L`, `LA`, `RGB`, `RGBA`, `I;16`, `I`, `F`, `RGBF`, `RGBAF`. `I` is unsigned
32-bit, unlike Pillow's signed mode. `F` is FLOAT. Nonstandard channel layouts
report `MULTI`; use channel names and sample types as the authoritative layout.

`Pixel(r=0, g=0, b=0, a=255)` is the convenience color value. Its alpha default
uses 8-bit units; supply `a=1.0` when explicitly constructing floating RGBA colors.

## Inspection and lifetime

`width()`, `height()`, `size()`, `origin()`, `file_format()`, `mode()`,
`channel_count()`, `channel_name(index)`, `channel_type(index)`,
`channel_index(name)`, `source_path()`.

`load()` decodes once; `is_loaded()` reports pixel availability. `workers_used()`
reports actual chunk workers after load. `close()` is idempotent. Closing any
managed alias invalidates the image for all aliases. `copy()` makes an independent
image with copied metadata.

`n_frames()`, `tell()`, `seek(frame)` provide TIFF page / EXR part access. Indices
are zero-based. `seek` is transactional: failed selection leaves the old image
intact, retains the configured resource limits, and successful selection resets
lazy pixel storage.

## Pixels and transforms

- `getpixel(x, y)` / `putpixel(x, y, pixel)` use standard `R/G/B/A` or `Y`
  channels. They do not turn arbitrary named AOVs into colors.
- `get_sample(x, y, channel=0)` / `put_sample(x, y, channel, value)` address
  the exact numeric channel value without gamma, alpha or color conversion.
- `get_channel(name)` returns an independent single-channel image.
- `crop(left, top, right, bottom)` uses a half-open rectangle, preserves metadata
  and adjusts the data-window origin. Out-of-bounds/empty crops are errors.
- `resize(width, height, resample="nearest")` supports `nearest` and `bilinear`.
  It does not preserve metadata or the original data-window origin.
- `convert(mode)` scales unsigned integer ranges to/from floating 0–1 color
  units, clamps/rounds integer output, and uses weighted RGB for grayscale.
  This is numeric conversion, not ICC or transfer-function conversion. It drops
  metadata and resets the origin. Use explicit sample access for signed/HDR AOVs.

Never bilinearly filter Cryptomatte ID channels, apply color transforms to them,
or convert them to HALF. Extract a coverage mask first; that mask can be resized
or converted for display normally.

## Metadata and output

`metadata_count()`, `metadata_key(index)`, `metadata(name)`,
`metadata_type(name)`, `metadata_bytes(name)`, `set_metadata(name, value)`.

`metadata` reads string attributes; typed attributes require `metadata_bytes`.
Missing attributes return empty text/bytes. The setter writes a string attribute;
it is primarily for EXR/Cryptomatte metadata. Structural EXR fields such as
channels/compression/windows are regenerated on save, not controlled by string
attributes. `set_origin(x, y)` updates the image's data-window origin with int32
bounds checks.

`save(path, file_format="", compression="zip", quality=90, tile=0,
bigtiff=false)` builds output in a bounded buffer and replaces the destination
atomically using Base's file API. Encoder failure does not partially overwrite
the existing destination. See [format-specific choices](FORMATS.md).

## Limits and errors

Thread count is 1–64. Default byte limit is 1 GiB per primary buffer; it is **not
a total-process memory budget**. Pixels use eight bytes per channel in memory.
See [design](DESIGN.md) for the resulting working set and security boundaries.

The package defines `invalid`, `unsupported`, `limit`, and `corrupt` error codes
in `luce_image.errors`; file, allocation and thread errors can also propagate.
Parallel decoding cancels pending work and joins workers before returning an
error. Retry with `threads=1` to obtain the original per-chunk error detail.

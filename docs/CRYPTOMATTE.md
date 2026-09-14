# Cryptomatte 1.2

The producer/consumer implementation is Luce Base, not a wrapper around the
reference Python/Nuke plugin. It implements the image-data and manifest parts
of the specification; renderer scene traversal and DCC-specific node/UI behavior
are outside an image library's scope.

## Reading

Import `Cryptomatte`, `layer_count`, `layer_name`, `hash_name`, `id_for_name`,
`hash_to_id`, `metadata_key`, and `CryptomatteBuilder` from `cryptomatte`.

`layer_count(image)` / `layer_name(image, index)` discover layers from metadata.
`Cryptomatte(image, layer, load_sidecar=true)` retains the source handle, finds the
matching metadata namespace, checks the hash/conversion identifiers and locates
all contiguous ranked RGBA channel sets. Upper/lower-case letters and the
reference fixtures' `red/green/blue/alpha` suffixes are supported. Channels must
be FLOAT32, not HALF. Keep the source image open while using its layer.

- `extract(names, invert=false)` unions selected names across **all** ranks,
  without counting duplicate selections twice, returning an `F` mask with the
  source data-window origin.
- `extract_ids(ids, invert=false)` selects exact float32 bit IDs. ID zero is
  background. Finite values only; coverage is checked and clamped to 0–1.
- `pick(x, y, rank=0)` / `pick_name(x, y, rank=0)` inspect an individual rank.
  An unknown manifest name for a picked ID returns an empty string.
- `id_for(name)` consults the manifest first, falling back to the standard hash.
- `name()`, `rank_count()`, `manifest_count()`, `manifest_name(index)`,
  `manifest_json()`, `write_manifest(path)`, `close()`.

Embedded manifests take precedence over sidecars. A missing manifest still
permits ID-based extraction and standard name hashing. JSON parsing handles UTF-8,
escaped controls, quotes/backslashes, and UTF-16 surrogate pairs; malformed input,
duplicate names and non-eight-digit hash strings are rejected. Both raw hash bits
and already exponent-remapped hash values in manifests are accepted.

Sidecars must be relative descendant `.json` paths with no `..`, empty component,
backslash, NUL or drive prefix. They resolve relative to the opened EXR, with a
64 MiB read limit. This is lexical path validation, **not a filesystem sandbox**:
symlinks are followed by the file API. Use `load_sidecar=false` for untrusted files
or isolate the asset directory. In-memory images cannot implicitly load sidecars.

`write_manifest(path)` writes the JSON atomically. To export a sidecar, write the
manifest, set `cryptomatte/<key>/manifest` to an empty string and
`cryptomatte/<key>/manif_file` to its relative filename before saving the EXR.
`metadata_key(layer)` returns the seven-character namespace used by the builder.

## Authoring

```luce
from cryptomatte import CryptomatteBuilder

pub func main(arguments: list[str]) -> int!:
    let builder = CryptomatteBuilder(1, 1, "CryptoObject", levels = 3)
    builder.add_sample(0, 0, ["hero", "floor"], [0.25, 0.5], weight = 1.0)
    builder.add_sample(0, 0, ["hero"], [1.0], weight = 3.0)
    let image = builder.finish()
    image.save(arguments[0], compression = "piz")
    return 0
```

`levels` counts RGBA channel sets: three sets hold six ID/coverage ranks. Each
sample provides names and their visible surface coverages, plus a nonnegative
filter weight. Remaining sample coverage contributes to background ID zero.
Transparency, motion blur and antialiasing are represented by the caller's
sample coverages and weights; the library does not render them itself.

Contributions are aggregated per pixel and encoded ID, then sorted by descending
weight (encoded bits break ties deterministically). Coverage is normalized by
the total pixel filter weight **before rank truncation**. Truncation never
renormalizes the remaining ranks. `finish()` is repeatable; the builder can accept
more samples afterward. Untouched pixels have zero recorded coverage. Negative
filter weights are rejected; apply renderer-specific reconstruction upstream.

MurmurHash3_x86_32 uses seed zero and UTF-8 bytes, with wraparound uint32 arithmetic.
The float-ID conversion toggles exponent bit 23 for exponent fields 0 or 255,
avoiding zero/subnormal/Inf/NaN encoded IDs. Hash collisions remain inherent in
the 32-bit format: colliding names cannot be independently selected.

ZIP/PIZ output preserves FLOAT IDs exactly. Do not use lossy compression or a
color-managed path for Cryptomatte. PXR24 input cannot restore discarded ID bits;
the consumer verifies FLOAT storage but cannot undo losses in the source file.

## Conformance evidence

Tests cover official hash vectors, exponent remapping, Unicode/surrogate JSON,
weighted samples, background, duplicate selections, inversion, rank truncation,
and EXR round trips. Three upstream Psyop EXRs cover five layers, including
embedded and sidecar manifests and unusual object names. Tests compare every
extracted pixel with independently decoded upstream OpenEXR channels, not merely
with this implementation's writer. See [provenance](../THIRD_PARTY.md).

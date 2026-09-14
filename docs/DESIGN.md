# Architecture and resource model

The package has no `[native]` manifest section and no foreign image codec calls.
All `.lucb` sources are compiled with the consuming Luce program. The C backend
is a compiler comparison target: compiling Base code to C does not substitute
an external C image codec.

| Component | Responsibility |
| --- | --- |
| `image.lucb` | Managed/owning public API, lazy loading, transformations, atomic save |
| `model.lucb`, `binary.lucb` | Raster ownership, typed channels/attributes, checked reads and bounded buffers, IEEE conversion |
| `png.lucb`, `jpeg.lucb`, `tiff.lucb`, `exr.lucb` | Format parsing, encoding and pixel reconstruction |
| `deflate.lucb` | Stored/fixed/dynamic inflate, LZ77/fixed-Huffman encode, Adler32/CRC32 |
| `piz.lucb`, `pxr24.lucb` | OpenEXR wavelet/Huffman and delta predictor algorithms ported to Base |
| `parallel.lucb` | Atomic work queue for independent TIFF/EXR chunks |
| `crypto_hash.lucb`, `manifest.lucb`, `cryptomatte.lucb` | Cryptomatte hash, bounded JSON, layer extraction, weighted-sample authoring |

The encoded source is an immutable snapshot. Workers have independent decoder
scratch space and write disjoint pixel/channel regions. Chunk selection uses an
atomic counter; failure signals cancellation. All spawned threads are joined
before pixels are published or released. Parallelism is per image load; callers
loading many images concurrently should lower each image's thread count to avoid
oversubscription. An `Image` itself is not a concurrent mutation API.

Pixels use interleaved f64 storage, preserving numerical UINT32, HALF, FLOAT and
DOUBLE values without quantizing Cryptomatte IDs. NaN payload preservation is not
promised; finite float32 IDs round-trip exactly. This favors correctness and a
single API over minimum memory. A 4096×4096 RGBA image uses 512 MiB for pixels,
plus encoded bytes, metadata and per-worker decompression buffers.

Default `max_bytes=1 GiB` bounds each primary encoded/pixel/chunk buffer, **not the
sum of all allocations**. Default `max_pixels=268435456`, per-axis maximum
1,000,000, and maximum 1024 channels are additional checks. A large-image caller
can raise byte/pixel limits explicitly. EXR headers/manifests have separate
bounded entry/field limits. Arbitrary metadata and worker counts still increase
the total working set. No streaming/mmap or disk-backed pixel cache exists yet.

Open probes metadata but reads the whole encoded file. Load allocates pixels and
only marks success after all decoding completes; errors discard partial pixels.
Save encodes into memory and then calls Base's atomic file replacement. Threads
currently accelerate TIFF/EXR **decode**, not file reads or encoding. Compression
ratio/throughput will vary; the Base compressor is intentionally simpler than
the many tuned strategies in mature zlib/OpenEXR implementations.

The test corpus and mutation suite are not a security certification. Hostile
assets should be processed in a resource-limited process. Sidecar path checks
are lexical, not symlink confinement. See the Cryptomatte documentation.

Language workarounds live here, not in the language repositories. The pinned C
emitter double-evaluates a span-producing call used as a subscript receiver;
`Reader.byte` binds a local first. `tests/regressions/c_span_call.lucb` preserves
the independent compiler reproducer. Detailed language findings are kept in
`../LUCE_IMAGE_LANGUAGE_AUDIT.md` in the development workspace as requested.

# Upstream references and attribution

Runtime codecs are Luce Base source. No external codec binary/library is vendored
or linked. Test-only Python packages use independent mature implementations to
check interoperability. Upstream reference source downloads under ignored
`build/` are not distribution dependencies.

## Specifications and API references

- [OpenEXR file layout](https://openexr.com/en/latest/OpenEXRFileLayout.html).
- [PNG specification](https://www.w3.org/TR/png-3/).
- [DEFLATE RFC 1951](https://www.rfc-editor.org/rfc/rfc1951), [zlib RFC 1950](https://www.rfc-editor.org/rfc/rfc1950).
- [TIFF 6.0](https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf), [BigTIFF](https://libtiff.gitlab.io/libtiff/specification/bigtiff.html).
- [JPEG T.81](https://www.itu.int/rec/T-REC-T.81/en).
- [Pillow Image API](https://pillow.readthedocs.io/en/stable/reference/Image.html), UX inspiration only. No Pillow source is used by the runtime.

# Local validation — 2026-09-14

Source: initial implementation commit `4a480ee` (codec/library sources unchanged
by this report). Host: macOS 15.7.3 arm64.

Compiler pins:

- Base `162ff10fce15997abe38337029069971643614b2`
- Luce `88d0e5d1847b489c0c3fb44425e8f56ee3bcc033`

`build/test-env/bin/python tests/run.py` completed successfully across native
optimization levels 0, 1, 2, 3, C, and C release. Each mode passed 1,426 counted
interoperability/mutation cases (8,556 across six modes), plus the Luce API,
Cryptomatte API and page/part navigation assertions. Five Base unit tests passed
on each backend, including exhaustive finite HALF round trips.

The 605-case mutation corpus also passed under AddressSanitizer and UBSan with
halt-on-error enabled. Leak detection was disabled. See [reproduction commands](TESTING.md).

Both example programs compiled and ran. `otool -L build/api` listed only
`libSystem.B.dylib`: no dynamic image/compression libraries. The package manifest
declares no native image inputs, and runtime sources have no foreign codec calls.

The sibling language working trees remained clean. One confirmed C-emitter bug
was isolated and worked around locally; its independent reproducer is in
`tests/regressions/c_span_call.lucb`. The requested audit note is at
`../LUCE_IMAGE_LANGUAGE_AUDIT.md` in the development workspace.

Cross-platform CI status is recorded in
[GitHub Actions](https://github.com/dymokomi/luce-image/actions), separately from
these local results. This report does not claim every format profile is supported
or that mutation testing proves security; consult [coverage](FORMATS.md).

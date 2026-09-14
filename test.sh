#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ -x build/test-env/bin/python ]; then
    exec build/test-env/bin/python tests/run.py "$@"
fi
exec python3 tests/run.py "$@"

#!/bin/bash
# Phantom — one-command setup on a fresh machine.
#
#   bash scripts/bootstrap.sh
#
# Idempotent: safe to re-run. Creates the venv, installs the package, seeds a
# demo DB, runs the test suite, and reports which cameras this machine can see.
# Everything it creates (.venv, data/, .env) is gitignored and machine-local.

set -u

cd "$(dirname "$0")/.." || exit 1
echo "Phantom bootstrap — $(pwd)"
echo

# ---------------------------------------------------------------- 1. python
PY=""
for candidate in python3.13 python3.12 python3; do
    if command -v "$candidate" &> /dev/null; then
        ver=$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        major=${ver%%.*}; minor=${ver##*.}
        if [ "$major" -eq 3 ] && [ "$minor" -ge 12 ]; then PY="$candidate"; break; fi
    fi
done
if [ -z "$PY" ]; then
    echo "✗ Need Python 3.12+. Install it:  brew install python@3.12"
    exit 1
fi
echo "✓ Python: $PY ($($PY --version 2>&1))"

# ------------------------------------------------------------------ 2. venv
if [ ! -x .venv/bin/python ]; then
    echo "• creating .venv ..."
    "$PY" -m venv .venv || { echo "✗ venv creation failed"; exit 1; }
else
    echo "✓ .venv already present"
fi

echo "• installing dependencies (this can take a minute) ..."
if ! .venv/bin/pip install -q --upgrade pip; then
    echo "✗ pip upgrade failed"; exit 1
fi
if ! .venv/bin/pip install -q -e ".[dev]"; then
    echo "✗ dependency install failed"; exit 1
fi
echo "✓ dependencies installed"

# ------------------------------------------------------------------- 3. .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ created .env from .env.example (edit it to add a VLM key)"
else
    echo "✓ .env already present (left untouched)"
fi

# ------------------------------------------------------------- 4. demo data
mkdir -p data
if .venv/bin/python scripts/seed_demo.py --reset > /dev/null 2>&1; then
    echo "✓ demo data seeded into data/phantom.db"
else
    echo "• demo seeding skipped (non-fatal)"
fi

# ----------------------------------------------------------------- 5. tests
echo
echo "• running test suite ..."
.venv/bin/pytest -q 2>&1 | tail -3

# ---------------------------------------------------------------- 6. cameras
echo
echo "• cameras visible to this machine:"
.venv/bin/python scripts/list_cameras.py --max 6 2>&1 \
    | grep -vE "WARN:|global |OpenCV:" | sed 's/^/    /'

# ------------------------------------------------------------------ 7. next
cat <<'EOF'

----------------------------------------------------------------------
Ready. Useful commands:

  Run the engine on recorded fixtures (no camera, no VLM needed):
    PHANTOM_CAMERA_SOURCE=replay PHANTOM_VLM_PROVIDER=mock make run
    curl localhost:8000/api/objects
    curl "localhost:8000/api/query?q=bottle"

  Check a camera + measure motion thresholds:
    .venv/bin/python scripts/check_camera.py --source iphone --index <N>

  Run against the iPhone (index from the camera list above):
    PHANTOM_CAMERA_SOURCE=iphone PHANTOM_CAMERA_INDEX=<N> make run

If the iPhone is NOT in the camera list above, see docs/working/dhwanit.md §E
(Continuity Camera needs the same Apple ID on both devices; Camo over USB is
the fallback that works regardless).
----------------------------------------------------------------------
EOF

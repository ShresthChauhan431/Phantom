#!/bin/bash
# Phantom — one-command setup on a fresh machine.
#
#   bash scripts/bootstrap.sh
#
# Idempotent: safe to re-run. Creates the venv, installs the package, runs the
# test suite, and reports which cameras this machine can see. Seeds NO data:
# memory is filled only by the live engine.
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

# ---------------------------------------------------------- 4. data dir
# No demo seeding: memory is filled only by the live engine (scripts/run_all.py
# starts each session empty). scripts/seed_demo.py remains for API tests only.
mkdir -p data
echo "✓ data/ ready (memory starts empty; the live engine fills it)"

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
Ready. Run Phantom live (iPhone camera + VLM + workspace page):

    python3 scripts/run_all.py
    # then open http://localhost:5173/pages/workspace.html

Needs PHANTOM_CLOUD_VLM_KEY in .env. Each session starts with empty
memory; everything shown is what the camera saw and the VLM described.

If the iPhone is NOT in the camera list above, see docs/working/dhwanit.md §E
(Continuity Camera needs the same Apple ID on both devices).
----------------------------------------------------------------------
EOF

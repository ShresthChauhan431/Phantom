#!/usr/bin/env python3
"""Start Phantom live: iPhone camera -> gate -> VLM -> memory -> workspace page.

Phantom runs as two processes:

  1. ENGINE — `python -m apps.engine.main`. One process hosting the perception
     loop (camera -> gate -> VLM -> SQLite, the single writer) and the read-only
     HTTP API on :8000. The loop starts on its own: it opens the phone camera,
     asks the VLM what is on the desk, then watches for changes.
  2. DASHBOARD — `apps/dashboard/serve.py` on :5173. Serves the UI and proxies
     /api/* to the engine, so the browser stays same-origin.

LIVE ONLY. This launcher refuses the offline test paths (mock VLM, replayed
frames) and starts every session with an EMPTY memory, so everything the
workspace shows was observed by the camera and described by the VLM in this run.
The previous session's memory is kept as data/live.prev.db.

It reports ready only after verifying, from the engine's own telemetry, that the
phone camera is streaming and the VLM has answered — not merely that a process
was launched.

Usage
    python3 scripts/run_all.py            # live session, fresh memory
    python3 scripts/run_all.py --keep     # continue the previous session's memory
    python3 scripts/run_all.py --check    # start, verify camera + VLM, then exit
    python3 scripts/run_all.py --vlm nvidia

Settings come from .env (API key, model). Calibrated gate defaults are applied
only where .env does not set a value.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENV_PY = ROOT / ".venv" / "bin" / "python"
LIVE_DB = ROOT / "data" / "live.db"
ENGINE_PORT = 8000
WEB_PORT = 5173

LIVE_CAMERAS = ("iphone", "android")
LIVE_VLMS = ("groq", "nvidia", "local")

# Measured on the mounted iPhone over a still desk. The live stream's edge shimmer
# (object outlines flickering 25-90 grey levels while nothing moves) reached 4.9%
# of pixels against the reference frame and produced fake "moves". A 9px opening
# erases those 1-3px outlines: still-scene drift fell to <=0.0021 while a real
# object move still scored >=0.0076. Thresholds sit between the two.
CALIBRATED_DEFAULTS = {
    "PHANTOM_GATE_OPEN_KSIZE": "9",
    "PHANTOM_MOTION_THRESHOLD": "0.005",
    "PHANTOM_CHANGE_THRESHOLD": "0.006",
    "PHANTOM_SETTLE_SECONDS": "2",
}

RESET, DIM, BOLD = "\033[0m", "\033[2m", "\033[1m"
GREEN, RED, YELLOW, BLUE = "\033[32m", "\033[31m", "\033[33m", "\033[36m"

processes: list[tuple[str, subprocess.Popen]] = []
shutting_down = threading.Event()


# --------------------------------------------------------------------- helpers
def ok(msg: str) -> None:
    print(f"{GREEN}✓{RESET} {msg}", flush=True)


def fail(msg: str) -> None:
    print(f"{RED}✗{RESET} {msg}", flush=True)


def python_exe() -> str:
    return str(VENV_PY) if VENV_PY.is_file() else sys.executable


def read_dotenv() -> dict[str, str]:
    """Parse .env the same way the engine does (comments and quotes stripped)."""
    values: dict[str, str] = {}
    path = ROOT / ".env"
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.split("#", 1)[0].strip().strip("'\"")
    return values


def port_owner(port: int) -> str | None:
    """Who is listening on `port`, if anyone.

    Probes IPv4 and IPv6 separately: node/Vite binds [::1] only, so an IPv4-only
    check reports the port as free and the conflict is missed.
    """
    listening = False
    for family, address in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        try:
            with socket.socket(family, socket.SOCK_STREAM) as probe:
                probe.settimeout(0.4)
                if probe.connect_ex((address, port)) == 0:
                    listening = True
                    break
        except OSError:
            continue
    if not listening:
        return None
    try:
        out = subprocess.run(
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN"],
            capture_output=True, text=True, timeout=6, check=False,
        ).stdout.splitlines()
        if len(out) > 1:
            fields = out[1].split()
            return f"{fields[0]} (pid {fields[1]})"
    except (OSError, subprocess.SubprocessError):
        pass
    return "something"


def get_json(url: str, timeout: float = 4.0) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError, ValueError):
        return None


def engine_alive() -> bool:
    return all(proc.poll() is None for name, proc in processes if name == "engine")


def stream(name: str, colour: str, proc: subprocess.Popen) -> None:
    """Relay a child's output with a prefix so two logs stay readable."""
    if proc.stdout is None:
        return
    for raw in iter(proc.stdout.readline, b""):
        if shutting_down.is_set():
            return
        line = raw.decode("utf-8", "replace").rstrip()
        # The API access log is one line per poll; it drowns out what matters.
        if line and '"GET /api/' not in line:
            print(f"{colour}[{name}]{RESET} {line}", flush=True)


def spawn(name: str, colour: str, argv: list[str], env: dict) -> subprocess.Popen:
    proc = subprocess.Popen(
        argv, cwd=str(ROOT), env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=0,
    )
    processes.append((name, proc))
    threading.Thread(target=stream, args=(name, colour, proc), daemon=True).start()
    return proc


def shutdown(*_args) -> None:
    if shutting_down.is_set():
        return
    shutting_down.set()
    print(f"\n{DIM}stopping…{RESET}")
    for _name, proc in reversed(processes):
        if proc.poll() is None:
            proc.terminate()
    for _name, proc in reversed(processes):
        try:
            proc.wait(timeout=6)
        except subprocess.TimeoutExpired:
            proc.kill()
    # The engine's Swift capture helper is a grandchild; make sure it goes too,
    # or it keeps holding the phone camera.
    subprocess.run(["pkill", "-f", "iphone_stream.swift"], check=False, capture_output=True)
    print(f"{DIM}stopped.{RESET}")


def fresh_session_db(keep: bool) -> Path:
    """Start from empty memory unless --keep; keep one backup of the last session."""
    LIVE_DB.parent.mkdir(parents=True, exist_ok=True)
    if keep:
        return LIVE_DB
    previous = LIVE_DB.with_name("live.prev.db")
    for suffix in ("", "-wal", "-shm"):
        src = Path(str(LIVE_DB) + suffix)
        dst = Path(str(previous) + suffix)
        if dst.exists():
            dst.unlink()
        if src.exists():
            shutil.move(str(src), str(dst))
    return LIVE_DB


# -------------------------------------------------------------- verification
def wait_for_engine(api: str, timeout: float) -> dict | None:
    """Wait for the API, then for the camera to stream and the VLM to answer."""
    deadline = time.monotonic() + timeout
    phase = "api"
    last: dict | None = None
    while time.monotonic() < deadline and not shutting_down.is_set():
        if not engine_alive():
            fail("engine exited — see [engine] output above")
            return None
        if phase == "api":
            if get_json(f"{api}/health"):
                ok(f"engine API up on {api}")
                phase = "camera"
        else:
            status = get_json(f"{api}/engine")
            if status:
                last = status
                if status.get("state") == "error":
                    fail(f"engine error: {status.get('error')}")
                    return None
                camera = status.get("camera", {})
                if phase == "camera" and camera.get("streaming"):
                    ok(f"camera streaming: {camera.get('device') or camera.get('source')} "
                       f"({camera.get('resolution')})")
                    phase = "vlm"
                if phase == "vlm":
                    vlm = status.get("vlm", {})
                    if status.get("scans", {}).get("count", 0) >= 1:
                        ok(f"VLM answered: {vlm.get('provider')} / {vlm.get('model')} "
                           f"in {vlm.get('last_latency_ms')}ms")
                        return status
                    if vlm.get("failures"):
                        fail(f"VLM call failed: {vlm.get('last_error')}")
                        return status
        time.sleep(0.5)
    if last:
        fail(f"timed out in phase '{phase}' — engine state: {last.get('state')} "
             f"{last.get('error') or ''}")
    else:
        fail(f"timed out waiting for the engine ({phase})")
    return None


# ------------------------------------------------------------------------ main
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run Phantom live: phone camera, engine, VLM and dashboard.",
    )
    parser.add_argument("--camera", choices=LIVE_CAMERAS, help="overrides .env (default iphone)")
    parser.add_argument("--vlm", choices=LIVE_VLMS, help="overrides .env (default groq)")
    parser.add_argument("--keep", action="store_true",
                        help="continue the previous session's memory instead of starting empty")
    parser.add_argument("--engine-port", type=int, default=ENGINE_PORT)
    parser.add_argument("--web-port", type=int, default=WEB_PORT)
    parser.add_argument("--check", action="store_true",
                        help="start, verify camera + VLM end to end, then exit")
    args = parser.parse_args()

    print(f"{BOLD}Phantom — live{RESET}  {DIM}{ROOT}{RESET}\n")

    # ---------------------------------------------------------- preflight
    if not VENV_PY.is_file():
        fail("no .venv — run:  bash scripts/bootstrap.sh")
        return 1
    dotenv = read_dotenv()
    camera = args.camera or dotenv.get("PHANTOM_CAMERA_SOURCE") or "iphone"
    vlm = args.vlm or dotenv.get("PHANTOM_VLM_PROVIDER") or "groq"

    if camera not in LIVE_CAMERAS:
        fail(f"PHANTOM_CAMERA_SOURCE={camera!r} is not a live camera. "
             f"Set it to one of {LIVE_CAMERAS} in .env.")
        return 1
    if vlm not in LIVE_VLMS:
        fail(f"PHANTOM_VLM_PROVIDER={vlm!r} is not a real model. "
             f"Set it to one of {LIVE_VLMS} in .env.")
        return 1
    if vlm in ("groq", "nvidia") and not (
        os.environ.get("PHANTOM_CLOUD_VLM_KEY") or dotenv.get("PHANTOM_CLOUD_VLM_KEY")
    ):
        fail(f"{vlm} needs an API key: set PHANTOM_CLOUD_VLM_KEY in .env")
        return 1

    conflicts = False
    for label, port in (("engine", args.engine_port), ("dashboard", args.web_port)):
        owner = port_owner(port)
        if owner:
            fail(f"port {port} ({label}) is already used by {owner}")
            conflicts = True
    if conflicts:
        print(
            "\n  Stop the other process first, or pick free ports:\n"
            "    python3 scripts/run_all.py --engine-port 8001 --web-port 5174\n"
            "  To stop a stray Phantom:  pkill -f apps.engine.main; pkill -f serve.py\n"
            "  A Vite/node dev server will NOT proxy /api — use this script."
        )
        return 1

    db = fresh_session_db(args.keep)
    ok(f"memory: {db.relative_to(ROOT)} "
       f"({'continuing previous session' if args.keep else 'fresh, empty'})")

    # ------------------------------------------------------------- engine
    env = os.environ.copy()
    env.update(
        PHANTOM_CAMERA_SOURCE=camera,
        PHANTOM_VLM_PROVIDER=vlm,
        PHANTOM_DB_PATH=str(db),
        PHANTOM_API_PORT=str(args.engine_port),
    )
    env.pop("PHANTOM_DISABLE_LOOP", None)  # the loop is the point
    for key, value in CALIBRATED_DEFAULTS.items():
        if key not in env and key not in dotenv:
            env[key] = value

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print(f"{BLUE}[engine]{RESET} starting — camera={camera}, vlm={vlm}, "
          f"motion={env.get('PHANTOM_MOTION_THRESHOLD', dotenv.get('PHANTOM_MOTION_THRESHOLD'))}")
    spawn("engine", BLUE, [python_exe(), "-m", "apps.engine.main"], env)

    api = f"http://localhost:{args.engine_port}/api"
    # First start compiles the Swift capture helper and waits out auto-exposure.
    status = wait_for_engine(api, timeout=180)
    if status is None or status.get("vlm", {}).get("failures") and not status.get("scans", {}).get("count"):
        shutdown()
        return 1

    objects = get_json(f"{api}/objects") or []
    if objects:
        ok(f"VLM sees {len(objects)} object(s): " + ", ".join(o["key"] for o in objects[:8]))
    else:
        print(f"{YELLOW}!{RESET} VLM sees no objects yet — put something on the desk")

    # ---------------------------------------------------------- dashboard
    spawn("web", YELLOW, [
        python_exe(), str(ROOT / "apps" / "dashboard" / "serve.py"),
        "--port", str(args.web_port),
        "--engine", f"http://localhost:{args.engine_port}",
    ], env)
    base = f"http://localhost:{args.web_port}"
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline and not get_json(f"{base}/api/health"):
        time.sleep(0.4)
    if not get_json(f"{base}/api/health"):
        fail("dashboard did not come up — see [web] output above")
        shutdown()
        return 1
    ok(f"dashboard on {base} (proxying /api to :{args.engine_port})")

    print(
        f"\n{BOLD}Ready — live{RESET}\n"
        f"  Workspace   {base}/pages/workspace.html\n"
        f"  Phantom     {base}/pages/phantom.html\n"
        f"  Telemetry   {base}/api/engine\n"
        f"\n  The engine is already watching. Move an object; within a few seconds\n"
        f"  the VLM describes the change and the workspace shows it.\n"
        f"  Press 'Start Monitoring' on the page to see the iPhone's live video.\n"
    )

    if args.check:
        ok("--check: camera, VLM and dashboard verified")
        shutdown()
        return 0

    print(f"{DIM}Ctrl-C to stop.{RESET}\n")
    try:
        while not shutting_down.is_set():
            for name, proc in processes:
                if proc.poll() is not None:
                    fail(f"{name} exited ({proc.returncode}) — shutting down")
                    shutdown()
                    return 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

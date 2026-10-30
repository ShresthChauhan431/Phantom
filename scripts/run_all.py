#!/usr/bin/env python3
"""Start the whole of Phantom: engine (API + perception loop) and dashboard.

Phantom runs as two processes:

  1. ENGINE — `python -m apps.engine.main`. One process hosting both the
     perception loop (camera -> gate -> VLM -> SQLite, the single writer) and the
     read-only HTTP API on :8000. There is no separate "backend": the API and the
     loop live together, because commits happen in-process, never over HTTP.
  2. DASHBOARD — `apps/dashboard/serve.py` on :5173. Serves the static UI and
     proxies /api/* to the engine, so the browser stays same-origin and the engine
     needs no CORS configuration.

This script starts both in the right order, waits until each actually answers,
prints what is running, streams both logs with prefixes, and shuts both down
cleanly on Ctrl-C.

Usage
    python3 scripts/run_all.py                      # .env settings
    python3 scripts/run_all.py --camera replay --vlm mock   # no phone, no API key
    python3 scripts/run_all.py --check              # start, verify, exit (CI/smoke)
    python3 scripts/run_all.py --no-loop            # API only, over seeded data

Options are applied on top of .env, so .env stays the source of truth.
"""

from __future__ import annotations

import argparse
import os
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
ENGINE_PORT = 8000
WEB_PORT = 5173

RESET, DIM, BOLD = "\033[0m", "\033[2m", "\033[1m"
GREEN, RED, YELLOW, BLUE = "\033[32m", "\033[31m", "\033[33m", "\033[36m"

processes: list[tuple[str, subprocess.Popen]] = []
shutting_down = threading.Event()


# --------------------------------------------------------------------- helpers
def python_exe() -> str:
    """Prefer the project venv; fall back to the current interpreter."""
    return str(VENV_PY) if VENV_PY.is_file() else sys.executable


def port_owner(port: int) -> str | None:
    """Who is listening on `port`, if anyone. Returns a short description.

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


def wait_for(url: str, timeout: float, label: str) -> bool:
    """Poll `url` until it answers or we run out of patience."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if shutting_down.is_set():
            return False
        try:
            with urllib.request.urlopen(url, timeout=3) as response:  # noqa: S310
                if response.status < 500:
                    return True
        except urllib.error.HTTPError:
            return True  # answering at all is enough
        except Exception:  # noqa: BLE001 - not up yet
            pass
        # Surface an early crash instead of waiting out the whole timeout.
        for name, proc in processes:
            if name == label and proc.poll() is not None:
                return False
        time.sleep(0.4)
    return False


def stream(name: str, colour: str, proc: subprocess.Popen) -> None:
    """Relay a child's output with a prefix so two logs stay readable."""
    if proc.stdout is None:
        return
    for raw in iter(proc.stdout.readline, b""):
        if shutting_down.is_set():
            return
        line = raw.decode("utf-8", "replace").rstrip()
        if line:
            print(f"{colour}[{name}]{RESET} {line}", flush=True)


def spawn(name: str, colour: str, argv: list[str], env: dict) -> subprocess.Popen:
    proc = subprocess.Popen(
        argv, cwd=str(ROOT), env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=1,
    )
    processes.append((name, proc))
    threading.Thread(target=stream, args=(name, colour, proc), daemon=True).start()
    return proc


def shutdown(*_args) -> None:
    if shutting_down.is_set():
        return
    shutting_down.set()
    print(f"\n{DIM}stopping…{RESET}")
    for name, proc in reversed(processes):
        if proc.poll() is None:
            proc.terminate()
    for name, proc in reversed(processes):
        try:
            proc.wait(timeout=6)
        except subprocess.TimeoutExpired:
            proc.kill()
    # The engine's Swift capture helper is a grandchild; make sure it goes too.
    subprocess.run(["pkill", "-f", "iphone_stream.swift"], check=False,
                   capture_output=True)
    print(f"{DIM}stopped.{RESET}")


# ------------------------------------------------------------------------ main
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the Phantom engine and dashboard together.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--camera", help="iphone | android | replay (overrides .env)")
    parser.add_argument("--vlm", help="groq | nvidia | local | mock (overrides .env)")
    parser.add_argument("--motion", help="motion threshold, e.g. 0.01")
    parser.add_argument("--engine-port", type=int, default=ENGINE_PORT)
    parser.add_argument("--web-port", type=int, default=WEB_PORT)
    parser.add_argument("--no-loop", action="store_true",
                        help="API only: serve existing memory, do not capture")
    parser.add_argument("--check", action="store_true",
                        help="start, verify both are healthy, then exit")
    args = parser.parse_args()

    print(f"{BOLD}Phantom{RESET}  {DIM}{ROOT}{RESET}\n")

    # ---------------------------------------------------------- preflight
    if not VENV_PY.is_file():
        print(f"{RED}✗{RESET} no .venv — run:  bash scripts/bootstrap.sh")
        return 1
    if not (ROOT / ".env").is_file():
        print(f"{YELLOW}!{RESET} no .env — copying .env.example")
        (ROOT / ".env").write_text((ROOT / ".env.example").read_text())

    conflicts = False
    for label, port in (("engine", args.engine_port), ("dashboard", args.web_port)):
        owner = port_owner(port)
        if owner:
            print(f"{RED}✗{RESET} port {port} ({label}) is already used by {owner}")
            conflicts = True
    if conflicts:
        print(
            f"\n  Stop the other process first, or pick free ports:\n"
            f"    python3 scripts/run_all.py --engine-port 8001 --web-port 5174\n"
            f"  To stop a stray Phantom:  pkill -f apps.engine.main; pkill -f serve.py\n"
            f"  A Vite/node dev server on {args.web_port} will NOT proxy /api — use this script."
        )
        return 1

    # ------------------------------------------------------------- engine
    env = os.environ.copy()
    if args.camera:
        env["PHANTOM_CAMERA_SOURCE"] = args.camera
    if args.vlm:
        env["PHANTOM_VLM_PROVIDER"] = args.vlm
    if args.motion:
        env["PHANTOM_MOTION_THRESHOLD"] = args.motion
    if args.no_loop:
        env["PHANTOM_DISABLE_LOOP"] = "1"
    env["PHANTOM_API_PORT"] = str(args.engine_port)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print(f"{BLUE}[engine]{RESET} starting (camera={env.get('PHANTOM_CAMERA_SOURCE', 'from .env')}, "
          f"vlm={env.get('PHANTOM_VLM_PROVIDER', 'from .env')}"
          f"{', loop disabled' if args.no_loop else ''})")
    spawn("engine", BLUE, [python_exe(), "-m", "apps.engine.main"], env)

    health = f"http://localhost:{args.engine_port}/api/health"
    # The iPhone bridge compiles a Swift helper and waits for auto-exposure, so
    # first start can take a while.
    if not wait_for(health, 120, "engine"):
        print(f"{RED}✗{RESET} engine did not come up — see [engine] output above")
        shutdown()
        return 1
    print(f"{GREEN}✓{RESET} engine healthy on :{args.engine_port}")

    # ---------------------------------------------------------- dashboard
    print(f"{YELLOW}[web]{RESET} starting")
    spawn("web", YELLOW, [
        python_exe(), str(ROOT / "apps" / "dashboard" / "serve.py"),
        "--port", str(args.web_port),
        "--engine", f"http://localhost:{args.engine_port}",
    ], env)

    page = f"http://localhost:{args.web_port}/pages/workspace.html"
    if not wait_for(page, 30, "web"):
        print(f"{RED}✗{RESET} dashboard did not come up — see [web] output above")
        shutdown()
        return 1
    print(f"{GREEN}✓{RESET} dashboard serving on :{args.web_port}")

    base = f"http://localhost:{args.web_port}"
    print(
        f"\n{BOLD}Ready{RESET}\n"
        f"  Workspace   {base}/pages/workspace.html\n"
        f"  Phantom     {base}/pages/phantom.html\n"
        f"  Landing     {base}/\n"
        f"  Engine API  {base}/api/objects   {DIM}(proxied to :{args.engine_port}){RESET}\n"
        f"\n  {DIM}Press ~ in the browser to inspect endpoints.{RESET}\n"
        f"  {DIM}Verify services:  python3 apps/dashboard/scripts/status_check.py{RESET}\n"
    )

    if args.check:
        print(f"{GREEN}✓{RESET} --check: both services verified")
        shutdown()
        return 0

    print(f"{DIM}Ctrl-C to stop both.{RESET}\n")
    try:
        while not shutting_down.is_set():
            for name, proc in processes:
                if proc.poll() is not None:
                    print(f"{RED}✗{RESET} {name} exited ({proc.returncode}) — shutting down")
                    shutdown()
                    return 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

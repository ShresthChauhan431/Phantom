"""
Phantom Engine — main entry point.

Starts the full backend in one process:
  * the perception loop (Track A): capture -> gate -> understand -> commit, the
    single writer, running in a background daemon thread;
  * the read-only HTTP API (Track B), bound to the *same* ``MemoryStore`` so queries
    see what the loop commits (SQLite WAL + a write lock make the sharing safe);
  * two read-only engine routes, mounted here beside the Track B API:
      GET /api/engine          live telemetry (camera, gate, VLM, scans)
      GET /api/engine/events   the trigger log: every VLM result the loop committed

Set ``PHANTOM_DISABLE_LOOP=1`` to serve the API only (e.g. over a previous session)
without starting the capture loop.

Run: `python -m apps.engine.main`  (or `make run`, or `python3 scripts/run_all.py`).
"""
from __future__ import annotations

import logging
import os
import threading

import uvicorn
from core.memory.store import MemoryStore
from fastapi import FastAPI, Query

from .api import create_api
from .config import Config
from .loop import EngineLoop, build_loop

log = logging.getLogger("phantom.engine")


def _run_loop(loop: EngineLoop) -> None:
    """Run the perception loop, logging (not crashing the process) on failure."""
    try:
        loop.run()
    except NotImplementedError as exc:
        loop.monitor.set_state("error", f"capture source not available: {exc}")
        log.warning("capture source not available, loop stopped: %s", exc)
    except Exception as exc:  # keep the API alive even if the loop dies
        loop.monitor.set_state("error", f"perception loop crashed: {exc}")
        log.exception("perception loop crashed")


def mount_engine_routes(app: FastAPI, store: MemoryStore, loop: EngineLoop | None) -> None:
    """Read-only engine telemetry. Commits still happen only in the loop."""

    @app.get("/api/engine")
    def engine_status() -> dict:
        if loop is None:
            return {"state": "disabled", "error": "perception loop disabled (PHANTOM_DISABLE_LOOP)"}
        return loop.monitor.snapshot(objects_in_memory=len(store.all()))

    @app.get("/api/engine/events")
    def engine_events(
        since: int = Query(0, ge=0),
        limit: int = Query(200, ge=1, le=1000),
    ) -> dict:
        if loop is None:
            return {"session": None, "events": []}
        return {
            "session": loop.monitor.session,
            "events": loop.monitor.events_since(since, limit),
        }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    config = Config.from_env()
    port = int(os.environ.get("PHANTOM_API_PORT", "8000"))

    print("🔮 Phantom Engine Starting...")
    print(f"📷 Camera: {config.camera_source}   🧠 VLM: {config.vlm_provider} ({config.cloud_model})")
    print(f"💾 Memory: {config.db_path}")
    print(f"📡 API:  http://localhost:{port}/api/health")
    if config.vlm_provider.lower() == "mock" or config.camera_source.lower() == "replay":
        print("⚠️  NOT LIVE: mock VLM and/or replayed frames — results are not observations.")

    # One store, shared by the writer (loop) and the readers (API).
    store = MemoryStore(config.db_path)

    # INTEGRATION HOOK (Track A): build the capture->gate->understand->commit loop and
    # run it in a background thread. The API reads the same store and serves frames
    # from the loop's live RAM buffer. PHANTOM_DISABLE_LOOP=1 serves the API only.
    loop: EngineLoop | None = None
    frame_source = None
    if os.environ.get("PHANTOM_DISABLE_LOOP", "").lower() not in ("1", "true", "yes"):
        loop = build_loop(store, config)
        frame_source = loop.get_frame_png  # serves reveal frames from the RAM buffer
        threading.Thread(
            target=_run_loop, args=(loop,), name="phantom-loop", daemon=True
        ).start()
    else:
        log.info("PHANTOM_DISABLE_LOOP set — serving API only, perception loop not started")

    app = create_api(store, frame_source=frame_source)
    mount_engine_routes(app, store, loop)
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()

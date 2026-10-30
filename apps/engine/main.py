"""
Phantom Engine — main entry point.

Starts the full backend in one process:
  * the perception loop (Track A): capture -> gate -> understand -> commit, the
    single writer, running in a background daemon thread;
  * the read-only HTTP API (Track B), bound to the *same* ``MemoryStore`` so queries
    see what the loop commits (SQLite WAL + a write lock make the sharing safe).

Set ``PHANTOM_DISABLE_LOOP=1`` to serve the API only (e.g. over seeded data) without
starting the capture loop.

Run: `python -m apps.engine.main`  (or `make run`).
"""
from __future__ import annotations

import logging
import os
import threading

import uvicorn
from core.memory.store import MemoryStore

from .api import create_api
from .config import Config
from .loop import EngineLoop, build_loop, encode_frame

log = logging.getLogger("phantom.engine")


def _frame_source(loop: EngineLoop):
    """A frame_ref -> PNG resolver backed by the loop's live RAM buffer.

    Resilient: returns None (→ 404) if the frame was evicted or a concurrent
    buffer mutation trips us up, so the API never crashes serving a stale ref.
    """
    def resolve(frame_ref: str) -> bytes | None:
        try:
            frame = loop.buffer.get(frame_ref)
        except Exception:  # transient races with the writer thread
            return None
        return encode_frame(frame) if frame is not None else None

    return resolve


def _run_loop(loop: EngineLoop) -> None:
    """Run the perception loop, logging (not crashing the process) on failure."""
    try:
        loop.run()
    except NotImplementedError as exc:
        log.warning("capture source not available, loop stopped: %s", exc)
    except Exception:  # keep the API alive even if the loop dies
        log.exception("perception loop crashed")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    config = Config.from_env()

    print("🔮 Phantom Engine Starting...")
    print(f"📷 Camera: {config.camera_source}   🧠 VLM: {config.vlm_provider}")
    print("📡 API:  http://localhost:8000/api/health")
    print("📚 Docs: http://localhost:8000/docs")

    # One store, shared by the writer (loop) and the readers (API).
    store = MemoryStore(config.db_path)

    # INTEGRATION HOOK (Track A): build the capture->gate->understand->commit loop and
    # run it in a background thread. The API reads the same store and serves frames
    # from the loop's live RAM buffer. PHANTOM_DISABLE_LOOP=1 serves the API only.
    frame_source = None
    if os.environ.get("PHANTOM_DISABLE_LOOP", "").lower() not in ("1", "true", "yes"):
        loop = build_loop(store, config)
        frame_source = _frame_source(loop)
        threading.Thread(
            target=_run_loop, args=(loop,), name="phantom-loop", daemon=True
        ).start()
    else:
        log.info("PHANTOM_DISABLE_LOOP set — serving API only, perception loop not started")

    app = create_api(store, frame_source=frame_source)
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PHANTOM_API_PORT", "8000")))


if __name__ == "__main__":
    main()

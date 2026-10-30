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
from .loop import build_loop

log = logging.getLogger("phantom.engine")


def _run_loop(store: MemoryStore, config: Config) -> None:
    """Run the perception loop, logging (not crashing the process) on failure."""
    try:
        build_loop(store, config).run()
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

    # INTEGRATION HOOK (Track A): start the capture->gate->understand->commit loop
    # in a background thread. The API below is read-only against the same store.
    if os.environ.get("PHANTOM_DISABLE_LOOP", "").lower() not in ("1", "true", "yes"):
        threading.Thread(
            target=_run_loop, args=(store, config), name="phantom-loop", daemon=True
        ).start()
    else:
        log.info("PHANTOM_DISABLE_LOOP set — serving API only, perception loop not started")

    app = create_api(store)
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PHANTOM_API_PORT", "8000")))


if __name__ == "__main__":
    main()

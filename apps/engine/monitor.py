"""Engine telemetry and the trigger log — what the engine actually did, live.

The perception loop runs in a background thread; the read-only API answers in
others. This module is the thread-safe hand-off between them:

  * a status snapshot — camera streaming state, the gate's real motion score, VLM
    call counts and latency, last error — served at ``GET /api/engine``;
  * an append-only trigger log of every Delta the VLM produced and the loop
    committed, served at ``GET /api/engine/events``.

Nothing here is computed for display. Every value is recorded at the moment the
loop does the corresponding work, so the UI shows the engine's own facts rather
than a browser-side imitation of them.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

from core.understand.schema.delta import Delta

_LOG_SIZE = 1000


def _iso(ts: datetime | None) -> str | None:
    return ts.isoformat() if ts else None


class EngineMonitor:
    """Thread-safe live state of one perception loop."""

    def __init__(self, *, provider: str, model: str, camera_source: str) -> None:
        self._lock = threading.Lock()
        self._started_mono = time.monotonic()
        self.started_at = datetime.now(timezone.utc)
        # Changes on every engine start, so clients can tell a restart (and reset
        # their read cursor) from a quiet period.
        self.session = self.started_at.strftime("%Y%m%dT%H%M%S.%f")

        self.state = "starting"  # starting | scanning | watching | reconnecting | error | stopped
        self.error: str | None = None
        self.loop_restarts = 0
        self.last_restart_reason: str | None = None
        self.last_restart_at: str | None = None
        self._key_status = None

        self.camera: dict[str, Any] = {
            "source": camera_source,
            "device": None,
            "frames": 0,
            "resolution": None,
        }
        self._last_frame_mono: float | None = None
        self._capture_interval = 2.0

        self.gate: dict[str, Any] = {
            "motion_score": 0.0,
            "motion_threshold": None,
            "change_threshold": None,
            "settle_seconds": None,
            "state": "idle",
            "promoted": 0,
            "discarded_transients": 0,
        }
        self.vlm: dict[str, Any] = {
            "provider": provider,
            "model": model,
            "calls": 0,
            "failures": 0,
            "last_call_at": None,
            "last_latency_ms": None,
            "last_kind": None,
            "last_error": None,
        }
        self.scans: dict[str, Any] = {"count": 0, "last_at": None, "last_object_count": None}

        self._events: deque[dict[str, Any]] = deque(maxlen=_LOG_SIZE)
        self._seq = 0

    # ------------------------------------------------------------- recording
    def configure(self, *, motion_threshold: float, change_threshold: float,
                  settle_seconds: float, capture_interval: float) -> None:
        with self._lock:
            self.gate.update(
                motion_threshold=motion_threshold,
                change_threshold=change_threshold,
                settle_seconds=settle_seconds,
            )
            self._capture_interval = capture_interval

    def set_state(self, state: str, error: str | None = None) -> None:
        with self._lock:
            self.state = state
            self.error = error

    def restarted(self, count: int, reason: str) -> None:
        """Record that the supervisor restarted the loop (it never stops by itself)."""
        with self._lock:
            self.loop_restarts = count
            self.last_restart_reason = reason[:300]
            self.last_restart_at = datetime.now(timezone.utc).isoformat()

    def attach_keys(self, status_fn) -> None:
        """Callable returning the provider's key-pool status, shown in telemetry."""
        self._key_status = status_fn

    def frame(self, *, width: int, height: int, device: str | None) -> None:
        with self._lock:
            self.camera["frames"] += 1
            self.camera["resolution"] = f"{width}x{height}"
            if device:
                self.camera["device"] = device
            self._last_frame_mono = time.monotonic()

    def gate_reading(self, *, score: float, state: str, promoted: int, discarded: int) -> None:
        with self._lock:
            self.gate.update(
                motion_score=round(score, 5),
                state=state,
                promoted=promoted,
                discarded_transients=discarded,
            )

    def vlm_call(self, *, kind: str, latency_ms: int, error: str | None = None) -> None:
        with self._lock:
            self.vlm["calls"] += 1
            self.vlm["last_call_at"] = datetime.now(timezone.utc).isoformat()
            self.vlm["last_latency_ms"] = latency_ms
            self.vlm["last_kind"] = kind
            if error:
                self.vlm["failures"] += 1
                self.vlm["last_error"] = error[:300]

    def scan_done(self, object_count: int) -> None:
        with self._lock:
            self.scans["count"] += 1
            self.scans["last_at"] = datetime.now(timezone.utc).isoformat()
            self.scans["last_object_count"] = object_count

    def trigger(self, *, kind: str, delta: Delta, latency_ms: int, status: str | None) -> None:
        """Append one committed VLM result to the trigger log."""
        with self._lock:
            self._seq += 1
            self._events.append(
                {
                    "seq": self._seq,
                    "kind": kind,  # startup_scan | scan | change
                    "event": delta.event,
                    "object": delta.object,
                    "from": delta.from_,
                    "to": delta.to,
                    "relations": list(delta.relations),
                    "confidence": delta.confidence,
                    "bbox": delta.bbox.model_dump() if delta.bbox else None,
                    "frame_ref": delta.frame_ref,
                    "observed_at": _iso(delta.observed_at),
                    "status": status,
                    "vlm_latency_ms": latency_ms,
                    "model": self.vlm["model"],
                }
            )

    # --------------------------------------------------------------- reading
    def snapshot(self, *, objects_in_memory: int | None = None) -> dict[str, Any]:
        with self._lock:
            age = (
                time.monotonic() - self._last_frame_mono
                if self._last_frame_mono is not None
                else None
            )
            # "Streaming" is a measured fact: a frame arrived within a few intervals.
            streaming = age is not None and age < max(3 * self._capture_interval, 5.0)
            vlm = dict(self.vlm)
            restarts = {
                "count": self.loop_restarts,
                "last_reason": self.last_restart_reason,
                "last_at": self.last_restart_at,
            }
        # Read outside our lock: the key pool has its own.
        if self._key_status is not None:
            try:
                vlm["keys"] = self._key_status()
            except Exception:  # noqa: BLE001 - telemetry must never break the API
                vlm["keys"] = None
        with self._lock:
            return {
                "session": self.session,
                "state": self.state,
                "error": self.error,
                "started_at": self.started_at.isoformat(),
                "uptime_s": round(time.monotonic() - self._started_mono, 1),
                "camera": {
                    **self.camera,
                    "streaming": streaming,
                    "last_frame_age_s": round(age, 2) if age is not None else None,
                    "capture_interval_s": self._capture_interval,
                },
                "gate": dict(self.gate),
                "vlm": vlm,
                "loop": restarts,
                "scans": dict(self.scans),
                "triggers": {"count": self._seq},
                "memory": {"objects": objects_in_memory},
            }

    def events_since(self, seq: int = 0, limit: int = 200) -> list[dict[str, Any]]:
        """Trigger-log entries with ``seq`` greater than the given cursor, oldest first."""
        with self._lock:
            newer = [e for e in self._events if e["seq"] > seq]
        return newer[-limit:]

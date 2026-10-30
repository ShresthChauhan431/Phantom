"""Engine configuration — the perception side of ``.env`` (shared-contracts §9).

Holds the knobs the loop needs: which camera source, which VLM provider, capture
timing, retention, and tuning for the gate/debounce/escalation. Parsed from the
process environment, with a tiny built-in ``.env`` loader so we take on no extra
dependency (``.env.example`` documents every key).

``.env`` values never override variables already set in the real environment, so
``PHANTOM_CAMERA_SOURCE=replay make run`` still wins over the file.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]


def load_dotenv(path: str | Path | None = None) -> None:
    """Populate ``os.environ`` from a ``.env`` file without clobbering real env vars."""
    env_path = Path(path) if path else _REPO_ROOT / ".env"
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        # Strip inline comments and surrounding quotes from the value.
        value = value.split("#", 1)[0].strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


def _get(key: str, default: str) -> str:
    return os.environ.get(key, default)


@dataclass(slots=True)
class Config:
    # Capture
    camera_source: str = "replay"  # android | iphone | replay
    capture_interval: float = 2.0
    replay_dir: str = "tests/fixtures/frames"
    camera_index: int = 0  # device index for iphone / usb webcam-bridge
    camera_url: str = ""  # stream URL for android IP-webcam apps
    # How to capture from an iPhone: "bridge" uses the Swift/AVFoundation helper
    # (the only path that reaches a Continuity Camera); "index" uses OpenCV by
    # device index, for a webcam-bridge app such as Camo.
    iphone_capture: str = "bridge"
    iphone_unique_id: str = ""  # pin a specific AVFoundation device, optional

    # Buffer / retention
    retention_hours: float = 168.0
    buffer_capacity: int = 256

    # VLM
    vlm_provider: str = "mock"  # local | nvidia | groq | mock
    ollama_model: str = "qwen2.5-vl:latest"
    ollama_host: str = "http://localhost:11434"
    cloud_vlm_key: str = ""
    cloud_model: str = "qwen/qwen3.8-27b"
    escalate_threshold: float = 0.7

    # Gate / debounce tuning
    motion_threshold: float = 0.02
    # How long the scene must hold still before a change is considered finished.
    # This is a *duration*, because what matters physically is outlasting a human
    # pause: measured on real footage, a 0.6s window captured a hand hovering
    # mid-reach and reported it as a change, while 1.8s let the hand withdraw first
    # so the transient filter could discard it. Frames are derived from the capture
    # interval, so the behaviour holds at any frame rate.
    settle_seconds: float = 2.0
    # Explicit frame-count override; 0 means derive from settle_seconds.
    settle_frames: int = 0
    # How different the settled scene must be from before the motion to count as a
    # real change. Filters out transient human motion: a hand reaching in scores
    # higher frame-to-frame than an actual object move, but leaves the scene
    # unchanged once withdrawn. Defaults to motion_threshold when unset.
    change_threshold: float = 0.0

    # Loop
    heartbeat_minutes: float = 7.0
    db_path: str = "data/phantom.db"

    @property
    def retention_seconds(self) -> float:
        return self.retention_hours * 3600.0

    @property
    def effective_settle_frames(self) -> int:
        """Quiet frames required to call a change finished.

        Derived from ``settle_seconds`` and the capture interval so the settle
        *duration* stays correct at any frame rate; ``settle_frames`` overrides it
        when set explicitly.
        """
        if self.settle_frames > 0:
            return self.settle_frames
        interval = max(self.capture_interval, 0.01)
        return max(1, math.ceil(self.settle_seconds / interval))

    @classmethod
    def from_env(cls, *, load_file: bool = True) -> Config:
        if load_file:
            load_dotenv()
        return cls(
            camera_source=_get("PHANTOM_CAMERA_SOURCE", "replay"),
            capture_interval=float(_get("PHANTOM_CAPTURE_INTERVAL", "2")),
            replay_dir=_get("PHANTOM_REPLAY_DIR", "tests/fixtures/frames"),
            camera_index=int(_get("PHANTOM_CAMERA_INDEX", "0")),
            camera_url=_get("PHANTOM_CAMERA_URL", ""),
            iphone_capture=_get("PHANTOM_IPHONE_CAPTURE", "bridge"),
            iphone_unique_id=_get("PHANTOM_IPHONE_UNIQUE_ID", ""),
            retention_hours=float(_get("PHANTOM_RETENTION_HOURS", "168")),
            buffer_capacity=int(_get("PHANTOM_BUFFER_CAPACITY", "256")),
            vlm_provider=_get("PHANTOM_VLM_PROVIDER", "mock"),
            ollama_model=_get("OLLAMA_MODEL", "qwen2.5-vl:latest"),
            ollama_host=_get("OLLAMA_HOST", "http://localhost:11434"),
            cloud_vlm_key=_get("PHANTOM_CLOUD_VLM_KEY", ""),
            cloud_model=_get("PHANTOM_CLOUD_MODEL", "qwen/qwen3.8-27b"),
            escalate_threshold=float(_get("PHANTOM_ESCALATE_THRESHOLD", "0.7")),
            motion_threshold=float(_get("PHANTOM_MOTION_THRESHOLD", "0.02")),
            settle_seconds=float(_get("PHANTOM_SETTLE_SECONDS", "2")),
            settle_frames=int(_get("PHANTOM_SETTLE_FRAMES", "0")),
            change_threshold=float(_get("PHANTOM_CHANGE_THRESHOLD", "0")),
            heartbeat_minutes=float(_get("PHANTOM_HEARTBEAT_MINUTES", "7")),
            db_path=_get("PHANTOM_DB_PATH", "data/phantom.db"),
        )

"""Engine configuration — the perception side of ``.env`` (shared-contracts §9).

Holds the knobs the loop needs: which camera source, which VLM provider, capture
timing, retention, and tuning for the gate/debounce/escalation. Parsed from the
process environment, with a tiny built-in ``.env`` loader so we take on no extra
dependency (``.env.example`` documents every key).

``.env`` values never override variables already set in the real environment, so
``PHANTOM_CAMERA_SOURCE=replay make run`` still wins over the file.
"""

from __future__ import annotations

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

    # Buffer / retention
    retention_hours: float = 168.0
    buffer_capacity: int = 256

    # VLM
    vlm_provider: str = "mock"  # local | nvidia | groq | mock
    ollama_model: str = "qwen2.5-vl:latest"
    ollama_host: str = "http://localhost:11434"
    cloud_vlm_key: str = ""
    cloud_model: str = "meta/llama-3.2-11b-vision-instruct"
    escalate_threshold: float = 0.7

    # Gate / debounce tuning
    motion_threshold: float = 0.02
    settle_frames: int = 1

    # Loop
    heartbeat_minutes: float = 7.0
    db_path: str = "data/phantom.db"

    @property
    def retention_seconds(self) -> float:
        return self.retention_hours * 3600.0

    @classmethod
    def from_env(cls, *, load_file: bool = True) -> Config:
        if load_file:
            load_dotenv()
        return cls(
            camera_source=_get("PHANTOM_CAMERA_SOURCE", "replay"),
            capture_interval=float(_get("PHANTOM_CAPTURE_INTERVAL", "2")),
            replay_dir=_get("PHANTOM_REPLAY_DIR", "tests/fixtures/frames"),
            retention_hours=float(_get("PHANTOM_RETENTION_HOURS", "168")),
            buffer_capacity=int(_get("PHANTOM_BUFFER_CAPACITY", "256")),
            vlm_provider=_get("PHANTOM_VLM_PROVIDER", "mock"),
            ollama_model=_get("OLLAMA_MODEL", "qwen2.5-vl:latest"),
            ollama_host=_get("OLLAMA_HOST", "http://localhost:11434"),
            cloud_vlm_key=_get("PHANTOM_CLOUD_VLM_KEY", ""),
            cloud_model=_get("PHANTOM_CLOUD_MODEL", "meta/llama-3.2-11b-vision-instruct"),
            escalate_threshold=float(_get("PHANTOM_ESCALATE_THRESHOLD", "0.7")),
            motion_threshold=float(_get("PHANTOM_MOTION_THRESHOLD", "0.02")),
            settle_frames=int(_get("PHANTOM_SETTLE_FRAMES", "1")),
            heartbeat_minutes=float(_get("PHANTOM_HEARTBEAT_MINUTES", "7")),
            db_path=_get("PHANTOM_DB_PATH", "data/phantom.db"),
        )

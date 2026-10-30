"""Android capture adapter (scrcpy/adb).

STATUS: M3 spike placeholder (shared-contracts §8, dhwanit.md §E). Getting scrcpy
2.x ``--video-source=camera`` frames into OpenCV on macOS needs a short spike. Until
that lands, this raises a clear error so the factory and config paths are complete
and callers fall back to ``replay`` for development.
"""

from __future__ import annotations

from .base import Frame


class AndroidCamera:
    """Placeholder ``Camera`` for an Android phone over USB (scrcpy/adb)."""

    def __init__(self, device: str | None = None, interval: float = 2.0) -> None:
        self.device = device
        self.interval = interval

    def open(self) -> None:
        raise NotImplementedError(
            "Android capture is not implemented yet (M3 spike). "
            "Use PHANTOM_CAMERA_SOURCE=replay for development. See dhwanit.md §E."
        )

    def read(self) -> Frame | None:
        raise NotImplementedError("Android capture is not implemented yet (M3 spike).")

    def close(self) -> None:
        return None

"""iPhone capture adapter (Continuity Camera).

STATUS: M3 spike placeholder (shared-contracts §8, dhwanit.md §E). An iPhone over
USB usually appears as an AVFoundation device OpenCV can open by index; the spike is
to confirm the index + resolution. Until verified, this raises a clear error so the
factory/config paths are complete and development falls back to ``replay``.
"""

from __future__ import annotations

from datetime import datetime, timezone

import cv2

from .base import Frame


class IPhoneCamera:
    """Placeholder ``Camera`` for an iPhone Continuity Camera (AVFoundation device)."""

    def __init__(self, device_index: int = 0, interval: float = 2.0) -> None:
        self.device_index = device_index
        self.interval = interval
        self._cap: cv2.VideoCapture | None = None
        self._seq = 0

    def open(self) -> None:
        raise NotImplementedError(
            "iPhone capture is not verified yet (M3 spike). Confirm the AVFoundation "
            "device index/resolution, then wire it here. Use PHANTOM_CAMERA_SOURCE=replay "
            "for development. See dhwanit.md §E."
        )

    def read(self) -> Frame | None:
        if self._cap is None:
            raise RuntimeError("IPhoneCamera.read() called before open()")
        ok, image = self._cap.read()
        if not ok:
            return None
        frame = Frame(image=image, seq=self._seq, ts=datetime.now(timezone.utc))
        self._seq += 1
        return frame

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

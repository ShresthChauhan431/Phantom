"""OpenCV-backed capture for real devices (index or stream URL).

A single `Camera` implementation that wraps `cv2.VideoCapture`, which can open:
  * an integer **device index** — iPhone Continuity Camera and USB webcam-bridge
    apps (Iriun/DroidCam) show up this way on macOS (AVFoundation);
  * a **stream URL** — Android "IP Webcam"-style apps expose an MJPEG/RTSP feed
    (e.g. ``http://<phone-ip>:8080/video``).

The engine loop pulls one frame per capture interval, so `read()` returns the
freshest frame and keeps the driver buffer shallow (``BUFFERSIZE=1`` + a short
warmup) to avoid serving stale, laggy frames.
"""

from __future__ import annotations

from datetime import datetime, timezone

import cv2

from .base import Frame


class OpenCVCamera:
    """Capture from any source `cv2.VideoCapture` understands (index or URL)."""

    def __init__(
        self,
        source: int | str,
        *,
        interval: float = 2.0,
        backend: int | None = None,
        warmup_frames: int = 5,
    ) -> None:
        self.source = source
        self.interval = interval
        self.backend = backend
        self.warmup_frames = warmup_frames
        self._cap: cv2.VideoCapture | None = None
        self._seq = 0

    def open(self) -> None:
        cap = (
            cv2.VideoCapture(self.source, self.backend)
            if self.backend is not None
            else cv2.VideoCapture(self.source)
        )
        if not cap.isOpened():
            cap.release()
            raise RuntimeError(
                f"could not open camera source {self.source!r}. "
                "Check the device is connected/streaming and the index/URL is right "
                "(try `python scripts/list_cameras.py` to list device indices)."
            )
        # Keep the latest frame only, so a slow consumer doesn't lag behind.
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        for _ in range(self.warmup_frames):  # let auto-exposure/white-balance settle
            cap.read()
        self._cap = cap
        self._seq = 0

    def read(self) -> Frame | None:
        if self._cap is None:
            raise RuntimeError("OpenCVCamera.read() called before open()")
        ok, image = self._cap.read()
        if not ok or image is None:
            return None
        frame = Frame(image=image, seq=self._seq, ts=datetime.now(timezone.utc))
        self._seq += 1
        return frame

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

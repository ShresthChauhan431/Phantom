"""Replay capture adapter — the dev fallback (replaces the webcam).

Replays a folder of recorded phone frames (``*.png`` / ``*.jpg``) in filename order,
so the gate + understand stages can be built and tested with no phone attached.
This is the source used by ``PHANTOM_CAMERA_SOURCE=replay``.

Reading image files from disk here is fine: these are *test/dev fixtures the
developer chose to record*, not live camera output. The no-disk rule applies to
frames the running camera sees in production, which live only in the RAM buffer.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import cv2

from .base import Frame

_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".bmp"}


class ReplayCamera:
    """A ``Camera`` that yields frames from a directory of images.

    Frames are returned one per ``read()`` call, in sorted filename order, each
    stamped with a synthetic timestamp spaced ``interval`` seconds apart so the
    gate/debounce timing logic behaves as it would against a live source.
    """

    def __init__(
        self,
        frames_dir: str | Path,
        *,
        interval: float = 2.0,
        loop: bool = False,
        start_ts: datetime | None = None,
    ) -> None:
        self.frames_dir = Path(frames_dir)
        self.interval = interval
        self.loop = loop
        self._start_ts = start_ts or datetime.now(timezone.utc)
        self._paths: list[Path] = []
        self._index = 0

    def open(self) -> None:
        if not self.frames_dir.is_dir():
            raise FileNotFoundError(f"replay frames dir not found: {self.frames_dir}")
        self._paths = sorted(
            p for p in self.frames_dir.iterdir() if p.suffix.lower() in _IMAGE_SUFFIXES
        )
        if not self._paths:
            raise FileNotFoundError(f"no replayable images in {self.frames_dir}")
        self._index = 0

    def read(self) -> Frame | None:
        if not self._paths:
            raise RuntimeError("ReplayCamera.read() called before open()")
        if self._index >= len(self._paths):
            if not self.loop:
                return None
            self._index = 0
        path = self._paths[self._index]
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError(f"failed to decode image: {path}")
        frame = Frame(
            image=image,
            seq=self._index,
            ts=self._start_ts + timedelta(seconds=self.interval * self._index),
        )
        self._index += 1
        return frame

    def close(self) -> None:
        self._paths = []
        self._index = 0

    def __len__(self) -> int:
        return len(self._paths)

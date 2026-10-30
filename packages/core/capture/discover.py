"""Probe which camera device indices are openable (to help pick the right one).

iPhone Continuity Camera and webcam-bridge apps appear as numbered AVFoundation
devices on macOS; their index isn't predictable, so this scans 0..max_index and
reports which open plus their resolution. Used by ``scripts/list_cameras.py``.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

import cv2


@dataclass(slots=True)
class CameraInfo:
    index: int
    width: int
    height: int


def _backend() -> int | None:
    return cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else None


def list_cameras(max_index: int = 8) -> list[CameraInfo]:
    """Return info for every openable camera index in ``[0, max_index)``."""
    backend = _backend()
    found: list[CameraInfo] = []
    for index in range(max_index):
        cap = cv2.VideoCapture(index, backend) if backend is not None else cv2.VideoCapture(index)
        try:
            if cap.isOpened():
                ok, frame = cap.read()
                if ok and frame is not None:
                    h, w = frame.shape[:2]
                    found.append(CameraInfo(index=index, width=w, height=h))
        finally:
            cap.release()
    return found

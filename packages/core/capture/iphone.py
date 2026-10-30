"""iPhone capture via Continuity Camera (AVFoundation device).

On macOS an iPhone (same Apple ID, nearby or on USB) shows up as a numbered
AVFoundation camera that OpenCV opens by index — so capture is the generic
``OpenCVCamera`` with the AVFoundation backend. The only unknown is the index;
run ``python scripts/list_cameras.py`` to find it, then set ``PHANTOM_CAMERA_INDEX``.
"""

from __future__ import annotations

import sys

import cv2

from .opencv_camera import OpenCVCamera


class IPhoneCamera(OpenCVCamera):
    """Continuity Camera as a frame source (AVFoundation index on macOS)."""

    def __init__(self, device_index: int = 0, interval: float = 2.0) -> None:
        backend = cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else None
        super().__init__(device_index, interval=interval, backend=backend)
        self.device_index = device_index

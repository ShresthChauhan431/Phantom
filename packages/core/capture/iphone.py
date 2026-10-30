"""iPhone capture — two routes, neither requiring a matching Apple ID.

Continuity Camera is *not* the only way in, and it is unusable when the Mac and the
iPhone are signed into different Apple IDs (Apple requires the same account; there
is no override). So this adapter accepts either:

  1. **Virtual camera index** (USB, recommended) — a bridge app such as Camo presents
     the iPhone to macOS as a normal camera device, so OpenCV opens it by index just
     like Continuity Camera would. Set ``PHANTOM_CAMERA_INDEX``.
     Find the index with ``python scripts/list_cameras.py``.
  2. **Stream URL** (Wi-Fi, no Mac-side driver) — an RTSP/MJPEG camera app on the
     phone publishes a URL that OpenCV opens directly. Set ``PHANTOM_CAMERA_URL``,
     e.g. ``rtsp://192.168.1.42:8554/live`` or ``http://192.168.1.42:8080/video``.

Route 2 is the most robust for OpenCV because it avoids macOS virtual-camera
enumeration entirely; route 1 keeps everything on the cable.
"""

from __future__ import annotations

import sys

import cv2

from .opencv_camera import OpenCVCamera


class IPhoneCamera(OpenCVCamera):
    """iPhone as a frame source, via a virtual-camera index or a stream URL."""

    def __init__(
        self,
        device_index: int = 0,
        interval: float = 2.0,
        url: str | None = None,
    ) -> None:
        if url:
            # URLs are decoded by FFMPEG, not AVFoundation — let OpenCV choose.
            super().__init__(url, interval=interval, backend=None)
        else:
            backend = cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else None
            super().__init__(device_index, interval=interval, backend=backend)
        self.url = url
        self.device_index = device_index

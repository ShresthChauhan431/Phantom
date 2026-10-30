"""Android capture.

Two supported routes into OpenCV on macOS (scrcpy can't pipe camera frames to
Python directly here — see dhwanit.md §E):

  1. **Stream URL** (recommended, wireless): an "IP Webcam"-style app on the phone
     exposes an MJPEG/RTSP feed. Point ``PHANTOM_CAMERA_URL`` at it, e.g.
     ``http://192.168.1.42:8080/video``. OpenCV opens the URL directly.
  2. **USB webcam bridge**: an app like Iriun/DroidCam presents the phone as a
     normal camera device; set ``PHANTOM_CAMERA_INDEX`` to its index
     (``python scripts/list_cameras.py`` to find it).

``scripts/setup_android.sh`` covers the adb/scrcpy preflight for the USB route.
"""

from __future__ import annotations

from .opencv_camera import OpenCVCamera


class AndroidCamera(OpenCVCamera):
    """Android phone camera via a stream URL or a USB webcam-bridge index."""

    def __init__(
        self,
        url: str | None = None,
        device_index: int = 0,
        interval: float = 2.0,
    ) -> None:
        if url:
            source: int | str = url
        else:
            source = device_index
        super().__init__(source, interval=interval)
        self.url = url
        self.device_index = device_index

    def open(self) -> None:
        if not self.url and self.device_index is None:
            raise RuntimeError(
                "Android capture needs a source: set PHANTOM_CAMERA_URL (IP Webcam app) "
                "or PHANTOM_CAMERA_INDEX (USB webcam-bridge app). See dhwanit.md §E."
            )
        super().open()

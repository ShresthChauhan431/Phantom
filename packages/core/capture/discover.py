"""Probe which camera device indices are openable (to help pick the right one).

A bridged iPhone (Camo and friends) or a Continuity Camera appears as a numbered
AVFoundation device on macOS, and the number isn't predictable — so this scans
0..max_index and reports which indices open plus their resolution. Device *names*
are read separately from ``system_profiler`` so you can tell the built-in camera
apart from the phone. Used by ``scripts/list_cameras.py``.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from dataclasses import dataclass

import cv2


@dataclass(slots=True)
class CameraInfo:
    index: int
    width: int
    height: int
    name: str = ""


def _backend() -> int | None:
    return cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else None


def _first_good_frame(cap: cv2.VideoCapture, attempts: int = 15, pause: float = 0.1):
    """Read until the device actually delivers a frame, or give up.

    A freshly opened AVFoundation device is not streaming yet, so the first
    ``read()`` routinely fails even though the camera is perfectly usable — a
    Continuity Camera is especially slow to start. Concluding "unopenable" from a
    single failed read reports a working camera as missing, so retry briefly.
    """
    for _ in range(attempts):
        ok, frame = cap.read()
        if ok and frame is not None:
            return frame
        time.sleep(pause)
    return None


def list_cameras(max_index: int = 8) -> list[CameraInfo]:
    """Return info for every openable camera index in ``[0, max_index)``.

    Each entry carries the device *name* where macOS can supply one. OpenCV can
    only address cameras by index and cannot report names, which with two 1080p
    cameras attached makes it impossible to tell a built-in camera from an iPhone.
    macOS lists devices in the same AVFoundation order OpenCV indexes them, so the
    names are zipped onto the probed indices. Cross-check with
    ``swift scripts/avf_devices.swift``, which reads AVFoundation directly.
    """
    backend = _backend()
    names = list_device_names()
    found: list[CameraInfo] = []
    for index in range(max_index):
        cap = cv2.VideoCapture(index, backend) if backend is not None else cv2.VideoCapture(index)
        try:
            if cap.isOpened():
                frame = _first_good_frame(cap)
                if frame is not None:
                    h, w = frame.shape[:2]
                    found.append(
                        CameraInfo(
                            index=index,
                            width=w,
                            height=h,
                            name=names[index] if index < len(names) else "",
                        )
                    )
        finally:
            cap.release()
    return found


def list_device_names() -> list[str]:
    """Camera device names macOS reports, for correlating with indices.

    Informational only: ``system_profiler`` ordering is not guaranteed to match
    OpenCV's index ordering, but the names tell you whether the phone bridge is
    registered at all. Returns ``[]`` off macOS or if the probe fails.
    """
    if sys.platform != "darwin":
        return []
    try:
        out = subprocess.run(
            ["system_profiler", "-json", "SPCameraDataType"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        data = json.loads(out.stdout or "{}")
    except (OSError, json.JSONDecodeError, subprocess.SubprocessError):
        return []
    names: list[str] = []
    for entry in data.get("SPCameraDataType", []):
        name = entry.get("_name") or entry.get("spcamera_model-id")
        if name:
            names.append(str(name))
    return names

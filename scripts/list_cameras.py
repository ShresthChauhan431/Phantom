#!/usr/bin/env python3
"""List camera indices with device names, and verify which camera an index opens.

OpenCV addresses cameras only by index and cannot report their names, so with a
built-in camera and an iPhone both presenting 1080p there is no way to tell them
apart from Python alone. This pairs each probed index with the name macOS reports.

Usage:
    python scripts/list_cameras.py                 # list indices + names
    python scripts/list_cameras.py --only 1        # open ONLY index 1 for a while,
                                                   # so you can see which camera's
                                                   # indicator light turns on
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.capture.discover import list_cameras, list_device_names


def _verify_only(index: int, seconds: float) -> None:
    """Hold a single index open so the user can confirm it by indicator light."""
    import cv2

    names = list_device_names()
    label = names[index] if index < len(names) else "(name unknown)"
    print(f"Opening ONLY index {index} — macOS calls this: {label}")
    print(f"Holding it open for {seconds:.0f}s. Watch which camera's light comes on.")
    print("(If your MacBook's built-in camera lights up, this index is NOT the iPhone.)\n")

    backend = cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else None
    cap = cv2.VideoCapture(index, backend) if backend is not None else cv2.VideoCapture(index)
    if not cap.isOpened():
        print(f"✗ index {index} would not open.")
        return
    deadline = time.monotonic() + seconds
    frames, brightness = 0, 0.0
    try:
        while time.monotonic() < deadline:
            ok, fr = cap.read()
            if ok and fr is not None:
                frames += 1
                brightness = float(fr.mean())
            time.sleep(0.1)
    finally:
        cap.release()
    print(f"✓ delivered {frames} frames, last mean brightness {brightness:.1f}")
    print(f"If the light you saw was the iPhone, use:  PHANTOM_CAMERA_INDEX={index}")


def main() -> None:
    parser = argparse.ArgumentParser(description="List / verify camera indices.")
    parser.add_argument("--max", type=int, default=8, help="highest index to probe (exclusive)")
    parser.add_argument("--only", type=int, default=None, help="open just this index, to verify it")
    parser.add_argument("--seconds", type=float, default=10.0, help="how long --only holds open")
    args = parser.parse_args()

    if args.only is not None:
        _verify_only(args.only, args.seconds)
        return

    cams = list_cameras(max_index=args.max)
    if not cams:
        print("No openable camera indices found. Connect the device, grant camera")
        print("permission (System Settings > Privacy & Security > Camera), and retry.")
        return

    print(f"Openable cameras ({len(cams)}):")
    for c in cams:
        print(f"  index {c.index}: {c.width}x{c.height}  {c.name or '(name unknown)'}")

    iphones = [c for c in cams if "iphone" in c.name.lower()]
    print()
    if iphones:
        idx = iphones[0].index
        print(f"iPhone detected at index {idx}:")
        print(f"  export PHANTOM_CAMERA_SOURCE=iphone PHANTOM_CAMERA_INDEX={idx}")
        print(f"  confirm it by LED:  python scripts/list_cameras.py --only {idx}")
    else:
        print("No iPhone among the names above. For Continuity Camera both devices")
        print("need the same Apple ID; see docs/working/dhwanit.md §E for fallbacks.")
    print("Authoritative cross-check:  swift scripts/avf_devices.swift")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""List openable camera device indices (to pick PHANTOM_CAMERA_INDEX).

Usage:
    python scripts/list_cameras.py [--max N]

Connect your iPhone (Continuity Camera) or a USB webcam-bridge app first, then run
this to see which index to point the engine at.
"""
from __future__ import annotations

import argparse

from core.capture.discover import list_cameras


def main() -> None:
    parser = argparse.ArgumentParser(description="List openable camera indices.")
    parser.add_argument("--max", type=int, default=8, help="highest index to probe (exclusive)")
    args = parser.parse_args()

    cams = list_cameras(max_index=args.max)
    if not cams:
        print("No cameras found. Connect the device, grant camera permission, and retry.")
        return
    print(f"Found {len(cams)} camera(s):")
    for c in cams:
        print(f"  index {c.index}: {c.width}x{c.height}")
    print("\nSet the one you want:  export PHANTOM_CAMERA_INDEX=<index>")


if __name__ == "__main__":
    main()

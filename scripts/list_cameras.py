#!/usr/bin/env python3
"""List openable camera device indices (to pick PHANTOM_CAMERA_INDEX).

Usage:
    python scripts/list_cameras.py [--max N]

Connect the phone first (via a bridge app such as Camo over USB), then run this to
see which index to point the engine at. Device names are listed too, so you can tell
the Mac's built-in camera apart from the phone.
"""
from __future__ import annotations

import argparse

from core.capture.discover import list_cameras, list_device_names


def main() -> None:
    parser = argparse.ArgumentParser(description="List openable camera indices.")
    parser.add_argument("--max", type=int, default=8, help="highest index to probe (exclusive)")
    args = parser.parse_args()

    names = list_device_names()
    if names:
        print("Cameras macOS reports:")
        for n in names:
            print(f"  • {n}")
        print()

    cams = list_cameras(max_index=args.max)
    if not cams:
        print("No openable camera indices found. Connect the device, grant camera")
        print("permission (System Settings > Privacy & Security > Camera), and retry.")
        return

    print(f"Openable indices ({len(cams)}):")
    for c in cams:
        print(f"  index {c.index}: {c.width}x{c.height}")
    print("\nSet the one you want:  export PHANTOM_CAMERA_INDEX=<index>")
    if len(cams) == 1:
        print("Only one camera found — if that's the Mac's built-in, the phone bridge")
        print("isn't registered yet (see docs/working/dhwanit.md §E).")


if __name__ == "__main__":
    main()

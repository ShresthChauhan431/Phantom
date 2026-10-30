#!/usr/bin/env python3
"""Watch the gate decide, live: transient motion vs real object change.

Prints one line per frame showing the frame-to-frame motion and, whenever motion
settles, whether the scene actually differs from before. This makes the transient
filter visible: wave a hand over the desk and it reports DISCARDED; move an object
and it reports a real CHANGE (which is what calls the VLM).

No VLM calls, nothing written to disk.

Usage:
    python scripts/watch_gate.py --seconds 60
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.gate.debounce import Debouncer
from core.gate.differ import MotionGate

from apps.engine.config import Config
from apps.engine.loop import build_camera


def main() -> int:
    parser = argparse.ArgumentParser(description="Live view of gate decisions.")
    parser.add_argument("--source", default=None, help="override PHANTOM_CAMERA_SOURCE")
    parser.add_argument("--seconds", type=float, default=60.0, help="how long to watch")
    parser.add_argument("--interval", type=float, default=0.6, help="seconds between frames")
    parser.add_argument("--threshold", type=float, default=None, help="motion threshold")
    args = parser.parse_args()

    config = Config.from_env()
    if args.source:
        config.camera_source = args.source
    threshold = args.threshold if args.threshold is not None else config.motion_threshold

    gate = MotionGate(motion_threshold=threshold)
    deb = Debouncer(gate, settle_frames=config.effective_settle_frames,
                    change_threshold=config.change_threshold or None)

    camera = build_camera(config)
    print(f"camera={config.camera_source}  motion_threshold={threshold}  "
          f"change_threshold={deb.change_threshold}")
    camera.open()
    print("\nwatching — try: (1) wave a hand WITHOUT moving anything, "
          "(2) then move an object\n")

    prev = None
    deadline = time.monotonic() + args.seconds
    try:
        while time.monotonic() < deadline:
            frame = camera.read()
            if frame is None:
                continue
            motion = gate.score(prev, frame) if prev is not None else 0.0
            prev = frame
            reference = deb.reference
            before = deb.state

            end_state = deb.feed(frame)

            tag = ""
            if end_state is not None:
                diff = gate.score(reference, end_state) if reference is not None else 0.0
                tag = f"  >>> REAL CHANGE (scene differs by {diff:.5f}) -> VLM"
            elif before == "moving" and deb.state == "idle":
                tag = "  ... settled but scene unchanged -> DISCARDED (transient)"
            elif motion > threshold:
                tag = "  motion"

            print(f"  motion={motion:.5f}  state={deb.state:6s}{tag}")
            time.sleep(args.interval)
    finally:
        camera.close()

    print("\n--- summary ---")
    print(f"  real changes promoted : {deb.promoted}")
    print(f"  transients discarded  : {deb.discarded_transients}")
    if deb.discarded_transients:
        print("\n✓ transient motion was filtered out — those never reach the VLM")
        print("  and never enter history.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

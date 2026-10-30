#!/usr/bin/env python3
"""Live capture + gate check: prove frames flow, and measure motion thresholds.

Runs the **real** production path (`build_camera` -> `MotionGate` -> `Debouncer`)
against a live camera, so it serves two purposes:

  1. **Verification** — confirm a newly connected phone actually delivers frames.
  2. **Tuning** — synthetic fixtures have no sensor noise, but real cameras do. This
     measures the noise floor of a *still* scene and recommends a motion threshold
     above it, which is what `PHANTOM_MOTION_THRESHOLD` should be set to.

It runs in two phases:
  * **baseline** — keep the scene still; measures per-frame noise.
  * **watch**    — move an object; reports gate triggers and debounce promotions.

Nothing is written to disk; frames stay in memory.

Usage:
    python scripts/check_camera.py                         # replay fixtures
    python scripts/check_camera.py --source iphone --index 1
    python scripts/check_camera.py --source iphone --url rtsp://192.168.1.42:8554/live
"""
from __future__ import annotations

import argparse
import statistics
import sys
import time
from pathlib import Path

# `apps` is not an installed package (only `packages/` is), so make the repo root
# importable when this script is run directly.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.gate.debounce import Debouncer
from core.gate.differ import MotionGate

from apps.engine.config import Config
from apps.engine.loop import build_camera


def _collect(camera, gate, count: int, interval: float, label: str) -> list[float]:
    """Read ``count`` frames, returning the motion score between consecutive ones."""
    scores: list[float] = []
    prev = None
    for i in range(count):
        frame = camera.read()
        if frame is None:
            print(f"  [{label}] camera returned no frame (source exhausted/unavailable)")
            break
        if prev is not None:
            score = gate.score(prev, frame)
            scores.append(score)
            flag = "  <-- MOTION" if score > gate.motion_threshold else ""
            print(f"  [{label}] frame {i:3d}  motion={score:.5f}{flag}")
        prev = frame
        if interval:
            time.sleep(interval)
    return scores


def main() -> None:
    parser = argparse.ArgumentParser(description="Live capture + gate diagnostic.")
    parser.add_argument("--source", default="replay", help="replay | iphone | android")
    parser.add_argument("--index", type=int, default=0, help="camera device index")
    parser.add_argument("--url", default="", help="stream URL (RTSP/MJPEG)")
    parser.add_argument("--baseline", type=int, default=10, help="still frames to measure noise")
    parser.add_argument("--watch", type=int, default=15, help="frames to watch for motion")
    parser.add_argument("--interval", type=float, default=0.5, help="seconds between frames")
    parser.add_argument("--threshold", type=float, default=None, help="override motion threshold")
    args = parser.parse_args()

    config = Config(
        camera_source=args.source,
        camera_index=args.index,
        camera_url=args.url,
        capture_interval=args.interval,
    )
    camera = build_camera(config)
    gate = MotionGate(
        motion_threshold=args.threshold if args.threshold is not None else config.motion_threshold
    )
    debouncer = Debouncer(gate, settle_frames=config.settle_frames)

    print(f"Opening camera: source={args.source} index={args.index} url={args.url or '-'}")
    camera.open()
    try:
        first = camera.read()
        if first is None:
            print("FAILED: camera opened but delivered no frames.")
            return
        h, w = first.image.shape[:2]
        print(f"✓ frames flowing: {w}x{h}\n")

        print(f"PHASE 1 — baseline ({args.baseline} frames). Keep the scene STILL.")
        baseline = _collect(camera, gate, args.baseline, args.interval, "base")

        print(f"\nPHASE 2 — watch ({args.watch} frames). MOVE an object now.")
        promotions = 0
        watch: list[float] = []
        prev = None
        for i in range(args.watch):
            frame = camera.read()
            if frame is None:
                break
            if prev is not None:
                watch.append(gate.score(prev, frame))
            prev = frame
            if debouncer.feed(frame) is not None:
                promotions += 1
                print(f"  [watch] frame {i:3d}  >>> END-STATE PROMOTED (would call the VLM)")
            elif watch:
                print(f"  [watch] frame {i:3d}  motion={watch[-1]:.5f}")
            if args.interval:
                time.sleep(args.interval)
    finally:
        camera.close()

    print("\n--- summary ---")
    if baseline:
        # Controlled tests established that true sensor noise is absorbed by the
        # gate's blur (a static scene scores ~0.00000 even at sigma=20), while a real
        # object move scores ~0.05. So a high baseline is NOT noise to be thresholded
        # away — it means the scene itself moved or the camera was unstable.
        ordered = sorted(baseline)
        p90 = ordered[min(len(ordered) - 1, int(len(ordered) * 0.9))]
        median = statistics.median(baseline)
        print(f"baseline: median={median:.5f} p90={p90:.5f} max={max(baseline):.5f}")
        print(f"current threshold: {gate.motion_threshold}")

        # A threshold at or above a plausible object-move score makes the gate deaf.
        SAFE_CEILING = 0.04
        if p90 < 0.01:
            recommended = max(round(p90 * 2.5, 4), 0.005)
            print(f"✓ scene is genuinely static. Recommended threshold: {recommended}")
        else:
            print("DIAGNOSIS: the baseline is far above sensor noise, so the scene was")
            print("  not static — something moved in frame, or the camera itself moved")
            print("  (hand-held / nudged cable), or auto-exposure was still hunting.")
            print("  Do NOT raise the threshold to cover this: a real object move")
            print(f"  measures only ~0.05, so any threshold above ~{SAFE_CEILING} would")
            print("  make the gate miss real changes entirely.")
            print("  FIX: mount the camera so it cannot move, aim it at a still scene,")
            print("  stay out of frame, then re-run this script.")
    if watch:
        print(f"watch phase: peak motion={max(watch):.5f}, end-state promotions={promotions}")
    print("Nothing was written to disk.")


if __name__ == "__main__":
    main()

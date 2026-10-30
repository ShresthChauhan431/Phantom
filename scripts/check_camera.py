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
    debouncer = Debouncer(gate, settle_frames=config.effective_settle_frames)

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
        # gate's blur (a static scene scores ~0.00000 even at sigma=20). So the
        # *floor* is what characterises a still scene; isolated spikes are real
        # transient events (a hand reaching in, a shadow) and must not set the
        # threshold. Use the median as the floor — taking a slice of the run is
        # fragile, because a single transient inside that slice skews everything.
        ordered = sorted(baseline)
        floor = statistics.median(baseline)
        quiet = ordered[len(ordered) // 4]  # lower-quartile: the calmest frames
        peak = max(baseline)
        print(f"still scene  : quiet={quiet:.5f} median={floor:.5f} peak={peak:.5f}")
        print(f"threshold now: {gate.motion_threshold}")
        if watch:
            print(f"during motion: peak={max(watch):.5f}, promotions={promotions}")

        move_peak = max(watch) if watch else 0.0
        # Put the threshold between the still-scene floor and the observed move.
        suggested = max(round(max(floor * 2.0, quiet * 4.0), 4), 0.005)
        if move_peak and suggested >= move_peak:
            suggested = max(round(move_peak * 0.5, 4), 0.005)

        print(f"\nRECOMMENDED  : PHANTOM_MOTION_THRESHOLD={suggested}")
        if move_peak:
            ratio = move_peak / max(floor, 1e-6)
            print(f"  A real move scored {move_peak:.5f} vs a still median of {floor:.5f}")
            print(f"  ({ratio:.0f}x separation). {suggested} sits between them.")
            if move_peak < peak:
                print(f"  CAUTION: a still-scene spike ({peak:.5f}) exceeded the real move")
                print("  — that spike was a transient (hand/shadow in frame), not the")
                print("  camera. Keep the scene clear while the engine runs, or small")
                print("  moves will be indistinguishable from someone walking past.")
        else:
            print("  No motion was observed, so this is based on the still scene only.")
            print("  Re-run with --watch 14 and move an object to confirm separation.")
        if promotions:
            print("\n✓ a change was promoted to an end-state frame — this is what calls")
            print("  the VLM, so capture -> gate -> debounce is working end to end.")
    print("Nothing was written to disk.")


if __name__ == "__main__":
    main()

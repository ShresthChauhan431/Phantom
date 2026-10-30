#!/usr/bin/env python3
"""Identify which OpenCV camera index is the iPhone, by matching image content.

Why this exists: OpenCV addresses macOS cameras only by index and cannot report
names. The order macOS lists cameras in does NOT match OpenCV's index order, and
indicator lights are useless for this because macOS wakes the Continuity Camera
whenever any capture session starts — so both cameras can light up regardless of
which one is actually streaming.

So identify by content instead. Swift/AVFoundation can address the iPhone by its
unique ID; it captures a frame and prints an 8x8 luma fingerprint. This script
computes the same fingerprint for every OpenCV index and reports which one
correlates. Two cameras pointing in different directions produce very different
fingerprints, making the match unambiguous.

Nothing is written to disk.

Usage:
    python scripts/identify_iphone_index.py
"""
from __future__ import annotations

import re
import subprocess
import sys
import time
from pathlib import Path

import cv2
import numpy as np

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

GRID = 8


def iphone_fingerprint() -> tuple[np.ndarray, str]:
    """Capture from the iPhone via Swift and return its fingerprint + device name."""
    probe = REPO / "scripts" / "avf_capture_probe.swift"
    print("Capturing a reference frame from the iPhone via AVFoundation (Swift) ...")
    proc = subprocess.run(
        ["swift", str(probe)], capture_output=True, text=True, timeout=240, check=False
    )
    out = proc.stdout
    name_match = re.search(r"Target device : (.+)", out)
    sig_match = re.search(r"SIGNATURE: (.+)", out)
    if not sig_match:
        print(proc.stdout or "", proc.stderr or "")
        raise RuntimeError("Swift probe did not produce a fingerprint")
    values = [float(v) for v in sig_match.group(1).split()]
    return np.array(values, dtype=np.float64), (name_match.group(1).strip() if name_match else "?")


def opencv_fingerprint(index: int) -> np.ndarray | None:
    """Fingerprint whatever OpenCV serves at ``index``, or None if unusable."""
    backend = cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else None
    cap = cv2.VideoCapture(index, backend) if backend is not None else cv2.VideoCapture(index)
    try:
        if not cap.isOpened():
            return None
        frame = None
        deadline = time.monotonic() + 6.0
        reads = 0
        # Let the stream start and auto-exposure settle before fingerprinting.
        while time.monotonic() < deadline:
            ok, fr = cap.read()
            if ok and fr is not None:
                frame = fr
                reads += 1
                if reads >= 15:
                    break
            else:
                time.sleep(0.05)
        if frame is None:
            return None
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        cells = cv2.resize(gray, (GRID, GRID), interpolation=cv2.INTER_AREA)
        return cells.astype(np.float64).reshape(-1)
    finally:
        cap.release()


def correlate(a: np.ndarray, b: np.ndarray) -> float:
    """Normalized correlation, so absolute brightness/scale differences don't matter."""
    a = a - a.mean()
    b = b - b.mean()
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom else 0.0


def main() -> None:
    try:
        reference, device_name = iphone_fingerprint()
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as exc:
        print(f"✗ could not fingerprint the iPhone: {exc}")
        return
    print(f"✓ reference captured from: {device_name}\n")

    print("Fingerprinting each OpenCV index (hold the scene still) ...")
    scores: list[tuple[int, float]] = []
    for index in range(4):
        fp = opencv_fingerprint(index)
        if fp is None:
            print(f"  index {index}: not usable")
            continue
        score = correlate(reference, fp)
        scores.append((index, score))
        print(f"  index {index}: correlation with iPhone = {score:+.3f}")

    if not scores:
        print("\n✗ no usable OpenCV indices.")
        return

    best_index, best_score = max(scores, key=lambda t: t[1])
    print()
    if best_score < 0.5:
        print(f"✗ No OpenCV index matches the iPhone (best {best_score:+.3f} at {best_index}).")
        print("  OpenCV cannot reach the Continuity Camera from a plain Python process")
        print("  (it needs the NSCameraUseContinuityCameraDeviceType Info.plist opt-in).")
        print("  Use the Swift capture bridge instead — see docs/working/dhwanit.md §E.")
        return
    print(f"✓ iPhone is OpenCV index {best_index} (correlation {best_score:+.3f})")
    print(f"  export PHANTOM_CAMERA_SOURCE=iphone PHANTOM_CAMERA_INDEX={best_index}")


if __name__ == "__main__":
    main()

"""Generate deterministic synthetic fixture frames for the perception tests.

These are *not* camera images — they are flat, reproducible scenes built with
OpenCV so gate/understand tests are deterministic and no real footage is ever
committed. Re-run with ``python tests/fixtures/generate_frames.py`` to regenerate.

Staged scene (a desk, viewed top-down):
  000_empty         empty desk                      (baseline)
  001_empty         identical to 000                (static  -> no trigger)
  002_bottle        a "bottle" appears on the desk  (change  -> motion starts)
  003_bottle        identical to 002                (settled -> promote end-state)
  004_bottle_moved  the bottle has moved            (change  -> motion starts)
  005_bottle_moved  identical to 004                (settled -> promote end-state)
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

W, H = 640, 480
DESK = (90, 110, 120)  # BGR muted brown-grey backdrop (gray ~111)
# High-contrast object so a ~2-3% area change clears the motion threshold. The
# bottle's luminance differs from the desk by far more than the per-pixel delta.
BOTTLE = (30, 200, 255)  # BGR bright amber (gray ~180)

FRAMES_DIR = Path(__file__).parent / "frames"


def _desk() -> np.ndarray:
    img = np.full((H, W, 3), DESK, dtype=np.uint8)
    # A couple of static landmarks so the scene is not perfectly flat, but these
    # never move between frames so they contribute zero motion.
    cv2.rectangle(img, (40, 40), (120, 440), (70, 85, 95), -1)  # left edge of desk
    cv2.circle(img, (560, 80), 26, (60, 75, 85), -1)  # a fixed mug ring
    return img


def _with_bottle(center: tuple[int, int]) -> np.ndarray:
    img = _desk()
    cx, cy = center
    cv2.rectangle(img, (cx - 24, cy - 70), (cx + 24, cy + 70), BOTTLE, -1)
    cv2.rectangle(img, (cx - 14, cy - 95), (cx + 14, cy - 70), BOTTLE, -1)  # cap/neck
    return img


def generate() -> list[Path]:
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    scenes = {
        "000_empty": _desk(),
        "001_empty": _desk(),
        "002_bottle": _with_bottle((320, 240)),
        "003_bottle": _with_bottle((320, 240)),
        "004_bottle_moved": _with_bottle((470, 300)),
        "005_bottle_moved": _with_bottle((470, 300)),
    }
    written: list[Path] = []
    for name, img in scenes.items():
        path = FRAMES_DIR / f"{name}.png"
        cv2.imwrite(str(path), img)
        written.append(path)
    return written


if __name__ == "__main__":
    paths = generate()
    for p in paths:
        print("wrote", p)

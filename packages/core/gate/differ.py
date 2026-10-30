"""The Gate: cheap motion detection via frame differencing (OpenCV).

Purpose (shared-contracts §0): most frames are boring. The Gate is the cheap
filter that decides whether a frame is worth waking the (expensive) VLM for.
Static scene -> discard. Real change -> signal downstream.

Scoring: convert both frames to grayscale, blur to suppress sensor noise, take the
absolute difference, threshold it, and report the fraction of pixels that changed.
That fraction (0.0-1.0) is the ``motion score``; a scene is "changing" when it
exceeds ``motion_threshold``.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from ..capture.base import Frame


@dataclass(slots=True)
class MotionResult:
    """Outcome of comparing two frames."""

    score: float  # fraction of pixels that changed, 0.0-1.0
    changed: bool  # score > motion_threshold


class MotionGate:
    """Frame-differencing motion detector.

    Args:
        motion_threshold: fraction of changed pixels above which the scene counts
            as "in motion" (default 0.02 = 2% of pixels).
        pixel_delta: per-pixel intensity delta (0-255) that counts as "changed".
        blur_ksize: Gaussian blur kernel size to damp sensor noise (odd int).
    """

    def __init__(
        self,
        motion_threshold: float = 0.02,
        pixel_delta: int = 25,
        blur_ksize: int = 5,
    ) -> None:
        self.motion_threshold = motion_threshold
        self.pixel_delta = pixel_delta
        self.blur_ksize = blur_ksize

    def _prep(self, image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        k = self.blur_ksize
        return cv2.GaussianBlur(gray, (k, k), 0)

    def score(self, prev: Frame, curr: Frame) -> float:
        """Fraction of pixels that changed between ``prev`` and ``curr``."""
        a = self._prep(prev.image)
        b = self._prep(curr.image)
        if a.shape != b.shape:
            raise ValueError(f"frame size mismatch: {a.shape} vs {b.shape}")
        diff = cv2.absdiff(a, b)
        _, mask = cv2.threshold(diff, self.pixel_delta, 255, cv2.THRESH_BINARY)
        changed = int(np.count_nonzero(mask))
        return changed / mask.size

    def compare(self, prev: Frame, curr: Frame) -> MotionResult:
        s = self.score(prev, curr)
        return MotionResult(score=s, changed=s > self.motion_threshold)

    def is_change(self, prev: Frame, curr: Frame) -> bool:
        return self.score(prev, curr) > self.motion_threshold

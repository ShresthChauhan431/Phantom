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

    Measured against live camera frames and controlled noise tests. Two different
    kinds of noise matter:

    * Gaussian sensor noise — absorbed completely by the blur below (a static
      scene with noise up to sigma=20 scores 0.00000).
    * Edge shimmer — on the real iPhone stream (JPEG-compressed, with focus and
      exposure micro-adjusting) object *outlines* flicker by 25-90 grey levels while
      nothing moves. Measured on a still desk: up to 4.9% of pixels "changed" versus
      the reference frame, all of it on edges, enough to fire the gate and send a
      reworded description of an unmoved object to the VLM as a fake "move".

    ``open_ksize`` (morphological opening) removes the shimmer: the changed regions
    are 1-3px-wide outlines, which a 9px opening erases, while a moved object
    leaves a solid blob that survives. Measured on the same still desk, 9px cut
    drift from 0.049 to 0.002 and kept 82% of a real move's signal. It defaults to
    off for synthetic/test sources; the live launcher enables it.

    Args:
        motion_threshold: fraction of changed pixels above which the scene counts
            as "in motion" (default 0.02 = 2% of pixels). Override with
            ``PHANTOM_MOTION_THRESHOLD``; tune against the real deployed scene.
        pixel_delta: per-pixel intensity delta (0-255) that counts as "changed".
        blur_ksize: Gaussian blur kernel size to damp sensor noise (odd int).
        open_ksize: morphological opening kernel in pixels; 0 disables (default).
            ``PHANTOM_GATE_OPEN_KSIZE``.
    """

    def __init__(
        self,
        motion_threshold: float = 0.02,
        pixel_delta: int = 25,
        blur_ksize: int = 5,
        open_ksize: int = 0,
    ) -> None:
        self.motion_threshold = motion_threshold
        self.pixel_delta = pixel_delta
        self.blur_ksize = blur_ksize
        self.open_ksize = open_ksize
        self.last_score = 0.0

    def _prep(self, image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        k = self.blur_ksize
        return cv2.GaussianBlur(gray, (k, k), 0)

    def change_mask(self, prev: Frame, curr: Frame) -> np.ndarray:
        """Binary mask (uint8, 0/255) of pixels that changed between the frames.

        This is the gate's evidence of *where* the scene changed. It is used both
        for the score and for checking that a change the VLM reports actually
        happened at the place it names.
        """
        a = self._prep(prev.image)
        b = self._prep(curr.image)
        if a.shape != b.shape:
            raise ValueError(f"frame size mismatch: {a.shape} vs {b.shape}")
        diff = cv2.absdiff(a, b)
        _, mask = cv2.threshold(diff, self.pixel_delta, 255, cv2.THRESH_BINARY)
        if self.open_ksize:
            # Erase thin edge shimmer and speckle; keep the solid blobs a real
            # object leaves behind or arrives as.
            kernel = cv2.getStructuringElement(
                cv2.MORPH_ELLIPSE, (self.open_ksize, self.open_ksize)
            )
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        return mask

    def score(self, prev: Frame, curr: Frame) -> float:
        """Fraction of pixels that changed between ``prev`` and ``curr``."""
        mask = self.change_mask(prev, curr)
        changed = int(np.count_nonzero(mask))
        result = changed / mask.size
        # Kept for telemetry: the score the gate actually decided on, so the UI can
        # show the engine's real motion reading rather than recomputing its own.
        self.last_score = result
        return result

    def compare(self, prev: Frame, curr: Frame) -> MotionResult:
        s = self.score(prev, curr)
        return MotionResult(score=s, changed=s > self.motion_threshold)

    def is_change(self, prev: Frame, curr: Frame) -> bool:
        return self.score(prev, curr) > self.motion_threshold

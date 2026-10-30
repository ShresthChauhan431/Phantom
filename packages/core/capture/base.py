"""Capture primitives: the ``Frame`` value and the ``Camera`` protocol.

Every capture source (Android, iPhone, replay) implements ``Camera`` so the rest
of the perception pipeline is source-agnostic. Frames are in-memory only — the
pipeline hands them to the RAM ring buffer (``buffer.py``) and never to disk.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol, runtime_checkable

import numpy as np


@dataclass(slots=True)
class Frame:
    """A single captured image plus the metadata the pipeline needs.

    ``image`` is a BGR ``HxWx3`` uint8 array (OpenCV's native layout). ``seq`` is a
    monotonically increasing counter assigned by the capture source; ``ts`` is the
    capture time (tz-aware).
    """

    image: np.ndarray
    seq: int
    ts: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def shape(self) -> tuple[int, ...]:
        return self.image.shape


@runtime_checkable
class Camera(Protocol):
    """A source of frames. Implementations: ``AndroidCamera``, ``IPhoneCamera``, ``ReplayCamera``."""

    def open(self) -> None:
        """Acquire the underlying device / resource. Idempotent."""
        ...

    def read(self) -> Frame | None:
        """Return the next frame, or ``None`` when the source is exhausted/unavailable."""
        ...

    def close(self) -> None:
        """Release the underlying device / resource. Idempotent."""
        ...

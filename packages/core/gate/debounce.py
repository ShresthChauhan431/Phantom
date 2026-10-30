"""Debounce: wait for motion to settle, then promote the end-state frame.

A single physical action (a hand placing a bottle) spans several frames of motion.
Waking the VLM on every one of them would be wasteful and would capture blurred,
mid-motion scenes. The debouncer collapses a burst of motion into exactly one
*end-state* frame: the first quiet frame after things stop moving.

It is a frame-driven state machine (no wall-clock sleeps) so it is deterministic
and testable against recorded frames. ``settle_frames`` quiet frames are required
before promotion; at a 2s capture interval, ``settle_frames=1`` ≈ a ~2s settle,
matching the "1-2s settle" rule in the dev doc.

Usage::

    deb = Debouncer(MotionGate())
    for frame in frames:
        end_state = deb.feed(frame)
        if end_state is not None:
            understand(end_state)   # exactly one promotion per settled change
"""

from __future__ import annotations

from enum import Enum, auto

from ..capture.base import Frame
from .differ import MotionGate


class _State(Enum):
    IDLE = auto()
    MOVING = auto()


class Debouncer:
    def __init__(self, gate: MotionGate, settle_frames: int = 1) -> None:
        if settle_frames < 1:
            raise ValueError("settle_frames must be >= 1")
        self.gate = gate
        self.settle_frames = settle_frames
        self._state = _State.IDLE
        self._prev: Frame | None = None
        self._quiet = 0
        self._last_moving: Frame | None = None

    @property
    def state(self) -> str:
        return self._state.name.lower()

    def feed(self, frame: Frame) -> Frame | None:
        """Push one frame. Returns the end-state frame when a change has settled, else ``None``."""
        prev = self._prev
        self._prev = frame
        if prev is None:
            # First frame: nothing to compare against yet.
            return None

        moving = self.gate.is_change(prev, frame)

        if self._state is _State.IDLE:
            if moving:
                self._state = _State.MOVING
                self._quiet = 0
                self._last_moving = frame
            return None

        # _State.MOVING
        if moving:
            self._quiet = 0
            self._last_moving = frame
            return None

        # Quiet frame while we were moving.
        self._quiet += 1
        if self._quiet >= self.settle_frames:
            self._state = _State.IDLE
            self._quiet = 0
            self._last_moving = None
            return frame  # this quiet frame is the settled end-state
        return None

    def flush(self) -> Frame | None:
        """Force-promote the last moving frame if the stream ends mid-motion.

        Useful at replay EOF so a change that never saw a trailing quiet frame is
        still emitted once.
        """
        if self._state is _State.MOVING and self._last_moving is not None:
            end_state = self._last_moving
            self._state = _State.IDLE
            self._quiet = 0
            self._last_moving = None
            return end_state
        return None

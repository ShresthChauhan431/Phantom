"""Debounce: wait for motion to settle, then promote only *persistent* change.

A single physical action (a hand placing a bottle) spans several frames of motion.
Waking the VLM on every one would be wasteful and would capture blurred,
mid-motion scenes. The debouncer collapses a burst of motion into exactly one
*end-state* frame: the first quiet frame after things stop moving.

It then answers a second, more important question: **did anything actually
change?** Frame-to-frame motion cannot distinguish a hand reaching across the desk
from an object being moved — measured on real footage, a hand scored 0.041 while an
actual object move scored only 0.022, so no threshold can separate them. But the
two differ in *persistence*: once a hand withdraws, the scene is identical to
before, whereas a moved object leaves the scene permanently different.

So on settling, the end-state frame is compared against the **pre-motion
reference**. If they match, the motion was transient (a hand, someone walking past)
and the frame is discarded without ever calling the VLM, so nothing enters history.
If they differ, a real change occurred and the frame is promoted.

It is a frame-driven state machine (no wall-clock sleeps) so it is deterministic
and testable against recorded frames. ``settle_frames`` quiet frames are required
before promotion; at a 2s capture interval, ``settle_frames=1`` ≈ a ~2s settle,
matching the "1-2s settle" rule in the dev doc.

Usage::

    deb = Debouncer(MotionGate())
    for frame in frames:
        end_state = deb.feed(frame)
        if end_state is not None:
            understand(end_state)   # only persistent changes reach here
"""

from __future__ import annotations

from enum import Enum, auto

from ..capture.base import Frame
from .differ import MotionGate


class _State(Enum):
    IDLE = auto()
    MOVING = auto()


class Debouncer:
    """Collapses motion bursts into one end-state frame, discarding transients.

    Args:
        gate: the motion detector used both for triggering and for the
            before/after comparison.
        settle_frames: quiet frames required before a burst is considered over.
        change_threshold: how different the end-state must be from the pre-motion
            reference to count as a real change. Defaults to the gate's motion
            threshold. Raise it to ignore smaller rearrangements.
    """

    def __init__(
        self,
        gate: MotionGate,
        settle_frames: int = 1,
        change_threshold: float | None = None,
    ) -> None:
        if settle_frames < 1:
            raise ValueError("settle_frames must be >= 1")
        self.gate = gate
        self.settle_frames = settle_frames
        self.change_threshold = (
            change_threshold if change_threshold is not None else gate.motion_threshold
        )
        self._state = _State.IDLE
        self._prev: Frame | None = None
        self._quiet = 0
        self._last_moving: Frame | None = None
        # The last known stable view of the scene — what "before" means.
        self._reference: Frame | None = None
        # Counters worth surfacing: how much work the transient filter saved.
        self.promoted = 0
        self.discarded_transients = 0
        self.promoted_reference: Frame | None = None

    @property
    def state(self) -> str:
        return self._state.name.lower()

    @property
    def reference(self) -> Frame | None:
        """The pre-motion frame the next end-state will be compared against."""
        return self._reference

    def feed(self, frame: Frame) -> Frame | None:
        """Push one frame. Returns an end-state frame only on persistent change."""
        prev = self._prev
        self._prev = frame
        if prev is None:
            # First frame establishes the baseline; nothing to compare yet.
            self._reference = frame
            return None

        moving = self.gate.is_change(prev, frame)

        if self._state is _State.IDLE:
            if moving:
                self._state = _State.MOVING
                self._quiet = 0
                self._last_moving = frame
            else:
                # Scene is stable, so keep "before" current. This also absorbs slow
                # drift (gradual daylight change) instead of letting it accumulate
                # into a false change.
                self._reference = frame
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
            return self._settle(frame)
        return None

    def flush(self) -> Frame | None:
        """Force-settle if the stream ends mid-motion (e.g. replay EOF)."""
        if self._state is _State.MOVING and self._last_moving is not None:
            end_state = self._last_moving
            self._state = _State.IDLE
            self._quiet = 0
            self._last_moving = None
            return self._settle(end_state)
        return None

    def _settle(self, end_state: Frame) -> Frame | None:
        """Promote ``end_state`` only if the scene truly differs from before."""
        reference = self._reference
        # Either way the scene is now stable, so this becomes the new "before".
        self._reference = end_state
        if reference is not None:
            persistent_change = self.gate.score(reference, end_state)
            if persistent_change <= self.change_threshold:
                # Scene returned to how it was: a hand reached in and withdrew.
                self.discarded_transients += 1
                return None
        self.promoted += 1
        #: The "before" frame of the change just promoted, so callers can locate
        #: *where* the scene changed (before vs. ``end_state``).
        self.promoted_reference = reference
        return end_state

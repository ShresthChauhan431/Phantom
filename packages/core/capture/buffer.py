"""RAM ring buffer for frames.

Hard rule (shared-contracts §1.3): raw frames never hit disk. They live here, in
memory, under a retention cap. The only thing that escapes the buffer is a
transient ``frame_ref`` handle (e.g. ``"buf_0412"``) that the reveal step can later
resolve back to a frame while it is still retained.

Eviction is bounded two ways:
  * ``capacity`` — keep at most N most-recent frames.
  * ``retention_seconds`` — drop frames older than the retention window.

Whichever limit bites first evicts the oldest frames. Once a ``frame_ref`` is
evicted, ``get`` returns ``None`` (the reveal layer must degrade gracefully).
"""

from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from threading import RLock

from .base import Frame


def make_frame_ref(seq: int) -> str:
    """Canonical handle format shared with the Delta contract (``"buf_0412"``)."""
    return f"buf_{seq:04d}"


class FrameBuffer:
    """Fixed-size, time-bounded RAM store mapping ``frame_ref`` -> ``Frame``.

    Thread-safe: the engine loop (writer) and the read API's frame-serving (reader)
    run in different threads and both mutate the backing map (``put``/``get`` evict),
    so all access is guarded by a re-entrant lock.
    """

    def __init__(self, capacity: int = 256, retention_seconds: float = 300.0) -> None:
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        self.capacity = capacity
        self.retention = timedelta(seconds=retention_seconds)
        self._frames: OrderedDict[str, Frame] = OrderedDict()
        self._lock = RLock()

    def put(self, frame: Frame) -> str:
        """Store ``frame`` and return its ``frame_ref`` handle."""
        ref = make_frame_ref(frame.seq)
        with self._lock:
            self._frames[ref] = frame
            self._frames.move_to_end(ref)
            self._evict(now=frame.ts)
        return ref

    def get(self, frame_ref: str) -> Frame | None:
        """Resolve a handle to its frame, or ``None`` if evicted/unknown."""
        with self._lock:
            self._evict()
            return self._frames.get(frame_ref)

    def __len__(self) -> int:
        with self._lock:
            return len(self._frames)

    def __contains__(self, frame_ref: object) -> bool:
        with self._lock:
            return frame_ref in self._frames

    def _evict(self, now: datetime | None = None) -> None:
        # Caller holds self._lock.
        now = now or datetime.now(timezone.utc)
        # Capacity bound: drop oldest until within capacity.
        while len(self._frames) > self.capacity:
            self._frames.popitem(last=False)
        # Time bound: drop oldest while older than the retention window.
        cutoff = now - self.retention
        while self._frames:
            oldest_ref = next(iter(self._frames))
            if self._frames[oldest_ref].ts < cutoff:
                self._frames.popitem(last=False)
            else:
                break

"""A pool of API keys for one provider, with automatic failover.

When a key hits its quota or rate limit, the provider must not stop — it moves to
the next key and retries the same request at once. A key that failed sits out for
a cooldown and is used again when it expires, so a pool of N keys keeps working
as long as any one of them has quota.

Failure classes:
  * ``rate_limited`` (HTTP 429: quota exhausted / rate limit) — cool down for the
    server's ``retry-after`` if it sent one, else ``default_cooldown``.
  * ``rejected`` (HTTP 401/403: invalid or revoked key) — cool down for a long
    time; such a key will not recover by itself, but it is not removed, so fixing
    it in the console brings it back without a restart.

Thread-safe: the scan and change paths may call from different threads.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field

REJECTED_COOLDOWN_S = 30 * 60.0


def mask_key(key: str) -> str:
    """Identify a key in logs and telemetry without revealing it."""
    if len(key) <= 10:
        return "****"
    return f"{key[:4]}…{key[-4:]}"


@dataclass
class _KeyState:
    key: str
    label: str
    calls: int = 0
    failures: int = 0
    cooling_until: float = 0.0  # time.monotonic(); 0 = available
    last_error: str | None = None
    last_used_at: float | None = None


@dataclass
class KeyPool:
    """Rotating set of API keys. Use the active key until it fails, then rotate."""

    keys: list[str]
    default_cooldown: float = 60.0
    _states: list[_KeyState] = field(init=False)
    _active: int = field(init=False, default=0)
    _lock: threading.Lock = field(init=False, default_factory=threading.Lock)
    switches: int = field(init=False, default=0)

    def __post_init__(self) -> None:
        unique: list[str] = []
        for key in self.keys:
            key = (key or "").strip()
            if key and key not in unique:
                unique.append(key)
        if not unique:
            raise ValueError("KeyPool needs at least one non-empty key")
        self._states = [
            _KeyState(key=k, label=f"key {i + 1} ({mask_key(k)})") for i, k in enumerate(unique)
        ]

    def __len__(self) -> int:
        return len(self._states)

    # --------------------------------------------------------------- choosing
    def acquire(self) -> tuple[int, str] | None:
        """The key to use now: the active one if available, else the next free one.

        Returns ``(index, key)``, or ``None`` if every key is cooling down.
        """
        now = time.monotonic()
        with self._lock:
            n = len(self._states)
            for step in range(n):
                i = (self._active + step) % n
                state = self._states[i]
                if state.cooling_until <= now:
                    if i != self._active:
                        self._active = i
                        self.switches += 1
                    state.calls += 1
                    state.last_used_at = now
                    return i, state.key
            return None

    def seconds_until_available(self) -> float:
        """How long until the soonest cooling key is usable again."""
        now = time.monotonic()
        with self._lock:
            return max(0.0, min(s.cooling_until for s in self._states) - now)

    # -------------------------------------------------------------- reporting
    def report_success(self, index: int) -> None:
        with self._lock:
            self._states[index].last_error = None

    def report_failure(
        self, index: int, *, kind: str, error: str, retry_after: float | None = None
    ) -> None:
        """Bench a key after a quota/limit/auth failure so the next call rotates."""
        if kind == "rejected":
            cooldown = REJECTED_COOLDOWN_S
        else:
            cooldown = retry_after if retry_after and retry_after > 0 else self.default_cooldown
        with self._lock:
            state = self._states[index]
            state.failures += 1
            state.last_error = f"{kind}: {error[:200]}"
            state.cooling_until = time.monotonic() + cooldown

    # -------------------------------------------------------------- telemetry
    def status(self) -> dict:
        now = time.monotonic()
        with self._lock:
            return {
                "count": len(self._states),
                "active": self._states[self._active].label,
                "switches": self.switches,
                "keys": [
                    {
                        "label": s.label,
                        "active": i == self._active,
                        "available": s.cooling_until <= now,
                        "cooling_s": round(max(0.0, s.cooling_until - now), 1),
                        "calls": s.calls,
                        "failures": s.failures,
                        "last_error": s.last_error,
                    }
                    for i, s in enumerate(self._states)
                ],
            }

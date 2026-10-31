"""Mock VLM provider — the offline test engine.

Returns canned deltas with no model, no network. Two modes:
  * a fixed list of deltas, returned in order (then cycling, or stopping);
  * a callable that derives a delta from the call arguments.

This is what powers ``PHANTOM_VLM_PROVIDER=mock`` and the understand tests, so the
whole perception pipeline can run end-to-end with no Ollama / cloud key.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from datetime import datetime, timezone

from ..schema.delta import Delta
from .base import ProviderError

DeltaFactory = Callable[[str, str, bytes], Delta]


class MockProvider:
    name = "mock"

    def __init__(
        self,
        deltas: Sequence[Delta] | None = None,
        *,
        factory: DeltaFactory | None = None,
        cycle: bool = False,
        scene: Sequence[Delta] | None = None,
    ) -> None:
        if deltas is None and factory is None:
            # Default: a single believable "bottle appeared" delta.
            deltas = [
                Delta(
                    object="blue_water_bottle",
                    event="appeared",
                    to="center of desk",
                    relations=["on desk"],
                    confidence=0.92,
                    observed_at=datetime.now(timezone.utc),
                )
            ]
        self._deltas = list(deltas or [])
        self._factory = factory
        self._cycle = cycle
        self._scene = list(scene or [])
        self._i = 0

    def whats_changed(self, prev_state_json: str, frame_ref: str, image_bytes: bytes) -> Delta:
        if self._factory is not None:
            delta = self._factory(prev_state_json, frame_ref, image_bytes)
        else:
            if self._i >= len(self._deltas):
                if not self._cycle:
                    raise ProviderError("mock provider exhausted its canned deltas")
                self._i = 0
            delta = self._deltas[self._i]
            self._i += 1
        # Stamp the frame_ref the pipeline assigned, mirroring real providers.
        if not delta.frame_ref:
            delta = delta.model_copy(update={"frame_ref": frame_ref})
        return delta

    def scan_scene(
        self,
        known_json: str,
        frame_ref: str,
        image_bytes: bytes,
        observed_at: datetime | None = None,
    ) -> list[Delta]:
        """Canned inventory for tests: the configured ``scene`` list, or nothing."""
        stamp = observed_at or datetime.now(timezone.utc)
        return [
            d.model_copy(update={"frame_ref": frame_ref, "observed_at": stamp})
            for d in self._scene
        ]

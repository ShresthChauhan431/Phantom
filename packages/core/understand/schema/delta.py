"""Versioned Delta contract (Seam 1).

This is the single source-of-truth data shape that flows from Perception (Track A)
into Memory (Track B). The VLM produces a ``Delta``; ``MemoryStore.commit_delta``
consumes it. The schema is frozen in ``docs/working/shared-contracts.md`` §3.

Rules (from the contract):
  * ``object`` is normalized to lowercase snake_case by the Perception side before emit.
  * ``event == "ambiguous"`` means *do not overwrite* memory — log only.
  * ``confidence < 0.7`` is the escalation trigger (local -> cloud). See ADR-0002.
  * Adding an optional, defaulted field is a *minor* change (no version bump).
    Renaming / removing / retyping a field => bump ``SCHEMA_VERSION`` and update both dev docs.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Bump this (and update both dev docs) on any breaking schema change.
SCHEMA_VERSION = 1

# The set of events the store knows how to commit. Kept as a module-level alias so
# other Perception modules can validate against it without re-declaring the literal.
EventType = Literal["appeared", "moved", "removed", "unchanged", "ambiguous"]

# Backwards-compatible alias: Track B's initial draft named this ``Event``. Keep both
# names resolving to the same type so neither side's imports break on integration.
Event = EventType


class Delta(BaseModel):
    """A single semantic change observed in the scene.

    ``from_`` carries the JSON alias ``from`` (a Python keyword), so the model
    serializes to the exact wire shape in the contract. Use
    ``model_dump(by_alias=True)`` / ``model_validate`` for round-trips.
    """

    model_config = ConfigDict(populate_by_name=True)

    schema_version: int = SCHEMA_VERSION
    object: str
    event: EventType
    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    relations: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    frame_ref: str | None = None
    observed_at: datetime

    def is_committable(self) -> bool:
        """True when this delta carries a change Memory should persist.

        ``ambiguous`` deltas are never committed destructively — the store only
        flags them — but the loop still forwards them so they can be logged.
        """
        return self.event != "ambiguous"

    def needs_escalation(self, threshold: float = 0.7) -> bool:
        """True when confidence is low enough to retry on a cloud provider."""
        return self.confidence < threshold

"""
Phantom — Memory models (CONTRACT).

ObjectRecord is the committed state of one object; HistoryEntry is one node in its
lineage. Frozen shape lives in docs/working/shared-contracts.md §4.
Owned by Track B (Memory & Serving / Shresth).
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Status = Literal["fresh", "stale", "ambiguous", "removed"]


class HistoryEntry(BaseModel):
    """One node in an object's movement lineage (newest last)."""

    location: str
    at: datetime
    confidence: float = Field(ge=0.0, le=1.0)


class ObjectRecord(BaseModel):
    """The latest committed state of a tracked object plus its lineage."""

    key: str
    location: str | None = None
    relations: list[str] = Field(default_factory=list)
    last_seen: datetime
    confidence: float = Field(ge=0.0, le=1.0)
    frame_ref: str | None = None
    status: Status = "fresh"
    history: list[HistoryEntry] = Field(default_factory=list)

"""
Phantom — Delta schema (CO-OWNED CONTRACT, Seam 1).

This is the strict-JSON output the VLM produces and the thing memory commits.
Frozen shape lives in docs/working/shared-contracts.md §3. Do not change fields
without bumping SCHEMA_VERSION and updating both dev docs.

Owned long-term by Track A (Perception / Dhwanit). This initial version implements
the agreed M0 contract so Track B (Memory) can build and test against it.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = 1

Event = Literal["appeared", "moved", "removed", "unchanged", "ambiguous"]


class Delta(BaseModel):
    """A single observed change to one object."""

    model_config = ConfigDict(populate_by_name=True)

    schema_version: int = SCHEMA_VERSION
    object: str
    event: Event
    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    relations: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    frame_ref: str | None = None
    observed_at: datetime

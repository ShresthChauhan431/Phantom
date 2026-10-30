"""
Phantom — shared geometry primitives.

``BBox`` is the grounded bounding box a VLM returns for an object. It flows through
the whole system: Delta (Perception) -> ObjectRecord (store) -> RevealPayload (UI).
It lives in a neutral module so the contract, the store, and the reveal layer can
all share one definition without importing each other.

Coordinates are normalized to 0..1 of the frame (origin top-left), so they stay
valid regardless of the served frame's pixel resolution.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class BBox(BaseModel):
    """Normalized bounding box (0..1) over a frame. Origin top-left."""

    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    w: float = Field(gt=0.0, le=1.0)
    h: float = Field(gt=0.0, le=1.0)

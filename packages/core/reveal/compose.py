"""
Phantom — Reveal composer.

Turns a committed ObjectRecord into the payload the UI needs to "reveal" an answer:
the transient frame_ref, an optional grounded bounding box, and a trust card that
always carries timestamp + confidence (never bare certainty). See vision.md §Reveal.

bbox comes from the Perception side's grounded region (Track A, added later). Until
then it is None and the card still renders.

Owned by Track B (Memory & Serving / Shresth).
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from core.geometry import BBox
from core.memory.models import ObjectRecord, Status
from core.memory.staleness import age_seconds, effective_status

__all__ = ["BBox", "TrustCard", "RevealPayload", "compose_reveal"]


class TrustCard(BaseModel):
    """Human-facing answer card. Always shows when + how sure."""

    title: str
    location: str | None
    last_seen: datetime
    confidence: float = Field(ge=0.0, le=1.0)
    status: Status
    message: str


class RevealPayload(BaseModel):
    key: str
    frame_ref: str | None
    bbox: BBox | None
    card: TrustCard


def _humanize_duration(seconds: float) -> str:
    """A bare duration like '12 seconds' / '1 hour' / '3 days' (no 'ago')."""
    seconds = int(max(seconds, 0))
    if seconds < 60:
        n, unit = seconds, "second"
    elif seconds < 3600:
        n, unit = seconds // 60, "minute"
    elif seconds < 86400:
        n, unit = seconds // 3600, "hour"
    else:
        n, unit = seconds // 86400, "day"
    return f"{n} {unit}{'s' if n != 1 else ''}"


def _message(record: ObjectRecord, status: Status, age: float) -> str:
    """Human-facing line for the trust card.

    Every status carries both *when* and *how sure* — the trust contract in
    vision.md §Reveal is "always shows timestamp + confidence, never bare
    certainty". A stale or removed card is exactly where an unqualified claim is
    most misleading, so confidence appears there too, not just on fresh answers.
    """
    pct = round(record.confidence * 100)
    where = record.location or "unknown location"
    if status == "removed":
        return (
            f"No longer observed — last seen {where} "
            f"({_humanize_duration(age)} ago), {pct}% confidence at the time."
        )
    if status == "ambiguous":
        return f"Ambiguous — best guess {where}, {pct}% confidence. Not re-observed cleanly."
    if status == "stale":
        return (
            f"Not re-observed for {_humanize_duration(age)} — possibly occluded. "
            f"Last: {where}, {pct}% confidence when seen."
        )
    return f"Last seen {_humanize_duration(age)} ago — {where} — {pct}% confidence."


def compose_reveal(
    record: ObjectRecord,
    *,
    bbox: BBox | None = None,
    now: datetime | None = None,
) -> RevealPayload:
    """Build the reveal payload for one object record."""
    age = age_seconds(record, now)
    status = effective_status(record, now)
    card = TrustCard(
        title=record.key.replace("_", " "),
        location=record.location,
        last_seen=record.last_seen,
        confidence=record.confidence,
        status=status,
        message=_message(record, status, age),
    )
    return RevealPayload(
        key=record.key,
        frame_ref=record.frame_ref,
        bbox=bbox if bbox is not None else record.bbox,
        card=card,
    )

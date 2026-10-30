"""
Phantom — staleness (a VIEW concern, single source of truth).

The *committed* status in the store is whatever the last delta said
(fresh/removed/ambiguous). Whether a still-"fresh" object has gone *stale* depends
on how long ago it was last observed relative to now — so it is computed at read
time, not stored. Both the API (``/objects``, ``/query``) and the reveal composer
run every record through here so the trust contract is consistent everywhere.

See vision.md §Reveal ("Not re-observed for 6 minutes — possibly occluded").
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core.memory.models import ObjectRecord, Status

# After this long without re-observation, a "fresh" record reads as "stale".
STALE_AFTER = timedelta(minutes=6)


def age_seconds(record: ObjectRecord, now: datetime | None = None) -> float:
    """Seconds since the record was last observed (naive timestamps assumed UTC)."""
    now = now or datetime.now(timezone.utc)
    last_seen = record.last_seen
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    return (now - last_seen).total_seconds()


def effective_status(record: ObjectRecord, now: datetime | None = None) -> Status:
    """The status to show a user: upgrades a stale 'fresh' record to 'stale'.

    'removed' and 'ambiguous' are committed facts and are never reinterpreted.
    """
    if record.status in ("removed", "ambiguous"):
        return record.status
    if age_seconds(record, now) > STALE_AFTER.total_seconds():
        return "stale"
    return record.status


def with_effective_status(record: ObjectRecord, now: datetime | None = None) -> ObjectRecord:
    """A copy of ``record`` whose status reflects staleness at ``now``."""
    status = effective_status(record, now)
    if status == record.status:
        return record
    return record.model_copy(update={"status": status})

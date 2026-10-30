"""Tests for core.memory.staleness — the view-layer staleness rule."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core.memory.models import ObjectRecord
from core.memory.staleness import effective_status, with_effective_status

NOW = datetime(2026, 10, 30, 15, 0, 0, tzinfo=timezone.utc)


def _rec(status="fresh", mins_ago=0.0):
    return ObjectRecord(
        key="bottle",
        location="desk",
        last_seen=NOW - timedelta(minutes=mins_ago),
        confidence=0.9,
        status=status,
    )


def test_fresh_stays_fresh_when_recent():
    assert effective_status(_rec("fresh", mins_ago=1), NOW) == "fresh"


def test_fresh_becomes_stale_past_threshold():
    assert effective_status(_rec("fresh", mins_ago=10), NOW) == "stale"


def test_removed_never_reinterpreted():
    assert effective_status(_rec("removed", mins_ago=120), NOW) == "removed"


def test_ambiguous_never_reinterpreted():
    assert effective_status(_rec("ambiguous", mins_ago=120), NOW) == "ambiguous"


def test_with_effective_status_returns_copy_only_when_changed():
    fresh_recent = _rec("fresh", mins_ago=1)
    assert with_effective_status(fresh_recent, NOW) is fresh_recent  # unchanged -> same obj

    stale = with_effective_status(_rec("fresh", mins_ago=10), NOW)
    assert stale.status == "stale"


def test_naive_last_seen_assumed_utc():
    rec = ObjectRecord(
        key="x", location="y",
        last_seen=datetime(2026, 10, 30, 14, 59, 0),  # naive, 1 min before NOW
        confidence=0.5, status="fresh",
    )
    assert effective_status(rec, NOW) == "fresh"

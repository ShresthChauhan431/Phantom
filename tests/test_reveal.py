"""Tests for core.reveal.compose — trust card + staleness messaging."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core.memory.models import ObjectRecord
from core.reveal.compose import BBox, compose_reveal

NOW = datetime(2026, 10, 30, 15, 0, 0, tzinfo=timezone.utc)


def _rec(**kw):
    base = dict(
        key="blue_water_bottle",
        location="behind laptop",
        last_seen=NOW,
        confidence=0.94,
        frame_ref="buf_0412",
        status="fresh",
    )
    base.update(kw)
    return ObjectRecord(**base)


def test_fresh_card_has_when_and_confidence():
    p = compose_reveal(_rec(last_seen=NOW - timedelta(seconds=12)), now=NOW)
    assert p.key == "blue_water_bottle"
    assert p.frame_ref == "buf_0412"
    assert p.card.status == "fresh"
    assert "12 seconds ago" in p.card.message
    assert "94%" in p.card.message
    assert "behind laptop" in p.card.message


def test_stale_when_not_observed_recently():
    p = compose_reveal(_rec(last_seen=NOW - timedelta(minutes=10)), now=NOW)
    assert p.card.status == "stale"
    assert "Not re-observed" in p.card.message


def test_removed_message():
    p = compose_reveal(_rec(status="removed", last_seen=NOW - timedelta(minutes=2)), now=NOW)
    assert p.card.status == "removed"
    assert "No longer observed" in p.card.message


def test_bbox_passthrough():
    bb = BBox(x=0.1, y=0.2, w=0.3, h=0.4)
    p = compose_reveal(_rec(), bbox=bb, now=NOW)
    assert p.bbox == bb


def test_naive_last_seen_tolerated():
    naive = datetime(2026, 10, 30, 14, 59, 50)  # no tz
    p = compose_reveal(_rec(last_seen=naive), now=NOW)
    assert p.card.status == "fresh"


def test_bbox_sourced_from_record_when_not_passed():
    bb = BBox(x=0.5, y=0.5, w=0.2, h=0.2)
    p = compose_reveal(_rec(bbox=bb), now=NOW)
    assert p.bbox == bb


def test_explicit_bbox_overrides_record():
    rec_bb = BBox(x=0.1, y=0.1, w=0.1, h=0.1)
    override = BBox(x=0.9, y=0.9, w=0.05, h=0.05)
    p = compose_reveal(_rec(bbox=rec_bb), bbox=override, now=NOW)
    assert p.bbox == override

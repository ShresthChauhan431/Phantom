"""Tests for core.query.search — exact / alias / fuzzy ranking."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core.memory.models import ObjectRecord
from core.query.search import search

BASE = datetime(2026, 10, 30, 14, 0, 0, tzinfo=timezone.utc)


def _rec(key, *, loc="somewhere", conf=0.9, secs=0, status="fresh"):
    return ObjectRecord(
        key=key,
        location=loc,
        last_seen=BASE + timedelta(seconds=secs),
        confidence=conf,
        status=status,
    )


def test_exact_key_match():
    recs = [_rec("blue_water_bottle"), _rec("keys")]
    out = search("blue_water_bottle", recs)
    assert out[0].key == "blue_water_bottle"


def test_fuzzy_words_match_snake_key():
    recs = [_rec("blue_water_bottle"), _rec("keys")]
    out = search("water bottle", recs)
    assert out and out[0].key == "blue_water_bottle"


def test_alias_match():
    recs = [_rec("glasses"), _rec("keys")]
    out = search("specs", recs, aliases={"specs": "glasses"})
    assert out and out[0].key == "glasses"


def test_no_match_returns_empty():
    recs = [_rec("blue_water_bottle")]
    assert search("helicopter", recs) == []


def test_ranks_recent_and_confident_first_on_tie():
    old = _rec("keys", secs=0, conf=0.9)
    recent = _rec("keys_spare", secs=500, conf=0.9)
    # both match "keys" fuzzily; the more recent should rank first
    out = search("keys", [old, recent])
    assert [r.key for r in out][0] == "keys"  # exact beats fuzzy
    # now tie on score: two exact-ish, recency decides
    a = _rec("mug", secs=0, conf=0.5)
    b = _rec("mug", secs=100, conf=0.5)  # same key won't happen in store, but tests sort
    out2 = search("mug", [a, b])
    assert out2[0].last_seen >= out2[-1].last_seen


def test_ambiguous_ranked_below_fresh_for_same_score():
    fresh = _rec("bottle", status="fresh", secs=0)
    amb = _rec("bottle", status="ambiguous", secs=100)
    out = search("bottle", [amb, fresh])
    assert out[0].status == "fresh"


def test_limit_caps_results():
    recs = [_rec("cup_one"), _rec("cup_two"), _rec("cup_three")]
    out = search("cup", recs, limit=2)
    assert len(out) == 2

"""Tests for core.memory.store.MemoryStore — commit behavior + lineage."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from core.memory.store import MemoryStore
from core.understand.schema.delta import Delta

BASE = datetime(2026, 10, 30, 14, 0, 0, tzinfo=timezone.utc)


def _delta(obj, event, to=None, frm=None, conf=0.9, secs=0, relations=None, frame="buf_1"):
    return Delta(
        object=obj,
        event=event,
        to=to,
        from_=frm,
        confidence=conf,
        frame_ref=frame,
        relations=relations or [],
        observed_at=BASE + timedelta(seconds=secs),
    )


@pytest.fixture
def store(tmp_path):
    s = MemoryStore(str(tmp_path / "t.db"))
    yield s
    s.close()


def test_appeared_creates_record(store):
    rec = store.commit_delta(_delta("bottle", "appeared", to="on desk", conf=0.8))
    assert rec.key == "bottle"
    assert rec.location == "on desk"
    assert rec.status == "fresh"
    assert len(rec.history) == 1
    assert rec.history[0].location == "on desk"
    assert store.get("bottle") is not None


def test_moved_pushes_lineage(store):
    store.commit_delta(_delta("bottle", "appeared", to="on desk", secs=0))
    rec = store.commit_delta(
        _delta("bottle", "moved", frm="on desk", to="behind laptop", secs=180, conf=0.94)
    )
    assert rec.location == "behind laptop"
    assert rec.confidence == 0.94
    assert [h.location for h in rec.history] == ["on desk", "behind laptop"]
    # newest last
    assert rec.history[-1].at > rec.history[0].at


def test_removed_marks_status_keeps_history(store):
    store.commit_delta(_delta("keys", "appeared", to="bowl", secs=0))
    rec = store.commit_delta(_delta("keys", "removed", secs=60))
    assert rec.status == "removed"
    assert [h.location for h in rec.history] == ["bowl"]  # history preserved, not appended


def test_unchanged_refreshes_last_seen_only(store):
    store.commit_delta(_delta("mug", "appeared", to="shelf", secs=0, conf=0.7))
    before = store.get("mug")
    rec = store.commit_delta(_delta("mug", "unchanged", secs=600, conf=0.99))
    assert rec.location == "shelf"
    assert rec.confidence == 0.7  # unchanged keeps confidence
    assert len(rec.history) == 1  # no new lineage node
    assert rec.last_seen > before.last_seen


def test_ambiguous_never_overwrites(store):
    store.commit_delta(_delta("passport", "appeared", to="drawer", secs=0))
    rec = store.commit_delta(
        _delta("passport", "ambiguous", to="somewhere else", secs=120)
    )
    assert rec.status == "ambiguous"
    assert rec.location == "drawer"  # NOT overwritten
    assert [h.location for h in rec.history] == ["drawer"]  # no new node


def test_all_returns_every_record(store):
    store.commit_delta(_delta("a", "appeared", to="x"))
    store.commit_delta(_delta("b", "appeared", to="y"))
    keys = {r.key for r in store.all()}
    assert keys == {"a", "b"}


def test_wal_mode_enabled(store):
    mode = store._conn.execute("PRAGMA journal_mode;").fetchone()[0]
    assert mode.lower() == "wal"


def test_persistence_across_instances(tmp_path):
    path = str(tmp_path / "p.db")
    s1 = MemoryStore(path)
    s1.commit_delta(_delta("bottle", "appeared", to="on desk"))
    s1.close()

    s2 = MemoryStore(path)
    rec = s2.get("bottle")
    assert rec is not None
    assert rec.location == "on desk"
    s2.close()

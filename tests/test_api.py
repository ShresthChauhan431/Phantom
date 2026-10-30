"""Tests for apps.engine.api — read-only endpoints over a seeded store."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from apps.engine.api import create_api
from core.memory.store import MemoryStore
from core.understand.schema.delta import Delta

BASE = datetime(2026, 10, 30, 14, 0, 0, tzinfo=timezone.utc)


def _delta(obj, event, to=None, frm=None, conf=0.9, secs=0, frame="buf_1"):
    return Delta(
        object=obj, event=event, to=to, from_=frm, confidence=conf,
        frame_ref=frame, observed_at=BASE + timedelta(seconds=secs),
    )


@pytest.fixture
def client():
    store = MemoryStore(":memory:")
    store.commit_delta(_delta("blue_water_bottle", "appeared", to="on desk", secs=0))
    store.commit_delta(_delta("blue_water_bottle", "moved", to="behind laptop", secs=180, conf=0.94))
    store.commit_delta(_delta("glasses", "appeared", to="nightstand", secs=10))
    app = create_api(store)
    yield TestClient(app)
    store.close()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "healthy"}


def test_objects_lists_all(client):
    keys = {o["key"] for o in client.get("/api/objects").json()}
    assert keys == {"blue_water_bottle", "glasses"}


def test_query_fuzzy(client):
    out = client.get("/api/query", params={"q": "water bottle"}).json()
    assert out and out[0]["key"] == "blue_water_bottle"


def test_query_alias(client):
    out = client.get("/api/query", params={"q": "specs"}).json()
    assert out and out[0]["key"] == "glasses"


def test_history_lineage(client):
    out = client.get("/api/objects/blue_water_bottle/history").json()
    assert [h["location"] for h in out] == ["on desk", "behind laptop"]


def test_history_404(client):
    assert client.get("/api/objects/nope/history").status_code == 404


def test_reveal_payload(client):
    out = client.get("/api/reveal/blue_water_bottle").json()
    assert out["key"] == "blue_water_bottle"
    assert out["frame_ref"] == "buf_1"
    assert "card" in out and "message" in out["card"]


def test_reveal_404(client):
    assert client.get("/api/reveal/nope").status_code == 404

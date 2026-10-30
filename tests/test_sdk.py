"""Tests for sdk.client.PhantomClient against the real API via ASGI transport."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from apps.engine.api import create_api
from core.memory.store import MemoryStore
from core.understand.schema.delta import Delta
from sdk.client import ObjectRecord, PhantomClient, RevealPayload

BASE = datetime(2026, 10, 30, 14, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def phantom():
    store = MemoryStore(":memory:")
    store.commit_delta(
        Delta(object="blue_water_bottle", event="appeared", to="on desk",
              confidence=0.8, frame_ref="buf_1", observed_at=BASE)
    )
    store.commit_delta(
        Delta(object="blue_water_bottle", event="moved", to="behind laptop",
              confidence=0.94, frame_ref="buf_2", observed_at=BASE + timedelta(seconds=180))
    )
    app = create_api(store)
    http = TestClient(app)  # a sync httpx.Client subclass that routes into the ASGI app
    yield PhantomClient(client=http)
    http.close()
    store.close()


def test_sdk_health(phantom):
    assert phantom.health()["status"] == "healthy"


def test_sdk_objects_typed(phantom):
    objs = phantom.objects()
    assert objs and isinstance(objs[0], ObjectRecord)
    assert objs[0].key == "blue_water_bottle"


def test_sdk_query_typed(phantom):
    out = phantom.query("water bottle")
    assert out and out[0].key == "blue_water_bottle"


def test_sdk_history(phantom):
    hist = phantom.history("blue_water_bottle")
    assert [h.location for h in hist] == ["on desk", "behind laptop"]


def test_sdk_reveal_typed(phantom):
    rev = phantom.reveal("blue_water_bottle")
    assert isinstance(rev, RevealPayload)
    assert rev.key == "blue_water_bottle"
    assert "confidence" in rev.card.message.lower() or "%" in rev.card.message

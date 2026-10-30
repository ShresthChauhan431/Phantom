"""Tests for the GET /api/frame/{ref} endpoint with an injectable frame source."""
from __future__ import annotations

from core.memory.store import MemoryStore
from fastapi.testclient import TestClient

from apps.engine.api import create_api

PNG = b"\x89PNG\r\n\x1a\n-fake-png-bytes"


def _store():
    return MemoryStore(":memory:")


def test_frame_served_when_source_has_it():
    source = lambda ref: PNG if ref == "buf_0001" else None  # noqa: E731
    c = TestClient(create_api(_store(), frame_source=source))
    r = c.get("/api/frame/buf_0001")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.content == PNG


def test_frame_404_when_ref_unknown_or_evicted():
    source = lambda ref: None  # noqa: E731
    c = TestClient(create_api(_store(), frame_source=source))
    assert c.get("/api/frame/buf_9999").status_code == 404


def test_frame_404_when_no_source():
    c = TestClient(create_api(_store()))  # API-only / seeded mode
    assert c.get("/api/frame/buf_0001").status_code == 404

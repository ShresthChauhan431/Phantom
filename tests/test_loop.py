"""Engine loop: startup scan, change triggers, real heartbeat, resilience, telemetry.

Runs the real EngineLoop over the recorded fixture scene (seq 0..5: empty desk,
bottle appears, bottle moves) with a mock provider. Mock and replay exist for these
offline tests only — the live launcher refuses both.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from core.capture.replay import ReplayCamera
from core.memory.store import MemoryStore
from core.understand.providers.base import ProviderError, parse_inventory_json
from core.understand.providers.mock import MockProvider
from core.understand.resolve import UnderstandService
from core.understand.schema.delta import Delta
from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.engine.config import Config
from apps.engine.loop import EngineLoop
from apps.engine.main import mount_engine_routes
from tests.conftest import FRAMES_DIR

NOW = datetime(2026, 10, 31, 12, 0, tzinfo=timezone.utc)


def _d(obj, event, to=None, frm=None, conf=0.9):
    return Delta(object=obj, event=event, to=to, from_=frm, confidence=conf, observed_at=NOW)


def _config(**overrides) -> Config:
    base = {
        "camera_source": "replay",
        "vlm_provider": "mock",
        "replay_dir": str(FRAMES_DIR),
        "capture_interval": 2.0,
        "heartbeat_minutes": 0,
    }
    base.update(overrides)
    return Config(**base)


def _loop(provider, config=None, store=None) -> EngineLoop:
    config = config or _config()
    return EngineLoop(
        store=store or MemoryStore(":memory:"),
        camera=ReplayCamera(config.replay_dir, interval=config.capture_interval),
        understand=UnderstandService(provider),
        config=config,
    )


# ------------------------------------------------------------- startup scan
def test_startup_scan_commits_what_the_vlm_sees_before_anything_moves():
    provider = MockProvider(
        [_d("bottle", "appeared", "center"), _d("bottle", "moved", "right", "center")],
        scene=[_d("laptop", "appeared", "back of desk"), _d("mug", "appeared", "left")],
    )
    loop = _loop(provider)
    loop.run()

    first = loop.monitor.events_since(0)[:2]
    assert [e["kind"] for e in first] == ["startup_scan", "startup_scan"]
    assert {e["object"] for e in first} == {"laptop", "mug"}
    keys = {r.key for r in loop.store.all()}
    assert {"laptop", "mug", "bottle"} <= keys


def test_changes_after_the_scan_are_triggered_and_logged():
    provider = MockProvider(
        [_d("bottle", "appeared", "center"), _d("bottle", "moved", "right", "center")],
    )
    loop = _loop(provider)
    loop.run()

    changes = [e for e in loop.monitor.events_since(0) if e["kind"] == "change"]
    assert [e["event"] for e in changes] == ["appeared", "moved"]
    assert changes[1]["from"] == "center" and changes[1]["to"] == "right"
    assert all(e["frame_ref"] for e in changes)
    assert loop.store.get("bottle").location == "right"


def test_only_screenshot_frames_are_buffered():
    """Scan frame + 2 settled end-states, not all 6 captured frames."""
    provider = MockProvider(
        [_d("bottle", "appeared", "center"), _d("bottle", "moved", "right", "center")],
    )
    loop = _loop(provider)
    loop.run()
    assert len(loop.buffer) == 3
    for event in loop.monitor.events_since(0):
        assert loop.get_frame_png(event["frame_ref"]) is not None


# --------------------------------------------------------------- resilience
def test_vlm_failure_is_recorded_and_the_loop_keeps_running():
    def broken(*_args):
        raise ProviderError("429 rate limited")

    loop = _loop(MockProvider(factory=broken))
    loop.run()  # must not raise

    snap = loop.monitor.snapshot()
    assert snap["vlm"]["failures"] == 2  # both settled changes failed
    assert "429" in snap["vlm"]["last_error"]
    assert loop.store.all() == []


# ---------------------------------------------------------------- heartbeat
def test_heartbeat_rescan_only_refreshes_objects_the_vlm_really_sees():
    store = MemoryStore(":memory:")
    store.commit_delta(_d("mug", "appeared", "left"))
    store.commit_delta(_d("keys", "appeared", "tray"))
    before = {r.key: r.last_seen for r in store.all()}

    provider = MockProvider(scene=[_d("mug", "appeared", "left"), _d("pen", "appeared", "front")])
    loop = _loop(provider, _config(heartbeat_minutes=0.0001), store)
    cam = ReplayCamera(FRAMES_DIR)
    cam.open()
    frame = cam.read()
    loop._last_heartbeat = 0  # interval elapsed

    seen = loop.maybe_heartbeat(frame)

    events = {d.object: d.event for d in seen}
    assert events == {"mug": "unchanged", "pen": "appeared"}
    assert store.get("mug").last_seen != before["mug"]  # re-observed
    assert store.get("keys").last_seen == before["keys"]  # not seen: not refreshed


def test_heartbeat_waits_while_the_scene_is_moving():
    loop = _loop(MockProvider(scene=[_d("mug", "appeared", "left")]),
                 _config(heartbeat_minutes=0.0001))
    loop._last_heartbeat = 0
    loop.debouncer._state = loop.debouncer._state.__class__.MOVING
    cam = ReplayCamera(FRAMES_DIR)
    cam.open()
    assert loop.maybe_heartbeat(cam.read()) == []


# ------------------------------------------------------------ scene parsing
def test_inventory_parser_skips_bad_entries_and_ignores_model_time():
    raw = (
        '{"objects":['
        '{"object":"black laptop","location":"center","confidence":0.92,'
        '"bbox":{"x":0.3,"y":0.2,"w":0.4,"h":0.3},"observed_at":"2024-01-01T00:00:00Z"},'
        '{"object":"mug","confidence":"high"},'
        '{"location":"no name"},'
        '{"object":"pen","location":"front","confidence":0.8,"bbox":"bad"}'
        "]}"
    )
    deltas = parse_inventory_json(raw, frame_ref="buf_0001", observed_at=NOW)
    assert [d.object for d in deltas] == ["black laptop", "pen"]
    assert deltas[0].bbox is not None and deltas[1].bbox is None
    assert all(d.observed_at == NOW for d in deltas)


def test_scan_scene_normalizes_dedupes_and_drops_guesses():
    provider = MockProvider(
        scene=[
            _d("Black Laptop", "appeared", "center", conf=0.7),
            _d("black_laptop", "appeared", "center", conf=0.95),
            _d("ghost", "appeared", "?", conf=0.2),
        ]
    )
    seen = UnderstandService(provider).scan_scene([], "buf_1", b"", observed_at=NOW)
    assert [(d.object, d.confidence) for d in seen] == [("black_laptop", 0.95)]


# ------------------------------------------------------------- telemetry API
@pytest.fixture
def engine_client():
    provider = MockProvider(
        [_d("bottle", "appeared", "center"), _d("bottle", "moved", "right", "center")],
        scene=[_d("laptop", "appeared", "back")],
    )
    loop = _loop(provider)
    loop.run()
    app = FastAPI()
    mount_engine_routes(app, loop.store, loop)
    return TestClient(app), loop


def test_engine_status_reports_measured_facts(engine_client):
    client, _ = engine_client
    body = client.get("/api/engine").json()
    assert body["camera"]["frames"] == 6
    assert body["camera"]["resolution"] == "640x480"
    assert body["vlm"]["calls"] == 3  # 1 scan + 2 changes
    assert body["scans"]["last_object_count"] == 1
    assert body["gate"]["promoted"] == 2
    assert body["memory"]["objects"] == 2
    assert body["triggers"]["count"] == 3


def test_engine_events_cursor_returns_only_newer_triggers(engine_client):
    client, _ = engine_client
    everything = client.get("/api/engine/events").json()
    assert everything["session"]
    assert [e["seq"] for e in everything["events"]] == [1, 2, 3]
    newer = client.get("/api/engine/events?since=2").json()["events"]
    assert [e["seq"] for e in newer] == [3]


def test_engine_routes_when_loop_disabled():
    app = FastAPI()
    mount_engine_routes(app, MemoryStore(":memory:"), None)
    client = TestClient(app)
    assert client.get("/api/engine").json()["state"] == "disabled"
    assert client.get("/api/engine/events").json()["events"] == []

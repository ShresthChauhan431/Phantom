"""VLM key failover and the never-stop supervisor.

Uses real openai exception types against a fake client, so behaviour matches what
Groq returns (HTTP 429 with retry-after) without spending quota.
"""

from __future__ import annotations

import threading
import time

import httpx
import openai
import pytest
from core.capture.replay import ReplayCamera
from core.memory.store import MemoryStore
from core.understand.providers.base import ProviderError
from core.understand.providers.cloud import CloudProvider, retry_after_seconds
from core.understand.providers.keypool import KeyPool, mask_key
from core.understand.providers.mock import MockProvider
from core.understand.resolve import UnderstandService

from apps.engine.config import Config
from apps.engine.loop import EngineLoop
from tests.conftest import FRAMES_DIR

GOOD_JSON = '{"objects": [{"object": "mug", "location": "left", "confidence": 0.9}]}'
KEY_A, KEY_B, KEY_C = "gsk_" + "a" * 52, "gsk_" + "b" * 52, "gsk_" + "c" * 52


def _status_error(cls, status, message, headers=None):
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    response = httpx.Response(status, request=request, headers=headers or {})
    return cls(message, response=response, body=None)


def rate_limited(retry_after="30"):
    return _status_error(
        openai.RateLimitError, 429,
        "Rate limit reached for model on tokens per day (TPD). Please try again in 7m12.5s.",
        {"retry-after": retry_after} if retry_after else None,
    )


class FakeClient:
    """Mimics client.chat.completions.create; behaviour scripted per key."""

    def __init__(self, key, script, calls):
        self.key, self.script, self.calls = key, script, calls
        self.chat = self
        self.completions = self

    def create(self, **_kwargs):
        self.calls.append(self.key)
        outcome = self.script[self.key]
        outcome = outcome.pop(0) if isinstance(outcome, list) else outcome
        if isinstance(outcome, Exception):
            raise outcome
        message = type("Msg", (), {"content": outcome})()
        choice = type("Choice", (), {"message": message})()
        return type("Resp", (), {"choices": (choice,)})()


def provider(script, keys=(KEY_A, KEY_B), **kw):
    calls: list[str] = []
    p = CloudProvider(
        model="qwen/qwen3.8-27b",
        api_key=list(keys),
        name="groq",
        client_factory=lambda key: FakeClient(key, script, calls),
        **kw,
    )
    return p, calls


# ------------------------------------------------------------------ failover
def test_quota_on_first_key_switches_to_second_immediately():
    p, calls = provider({KEY_A: rate_limited(), KEY_B: GOOD_JSON})
    started = time.monotonic()
    result = p.scan_scene("[]", "buf_1", b"\xff\xd8\xff")
    assert [d.object for d in result] == ["mug"]
    assert calls == [KEY_A, KEY_B]  # same request, retried on key 2
    assert time.monotonic() - started < 1.0  # no waiting
    status = p.key_status
    assert status["active"].startswith("key 2") and status["switches"] == 1
    assert status["keys"][0]["available"] is False  # key 1 benched
    assert status["keys"][0]["cooling_s"] > 25  # honours retry-after: 30


def test_stays_on_the_working_key_afterwards():
    p, calls = provider({KEY_A: rate_limited(), KEY_B: GOOD_JSON})
    for _ in range(3):
        p.scan_scene("[]", "buf_1", b"")
    assert calls == [KEY_A, KEY_B, KEY_B, KEY_B]  # no flapping back to the exhausted key


def test_first_key_is_used_again_once_its_cooldown_ends():
    p, calls = provider(
        {KEY_A: [rate_limited("0.3"), GOOD_JSON], KEY_B: [GOOD_JSON, rate_limited("60")]}
    )
    p.scan_scene("[]", "buf_1", b"")  # A limited -> B answers
    calls.clear()
    time.sleep(0.4)  # A's cooldown ends
    p.scan_scene("[]", "buf_1", b"")  # B (active) now limited -> back to A
    assert calls == [KEY_B, KEY_A]


def test_rejected_key_is_skipped():
    bad = _status_error(openai.AuthenticationError, 401, "Invalid API Key")
    p, calls = provider({KEY_A: bad, KEY_B: GOOD_JSON})
    p.scan_scene("[]", "buf_1", b"")
    assert calls == [KEY_A, KEY_B]
    assert p.key_status["keys"][0]["last_error"].startswith("rejected")


def test_when_every_key_is_exhausted_it_waits_for_the_soonest_then_continues():
    p, calls = provider(
        {KEY_A: [rate_limited("0.6"), GOOD_JSON], KEY_B: rate_limited("60")}
    )
    started = time.monotonic()
    result = p.scan_scene("[]", "buf_1", b"")
    assert [d.object for d in result] == ["mug"]
    assert calls == [KEY_A, KEY_B, KEY_A]
    assert 0.4 < time.monotonic() - started < 5.0


def test_non_quota_errors_do_not_burn_other_keys():
    timeout = openai.APITimeoutError(request=httpx.Request("POST", "https://x"))
    p, calls = provider({KEY_A: timeout, KEY_B: GOOD_JSON})
    with pytest.raises(ProviderError):
        p.scan_scene("[]", "buf_1", b"")
    assert calls == [KEY_A]  # a timeout would fail on every key alike


def test_wait_is_bounded_so_the_loop_can_retry_later():
    p, _ = provider({KEY_A: rate_limited("600"), KEY_B: rate_limited("600")}, max_wait=0.5)
    with pytest.raises(ProviderError, match="over quota"):
        p.scan_scene("[]", "buf_1", b"")


def test_retry_after_parsed_from_header_or_message():
    assert retry_after_seconds(rate_limited("12")) == 12.0
    assert retry_after_seconds(rate_limited(None)) == pytest.approx(432.5)  # "7m12.5s"


def test_keys_are_masked_and_deduplicated():
    pool = KeyPool([KEY_A, KEY_A, " ", KEY_B])
    assert len(pool) == 2
    status = pool.status()
    assert all(KEY_A not in k["label"] and KEY_B not in k["label"] for k in status["keys"])
    assert mask_key(KEY_A) == "gsk_…aaaa"


# -------------------------------------------------------------------- config
def test_config_collects_numbered_keys_in_order(monkeypatch):
    monkeypatch.setenv("PHANTOM_CLOUD_VLM_KEY", KEY_A)
    monkeypatch.setenv("PHANTOM_CLOUD_VLM_KEY3", KEY_C)
    monkeypatch.setenv("PHANTOM_CLOUD_VLM_KEY2", f"{KEY_B}, {KEY_A}")
    config = Config.from_env(load_file=False)
    assert config.cloud_vlm_keys == [KEY_A, KEY_B, KEY_C]


# ---------------------------------------------------------------- supervisor
class FlakyCamera(ReplayCamera):
    """Fails to open the first two times, like a phone that is not ready yet."""

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.opens = 0

    def open(self):
        self.opens += 1
        if self.opens <= 2:
            raise RuntimeError("iPhone capture did not start")
        super().open()


def test_supervisor_restarts_until_the_user_stops_it():
    config = Config(camera_source="replay", vlm_provider="mock",
                    replay_dir=str(FRAMES_DIR), heartbeat_minutes=0)
    camera = FlakyCamera(FRAMES_DIR, interval=2.0)
    loop = EngineLoop(
        store=MemoryStore(":memory:"),
        camera=camera,
        understand=UnderstandService(MockProvider(cycle=True)),
        config=config,
    )
    stop = threading.Event()
    thread = threading.Thread(target=loop.run_forever, args=(stop,), kwargs={"max_backoff": 0.1})
    thread.start()
    deadline = time.monotonic() + 15
    while camera.opens < 4 and time.monotonic() < deadline:
        time.sleep(0.05)
    stop.set()
    thread.join(timeout=10)

    assert not thread.is_alive()  # stops promptly when asked
    assert camera.opens >= 4  # two failed opens, then it kept restarting after replay ended
    snap = loop.monitor.snapshot()
    assert snap["loop"]["count"] >= 3
    assert snap["state"] == "stopped"


def test_quota_wait_ends_immediately_on_shutdown():
    p, _ = provider({KEY_A: rate_limited("600"), KEY_B: rate_limited("600")})
    p.stop_event = threading.Event()
    threading.Timer(0.3, p.stop_event.set).start()
    started = time.monotonic()
    with pytest.raises(ProviderError, match="stopping"):
        p.scan_scene("[]", "buf_1", b"")
    assert time.monotonic() - started < 2.0

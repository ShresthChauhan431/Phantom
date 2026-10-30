"""Understand tests: fixture frames + mock provider -> valid, normalized Deltas."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from core.gate.debounce import Debouncer
from core.gate.differ import MotionGate
from core.understand.providers.base import ProviderError, VLMProvider, parse_delta_json
from core.understand.providers.mock import MockProvider
from core.understand.resolve import UnderstandService, normalize_object
from core.understand.schema.delta import SCHEMA_VERSION, Delta


def _now():
    return datetime.now(timezone.utc)


def test_parse_delta_json_handles_prose_and_fences_and_alias():
    raw = """Here is the change:
    ```json
    {"object":"blue_water_bottle","event":"moved","from":"center of desk",
     "to":"behind laptop","relations":["on desk"],"confidence":0.9,
     "observed_at":"2026-10-30T14:05:32+05:30"}
    ```"""
    delta = parse_delta_json(raw, frame_ref="buf_0003")
    assert delta.event == "moved"
    assert delta.from_ == "center of desk"
    assert delta.to == "behind laptop"
    assert delta.frame_ref == "buf_0003"
    assert delta.schema_version == SCHEMA_VERSION


def test_parse_delta_json_rejects_garbage():
    with pytest.raises(ProviderError):
        parse_delta_json("no json here at all")


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Blue Water Bottle", "blue_water_bottle"),
        ("  Car-Keys!! ", "car_keys"),
        ("iPhone 15", "iphone_15"),
        ("passport", "passport"),
    ],
)
def test_normalize_object(raw, expected):
    assert normalize_object(raw) == expected


def test_mock_provider_conforms_to_protocol():
    assert isinstance(MockProvider(), VLMProvider)


def test_pipeline_produces_valid_delta_per_promoted_frame(frames):
    """End-to-end on fixtures with mock VLM: each settled change yields one valid Delta."""
    canned = [
        Delta(object="Blue Water Bottle", event="appeared", to="center of desk",
              relations=["on desk"], confidence=0.92, observed_at=_now()),
        Delta(object="Blue Water Bottle", event="moved", from_="center of desk",
              to="behind laptop", relations=["on desk"], confidence=0.88, observed_at=_now()),
    ]
    provider = MockProvider(canned)
    service = UnderstandService(provider)
    gate = MotionGate()
    deb = Debouncer(gate, settle_frames=1)

    deltas: list[Delta] = []
    for frame in frames:
        end_state = deb.feed(frame)
        if end_state is None:
            continue
        ref = f"buf_{end_state.seq:04d}"
        delta = service.process("[]", ref, end_state.image.tobytes())
        deltas.append(delta)

    assert len(deltas) == 2
    assert [d.event for d in deltas] == ["appeared", "moved"]
    # object normalized by the understand side.
    assert all(d.object == "blue_water_bottle" for d in deltas)
    assert deltas[0].frame_ref == "buf_0003"
    assert deltas[1].frame_ref == "buf_0005"
    # every emitted delta round-trips through the contract.
    for d in deltas:
        Delta.model_validate(d.model_dump(by_alias=True))


def test_low_confidence_escalates_to_cloud():
    local = MockProvider([Delta(object="keys", event="moved", to="hook",
                                confidence=0.5, observed_at=_now())])
    cloud = MockProvider([Delta(object="keys", event="moved", to="hook",
                                confidence=0.93, observed_at=_now())])
    service = UnderstandService(local, cloud, escalate_threshold=0.7)
    delta = service.process("[]", "buf_0001", b"")
    assert delta.confidence == pytest.approx(0.93)


def test_crosscheck_failure_emits_ambiguous():
    provider = MockProvider(
        [Delta(object="mug", event="moved", to="x", confidence=0.9, observed_at=_now())] * 2
    )
    service = UnderstandService(provider, crosscheck=lambda _d: False)
    delta = service.process("[]", "buf_0001", b"")
    assert delta.event == "ambiguous"
    assert delta.is_committable() is False

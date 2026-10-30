"""The engine loop (M2): capture -> gate -> understand -> commit (+ heartbeat).

This is where Track A's perception pipeline meets Track B's memory. It is the
*single writer*: the only place ``MemoryStore.commit_delta`` is called (Seam 2).
The HTTP API reads the same store concurrently (SQLite WAL + a write lock make
that safe in one process).

Flow per frame:
    1. buffer the frame -> get a transient ``frame_ref`` (frames never hit disk).
    2. feed it to the debouncer; most frames are boring and produce nothing.
    3. on a settled end-state frame, ask the VLM "what changed?" given the current
       memory as prior state, and commit the resulting ``Delta``.

Heartbeat: periodically re-validate fresh objects by committing ``unchanged``
deltas so ``last_seen`` advances (and staleness is meaningful downstream).

Factories here (``build_camera`` / ``build_understand_service``) live in the engine
because the engine is the core host — the one place allowed to import core modules
directly and pick concrete implementations from config.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone

import cv2
from core.capture.base import Camera, Frame
from core.capture.buffer import FrameBuffer
from core.capture.replay import ReplayCamera
from core.gate.debounce import Debouncer
from core.gate.differ import MotionGate
from core.geometry import BBox
from core.memory.store import MemoryStore
from core.understand.providers.base import VLMProvider
from core.understand.providers.cloud import KNOWN_BASE_URLS, CloudProvider
from core.understand.providers.local import LocalProvider
from core.understand.providers.mock import MockProvider
from core.understand.resolve import UnderstandService
from core.understand.schema.delta import Delta

from .config import Config

log = logging.getLogger("phantom.engine.loop")

# A believable 2-step script for PHANTOM_VLM_PROVIDER=mock, matching the fixture
# scene (bottle appears center, then moves right). Boxes are normalized 0..1 and
# track the bottle's position so the reveal overlay has something to draw. Cycles
# so the loop never runs dry offline.
_MOCK_SCRIPT = [
    Delta(object="blue_water_bottle", event="appeared", to="center of desk",
          relations=["on desk"], confidence=0.92,
          bbox=BBox(x=0.46, y=0.35, w=0.09, h=0.34),
          observed_at=datetime.now(timezone.utc)),
    Delta(object="blue_water_bottle", event="moved", from_="center of desk",
          to="behind laptop", relations=["left of monitor", "on desk"],
          confidence=0.88, bbox=BBox(x=0.70, y=0.48, w=0.09, h=0.34),
          observed_at=datetime.now(timezone.utc)),
]


def build_camera(config: Config) -> Camera:
    """Select a capture source from ``PHANTOM_CAMERA_SOURCE``."""
    source = config.camera_source.lower()
    if source == "replay":
        return ReplayCamera(config.replay_dir, interval=config.capture_interval)
    if source == "android":
        from core.capture.android import AndroidCamera

        return AndroidCamera(interval=config.capture_interval)
    if source == "iphone":
        from core.capture.iphone import IPhoneCamera

        return IPhoneCamera(interval=config.capture_interval)
    raise ValueError(f"unknown PHANTOM_CAMERA_SOURCE: {config.camera_source!r}")


def _build_cloud(config: Config, name: str) -> CloudProvider:
    base_url = KNOWN_BASE_URLS.get(name)
    return CloudProvider(
        model=config.cloud_model,
        api_key=config.cloud_vlm_key,
        base_url=base_url,
        name=name,
    )


def build_understand_service(config: Config) -> UnderstandService:
    """Pick the primary VLM provider from config and wire cloud escalation.

    ``local`` escalates to a cloud provider when a key is present (ADR-0002).
    ``nvidia``/``groq`` are themselves cloud primaries (no further escalation).
    ``mock`` runs fully offline.
    """
    provider_name = config.vlm_provider.lower()
    cloud: VLMProvider | None = None
    primary: VLMProvider

    if provider_name == "mock":
        primary = MockProvider(_MOCK_SCRIPT, cycle=True)
    elif provider_name == "local":
        primary = LocalProvider(model=config.ollama_model, host=config.ollama_host)
        if config.cloud_vlm_key:
            cloud = _build_cloud(config, "nvidia")
    elif provider_name in ("nvidia", "groq"):
        primary = _build_cloud(config, provider_name)
    else:
        raise ValueError(f"unknown PHANTOM_VLM_PROVIDER: {config.vlm_provider!r}")

    return UnderstandService(primary, cloud, escalate_threshold=config.escalate_threshold)


def encode_frame(frame: Frame) -> bytes:
    """PNG-encode a frame's image for transport to a VLM provider."""
    ok, buf = cv2.imencode(".png", frame.image)
    if not ok:
        raise RuntimeError("failed to PNG-encode frame")
    return buf.tobytes()


class EngineLoop:
    """Drives one perception pipeline against one store (the single writer)."""

    def __init__(
        self,
        store: MemoryStore,
        camera: Camera,
        understand: UnderstandService,
        config: Config,
        *,
        buffer: FrameBuffer | None = None,
        debouncer: Debouncer | None = None,
    ) -> None:
        self.store = store
        self.camera = camera
        self.understand = understand
        self.config = config
        self.buffer = buffer or FrameBuffer(
            capacity=config.buffer_capacity, retention_seconds=config.retention_seconds
        )
        self.debouncer = debouncer or Debouncer(
            MotionGate(motion_threshold=config.motion_threshold),
            settle_frames=config.settle_frames,
        )
        self._last_heartbeat = time.monotonic()

    # --------------------------------------------------------------- frame source
    def get_frame_png(self, frame_ref: str) -> bytes | None:
        """Resolve a transient ``frame_ref`` to PNG bytes from the RAM buffer.

        This is the ``frame_source`` the read-only API uses to serve reveal frames
        (``GET /api/frame/{frame_ref}``). Returns ``None`` once the frame has been
        evicted past its retention window, so the API degrades to a 404.
        """
        frame = self.buffer.get(frame_ref)
        return encode_frame(frame) if frame is not None else None

    # --------------------------------------------------------------- prior state
    def _prev_state_json(self) -> str:
        """Serialize current memory as the VLM's prior-state context."""
        state = [
            {"object": r.key, "location": r.location, "status": r.status}
            for r in self.store.all()
        ]
        return json.dumps(state, separators=(",", ":"))

    # ------------------------------------------------------------------ per frame
    def process_frame(self, frame: Frame) -> Delta | None:
        """Buffer + debounce one frame; on a settled change, understand + commit."""
        self.buffer.put(frame)
        end_state = self.debouncer.feed(frame)
        if end_state is None:
            return None
        return self._understand_and_commit(end_state)

    def _understand_and_commit(self, frame: Frame) -> Delta:
        frame_ref = self.buffer.put(frame)  # ensure the end-state frame is retained
        image_bytes = encode_frame(frame)
        delta = self.understand.process(self._prev_state_json(), frame_ref, image_bytes)
        record = self.store.commit_delta(delta)
        log.info(
            "committed delta %s",
            json.dumps(delta.model_dump(by_alias=True, mode="json"), separators=(",", ":")),
        )
        log.debug("record now: %s @ %s (%s)", record.key, record.location, record.status)
        return delta

    # --------------------------------------------------------------- heartbeat
    def maybe_heartbeat(self) -> list[Delta]:
        """If the heartbeat interval elapsed, re-validate fresh objects."""
        interval = self.config.heartbeat_minutes * 60.0
        if interval <= 0 or (time.monotonic() - self._last_heartbeat) < interval:
            return []
        self._last_heartbeat = time.monotonic()
        emitted: list[Delta] = []
        for record in self.store.all():
            if record.status != "fresh":
                continue
            delta = Delta(
                object=record.key,
                event="unchanged",
                to=record.location,
                relations=record.relations,
                confidence=record.confidence,
                frame_ref=record.frame_ref,
                observed_at=datetime.now(timezone.utc),
            )
            self.store.commit_delta(delta)
            emitted.append(delta)
        if emitted:
            log.info("heartbeat refreshed %d object(s)", len(emitted))
        return emitted

    # ------------------------------------------------------------------ run
    def run(
        self,
        *,
        max_frames: int | None = None,
        stop_event: threading.Event | None = None,
    ) -> list[Delta]:
        """Main loop. Finite sources (replay) end naturally; live sources poll.

        Returns every committed delta (useful for the replay demo and tests).
        """
        self.camera.open()
        committed: list[Delta] = []
        is_finite = isinstance(self.camera, ReplayCamera) and not self.camera.loop
        count = 0
        try:
            while True:
                if stop_event is not None and stop_event.is_set():
                    break
                if max_frames is not None and count >= max_frames:
                    break
                frame = self.camera.read()
                if frame is None:
                    if is_finite:
                        tail = self.debouncer.flush()
                        if tail is not None:
                            committed.append(self._understand_and_commit(tail))
                        break
                    time.sleep(self.config.capture_interval)
                    continue
                count += 1
                delta = self.process_frame(frame)
                if delta is not None:
                    committed.append(delta)
                self.maybe_heartbeat()
                if not is_finite:
                    time.sleep(self.config.capture_interval)
        finally:
            self.camera.close()
        return committed


def build_loop(store: MemoryStore, config: Config | None = None) -> EngineLoop:
    """Assemble an ``EngineLoop`` from config, sharing the given store."""
    config = config or Config.from_env()
    return EngineLoop(
        store=store,
        camera=build_camera(config),
        understand=build_understand_service(config),
        config=config,
    )

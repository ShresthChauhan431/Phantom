"""The engine loop (M2): capture -> gate -> understand -> commit (+ heartbeat).

This is where Track A's perception pipeline meets Track B's memory. It is the
*single writer*: the only place ``MemoryStore.commit_delta`` is called (Seam 2).
The HTTP API reads the same store concurrently (SQLite WAL + a write lock make
that safe in one process).

Flow per frame:
    1. feed it to the gate; most frames are boring and produce nothing.
    2. on a settled, persistent change, buffer that end-state frame (it becomes
       the screenshot), ask the VLM "what changed?" given current memory as prior
       state, and commit the resulting ``Delta``.

Startup and heartbeat: the VLM scans the real scene and commits what it sees, so
memory reflects the camera before anything moves, and ``last_seen`` only advances
for objects that were genuinely re-observed.

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
from core.understand.providers.base import ProviderError, VLMProvider
from core.understand.providers.cloud import KNOWN_BASE_URLS, CloudProvider
from core.understand.providers.local import LocalProvider
from core.understand.providers.mock import MockProvider
from core.understand.resolve import UnderstandService
from core.understand.schema.delta import Delta

from .config import Config
from .monitor import EngineMonitor

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

        return AndroidCamera(
            url=config.camera_url or None,
            device_index=config.camera_index,
            interval=config.capture_interval,
        )
    if source == "iphone":
        # A Continuity Camera is unreachable through OpenCV's index space, so the
        # Swift/AVFoundation bridge is the default. Use "index" only for a
        # webcam-bridge app (e.g. Camo) that registers as an ordinary device.
        if not config.camera_url and config.iphone_capture.lower() != "index":
            from core.capture.iphone_bridge import IPhoneBridgeCamera

            return IPhoneBridgeCamera(
                interval=config.capture_interval,
                unique_id=config.iphone_unique_id or None,
            )

        from core.capture.iphone import IPhoneCamera

        return IPhoneCamera(
            device_index=config.camera_index,
            interval=config.capture_interval,
            url=config.camera_url or None,
        )
    raise ValueError(f"unknown PHANTOM_CAMERA_SOURCE: {config.camera_source!r}")


def _build_cloud(config: Config, name: str) -> CloudProvider:
    base_url = KNOWN_BASE_URLS.get(name)
    return CloudProvider(
        model=config.cloud_model,
        api_key=config.cloud_vlm_keys,  # all keys; fails over on quota
        base_url=base_url,
        name=name,
        default_cooldown=config.key_cooldown_seconds,
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
        if config.cloud_vlm_keys:
            cloud = _build_cloud(config, "nvidia")
    elif provider_name in ("nvidia", "groq"):
        primary = _build_cloud(config, provider_name)
    else:
        raise ValueError(f"unknown PHANTOM_VLM_PROVIDER: {config.vlm_provider!r}")

    return UnderstandService(primary, cloud, escalate_threshold=config.escalate_threshold)


def encode_frame(frame: Frame, fmt: str = ".png", quality: int = 85) -> bytes:
    """Encode a frame's image for transport.

    PNG is used where fidelity matters (serving a reveal frame); JPEG is used for
    VLM uploads. Measured on a real 1920x1080 iPhone frame: 147KB as JPEG versus
    1.47MB as PNG — 10x less to upload on every captured change. (On flat synthetic
    fixtures PNG wins instead, which is why the format is explicit per call site.)
    """
    params = [cv2.IMWRITE_JPEG_QUALITY, quality] if fmt in (".jpg", ".jpeg") else []
    ok, buf = cv2.imencode(fmt, frame.image, params)
    if not ok:
        raise RuntimeError(f"failed to {fmt} encode frame")
    return buf.tobytes()


class EngineLoop:
    """Drives one perception pipeline against one store (the single writer).

    Lifecycle on a live camera:
      1. open the camera and wait for a real frame;
      2. **startup scan** — ask the VLM what is visible and commit it, so memory
         reflects the actual scene before anything moves;
      3. watch: every frame goes through the gate; a settled, *persistent* change
         is sent to the VLM ("what changed?") and committed;
      4. **heartbeat** — periodically re-scan the real scene; only objects the VLM
         genuinely sees again get their ``last_seen`` advanced.

    A VLM failure (rate limit, timeout, bad JSON) is recorded and skipped — it must
    never kill the loop, or the engine would silently stop observing. A camera that
    stops delivering frames is reconnected.
    """

    def __init__(
        self,
        store: MemoryStore,
        camera: Camera,
        understand: UnderstandService,
        config: Config,
        *,
        buffer: FrameBuffer | None = None,
        debouncer: Debouncer | None = None,
        monitor: EngineMonitor | None = None,
    ) -> None:
        self.store = store
        self.camera = camera
        self.understand = understand
        self.config = config
        self.buffer = buffer or FrameBuffer(
            capacity=config.buffer_capacity, retention_seconds=config.retention_seconds
        )
        self.debouncer = debouncer or Debouncer(
            MotionGate(motion_threshold=config.motion_threshold, open_ksize=config.gate_open_ksize),
            settle_frames=config.effective_settle_frames,
            change_threshold=config.change_threshold or None,
        )
        provider = understand.provider
        self.monitor = monitor or EngineMonitor(
            provider=getattr(provider, "name", "unknown"),
            model=getattr(provider, "model", getattr(provider, "name", "unknown")),
            camera_source=config.camera_source,
        )
        self.monitor.configure(
            motion_threshold=self.debouncer.gate.motion_threshold,
            change_threshold=self.debouncer.change_threshold,
            settle_seconds=config.settle_seconds,
            capture_interval=config.capture_interval,
        )
        keys = getattr(provider, "keys", None)
        if keys is not None and hasattr(keys, "status"):
            self.monitor.attach_keys(keys.status)
        self._last_heartbeat = time.monotonic()
        self._last_frame_mono: float | None = None

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
        """Gate one frame; on a settled persistent change, understand + commit.

        Only frames that may become a screenshot (settled end-states, scan frames)
        are buffered. Buffering every frame held ~6MB of raw 1080p per capture.
        """
        end_state = self.debouncer.feed(frame)
        gate = self.debouncer.gate
        self.monitor.gate_reading(
            score=getattr(gate, "last_score", 0.0),
            state=self.debouncer.state,
            promoted=self.debouncer.promoted,
            discarded=self.debouncer.discarded_transients,
        )
        if end_state is None:
            return None
        return self._understand_and_commit(end_state)

    def _understand_and_commit(self, frame: Frame) -> Delta | None:
        frame_ref = self.buffer.put(frame)
        image_bytes = encode_frame(frame, fmt=".jpg")  # JPEG: 10x smaller upload
        started = time.monotonic()
        try:
            delta = self.understand.process(
                self._prev_state_json(), frame_ref, image_bytes, observed_at=frame.ts
            )
        except ProviderError as exc:
            latency = int((time.monotonic() - started) * 1000)
            self.monitor.vlm_call(kind="change", latency_ms=latency, error=str(exc))
            log.warning("VLM change call failed, skipping this change: %s", exc)
            return None
        latency = int((time.monotonic() - started) * 1000)
        self.monitor.vlm_call(kind="change", latency_ms=latency)

        record = self.store.commit_delta(delta)
        self.monitor.trigger(kind="change", delta=delta, latency_ms=latency, status=record.status)
        log.info(
            "committed delta %s",
            json.dumps(delta.model_dump(by_alias=True, mode="json"), separators=(",", ":")),
        )
        return delta

    # ----------------------------------------------------------------- scanning
    def scan(self, frame: Frame, *, kind: str = "scan") -> list[Delta]:
        """Ask the VLM what is visible in ``frame`` and commit it.

        New objects are committed as ``appeared``. Objects already in memory that
        the model sees again are committed as ``unchanged``, which advances
        ``last_seen`` — only because they were really re-observed. Objects the
        model does not see are left alone: absence from one frame may be occlusion,
        so they go stale honestly instead of being declared removed on a guess.
        """
        if not hasattr(self.understand, "scan_scene"):
            return []
        self.monitor.set_state("scanning")
        frame_ref = self.buffer.put(frame)
        image_bytes = encode_frame(frame, fmt=".jpg")
        existing = {r.key: r for r in self.store.all()}

        started = time.monotonic()
        try:
            seen = self.understand.scan_scene(
                list(existing),
                frame_ref,
                image_bytes,
                observed_at=frame.ts,
                min_confidence=self.config.scan_min_confidence,
            )
        except ProviderError as exc:
            latency = int((time.monotonic() - started) * 1000)
            self.monitor.vlm_call(kind=kind, latency_ms=latency, error=str(exc))
            self.monitor.set_state("watching")
            log.warning("VLM scene scan failed: %s", exc)
            return []
        latency = int((time.monotonic() - started) * 1000)
        self.monitor.vlm_call(kind=kind, latency_ms=latency)

        committed: list[Delta] = []
        for delta in seen:
            known = existing.get(delta.object)
            if known is not None and known.status != "removed":
                delta = delta.model_copy(update={"event": "unchanged"})
            record = self.store.commit_delta(delta)
            self.monitor.trigger(kind=kind, delta=delta, latency_ms=latency, status=record.status)
            committed.append(delta)

        self.monitor.scan_done(len(committed))
        self.monitor.set_state("watching")
        log.info(
            "%s: VLM sees %d object(s) in %dms: %s",
            kind,
            len(committed),
            latency,
            ", ".join(f"{d.object}@{d.to}" for d in committed) or "none",
        )
        return committed

    # --------------------------------------------------------------- heartbeat
    def maybe_heartbeat(self, frame: Frame) -> list[Delta]:
        """Re-scan the real scene once the heartbeat interval has elapsed.

        Skipped while the gate is mid-motion: a scan of a moving scene would
        describe a half-finished action.
        """
        interval = self.config.heartbeat_minutes * 60.0
        if interval <= 0 or (time.monotonic() - self._last_heartbeat) < interval:
            return []
        if self.debouncer.state != "idle":
            return []
        self._last_heartbeat = time.monotonic()
        return self.scan(frame, kind="scan")

    # ------------------------------------------------------------------ run
    def _read(self) -> Frame | None:
        frame = self.camera.read()
        if frame is not None:
            self._last_frame_mono = time.monotonic()
            h, w = frame.image.shape[:2]
            self.monitor.frame(width=w, height=h, device=getattr(self.camera, "device_name", None))
        return frame

    def _reconnect(self) -> None:
        """Reopen a camera that stopped delivering frames (e.g. phone disconnected)."""
        self.monitor.set_state("reconnecting", "camera delivered no frames; reconnecting")
        log.warning("camera stalled for %.0fs; reconnecting", self.config.stall_seconds)
        try:
            self.camera.close()
        except Exception:
            log.debug("camera close failed during reconnect", exc_info=True)
        try:
            self.camera.open()
            self._last_frame_mono = time.monotonic()
            self.monitor.set_state("watching")
        except Exception as exc:  # noqa: BLE001 - keep retrying; never kill the loop
            self.monitor.set_state("reconnecting", f"camera unavailable: {exc}")
            time.sleep(5.0)

    def run_forever(
        self,
        stop_event: threading.Event,
        *,
        max_backoff: float = 30.0,
    ) -> None:
        """Keep the perception loop running until ``stop_event`` is set.

        Scanning must only end when the user stops the engine. ``run()`` can still
        end on its own — the phone may be unreachable at startup, or an unexpected
        error may escape the frame loop — so this restarts it after a short,
        growing pause (2s, 4s, … capped at ``max_backoff``) and records each
        restart in telemetry. A run that lasted a while resets the backoff.
        """
        backoff = 2.0
        restarts = 0
        # Let a provider waiting out a quota window notice shutdown at once.
        for p in (self.understand.provider, getattr(self.understand, "cloud_provider", None)):
            if p is not None and hasattr(p, "stop_event"):
                p.stop_event = stop_event
        while not stop_event.is_set():
            started = time.monotonic()
            try:
                self.run(stop_event=stop_event)
                if stop_event.is_set():
                    break
                reason = "perception loop ended unexpectedly"
            except Exception as exc:
                reason = f"{type(exc).__name__}: {exc}"
                log.exception("perception loop stopped; restarting")
            if time.monotonic() - started > 120:
                backoff = 2.0  # it was healthy for a while: restart quickly
            restarts += 1
            self.monitor.restarted(restarts, reason)
            self.monitor.set_state("reconnecting", f"restarting in {backoff:.0f}s — {reason}")
            log.warning("restarting perception loop in %.0fs (%s)", backoff, reason)
            if stop_event.wait(backoff):
                break
            backoff = min(backoff * 2, max_backoff)
            # A fresh start must re-scan the scene: memory may be stale after a gap.
            self._last_heartbeat = time.monotonic()
        self.monitor.set_state("stopped")

    def run(
        self,
        *,
        max_frames: int | None = None,
        stop_event: threading.Event | None = None,
    ) -> list[Delta]:
        """Main loop. Finite sources (replay) end naturally; live sources poll.

        Returns every committed delta (useful for tests).
        """
        self.monitor.set_state("starting")
        try:
            self.camera.open()
        except Exception as exc:
            self.monitor.set_state("error", f"camera failed to open: {exc}")
            raise
        self._last_frame_mono = time.monotonic()

        committed: list[Delta] = []
        is_finite = isinstance(self.camera, ReplayCamera) and not self.camera.loop
        count = 0
        scanned = False
        try:
            while True:
                if stop_event is not None and stop_event.is_set():
                    break
                if max_frames is not None and count >= max_frames:
                    break
                frame = self._read()
                if frame is None:
                    if is_finite:
                        tail = self.debouncer.flush()
                        if tail is not None:
                            delta = self._understand_and_commit(tail)
                            if delta is not None:
                                committed.append(delta)
                        break
                    if (
                        self._last_frame_mono is not None
                        and time.monotonic() - self._last_frame_mono > self.config.stall_seconds
                    ):
                        self._reconnect()
                    else:
                        time.sleep(min(self.config.capture_interval, 0.5))
                    continue
                count += 1

                if not scanned:
                    # First real frame: learn what is actually on the desk now.
                    scanned = True
                    committed.extend(self.scan(frame, kind="startup_scan"))
                    self._last_heartbeat = time.monotonic()
                    self.debouncer.feed(frame)  # baseline reference for the gate
                    continue

                delta = self.process_frame(frame)
                if delta is not None:
                    committed.append(delta)
                committed.extend(self.maybe_heartbeat(frame))
                if not is_finite:
                    # Interruptible, so closing the engine never waits out a frame.
                    if stop_event is not None:
                        if stop_event.wait(self.config.capture_interval):
                            break
                    else:
                        time.sleep(self.config.capture_interval)
        finally:
            self.monitor.set_state("stopped")
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

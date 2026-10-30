"""iPhone capture via a Swift/AVFoundation helper process.

WHY: OpenCV cannot reach a Continuity Camera from a plain Python process. Doing so
requires the ``NSCameraUseContinuityCameraDeviceType`` Info.plist opt-in, which a
bare interpreter cannot declare — verified on hardware, where every OpenCV index
served the built-in camera while Swift captured the iPhone without trouble.

So ``scripts/iphone_stream.swift`` owns the capture and streams length-prefixed
JPEG frames over stdout; this adapter decodes them into ``Frame`` objects. The
device is chosen by AVFoundation **uniqueID** (or by name containing "iphone"), so
there is no positional-index ambiguity and the built-in camera can never be opened
by mistake.

Frames are decoded in a reader thread that keeps only the newest frame, so the
engine loop always gets a current view rather than a backlog, and nothing is
written to disk.
"""

from __future__ import annotations

import logging
import re
import struct
import subprocess
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from .base import Frame

log = logging.getLogger("phantom.capture.iphone_bridge")

_SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "iphone_stream.swift"
_HEADER = 4  # bytes, big-endian frame length
_DEVICE_LINE = re.compile(r"device:\s*(.+?)\s*\[([^\]]+)\]")


class IPhoneBridgeCamera:
    """``Camera`` backed by the Swift AVFoundation streamer."""

    def __init__(
        self,
        *,
        interval: float = 2.0,
        unique_id: str | None = None,
        fps: float | None = None,
        quality: float = 0.8,
        startup_timeout: float = 90.0,
        lock_after: float = 3.0,
        settle_extra: float = 1.5,
        script: Path | None = None,
    ) -> None:
        self.interval = interval
        self.unique_id = unique_id
        # Stream a little faster than we consume so a frame is always ready.
        self.fps = fps if fps is not None else max(1.0, 1.0 / max(interval, 0.1))
        self.quality = quality
        self.startup_timeout = startup_timeout
        # The helper locks exposure/white-balance after `lock_after` seconds; frames
        # captured before that still drift in brightness, which the gate would read
        # as motion. Hold open() until the lock has taken effect.
        self.lock_after = lock_after
        self.settle_extra = settle_extra
        self.script = script or _SCRIPT

        self._proc: subprocess.Popen[bytes] | None = None
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._latest: np.ndarray | None = None
        self._frames_seen = 0
        self._last_frame_at: float | None = None
        self._seq = 0
        self._stderr: list[str] = []
        #: Name/id of the AVFoundation device actually opened, as reported by the
        #: helper. Lets callers state which camera is live instead of assuming.
        self.device_name: str | None = None
        self.device_id: str | None = None

    # ---------------------------------------------------------------- lifecycle
    def open(self) -> None:
        if not self.script.is_file():
            raise FileNotFoundError(f"Swift capture helper not found: {self.script}")
        cmd = [
            "swift",
            str(self.script),
            "--fps",
            f"{self.fps:g}",
            "--quality",
            f"{self.quality:g}",
            "--lock-after",
            f"{self.lock_after:g}",
        ]
        if self.unique_id:
            cmd += ["--unique-id", self.unique_id]

        self._stop.clear()
        self._proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0
        )
        self._thread = threading.Thread(target=self._read_loop, name="iphone-bridge", daemon=True)
        self._thread.start()
        threading.Thread(target=self._drain_stderr, name="iphone-bridge-err", daemon=True).start()

        # `swift` compiles the helper on first run, then auto-exposure settles, so
        # the first frame can take a while. Wait for proof of life.
        started = time.monotonic()
        deadline = started + self.startup_timeout
        while time.monotonic() < deadline:
            with self._lock:
                if self._latest is not None:
                    elapsed = time.monotonic() - started
                    # Wait out the exposure lock so the first frames the gate sees
                    # are photometrically stable, not mid-adjustment.
                    remaining = (self.lock_after + self.settle_extra) - elapsed
                    if remaining > 0:
                        time.sleep(remaining)
                    log.info(
                        "iPhone bridge streaming after %.1fs (exposure settled)",
                        time.monotonic() - started,
                    )
                    return
            if self._proc.poll() is not None:
                break
            time.sleep(0.2)

        detail = " ".join(self._stderr[-4:]) or "no output from helper"
        self.close()
        raise RuntimeError(
            f"iPhone capture did not start within {self.startup_timeout:g}s: {detail}. "
            "For Continuity Camera: same Apple ID on both devices, Wi-Fi + Bluetooth on, "
            "iPhone locked and stationary with its rear cameras facing the scene."
        )

    def read(self) -> Frame | None:
        with self._lock:
            image = self._latest
            self._latest = None  # consume, so we never re-serve a stale frame
        if image is None:
            # No new frame yet; wait briefly rather than reporting end-of-stream.
            deadline = time.monotonic() + max(self.interval, 2.0)
            while time.monotonic() < deadline:
                time.sleep(0.05)
                with self._lock:
                    image = self._latest
                    self._latest = None
                if image is not None:
                    break
        if image is None:
            return None
        frame = Frame(image=image, seq=self._seq, ts=datetime.now(timezone.utc))
        self._seq += 1
        return frame

    def close(self) -> None:
        self._stop.set()
        proc, self._proc = self._proc, None
        if proc is not None:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            except OSError:
                pass  # already gone
        thread, self._thread = self._thread, None
        if thread is not None and thread.is_alive():
            thread.join(timeout=2)
        with self._lock:
            self._latest = None

    # ------------------------------------------------------------------ internals
    def _read_exact(self, stream, count: int) -> bytes | None:
        chunks, remaining = [], count
        while remaining > 0:
            if self._stop.is_set():
                return None
            block = stream.read(remaining)
            if not block:
                return None
            chunks.append(block)
            remaining -= len(block)
        return b"".join(chunks)

    def _read_loop(self) -> None:
        proc = self._proc
        if proc is None or proc.stdout is None:
            return
        while not self._stop.is_set():
            header = self._read_exact(proc.stdout, _HEADER)
            if header is None:
                break
            (length,) = struct.unpack(">I", header)
            if not 0 < length <= 64 * 1024 * 1024:
                log.error("iPhone bridge: implausible frame length %d; stopping", length)
                break
            payload = self._read_exact(proc.stdout, length)
            if payload is None:
                break
            image = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
            if image is None:
                continue
            with self._lock:
                self._latest = image
                self._frames_seen += 1
                self._last_frame_at = time.monotonic()

    def _drain_stderr(self) -> None:
        proc = self._proc
        if proc is None or proc.stderr is None:
            return
        for raw in iter(proc.stderr.readline, b""):
            if self._stop.is_set():
                return
            line = raw.decode("utf-8", "replace").strip()
            if line:
                self._stderr.append(line)
                del self._stderr[:-50]  # bounded: this runs for the life of the engine
                # The helper announces the AVFoundation device it opened, e.g.
                # "[iphone_stream] device: Devansh’s iPhone Camera [1972EF6F-...]".
                found = _DEVICE_LINE.search(line)
                if found:
                    self.device_name = found.group(1).strip()
                    self.device_id = found.group(2).strip()
                    log.info("iPhone bridge opened device: %s", self.device_name)
                log.debug("iphone_stream: %s", line)

    # -------------------------------------------------------------- telemetry
    @property
    def frames_seen(self) -> int:
        """Frames decoded since open — proof the camera is really streaming."""
        return self._frames_seen

    @property
    def last_frame_at(self) -> float | None:
        """``time.monotonic()`` of the newest decoded frame, or None."""
        return self._last_frame_at

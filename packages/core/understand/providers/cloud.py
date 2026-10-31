"""Cloud VLM provider — OpenAI-compatible (Groq, NVIDIA).

NVIDIA and Groq both expose OpenAI-compatible chat endpoints, so a single client
covers ``PHANTOM_VLM_PROVIDER=nvidia|groq`` by swapping ``base_url`` + ``model``.
Like ``local.py``, this is one of the only modules permitted to call a model.

Two questions are asked of the model:
  * ``whats_changed`` — after a settled change: what is the single change?
  * ``scan_scene``    — at startup and on heartbeat: what is visible right now?

Several API keys may be configured. When the active key hits its quota or rate
limit (HTTP 429) or is rejected (401/403), the request is retried at once on the
next key; the failed key sits out for its cooldown (see ``keypool.py``). Only when
*every* key is cooling down does a call wait — for the soonest one to free up —
and then it proceeds, so a quota never stops the engine.
"""

from __future__ import annotations

import base64
import logging
import re
import threading
import time
from collections.abc import Sequence
from datetime import datetime
from pathlib import Path

from ..schema.delta import Delta
from .base import ProviderError, parse_delta_json, parse_inventory_json
from .keypool import KeyPool

log = logging.getLogger("phantom.understand.cloud")

_PROMPTS = Path(__file__).resolve().parent.parent / "prompts"
_PROMPT_PATH = _PROMPTS / "delta.txt"
_INVENTORY_PATH = _PROMPTS / "inventory.txt"

# Convenience base URLs for the common OpenAI-compatible vision backends.
KNOWN_BASE_URLS = {
    "nvidia": "https://integrate.api.nvidia.com/v1",
    "groq": "https://api.groq.com/openai/v1",
    "openai": None,  # library default
}

# "Please try again in 7m12.5s" / "in 1h2m" / "in 850ms" — Groq states the wait in
# the error message as well as (sometimes) in a retry-after header.
_TRY_AGAIN = re.compile(r"try again in\s+((?:\d+(?:\.\d+)?\s*(?:h|ms|m|s)\s*)+)", re.IGNORECASE)
_DURATION_PART = re.compile(r"(\d+(?:\.\d+)?)\s*(ms|h|m|s)", re.IGNORECASE)


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


def _image_mime(image_bytes: bytes) -> str:
    """Detect the payload format so the data URL advertises the right MIME type.

    The loop sends JPEG to keep uploads small (measured on a real 1920x1080 iPhone
    frame: 147KB as JPEG versus 1.47MB as PNG), but callers may send either.
    """
    if image_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    return "image/png"


def _parse_duration(text: str) -> float | None:
    total, found = 0.0, False
    for value, unit in _DURATION_PART.findall(text):
        found = True
        v = float(value)
        total += {"h": 3600.0, "m": 60.0, "s": 1.0, "ms": 0.001}[unit.lower()] * v
    return total if found else None


def retry_after_seconds(exc: Exception) -> float | None:
    """How long the server says to back off, from the header or the message."""
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None) or {}
    try:
        header = headers.get("retry-after")
    except AttributeError:
        header = None
    if header:
        try:
            return float(header)
        except ValueError:
            pass
    match = _TRY_AGAIN.search(str(exc))
    return _parse_duration(match.group(1)) if match else None


def classify_failure(exc: Exception) -> str | None:
    """'rate_limited' / 'rejected' for errors another key can fix, else None.

    Only these two warrant switching keys. Anything else (timeouts, 5xx, a bad
    image) would fail the same way on every key, so rotating would just burn quota.
    """
    status = getattr(exc, "status_code", None)
    if status is None:
        status = getattr(getattr(exc, "response", None), "status_code", None)
    if status == 429:
        return "rate_limited"
    if status in (401, 403):
        return "rejected"
    return None


class CloudProvider:
    """OpenAI-compatible provider. ``name`` reflects the backend (nvidia/groq/cloud)."""

    def __init__(
        self,
        model: str,
        api_key: str | Sequence[str],
        *,
        base_url: str | None = None,
        name: str = "cloud",
        prompt_template: str | None = None,
        inventory_template: str | None = None,
        timeout: float = 45.0,
        default_cooldown: float = 60.0,
        max_wait: float = 15 * 60.0,
        client_factory=None,
    ) -> None:
        keys = [api_key] if isinstance(api_key, str) else list(api_key)
        if not any((k or "").strip() for k in keys):
            raise ProviderError("cloud provider requires an API key")
        self.model = model
        self.name = name
        self.keys = KeyPool(keys, default_cooldown=default_cooldown)
        self._base_url = base_url
        self._prompt_template = prompt_template or _load_prompt()
        self._inventory_template = inventory_template or _INVENTORY_PATH.read_text(
            encoding="utf-8"
        )
        self._timeout = timeout
        # Upper bound on one wait when every key is benched, so a stop request
        # (or a fixed key) is noticed; the loop simply calls again afterwards.
        self._max_wait = max_wait
        self._client_factory = client_factory
        self._clients: dict[int, object] = {}
        self._clients_lock = threading.Lock()
        #: Set by the engine; lets a quota wait end immediately on shutdown.
        self.stop_event: threading.Event | None = None

    # ----------------------------------------------------------------- client
    def _client_for(self, index: int, key: str):
        with self._clients_lock:
            client = self._clients.get(index)
            if client is None:
                if self._client_factory is not None:
                    client = self._client_factory(key)
                else:
                    try:
                        from openai import OpenAI
                    except ImportError as exc:  # pragma: no cover - environment dependent
                        raise ProviderError("openai package is not installed") from exc
                    # max_retries=0: the SDK would otherwise sleep and retry a 429 on
                    # the SAME exhausted key. Rotating to the next key is the retry.
                    kwargs = {"api_key": key, "timeout": self._timeout, "max_retries": 0}
                    if self._base_url:
                        kwargs["base_url"] = self._base_url
                    client = OpenAI(**kwargs)
                self._clients[index] = client
            return client

    @property
    def key_status(self) -> dict:
        return self.keys.status()

    # ---------------------------------------------------------------- calling
    def _complete(self, prompt: str, image_bytes: bytes) -> str:
        """One strict-JSON chat completion over a single image, with key failover."""
        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        mime = _image_mime(image_bytes)
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
                ],
            }
        ]

        waited = 0.0
        while True:
            acquired = self.keys.acquire()
            if acquired is None:
                # Every key is cooling down. Wait for the soonest, then carry on.
                remaining = self._max_wait - waited
                if remaining <= 0:
                    raise ProviderError(
                        f"all {len(self.keys)} API keys are over quota "
                        f"(waited {waited:.0f}s); will retry on the next call"
                    )
                pause = min(max(self.keys.seconds_until_available(), 0.2), 30.0, remaining)
                log.warning("all %d API keys cooling down; waiting %.0fs", len(self.keys), pause)
                # Interruptible: closing the engine must not wait out a quota window.
                if self.stop_event is not None and self.stop_event.wait(pause):
                    raise ProviderError("engine stopping")
                if self.stop_event is None:
                    time.sleep(pause)
                waited += pause
                continue

            index, key = acquired
            client = self._client_for(index, key)
            try:
                resp = client.chat.completions.create(
                    model=self.model,
                    temperature=0.0,
                    response_format={"type": "json_object"},
                    messages=messages,
                )
            except Exception as exc:
                kind = classify_failure(exc)
                if kind is None:
                    raise ProviderError(f"cloud chat failed: {exc}") from exc
                retry_after = retry_after_seconds(exc)
                self.keys.report_failure(index, kind=kind, error=str(exc), retry_after=retry_after)
                log.warning(
                    "%s %s (retry after %s) — switching to the next key",
                    self.keys.status()["keys"][index]["label"],
                    kind,
                    f"{retry_after:.0f}s" if retry_after else "unknown",
                )
                continue  # same request, next key, no wait

            self.keys.report_success(index)
            return resp.choices[0].message.content or ""

    def whats_changed(self, prev_state_json: str, frame_ref: str, image_bytes: bytes) -> Delta:
        prompt = self._prompt_template.format(prev_state_json=prev_state_json)
        return parse_delta_json(self._complete(prompt, image_bytes), frame_ref=frame_ref)

    def scan_scene(
        self,
        known_json: str,
        frame_ref: str,
        image_bytes: bytes,
        observed_at: datetime | None = None,
    ) -> list[Delta]:
        prompt = self._inventory_template.format(known_json=known_json)
        return parse_inventory_json(
            self._complete(prompt, image_bytes), frame_ref=frame_ref, observed_at=observed_at
        )

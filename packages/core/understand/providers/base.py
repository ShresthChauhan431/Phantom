"""VLM provider interface (Perception §C) + shared JSON->Delta parsing.

A provider's one job: given the previous room state and the new end-state frame,
ask a vision-language model "what changed?" and return a validated ``Delta``.
Only modules in this ``providers/`` package may talk to an actual model
(shared-contracts §1.4). Everything upstream depends on the ``VLMProvider``
protocol, never on a concrete model client.

Provider selection and escalation are *not* a provider's concern — they live in
the understand service (``resolve.py`` glue). A provider parses exactly one model
response into one ``Delta``.
"""

from __future__ import annotations

import json
import re
from typing import Any, Protocol, runtime_checkable

from core.geometry import BBox

from ..schema.delta import Delta


class ProviderError(RuntimeError):
    """Raised when a provider cannot produce a valid Delta (network, bad JSON, etc.)."""


@runtime_checkable
class VLMProvider(Protocol):
    """Swappable model backend. Implementations: local (Ollama), cloud, mock."""

    name: str

    def whats_changed(self, prev_state_json: str, frame_ref: str, image_bytes: bytes) -> Delta:
        """Compare the new frame to the previous state and return the observed change."""
        ...


_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def _clamp01(v: float) -> float:
    return min(max(v, 0.0), 1.0)


def coerce_bbox(raw: Any) -> BBox | None:
    """Best-effort parse of a model's bounding box into a normalized ``BBox`` (0..1).

    Tolerant of the shapes VLMs actually emit: ``{x,y,w,h}``, ``{x,y,width,height}``,
    ``[x,y,w,h]`` (top-left + size) or ``{x1,y1,x2,y2}``/``[x1,y1,x2,y2]`` (corners).
    Values are clamped into range. Returns ``None`` for anything unparseable or a
    degenerate (zero-area) box — a bad box is dropped, never fatal to the Delta.
    """
    if raw is None:
        return None
    x = y = w = h = None
    try:
        if isinstance(raw, dict):
            if {"x", "y", "w", "h"} <= raw.keys():
                x, y, w, h = raw["x"], raw["y"], raw["w"], raw["h"]
            elif {"x", "y", "width", "height"} <= raw.keys():
                x, y, w, h = raw["x"], raw["y"], raw["width"], raw["height"]
            elif {"x1", "y1", "x2", "y2"} <= raw.keys():
                x, y, w, h = raw["x1"], raw["y1"], raw["x2"] - raw["x1"], raw["y2"] - raw["y1"]
            else:
                return None
        elif isinstance(raw, (list, tuple)) and len(raw) == 4:
            a, b, c, d = (float(v) for v in raw)
            # Heuristic: if the last two look like coords beyond the first, treat as corners.
            x, y, w, h = (a, b, c - a, d - b) if (c > a and d > b and c <= 1.0 and d <= 1.0) else (a, b, c, d)
        else:
            return None
        x, y = _clamp01(float(x)), _clamp01(float(y))
        w, h = float(w), float(h)
        if w <= 0 or h <= 0:
            return None
        return BBox(x=x, y=y, w=min(w, 1.0), h=min(h, 1.0))
    except (TypeError, ValueError, KeyError):
        return None


def parse_delta_json(raw: str, *, frame_ref: str | None = None) -> Delta:
    """Parse a model's raw text response into a validated ``Delta``.

    VLMs often wrap JSON in prose or ```json fences. This pulls out the first
    balanced-looking JSON object, validates it against the Delta contract (honoring
    the ``from`` alias), stamps ``frame_ref`` when omitted, and attaches a grounded
    ``bbox`` when the model supplied a usable one. A malformed box is dropped rather
    than failing the whole Delta.

    Raises:
        ProviderError: if no parseable JSON object matching the schema is found.
    """
    match = _JSON_OBJECT_RE.search(raw or "")
    if not match:
        raise ProviderError(f"no JSON object found in model response: {raw!r:.200}")
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise ProviderError(f"model response was not valid JSON: {exc}") from exc
    if frame_ref is not None and not payload.get("frame_ref"):
        payload["frame_ref"] = frame_ref
    # Pull bbox out and coerce it separately so a bad box never rejects a good Delta.
    bbox = coerce_bbox(payload.pop("bbox", None))
    try:
        delta = Delta.model_validate(payload)
    except Exception as exc:  # pydantic ValidationError -> uniform provider error
        raise ProviderError(f"model JSON did not match Delta schema: {exc}") from exc
    if bbox is not None:
        delta = delta.model_copy(update={"bbox": bbox})
    return delta

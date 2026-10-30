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
from typing import Protocol, runtime_checkable

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


def parse_delta_json(raw: str, *, frame_ref: str | None = None) -> Delta:
    """Parse a model's raw text response into a validated ``Delta``.

    VLMs often wrap JSON in prose or ```json fences. This pulls out the first
    balanced-looking JSON object, validates it against the Delta contract (honoring
    the ``from`` alias), and stamps ``frame_ref`` when the model omitted it.

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
    try:
        return Delta.model_validate(payload)
    except Exception as exc:  # pydantic ValidationError -> uniform provider error
        raise ProviderError(f"model JSON did not match Delta schema: {exc}") from exc

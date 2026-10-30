"""Understand glue: normalize, escalate, cross-check, resolve.

This is the orchestration layer the engine loop calls. Providers (``providers/``)
each know how to ask one model "what changed?"; this module turns a raw provider
answer into a trustworthy, contract-compliant ``Delta``:

  1. Normalize ``object`` to lowercase snake_case (the Perception side owns this).
  2. If the primary (local) answer is low-confidence (``< threshold``) and a cloud
     provider is configured, escalate and keep the more confident answer (ADR-0002).
  3. Cross-check the answer (text vs. grounded region). If it disagrees, re-sample
     once; if it still disagrees, emit ``event="ambiguous"`` so Memory never
     overwrites on a guess (shared-contracts §3).

The grounded-region cross-check is a stub until the understand step emits ``bbox``
(an M3 task); by default it trusts the text, so the pipeline is correct now and the
ambiguous path is already wired for when real cross-checks arrive.
"""

from __future__ import annotations

import re
from collections.abc import Callable

from .providers.base import ProviderError, VLMProvider
from .schema.delta import Delta

_NON_ALNUM = re.compile(r"[^a-z0-9]+")

# A cross-check decides whether a delta's text is internally consistent with any
# grounded evidence. Returns True when it agrees (safe to emit as-is).
CrossCheck = Callable[[Delta], bool]


def normalize_object(name: str) -> str:
    """Lowercase snake_case key: ``"Blue Water Bottle"`` -> ``"blue_water_bottle"``."""
    key = _NON_ALNUM.sub("_", name.strip().lower())
    return key.strip("_")


def normalize_delta(delta: Delta) -> Delta:
    """Return a copy of ``delta`` with its ``object`` normalized to snake_case."""
    normalized = normalize_object(delta.object)
    if normalized == delta.object:
        return delta
    return delta.model_copy(update={"object": normalized})


def _more_confident(a: Delta, b: Delta) -> Delta:
    """Pick the more trustworthy of two answers; ties go to ``b`` (the escalation)."""
    return a if a.confidence > b.confidence else b


def _mark_ambiguous(delta: Delta) -> Delta:
    """Re-cast a delta as ambiguous without losing its identity/context."""
    return delta.model_copy(update={"event": "ambiguous"})


def _default_crosscheck(_delta: Delta) -> bool:
    # No grounded regions yet (bbox is an M3 task) -> trust the text.
    return True


class UnderstandService:
    """Turns an end-state frame into one validated, trustworthy ``Delta``.

    Args:
        provider: primary (usually local) VLM provider.
        cloud_provider: optional escalation target for low-confidence answers.
        escalate_threshold: confidence below which escalation fires (contract: 0.7).
        crosscheck: predicate deciding whether an answer is internally consistent.
    """

    def __init__(
        self,
        provider: VLMProvider,
        cloud_provider: VLMProvider | None = None,
        *,
        escalate_threshold: float = 0.7,
        crosscheck: CrossCheck | None = None,
    ) -> None:
        self.provider = provider
        self.cloud_provider = cloud_provider
        self.escalate_threshold = escalate_threshold
        self.crosscheck = crosscheck or _default_crosscheck

    def process(self, prev_state_json: str, frame_ref: str, image_bytes: bytes) -> Delta:
        delta = normalize_delta(self.provider.whats_changed(prev_state_json, frame_ref, image_bytes))

        # 2. Escalate low-confidence answers to the cloud, keep the better one.
        if delta.needs_escalation(self.escalate_threshold) and self.cloud_provider is not None:
            try:
                cloud = normalize_delta(
                    self.cloud_provider.whats_changed(prev_state_json, frame_ref, image_bytes)
                )
                delta = _more_confident(delta, cloud)
            except ProviderError:
                # Cloud unreachable -> fall back to the local answer unchanged.
                pass

        # 3. Cross-check; disagreement -> re-sample once -> still bad -> ambiguous.
        if not self.crosscheck(delta):
            try:
                resampled = normalize_delta(
                    self.provider.whats_changed(prev_state_json, frame_ref, image_bytes)
                )
            except ProviderError:
                resampled = None
            if resampled is not None and self.crosscheck(resampled):
                delta = resampled
            else:
                delta = _mark_ambiguous(resampled or delta)

        return delta

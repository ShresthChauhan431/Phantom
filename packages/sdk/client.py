"""
Phantom SDK — typed client over the localhost HTTP API.

Layers, the CLI, and the dashboard talk to Phantom ONLY through this client, never
through packages/core directly (see docs/working/shared-contracts.md §1, §5).

The record/payload types are re-exported from core so callers get one consistent
set of models without importing core internals themselves.
"""
from __future__ import annotations

import httpx

from core.memory.models import HistoryEntry, ObjectRecord
from core.reveal.compose import RevealPayload

__all__ = ["PhantomClient", "ObjectRecord", "HistoryEntry", "RevealPayload"]


class PhantomClient:
    """Typed, synchronous client for the Phantom engine API."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        *,
        client: httpx.Client | None = None,
        timeout: float = 10.0,
    ) -> None:
        self._own_client = client is None
        self._client = client or httpx.Client(base_url=base_url, timeout=timeout)

    # context-manager support
    def __enter__(self) -> "PhantomClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        if self._own_client:
            self._client.close()

    # ------------------------------------------------------------- endpoints
    def health(self) -> dict:
        return self._get("/api/health").json()

    def objects(self) -> list[ObjectRecord]:
        data = self._get("/api/objects").json()
        return [ObjectRecord.model_validate(o) for o in data]

    def query(self, q: str) -> list[ObjectRecord]:
        data = self._get("/api/query", params={"q": q}).json()
        return [ObjectRecord.model_validate(o) for o in data]

    def history(self, key: str) -> list[HistoryEntry]:
        data = self._get(f"/api/objects/{key}/history").json()
        return [HistoryEntry.model_validate(h) for h in data]

    def reveal(self, key: str) -> RevealPayload:
        data = self._get(f"/api/reveal/{key}").json()
        return RevealPayload.model_validate(data)

    # ---------------------------------------------------------------- helper
    def _get(self, path: str, **kw: object) -> httpx.Response:
        resp = self._client.get(path, **kw)
        resp.raise_for_status()
        return resp

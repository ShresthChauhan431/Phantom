"""
Phantom Engine — HTTP API (read-only serving surface).

Exposes the memory for queries, history, and reveal. This layer NEVER writes to the
store — commits happen in-process via the engine loop (single writer). Contract in
docs/working/shared-contracts.md §5.

Owned by Track B (Memory & Serving / Shresth).
"""
from __future__ import annotations

import os

from fastapi import APIRouter, FastAPI, HTTPException, Query

from core.memory.models import HistoryEntry, ObjectRecord
from core.memory.store import MemoryStore
from core.query.search import search
from core.reveal.compose import RevealPayload, compose_reveal

# Optional human aliases → object keys. Extend as the demo needs.
DEFAULT_ALIASES: dict[str, str] = {
    "specs": "glasses",
    "spectacles": "glasses",
    "water bottle": "blue_water_bottle",
    "bottle": "blue_water_bottle",
    "phone": "mobile_phone",
}


def create_api(store: MemoryStore, aliases: dict[str, str] | None = None) -> FastAPI:
    """Build a FastAPI app bound to a given store (used by main.py and by tests)."""
    app = FastAPI(title="Phantom Engine", version="0.1.0")
    router = APIRouter(prefix="/api")
    alias_map = DEFAULT_ALIASES if aliases is None else aliases

    @router.get("/health")
    def health() -> dict:
        return {"status": "healthy"}

    @router.get("/objects", response_model=list[ObjectRecord])
    def objects() -> list[ObjectRecord]:
        return store.all()

    @router.get("/query", response_model=list[ObjectRecord])
    def query(q: str = Query(..., min_length=1)) -> list[ObjectRecord]:
        return search(q, store.all(), aliases=alias_map)

    @router.get("/objects/{key}/history", response_model=list[HistoryEntry])
    def history(key: str) -> list[HistoryEntry]:
        if store.get(key) is None:
            raise HTTPException(status_code=404, detail=f"unknown object: {key}")
        return store.history(key)

    @router.get("/reveal/{key}", response_model=RevealPayload)
    def reveal(key: str) -> RevealPayload:
        record = store.get(key)
        if record is None:
            raise HTTPException(status_code=404, detail=f"unknown object: {key}")
        return compose_reveal(record)

    app.include_router(router)
    return app


def _default_store() -> MemoryStore:
    return MemoryStore(os.environ.get("PHANTOM_DB_PATH", "data/phantom.db"))


def get_app() -> FastAPI:
    """ASGI factory (side-effect free import). Used by `uvicorn --factory` / main.py."""
    return create_api(_default_store())

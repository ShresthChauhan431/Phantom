# Shresth — Working Path (Track B: Memory & Serving)

> Your branch: **`shresthBranch`** (currently `ShresthBranch` locally — same branch).
> Partner: Dhwanit on Track A (Perception), branch `dhwanitBranch`.
> **Source of truth is `shared-contracts.md`.** The critical contract + git rules are also
> copied into §A–§C below so you never have to leave this file. If a contract changes, it
> changes in `shared-contracts.md` first, then here and in Dhwanit's doc in the same commit.

---

## Your mission

Own the **memory and the serving surface**: the SQLite KV store with history, the query/search,
the reveal payload, the FastAPI read API, the SDK, and the demo seeder. You make Phantom
*answerable*. You can build and fully test **without a camera and without a VLM** by feeding
fake deltas and seeded data.

## Directories you own

```
packages/core/memory/      store.py, models.py, migrations/
packages/core/query/       search.py
packages/core/reveal/      compose.py
apps/engine/api.py         FastAPI read-only routes
packages/sdk/              client.py (+ typed models re-export)
scripts/seed_demo.py       fake an evening of object moves for the demo
```

Co-owned (announce before editing): `understand/schema/delta.py`, `apps/engine/main.py`,
`pyproject.toml`, `Makefile`, `.env.example`.

## Do NOT

- Do **not** touch `capture/`, `gate/`, `understand/` (except reading `delta.py`) or
  `engine/loop.py` — that's Dhwanit.
- Do **not** make the API write to the store. **Commit is in-process only** (the loop calls
  `commit_delta`). The API is **read-only**.
- Do **not** let anything outside `apps/engine` import `packages/core`. Layers/CLI use the SDK.

---

## Task checklist (in order)

### M0 — Kickoff (do WITH Dhwanit first, commit to `main`)
- [ ] Co-write `packages/core/memory/models.py`: `ObjectRecord`, `HistoryEntry` (Pydantic v2).
- [ ] Co-write the `MemoryStore` interface stub in `store.py` (signatures from §B).
- [ ] Agree the delta shape in `understand/schema/delta.py` with Dhwanit (he owns the file; you
      confirm the fields your store consumes).
- [ ] Agree the API path list and SDK signatures (§C). Commit all of this to `main`, then both
      branch off / merge.

### M1 — Build in isolation (your branch)
- [ ] `memory/store.py`: SQLite (WAL mode) KV. Implement `commit_delta` with the behavior rules
      in §B (appeared/moved/removed/unchanged/ambiguous). Single writer.
- [ ] `memory/migrations/`: initial schema (objects table + history table, or JSON column — your
      call, keep it simple).
- [ ] `query/search.py`: exact key → alias → fuzzy (use `rapidfuzz`). Return ranked
      `ObjectRecord[]` (latest, highest-confidence, least-ambiguous first).
- [ ] `scripts/seed_demo.py`: write ~6–10 fake deltas through `commit_delta` so the DB has a
      believable evening of moves (bottle, keys, glasses, passport…). This is your test fixture
      *and* the demo data.
- [ ] `apps/engine/api.py`: implement the read endpoints (§C) against the store + query.
- [ ] `reveal/compose.py`: build the reveal payload `{frame_ref, bbox, card}`. (`bbox` can be a
      stub/placeholder until Dhwanit's understand step provides grounded regions — agree a
      default like `null` + a `card` that still renders.)
- [ ] `packages/sdk/client.py`: typed client over the API with the frozen signatures (§C).
- [ ] Tests: `tests/test_memory.py` (store + lineage), `tests/test_query.py` (alias/fuzzy).
      Create the `tests/` dir; add `tests/fixtures/` as needed.

### M2 — Integration (with Dhwanit)
- [ ] Confirm `commit_delta` accepts Dhwanit's real `Delta` objects unchanged.
- [ ] End-to-end check: he runs the loop → you query `GET /api/query?q=bottle` and get the record.
- [ ] SDK ↔ API verified from a tiny script (precursor to the future frontend/CLI).

### M3 — Harden
- [x] `status` staleness: `core.memory.staleness.effective_status` upgrades a `fresh` record to
      `stale` after 6 min; applied at the view layer (`/objects`, `/query`, reveal). Store stays
      pure (committed status). Feeds the "not re-observed for 6 minutes" trust message.
- [x] History tree endpoint returns clean lineage for the future UI (`/api/objects/{key}/history`).
- [x] Reveal payload wired for `frame_ref`/`bbox`: `GET /api/frame/{frame_ref}` serves the
      last-known PNG from the live buffer (404 if evicted / API-only mode); `bbox` now flows
      Delta → store → ObjectRecord → reveal (coordinated contract change, see §B/§C below).
      Remaining: the VLM actually grounding `bbox` is Dhwanit's (Track A).

## How you verify (evidence, not vibes)
- `make seed` populates `data/phantom.db`; `make test` passes `test_memory`/`test_query`.
- `make run` → `curl localhost:8000/api/objects` and `/api/query?q=bottle` return seeded data.
- A 10-line script using `PhantomClient` prints the same results as the raw `curl`.

---

# §A — The hard rules (copied from shared-contracts.md)

1. Only `apps/engine` touches SQLite. `memory.store` is the single writer. API is read-only.
2. Apps/layers import only `packages/sdk`, never `packages/core`.
3. Raw frames never hit disk; only a transient `frame_ref` survives under a retention cap.
4. The VLM is behind a provider interface (Dhwanit's side).
5. Everything keys off the versioned delta schema (§B). Schema change → version bump → update
   both dev docs.

# §B — CONTRACT: Delta + MemoryStore (copied from shared-contracts.md)

**Delta** (`understand/schema/delta.py`, Dhwanit owns the file, you consume it):
```python
class Delta(BaseModel):
    schema_version: int = 1
    object: str                      # lowercase snake_case key
    event: Literal["appeared", "moved", "removed", "unchanged", "ambiguous"]
    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    relations: list[str] = []
    confidence: float                # 0.0–1.0
    frame_ref: str | None = None
    bbox: BBox | None = None         # core.geometry.BBox {x,y,w,h} 0..1 (optional)
    observed_at: datetime            # ISO-8601 with tz
```

**MemoryStore interface** (you own the impl):
```python
class MemoryStore:
    def __init__(self, db_path: str) -> None: ...
    def commit_delta(self, delta: Delta) -> ObjectRecord: ...   # single writer, loop-only
    def get(self, key: str) -> ObjectRecord | None: ...
    def all(self) -> list[ObjectRecord]: ...
    def history(self, key: str) -> list[HistoryEntry]: ...
```

**ObjectRecord** (`memory/models.py`, you own it):
```jsonc
{
  "key": "blue_water_bottle",
  "location": "behind laptop",
  "relations": ["left of monitor", "on desk"],
  "last_seen": "2026-10-30T14:05:32+05:30",
  "confidence": 0.94,
  "frame_ref": "buf_0412",
  "bbox": {"x": 0.42, "y": 0.18, "w": 0.12, "h": 0.22},  // optional, from the Delta; null if ungrounded
  "status": "fresh",                 // fresh | stale | ambiguous | removed (stale computed at read time)
  "history": [ {"location": "...", "at": "...", "confidence": 0.90} ]  // newest last
}
```

**`commit_delta` behavior:**
- `appeared` → create record.
- `moved` → push current location to history, update location/last_seen/confidence.
- `removed` → `status = "removed"`, keep history.
- `unchanged` → refresh `last_seen` only (heartbeat).
- `ambiguous` → flag `ambiguous`, **never overwrite**.

# §C — CONTRACT: API + SDK (you own both)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/health` | `{status}` |
| GET | `/api/objects` | `ObjectRecord[]` |
| GET | `/api/query?q=<text>` | ranked `ObjectRecord[]` |
| GET | `/api/objects/{key}/history` | `HistoryEntry[]` |
| GET | `/api/reveal/{key}` | `{frame_ref, bbox, card}` |
| GET | `/api/frame/{frame_ref}` | last-known frame `image/png` (404 if evicted / API-only) |
| GET | `/api/stream` | SSE live events (optional, last) |

```python
class PhantomClient:
    def __init__(self, base_url: str = "http://localhost:8000"): ...
    def health(self) -> dict: ...
    def objects(self) -> list[ObjectRecord]: ...
    def query(self, q: str) -> list[ObjectRecord]: ...
    def history(self, key: str) -> list[HistoryEntry]: ...
    def reveal(self, key: str) -> RevealPayload: ...
```

# §D — Git workflow & conflict rules (copied from shared-contracts.md)

```bash
git checkout main && git pull                 # start of session
git checkout ShresthBranch && git merge main  # bring trunk in
# work, commit often (Conventional Commits), then:
git push                                      # PR → main when a unit is done + tested
```

Rules: touch only your directories; announce + isolate + solo-commit any co-owned file edit;
contract changes go through `shared-contracts.md` + both dev docs in one commit; merge `main`
into your branch at least every session and before every PR; new dependency → edit
`pyproject.toml` alone, ping Dhwanit to reinstall.

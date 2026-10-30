# Phantom — Shared Contracts & Conflict Rules (SOURCE OF TRUTH)

> Read this first. Both developers depend on this file. The same contract section is
> copied into `shresth.md` and `dhwanit.md` so neither of you can miss it. **If anything
> here changes, it changes here first, then gets copied into both dev docs in the same
> commit.** Nobody edits a contract unilaterally.

---

## 0. What we are building (one paragraph)

Phantom is a local-first "continuous physical key-value store." A **phone camera** watches a
space. A cheap **Gate** detects motion. On a real change, a **VLM** compares the new frame to
the previous room state and emits a strict-JSON **delta** ("object X moved from A to B"). The
delta is **committed** to a SQLite memory with full history. A **query** layer answers
"where is X?" and a **reveal** layer returns the last frame + bounding box + a trust card
(timestamp + confidence). Raw video is never persisted; only semantic records survive.

Pipeline: **Capture → Gate → Understand → Commit → Query → Reveal**

We build the **backend only** right now. Frontend comes after the backend is working end-to-end.

---

## 1. The hard architectural rules (do not break these)

1. **Only `apps/engine` touches SQLite.** `memory.store` is the single writer. The API is
   **read-only** against the store.
2. **Apps/layers import only `packages/sdk`** — never `packages/core` directly. (Within the
   engine process, the loop may import core modules; that is the one allowed exception because
   the engine *is* the core host.)
3. **Raw frames never hit disk.** Frames live in a RAM ring buffer. Only a transient
   `frame_ref` survives for the reveal step, under a retention cap.
4. **The VLM is behind a provider interface.** No module calls Ollama/NVIDIA/Groq directly
   except the provider implementations.
5. **Everything keys off the versioned delta schema** (§3). Change the schema → bump its
   version → update both dev docs.

---

## 2. Track split (who owns what)

Two tracks, chosen so the two of you touch **different directories** → near-zero merge conflicts.

| Track | Owner | Directories owned |
|------|-------|-------------------|
| **A — Perception** | **Dhwanit** | `packages/core/capture/`, `packages/core/gate/`, `packages/core/understand/`, `apps/engine/loop.py`, `apps/engine/config.py` |
| **B — Memory & Serving** | **Shresth** | `packages/core/memory/`, `packages/core/query/`, `packages/core/reveal/`, `apps/engine/api.py`, `packages/sdk/`, `scripts/seed_demo.py` |

**Co-owned (edit only by agreement, see §6):**
`packages/core/understand/schema/delta.py`, `pyproject.toml`, `Makefile`,
`apps/engine/main.py`, `.env.example`.

The two tracks meet at exactly **two seams**:
- **Seam 1 — the delta** (§3): Perception *produces* a `Delta`; Memory *consumes* it.
- **Seam 2 — the store call** (§4): the engine loop (Track A) calls `MemoryStore.commit_delta()`
  (Track B). Track A codes against the interface, not the implementation.

Because both seams are frozen in §3/§4 up front, both tracks can build and test **in isolation**:
- Track A tests with recorded **fixture frames** + a **mock VLM** → prints deltas.
- Track B tests with **fake deltas** / `seed_demo.py` → serves data through the API.

---

## 3. CONTRACT — the Delta (Seam 1)

The VLM output and the thing Memory commits. Lives in
`packages/core/understand/schema/delta.py` as a **versioned Pydantic v2 model**.

```jsonc
// SCHEMA_VERSION = 1
{
  "schema_version": 1,
  "object": "blue_water_bottle",     // normalized snake_case key
  "event": "moved",                  // one of: appeared | moved | removed | unchanged | ambiguous
  "from": "center of desk",          // nullable (null when appeared)
  "to": "behind laptop",             // nullable (null when removed)
  "relations": ["left of monitor", "on desk"],  // spatial context, may be []
  "confidence": 0.94,                // 0.0–1.0
  "frame_ref": "buf_0412",           // transient RAM-buffer handle, not a file path
  "observed_at": "2026-10-30T14:05:32+05:30"  // ISO-8601 with tz
}
```

Rules:
- `object` is normalized to lowercase snake_case by the Perception side before emit.
- `event = "ambiguous"` means **do not overwrite** memory — log only.
- `confidence < 0.7` is the escalation trigger (local → cloud). See ADR-0002.
- Adding a field = **minor**, allowed without version bump if optional + defaulted.
  Renaming/removing/retyping a field = **bump `schema_version`** and update both dev docs.

Pydantic shape (frozen signature both sides import):
```python
class Delta(BaseModel):
    schema_version: int = 1
    object: str
    event: Literal["appeared", "moved", "removed", "unchanged", "ambiguous"]
    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    relations: list[str] = []
    confidence: float
    frame_ref: str | None = None
    observed_at: datetime
```

---

## 4. CONTRACT — the MemoryStore interface (Seam 2)

Lives in `packages/core/memory/store.py` (Track B owns impl). Track A codes against **these
signatures only**. Frozen:

```python
class MemoryStore:
    def __init__(self, db_path: str) -> None: ...

    # single writer — only the engine loop calls this
    def commit_delta(self, delta: Delta) -> ObjectRecord: ...

    # read side (used by query/reveal/api)
    def get(self, key: str) -> ObjectRecord | None: ...
    def all(self) -> list[ObjectRecord]: ...
    def history(self, key: str) -> list[HistoryEntry]: ...
```

`ObjectRecord` (in `packages/core/memory/models.py`):
```jsonc
{
  "key": "blue_water_bottle",
  "location": "behind laptop",
  "relations": ["left of monitor", "on desk"],
  "last_seen": "2026-10-30T14:05:32+05:30",
  "confidence": 0.94,
  "frame_ref": "buf_0412",
  "status": "fresh",                 // fresh | stale | ambiguous | removed
  "history": [                       // lineage, newest last
    {"location": "center of desk", "at": "2026-10-30T14:02:15+05:30", "confidence": 0.90},
    {"location": "behind laptop",  "at": "2026-10-30T14:05:32+05:30", "confidence": 0.94}
  ]
}
```

`commit_delta` behavior (the rule that keeps data honest):
- `appeared` → create record.
- `moved` → push current location to history, update location/last_seen/confidence.
- `removed` → mark `status = "removed"`, keep history.
- `unchanged` → refresh `last_seen` only (heartbeat).
- `ambiguous` → **append nothing destructive**; record flagged `ambiguous`, never overwrite.

---

## 5. CONTRACT — the API + SDK (serving surface)

Track B owns both. FastAPI in `apps/engine/api.py`, typed client in `packages/sdk/client.py`.
**Read-only** endpoints (commit happens in-process via the loop, not over HTTP).

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/health` | `{status}` |
| GET | `/api/objects` | `ObjectRecord[]` |
| GET | `/api/query?q=<text>` | ranked `ObjectRecord[]` (exact → alias → fuzzy) |
| GET | `/api/objects/{key}/history` | `HistoryEntry[]` |
| GET | `/api/reveal/{key}` | `{frame_ref, bbox, card}` reveal payload |
| GET | `/api/stream` | SSE live events (optional, last) |

SDK method signatures (frozen):
```python
class PhantomClient:
    def __init__(self, base_url: str = "http://localhost:8000"): ...
    def health(self) -> dict: ...
    def objects(self) -> list[ObjectRecord]: ...
    def query(self, q: str) -> list[ObjectRecord]: ...
    def history(self, key: str) -> list[HistoryEntry]: ...
    def reveal(self, key: str) -> RevealPayload: ...
```

---

## 6. Git workflow & conflict rules

**Branches**
- `main` — remote trunk, always runnable. Integration happens here.
- `shresthBranch` (currently `ShresthBranch` locally) — Shresth's work (Track B).
- `dhwanitBranch` — Dhwanit's work (Track A). **Does not exist yet** — create it:
  ```bash
  git checkout main && git pull
  git checkout -b dhwanitBranch
  git push -u origin dhwanitBranch
  ```

**Daily rhythm (both of you)**
```bash
git checkout main && git pull                 # start of day: get latest trunk
git checkout <yourBranch> && git merge main   # bring trunk into your branch
# ...work, commit often (Conventional Commits)...
git push
# when a unit is done + tested → PR into main (or direct merge for hackathon) → both re-sync
```

**Conventional Commits**: `feat(memory): sqlite KV store + history`, `feat(gate): frame diff`.

**Conflict-avoidance rules (follow these and you will basically never conflict):**
1. Only touch directories your track owns (§2). If you need something in the other's area,
   **ask**, don't reach in.
2. **Co-owned files** (`delta.py`, `pyproject.toml`, `Makefile`, `main.py`, `.env.example`):
   announce before editing, make the edit tiny and isolated, commit it alone, push, tell the
   other to sync immediately. Never bundle a co-owned edit inside a big feature commit.
3. **Contract changes** (§3/§4/§5): agree first, change the contract + both dev docs in **one**
   commit to `main`, then both rebase/merge. No silent contract drift.
4. Merge `main` into your branch **at least** at the start of every work session and before
   every PR. Small, frequent merges beat one big painful one.
5. New shared dependency? Whoever adds it edits `pyproject.toml` once, commits it alone,
   pings the other to `pip install -e ".[dev]"` again.

---

## 7. Milestones (how the two tracks converge)

| Milestone | Definition of done | Who |
|-----------|--------------------|-----|
| **M0 — Kickoff (do together, ~first hour)** | `delta.py`, `models.py` (ObjectRecord/HistoryEntry), the `MemoryStore` interface stub, API path list, SDK signatures all committed to `main`. Deps installed. | Both |
| **M1 — Isolated build** | A: gate + capture(replay) + mock VLM prints valid `Delta`s from fixture frames. B: store + query + `seed_demo.py` + API serve fake records; SDK calls work. Each has tests. | Parallel |
| **M2 — Integration** | Engine `loop.py` wires capture→gate→understand→`commit_delta`. Real VLM provider swapped in. End-to-end on **phone**: move an object → record appears → `GET /api/query` returns it. | Both |
| **M3 — Harden** | Real Android/iPhone capture path solid, heartbeat re-validation, reveal payload (frame_ref + bbox + card), `status` staleness. Tag `v0.1.0`. | Both |

---

## 8. Known unknowns to resolve early (spikes)

- **Android USB camera path.** `scrcpy` 2.x supports `--video-source=camera`; grabbing those
  frames into Python on macOS needs a short spike (scrcpy window capture vs. a camera-bridge).
  Owner: Dhwanit. Timebox it; fall back to the frame-replay adapter if it stalls.
- **iPhone Continuity Camera** usually appears as an AVFoundation device OpenCV can open by
  index — verify the index and resolution. Owner: Dhwanit.
- **VLM provider choice for the demo** (NVIDIA vs Groq vs Ollama qwen2.5-vl): pick one as
  primary, keep the mock for offline dev, keep one as escalation. Owner: Dhwanit, with the
  `.env` keys from Shresth-side config.

---

## 9. Environment (`.env`, already scaffolded in `.env.example`)

```
PHANTOM_VLM_PROVIDER=local        # local | nvidia | groq | mock
OLLAMA_MODEL=qwen2.5-vl:latest
PHANTOM_CLOUD_VLM_KEY=            # NVIDIA/Groq/OpenAI-compatible key
PHANTOM_DB_PATH=data/phantom.db
PHANTOM_CAMERA_SOURCE=android     # android | iphone | replay   (NO webcam)
PHANTOM_CAPTURE_INTERVAL=2
PHANTOM_RETENTION_HOURS=168
```

# Dhwanit — Working Path (Track A: Perception)

> Your branch: **`dhwanitBranch`** — it does NOT exist yet, create it (see §D).
> Partner: Shresth on Track B (Memory & Serving), branch `shresthBranch`.
> **Source of truth is `shared-contracts.md`.** The critical contract + git rules are also
> copied into §A–§C below so you never have to leave this file. If a contract changes, it
> changes in `shared-contracts.md` first, then here and in Shresth's doc in the same commit.

---

## Your mission

Own the **perception pipeline**: get frames from the **phone camera** (Android/iPhone, no
webcam), detect real change cheaply (the Gate), ask the **VLM** "what changed?", turn its answer
into a validated `Delta`, and run the engine loop that hands each `Delta` to Shresth's store.
You make Phantom *see*. You can build and test most of this **without the store** using a mock
VLM + fixture frames that print `Delta` objects.

## Directories you own

```
packages/core/capture/     base.py (Camera protocol), android.py, iphone.py, buffer.py (RAM ring), replay.py (dev)
packages/core/gate/        differ.py (frame diff / motion score), debounce.py (settle → end-state frame)
packages/core/understand/  providers/ (local.py, cloud.py), prompts/delta.txt, resolve.py, schema/delta.py*
apps/engine/loop.py        capture → gate → understand → commit (+ heartbeat)
apps/engine/config.py      intervals, retention cap, provider toggles
```
`*schema/delta.py` is co-owned with Shresth — agreed at M0, you own later edits with his sign-off.

Co-owned (announce before editing): `apps/engine/main.py`, `pyproject.toml`, `Makefile`,
`.env.example`.

## Do NOT

- Do **not** touch `memory/`, `query/`, `reveal/`, `api.py`, `sdk/` — that's Shresth.
- Do **not** write frames to disk. Frames stay in the RAM ring buffer (`buffer.py`); only a
  transient `frame_ref` leaves the buffer, under the retention cap.
- Do **not** call Ollama/NVIDIA/Groq anywhere except inside `understand/providers/`. Everything
  else talks to the provider **interface**.
- Do **not** reach into the store internals — call `MemoryStore.commit_delta(delta)` only (§B).

---

## Task checklist (in order)

### M0 — Kickoff (do WITH Shresth first, commit to `main`)
- [x] Co-finalize `understand/schema/delta.py` (`Delta` Pydantic model, §B). You own the file.
      Implemented as a versioned superset (adds `is_committable`/`needs_escalation`, `EventType`,
      and an `Event` alias for Shresth's draft name). Wire-identical to his M0 draft.
- [x] Confirm the `MemoryStore.commit_delta(delta)` signature you'll call (§B). Loop codes against
      the real `MemoryStore` (merged from `shresthBranch`); verified end-to-end.
- [x] Agree the provider interface shape so local/cloud/mock are swappable (`providers/base.py`).

### M1 — Build in isolation (your branch)
- [x] `capture/base.py`: `Camera` protocol — `read() -> Frame`, `open()/close()`.
- [x] `capture/buffer.py`: RAM ring buffer with retention cap; hands out `frame_ref` handles.
- [x] `capture/replay.py`: **dev adapter** that replays a folder of recorded phone frames — lets
      you build gate/understand with no phone attached. (This replaces the webcam as the dev
      fallback.)
- [x] `gate/differ.py`: frame differencing / motion score (OpenCV). Static → discard. Change →
      signal.
- [x] `gate/debounce.py`: on change, wait 1–2s for motion to settle, grab the **end-state** frame,
      promote it. (Frame-driven state machine + `flush()` for stream EOF.)
- [x] `understand/providers/local.py`: Ollama (`qwen2.5-vl`) client behind the interface.
- [x] `understand/providers/cloud.py`: NVIDIA/Groq (OpenAI-compatible) client for escalation.
- [x] `understand/providers/mock.py`: returns canned deltas — your offline test engine.
- [x] `understand/prompts/delta.txt`: "previous state JSON + new frame + what changed?" → strict
      JSON matching the `Delta` schema.
- [x] `understand/resolve.py`: entity resolution (normalized snake_case key = identity) +
      cross-check hook → re-sample once → still ambiguous → emit `event="ambiguous"`.
- [x] `understand/` glue: normalize `object`, pick provider by `PHANTOM_VLM_PROVIDER`, escalate to
      cloud when `confidence < 0.7` (`resolve.UnderstandService` + `loop.build_understand_service`).
- [x] `apps/engine/config.py`: read `.env` (intervals, retention, provider, camera source).
- [x] Tests: `tests/test_gate.py` (replay fixtures → trigger/no-trigger),
      `tests/test_understand.py` (fixture frames + mock → valid `Delta` JSON).
      Deterministic fixtures generated into `tests/fixtures/frames/`.

### M2 — Integration (with Shresth)
- [x] `apps/engine/loop.py`: wire capture → gate → understand → `store.commit_delta(delta)` +
      heartbeat re-validation (periodic `unchanged` refresh of fresh objects).
- [x] Swap the mock for a real provider: `PHANTOM_VLM_PROVIDER=local|nvidia|groq` selects it via
      `build_understand_service` (no code change). End-to-end verified on **replay + mock + real
      store + API**: loop commits `appeared`→`moved`, `GET /api/query?q=bottle` returns the record,
      `GET /api/reveal/...` renders the trust card. Phone hardware path is the M3 spike below.
- [x] Integration seam wired in `apps/engine/main.py`: one shared `MemoryStore`, loop in a daemon
      thread (writer), read-only API on the same store (`PHANTOM_DISABLE_LOOP=1` to serve only).

### M3 — Harden
- [ ] Real **Android** capture path (see spike in §E) and/or **iPhone** Continuity Camera.
      `android.py`/`iphone.py` adapters stubbed behind the `Camera` protocol with clear
      NotImplemented guidance; actual frame grab is a hardware spike (needs a device + scrcpy).
- [ ] Tune debounce + motion thresholds against real desk footage (needs real footage; defaults
      are parameterized via `.env`: `PHANTOM_MOTION_THRESHOLD`, `PHANTOM_SETTLE_FRAMES`).
- [ ] Grounded `bbox` in the understand output so Shresth's reveal can draw it. **Blocked on a
      coordinated contract change**: `bbox` must flow Delta → store → ObjectRecord → reveal, i.e.
      a schema bump agreed with Shresth in `shared-contracts.md` + both dev docs. Not changed
      unilaterally. `reveal.compose_reveal` already accepts an optional `bbox` for when it lands.

## How you verify (evidence, not vibes)
- `make test` passes `test_gate` + `test_understand`.
- With `PHANTOM_CAMERA_SOURCE=replay` + `PHANTOM_VLM_PROVIDER=mock`, running the loop prints
  valid `Delta` JSON for each staged change in the fixture folder.
- With the phone connected, moving an object on the desk produces exactly one `Delta` after the
  debounce settles (no spam on static scenes).

---

# §A — The hard rules (copied from shared-contracts.md)

1. Only `apps/engine` touches SQLite. `memory.store` is the single writer. API is read-only.
2. Apps/layers import only `packages/sdk`, never `packages/core`.
3. Raw frames never hit disk; only a transient `frame_ref` survives under a retention cap.
4. The VLM is behind a provider interface — only `understand/providers/` calls a model.
5. Everything keys off the versioned delta schema (§B). Schema change → version bump → update
   both dev docs.

# §B — CONTRACT: Delta + MemoryStore (copied from shared-contracts.md)

**Delta** (`understand/schema/delta.py`, you own it):
```python
class Delta(BaseModel):
    schema_version: int = 1
    object: str                      # lowercase snake_case key — YOU normalize this
    event: Literal["appeared", "moved", "removed", "unchanged", "ambiguous"]
    from_: str | None = Field(default=None, alias="from")
    to: str | None = None
    relations: list[str] = []
    confidence: float                # 0.0–1.0; <0.7 → escalate local→cloud
    frame_ref: str | None = None
    observed_at: datetime            # ISO-8601 with tz
```
Example emit:
```json
{"schema_version":1,"object":"blue_water_bottle","event":"moved","from":"center of desk",
 "to":"behind laptop","relations":["left of monitor","on desk"],"confidence":0.94,
 "frame_ref":"buf_0412","observed_at":"2026-10-30T14:05:32+05:30"}
```

**MemoryStore** — the ONLY method you call (Shresth owns the impl):
```python
store.commit_delta(delta: Delta) -> ObjectRecord
```
Commit behavior (so you know what each `event` does): `appeared`=create, `moved`=push history +
update, `removed`=mark removed, `unchanged`=refresh last_seen (heartbeat), `ambiguous`=flagged,
never overwrites.

# §C — Provider interface (you own; keep local/cloud/mock swappable)

```python
class VLMProvider(Protocol):
    def whats_changed(self, prev_state_json: str, frame_ref: str, image_bytes: bytes) -> Delta: ...

# selected by PHANTOM_VLM_PROVIDER = local | nvidia | groq | mock
# escalate: if provider.confidence < 0.7 → retry on cloud provider
```

# §D — Git: create your branch + workflow (copied from shared-contracts.md)

```bash
# create your branch (first time only)
git checkout main && git pull
git checkout -b dhwanitBranch
git push -u origin dhwanitBranch

# every session
git checkout main && git pull
git checkout dhwanitBranch && git merge main
# work, commit often (Conventional Commits), then:
git push                                     # PR → main when a unit is done + tested
```

Rules: touch only your directories; announce + isolate + solo-commit any co-owned file edit;
contract changes go through `shared-contracts.md` + both dev docs in one commit; merge `main`
into your branch at least every session and before every PR; new dependency → edit
`pyproject.toml` alone, ping Shresth to reinstall.

# §E — Your spikes (timeboxed, resolve early)

- **Android USB → frames in Python (macOS).** `scrcpy` 2.x has `--video-source=camera`. Getting
  those frames into OpenCV on macOS needs a short spike (capture the scrcpy stream/window vs. a
  camera bridge). Timebox it; if it stalls, keep developing on `replay.py` + fixtures and come
  back. This is the biggest risk on your track — do it first.
- **iPhone Continuity Camera** typically shows up as an AVFoundation device OpenCV opens by
  index — find the index + resolution, confirm it works over USB.
- **VLM pick for the demo**: choose primary (NVIDIA / Groq / Ollama qwen2.5-vl), keep `mock` for
  offline dev, keep one as the `<0.7` escalation target. Get the API key into `.env` with Shresth.

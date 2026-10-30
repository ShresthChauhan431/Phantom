
# Phantom — Repo & Git Setup

## 1. Stack (hackathon-pragmatic)

|                  |                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Piece            | Choice                                                                                        |
| Engine + core    | Python 3.12 (uv/pip + venv), OpenCV for frame diff                                            |
| Local VLM        | Ollama (qwen2.5-vl / llama3.2-vision) on the MacBook                                          |
| Cloud escalation | OpenAI/Anthropic-compatible key, called only on ambiguity                                     |
| API              | FastAPI on `localhost:8000`                                                                   |
| Store            | SQLite (WAL mode), file at `data/phantom.db` (gitignored)                                     |
| Dashboard        | React + Vite + Tailwind                                                                       |
| Camera           | scrcpy/adb for Android, Continuity Camera or `v4l2`-style capture for iPhone, webcam fallback |

## 2. Repo layout

```text
phantom/
├── README.md
├── Makefile                     # make run / make dashboard / make test / make seed
├── pyproject.toml               # workspace: phantom-core, phantom-sdk, engine, cli
├── .env.example                 # PHANTOM_CLOUD_VLM_KEY=
├── .gitignore
│
├── docs/
│   ├── hello-phantom.md         # the design doc (source of truth)
│   └── adr/                     # decision records
│       ├── 0001-repo-monorepo.md
│       ├── 0002-local-vlm-first.md
│       └── _template.md
│
├── apps/
│   ├── engine/                  # THE BACKEND — the daemon that runs the pipeline
│   │   ├── main.py              # entrypoint: python -m phantom.engine
│   │   ├── loop.py              # capture → gate → understand → commit + heartbeat
│   │   ├── api.py               # FastAPI routes (query, history, reveal, stream)
│   │   └── config.py            # intervals, retention cap, provider toggles
│   ├── dashboard/               # React client
│   │   ├── src/
│   │   │   ├── views/           # Search, HistoryTree, LiveFeed
│   │   │   └── components/      # GlassCard, BoundingBox, Typewriter
│   │   └── package.json
│   └── cli/                     # terminal client
│       └── main.py
│
├── packages/
│   ├── core/                    # importable package: phantom_core
│   │   ├── capture/
│   │   │   ├── base.py          # Camera protocol
│   │   │   ├── android.py       # scrcpy/adb adapter
│   │   │   ├── iphone.py
│   │   │   ├── webcam.py        # dev fallback — no phone needed
│   │   │   └── buffer.py        # RAM ring buffer + retention cap
│   │   ├── gate/
│   │   │   ├── differ.py        # frame differencing / motion score
│   │   │   └── debounce.py      # 1–2s settle, end-state frame
│   │   ├── understand/
│   │   │   ├── providers/
│   │   │   │   ├── local.py     # Ollama client
│   │   │   │   └── cloud.py     # escalation client
│   │   │   ├── prompts/
│   │   │   │   └── delta.txt    # "What changed?" + strict JSON instruction
│   │   │   ├── schema/
│   │   │   │   └── delta.py     # VERSIONED pydantic model = the contract
│   │   │   └── resolve.py       # entity resolution + relational cross-check
│   │   ├── memory/
│   │   │   ├── store.py         # SQLite KV: get/set/history, single writer
│   │   │   ├── models.py        # ObjectRecord (location, relations, history…)
│   │   │   └── migrations/
│   │   ├── query/
│   │   │   └── search.py        # exact key, aliases, fuzzy match
│   │   └── reveal/
│   │       └── compose.py       # frame_ref + bbox + trust-card payload
│   └── sdk/                     # importable package: phantom_sdk
│       └── client.py            # typed client over localhost API — layers use ONLY this
│
├── layers/                      # vertical apps, later (home, inventory…)
│   └── .gitkeep
│
├── tests/
│   ├── fixtures/
│   │   └── frames/              # recorded golden frames (commit these deliberately)
│   ├── test_gate.py             # replay fixtures → expect trigger/no-trigger
│   ├── test_understand.py       # recorded frames → expect JSON deltas
│   ├── test_memory.py          # store + lineage
│   └── test_query.py           # alias/fuzzy matching
│
└── scripts/
    ├── setup_android.sh         # adb pairing + scrcpy check
    └── seed_demo.py             # fake a full evening of object moves for the demo
```

## 3. Git setup

- **Init:** `git init -b main` — `main` is the trunk, always deployable.
    
- **Branching:** trunk-based. Short-lived branches off `main`:
    
    - `feat/gate-motion-diff`
        
    - `feat/vlm-delta-schema`
        
    - `fix/bbox-drift`
        
    - `chore/deps`
        
- **Commits:** Conventional Commits — `feat(gate): debounce + end-state frame`, `fix(memory): dedupe alias keys`. One logical change per commit; commit in working order (see §5).
    
- **Merging:** PR → squash merge → delete branch. For a solo hackathon, direct pushes to `main` are fine; keep branches for anything risky.
    
- **Tags:** `v0.1.0` first end-to-end run (webcam → store), `v0.2.0` phone camera, `v0.3.0` dashboard. Tag before demo day.
    
- **Hooks (optional but cheap):** pre-commit with `ruff` + `pytest -k "not slow"`.
    
- **Never committed:** `data/`, frames, `.env`, model weights, anything a camera saw. Fixtures in `tests/fixtures/frames/` are the only images allowed, and only ones you chose to record.
    

### `.gitignore`

```gitignore
# Python
__pycache__/
*.pyc
.venv/
.pytest_cache/
.ruff_cache/

# Runtime data — the store and everything the camera saw
data/
*.db
*.sqlite*
frames/
*.jpg
*.png
!tests/fixtures/frames/*.png

# Secrets
.env

# Node / dashboard
node_modules/
dist/

# Local models
*.gguf
```

## 4. Bootstrap (day zero)

```bash
mkdir phantom && cd phantom
git init -b main

# Python workspace
python3 -m venv .venv && source .venv/bin/activate
pip install opencv-python fastapi uvicorn pydantic ollama rapidfuzz pytest

# Commit the skeleton first
git add . && git commit -m "chore: repo skeleton (engine, core, sdk, apps)"

# Engine terminal
make run          # apps/engine — the daemon

# Dashboard terminal
cd apps/dashboard && npm run dev
```

## 5. Build order — your first 10 commits

1. `feat(schema): versioned JSON delta contract` — **everything depends on this, so it goes first.**
    
2. `feat(memory): SQLite KV store + history lineage` — you can test it with fake deltas, no camera.
    
3. `feat(gate): frame differencing + debounce` — runs on your MacBook webcam today, no phone needed.
    
4. `feat(capture): camera protocol + webcam adapter` — RAM ring buffer with retention cap.
    
5. `feat(engine): main loop — capture → gate → commit` — first end-to-end run: point webcam at desk, move a bottle, see a record appear. Tag `v0.1.0`.
    
6. `feat(understand): Ollama provider + delta prompt` — insert VLM between gate and commit.
    
7. `feat(resolve): entity resolution + cross-check` — agree → commit; ambiguous → log, never overwrite.
    
8. `feat(api): FastAPI query + history + reveal endpoints` + `feat(sdk): typed client`.
    
9. `feat(capture): Android scrcpy adapter` — the phone replaces the webcam. Tag `v0.2.0`.
    
10. `feat(dashboard): search by name + history tree` — glass card, bounding box, trust contract. Tag `v0.3.0`.
    

**Rule while coding:** layers and apps only import `phantom_sdk` — never `phantom_core`. The day something outside `apps/engine` touches SQLite directly, the architecture is broken.
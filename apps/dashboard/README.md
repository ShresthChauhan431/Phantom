# Phantom Dashboard

The DISHA spatial-memory web experience. A static multi-page site — vanilla
HTML/CSS/JS with Three.js — so there is **no build step**: edit a file, reload.

Migrated from the `3D-assets-for-Phantom` repository, where every page, script,
stylesheet and model sat in a single flat directory.

## Run it

One command starts both processes:

```bash
python3 scripts/run_all.py
```

It starts the engine, waits for it to answer, starts the dashboard, and prints the
URLs. Ctrl-C stops both.

```bash
python3 scripts/run_all.py --camera replay --vlm mock   # no phone, no API key
python3 scripts/run_all.py --no-loop                    # serve seeded memory only
python3 scripts/run_all.py --check                      # start, verify, exit
```

Or run the two processes yourself:

```bash
make run                                # engine  :8000
python3 apps/dashboard/serve.py         # dashboard :5173
```

**Do not serve this with Vite or another node dev server.** This is a static
multi-page site with no build step. A dev server will not proxy `/api` (so every
backend call returns HTML instead of JSON, silently) and may transform the CSS,
which browsers then reject as a stylesheet. `serve.py` proxies `/api/*` to the
engine, keeping requests same-origin so the engine needs no CORS configuration —
point it elsewhere with `--engine http://host:port`.

The UI renders without the engine; API-backed panels simply report it unreachable.

## Layout

```text
apps/dashboard/
├── index.html              Landing page / spatial canvas
├── pages/                  One file per route
│   ├── phantom.html        Core intelligence constellation
│   ├── workspace.html      Live capture workspace (browser-side engine)
│   ├── smriti.html         Memory module
│   ├── aegis.html  lumen.html  forge.html
│   └── meridian.html  sense.html  sentinel.html
├── src/
│   ├── api/                Backend contract (the ONLY place UI talks to the engine)
│   │   ├── endpoints.js    Endpoint table — single source of truth
│   │   ├── client.js       Fetch wrapper; emits `phantom:api` per call
│   │   └── inspector.js    On-page endpoint badges + live call log
│   ├── css/                Stylesheets
│   ├── js/
│   │   ├── core/           phantom-core, app, phantom-engine
│   │   ├── experiences/    disha-experience, smriti-experience, workspace
│   │   ├── sections/       reality-diff, memory-receipt, trust-section, final-cta
│   │   └── engine/         Browser-side capture/vision/storage (independent of the Python engine)
│   └── lib/                Vendored three.min.js, GLTFLoader.js
├── public/
│   ├── models/*.glb        3D models (~54 MB)
│   └── assets/*.png        Render previews
├── serve.py                Static server + /api proxy
└── scripts/check_links.py  Verifies every reference resolves
```

Asset references are **root-absolute** (`/src/...`, `/public/...`) rather than
relative, so one string resolves identically from `index.html` and from
`pages/*.html`. Add a page without recalculating `../` prefixes.

## Routes

`serve.py` also serves clean URLs, so `/pages/phantom` works as well as
`/pages/phantom.html`.

| Route | Page | What it shows |
|---|---|---|
| `/` | `index.html` | Landing, editorial scroll, spatial canvas |
| `/pages/phantom` | `phantom.html` | Core architecture + 7-module constellation |
| `/pages/workspace` | `workspace.html` | Live capture workspace |
| `/pages/smriti` | `smriti.html` | SMRITI — memory |
| `/pages/aegis` | `aegis.html` | AEGIS |
| `/pages/lumen` | `lumen.html` | LUMEN |
| `/pages/forge` | `forge.html` | FORGE |
| `/pages/meridian` | `meridian.html` | MERIDIAN |
| `/pages/sense` | `sense.html` | SENSE |
| `/pages/sentinel` | `sentinel.html` | SENTINEL |

Module navigation is data-driven: each entry in `src/js/core/phantom-core.js`
carries a `routeUrl`, and `navigateToModuleRoute()` performs the jump. To change
where a module points, edit its `routeUrl` — not the click handler.

## Backend endpoints

Declared once in `src/api/endpoints.js`, mirroring `apps/engine/api.py`. All are
`GET`: the engine is **read-only** over HTTP, because commits happen in-process via
the perception loop (single writer).

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Is the engine up |
| GET | `/api/objects` | Every remembered object (status, bbox) |
| GET | `/api/query?q={text}` | Ranked matches — "where is my phone?" |
| GET | `/api/objects/{key}/history` | Movement lineage, oldest first |
| GET | `/api/reveal/{key}` | `frame_ref` + `bbox` + trust card |
| GET | `/api/frame/{frame_ref}` | The last-seen frame as PNG |

`/api/frame/{frame_ref}` only resolves while the perception loop is running:
frames live in a RAM ring buffer and are never written to disk, so a `frame_ref`
expires with its retention window. A seeded database has records but no frames —
expect `404` there, and design the UI to degrade.

### Seeing which endpoint a button calls

Press **`~`** in the browser, or click **endpoints** at bottom-right. The panel
lists every endpoint and logs calls live with status and latency. The status dot is
green when the engine answered, red when it is unreachable.

To label a control with the route it calls, declare it in the markup:

```html
<button data-endpoint="query">Find it</button>
```

The inspector appends a visible `GET /api/query?q={text}` badge and tooltip. The id
must exist in `endpoints.js`, which keeps the displayed contract honest.

### Calling the API

```js
import PhantomAPI from '/src/api/client.js';

const { ok, data } = await PhantomAPI.query('phone');
if (ok) console.log(data[0].location, data[0].bbox);

const reveal = await PhantomAPI.reveal('smartphone');
img.src = PhantomAPI.frameUrl(reveal.data.frame_ref);
```

`client.js` never throws on HTTP errors — it returns `{ ok, status, data }`,
because `404` is routine here (unknown object, expired frame). Every call emits a
`phantom:api` event, which is how the inspector observes traffic without the call
sites knowing about it.

## After changing paths

```bash
python3 apps/dashboard/scripts/check_links.py
```

Walks every page and script and confirms each reference exists on disk.

## Known gaps

- The 3D experience scripts reference `sections_desktop/*.png` (reveal stills) that
  were not present in the source repository. Those layers fall back silently.
- `public/rive/` holds only a README; `phantom-engine.js` probes for a Rive file and
  degrades when absent.
- `pages/workspace.html` is fully live (engine telemetry, trigger log, memory,
  search, screenshots, iPhone preview) via `src/js/engine/backend-engine.js`.
  The other pages are still the static design experience.
- Bounding boxes are the VLM's own coordinates and are approximate; they mark
  roughly where an object is, not its exact outline.

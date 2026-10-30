#!/usr/bin/env python3
"""Status check for the workspace page: every service it depends on, with a verdict.

Verifies the page, each asset it declares, each backend endpoint it calls, and the
engine state behind those endpoints — then prints one OK/WARN/FAIL line per
service so it is obvious what is working and what is not.

Usage:
    python3 apps/dashboard/scripts/status_check.py
    python3 apps/dashboard/scripts/status_check.py --base http://localhost:5173
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = "/pages/workspace.html"

OK, WARN, FAIL = "OK", "WARN", "FAIL"
results: list[tuple[str, str, str, str]] = []  # (status, group, name, detail)


def record(status: str, group: str, name: str, detail: str = "") -> None:
    results.append((status, group, name, detail))


def fetch(url: str, timeout: float = 20.0):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "phantom-status/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b""), dict(e.headers)
    except Exception as e:  # noqa: BLE001 - any failure is a reportable status
        return 0, str(e).encode(), {}


def header(headers: dict, name: str, default: str = "") -> str:
    """Case-insensitive header lookup — stdlib sends 'Content-type', others differ."""
    target = name.lower()
    for key, value in headers.items():
        if key.lower() == target:
            return value
    return default


def check_page(base: str) -> str:
    status, body, _ = fetch(base + PAGE)
    if status != 200:
        record(FAIL, "Page", "workspace.html", f"HTTP {status}")
        return ""
    record(OK, "Page", "workspace.html", f"{len(body):,} bytes")
    return body.decode("utf-8", "replace")


def check_assets(base: str, html: str) -> None:
    """Every local asset the page declares must resolve over HTTP."""
    refs = sorted({m for m in re.findall(r'(?:src|href)="(/[^"]+)"', html)})
    for ref in refs:
        url = base + ref
        status, body, headers = fetch(url)
        name = ref.split("?")[0]
        if status == 200:
            kind = header(headers, "Content-Type", "?").split(";")[0]
            record(OK, "Assets", name, f"{len(body):,}b  {kind}")
        else:
            record(FAIL, "Assets", name, f"HTTP {status}")


def check_cdn(html: str) -> None:
    """External libraries the page needs; a failure here means it works offline-only."""
    for ref in sorted(set(re.findall(r'src="(https://[^"]+)"', html))):
        status, body, _ = fetch(ref, timeout=25)
        short = ref.split("/")[-1]
        if status == 200:
            record(OK, "CDN", short, f"{len(body):,}b")
        else:
            record(WARN, "CDN", short, f"HTTP {status} — in-browser vision unavailable")


def fetch_json(url: str):
    """Fetch and parse JSON, distinguishing 'not JSON' from 'HTTP error'.

    A dev server that serves an HTML fallback for unknown paths answers /api/*
    with 200 text/html, which looks healthy but breaks every backend call. That
    case must be reported, not crash the check.
    """
    status, body, headers = fetch(url)
    ctype = header(headers, "Content-Type", "").split(";")[0]
    if status != 200:
        return status, None, ctype
    try:
        return status, json.loads(body), ctype
    except (json.JSONDecodeError, UnicodeDecodeError):
        return status, None, ctype


def check_api(base: str) -> dict:
    """Each endpoint declared in src/api/endpoints.js, through the dashboard proxy."""
    summary: dict = {}

    status, data, ctype = fetch_json(f"{base}/api/health")
    if status != 200:
        record(FAIL, "Engine API", "GET /api/health", f"HTTP {status} — engine not reachable")
        return summary
    if data is None:
        record(
            FAIL,
            "Engine API",
            "GET /api/health",
            f"200 but {ctype or 'non-JSON'} — this server does not proxy /api. "
            "Use: python3 apps/dashboard/serve.py",
        )
        summary["no_proxy"] = True
        return summary
    record(OK, "Engine API", "GET /api/health", str(data))

    status, objects, _ = fetch_json(f"{base}/api/objects")
    objects = objects if isinstance(objects, list) else []
    if status == 200:
        record(OK, "Engine API", "GET /api/objects", f"{len(objects)} object(s) in memory")
    else:
        record(FAIL, "Engine API", "GET /api/objects", f"HTTP {status}")
    summary["objects"] = objects

    # Search: the page's search bar depends on this ranking.
    for term in ("bottle", "phone"):
        status, hits, _ = fetch_json(f"{base}/api/query?q={term}")
        if status == 200 and isinstance(hits, list):
            names = ", ".join(h["key"] for h in hits[:2])
            record(OK, "Engine API", f"GET /api/query?q={term}", f"{len(hits)} hit(s)  {names}")
        else:
            record(FAIL, "Engine API", f"GET /api/query?q={term}", f"HTTP {status}")

    if not objects:
        record(WARN, "Engine API", "per-object endpoints", "no objects to exercise")
        return summary

    key = objects[0]["key"]
    status, history, _ = fetch_json(f"{base}/api/objects/{key}/history")
    if status == 200 and isinstance(history, list):
        record(OK, "Engine API", "GET /api/objects/{key}/history", f"{len(history)} entries")
    else:
        record(FAIL, "Engine API", "GET /api/objects/{key}/history", f"HTTP {status}")

    status, payload, _ = fetch_json(f"{base}/api/reveal/{key}")
    frame_ref = None
    if status == 200 and isinstance(payload, dict):
        frame_ref = payload.get("frame_ref")
        has_bbox = payload.get("bbox") is not None
        record(OK, "Engine API", "GET /api/reveal/{key}",
               f"trust card ok, bbox={'yes' if has_bbox else 'null'}")
    else:
        record(FAIL, "Engine API", "GET /api/reveal/{key}", f"HTTP {status}")

    # Screenshots come from the engine's RAM buffer, so this is loop-dependent.
    if frame_ref:
        status, body, _ = fetch(f"{base}/api/frame/{frame_ref}")
        if status == 200 and body[:4] == b"\x89PNG":
            record(OK, "Engine API", "GET /api/frame/{ref}", f"PNG {len(body):,}b")
        elif status == 404:
            record(WARN, "Engine API", "GET /api/frame/{ref}",
                   "404 — no RAM frames (engine loop disabled, or frame evicted)")
        else:
            record(FAIL, "Engine API", "GET /api/frame/{ref}", f"HTTP {status}")
    summary["frame_ref"] = frame_ref
    return summary


def check_page_features(base: str, html: str, summary: dict) -> None:
    """The specific UI capabilities that were asked for."""
    needed = {
        "Video window": 'id="cameraVideo"',
        "Bounding-box overlay": 'id="overlayCanvas"',
        "Start / Pause control": 'id="btnStartMonitoring"',
        "Camera picker": 'id="cameraSourceSelect"',
        "Search bar": 'id="searchInput"',
        "Search results": 'id="searchResultContainer"',
        "Trigger registry": 'id="objectsRegistryRows"',
        "History / recent events": 'id="recentEventsOverview"',
        "Scene screenshots": 'id="deskSnapshotList"',
        "Motion meter": 'id="motionMeterFill"',
    }
    for name, marker in needed.items():
        record(OK if marker in html else FAIL, "UI wiring", name,
               "" if marker in html else f"missing {marker}")

    record(
        OK if "backend-engine.js" in html else FAIL,
        "UI wiring",
        "Backend engine loaded",
        "memory sourced from /api" if "backend-engine.js" in html else "not referenced",
    )

    # History window is defined in the adapter; confirm it is the asked-for 5 min.
    adapter = (ROOT / "src/js/engine/backend-engine.js").read_text(encoding="utf-8")
    m = re.search(r"HISTORY_WINDOW_MS\s*=\s*([^;]+);", adapter)
    if m and "5 * 60 * 1000" in m.group(1):
        record(OK, "UI wiring", "History window", "5 minutes")
    else:
        record(WARN, "UI wiring", "History window", m.group(1).strip() if m else "not found")

    objects = summary.get("objects") or []
    if objects:
        cats = {}
        for o in objects:
            key = o["key"]
            cats[key] = o.get("location")
        record(OK, "Data", "Searchable triggers",
               ", ".join(list(cats)[:4]) + (" …" if len(cats) > 4 else ""))
    else:
        record(WARN, "Data", "Searchable triggers", "memory is empty — run the engine with a camera")


def main() -> int:
    parser = argparse.ArgumentParser(description="Status check for the workspace page.")
    parser.add_argument("--base", default="http://localhost:5173")
    parser.add_argument(
        "--embedded",
        action="store_true",
        help="run serve.py in-process on a spare port and check that instead",
    )
    args = parser.parse_args()

    httpd = None
    if args.embedded:
        # Checks the dashboard as it is *meant* to be served, independent of
        # whatever happens to be running on the usual port.
        import sys
        import threading
        from functools import partial
        from http.server import ThreadingHTTPServer

        sys.path.insert(0, str(ROOT))
        import serve

        port = 5391
        httpd = ThreadingHTTPServer(("127.0.0.1", port), partial(serve.DashboardHandler))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{port}"
        print(f"(embedded serve.py on {port})")
    else:
        base = args.base.rstrip("/")

    print(f"Checking {base}{PAGE}\n")

    try:
        html = check_page(base)
        if not html:
            print("Page unreachable — start the dashboard:  python3 apps/dashboard/serve.py")
            return 1

        check_assets(base, html)
        check_cdn(html)
        summary = check_api(base)
        check_page_features(base, html, summary)
    finally:
        if httpd is not None:
            httpd.shutdown()

    width = max(len(n) for _, _, n, _ in results) + 2
    current = None
    for status, group, name, detail in results:
        if group != current:
            print(f"\n{group}")
            current = group
        mark = {OK: "ok  ", WARN: "warn", FAIL: "FAIL"}[status]
        print(f"  [{mark}] {name:<{width}} {detail}")

    counts = {OK: 0, WARN: 0, FAIL: 0}
    for status, *_ in results:
        counts[status] += 1
    print(f"\n{counts[OK]} ok · {counts[WARN]} warn · {counts[FAIL]} fail")
    if counts[FAIL]:
        print("Not all services are healthy.")
        return 1
    print("All services operational." if not counts[WARN] else "Operational, with caveats above.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

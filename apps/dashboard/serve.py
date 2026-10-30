#!/usr/bin/env python3
"""Static server for the dashboard, with /api proxied to the Phantom engine.

Why a proxy: the engine (apps/engine/api.py) ships no CORS middleware, so a page
served from a different port cannot call it directly from the browser. Proxying
keeps every request same-origin, which means the UI works without changing a line
of backend code.

    frontend  http://localhost:5173/          -> files in this directory
    api       http://localhost:5173/api/...   -> http://localhost:8000/api/...

Also serves clean URLs: /pages/phantom resolves to /pages/phantom.html.

Usage:
    python3 apps/dashboard/serve.py [--port 5173] [--engine http://localhost:8000]
"""

from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class DashboardHandler(SimpleHTTPRequestHandler):
    """Serves the dashboard, forwarding /api/* to the engine."""

    engine_base = "http://localhost:8000"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # ------------------------------------------------------------------ routing
    def do_GET(self) -> None:  # noqa: N802 - stdlib naming
        if self.path.startswith("/api/"):
            self._proxy()
            return
        super().do_GET()

    def translate_path(self, path: str) -> str:
        """Resolve clean URLs to .html files so links need no extension."""
        local = super().translate_path(path)
        candidate = Path(local)
        if candidate.is_dir() and (candidate / "index.html").is_file():
            return str(candidate / "index.html")
        if not candidate.exists() and not candidate.suffix:
            with_html = candidate.with_suffix(".html")
            if with_html.is_file():
                return str(with_html)
        return local

    # -------------------------------------------------------------------- proxy
    def _proxy(self) -> None:
        target = f"{self.engine_base}{self.path}"
        try:
            with urllib.request.urlopen(target, timeout=30) as upstream:  # noqa: S310
                body = upstream.read()
                self.send_response(upstream.status)
                content_type = upstream.headers.get("Content-Type", "application/json")
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as exc:
            # Pass the engine's own status through: 404 for an unknown object or an
            # evicted frame is meaningful data, not a proxy failure.
            body = exc.read() or b"{}"
            self.send_response(exc.code)
            self.send_header("Content-Type", exc.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            body = (
                b'{"detail":"engine unreachable. Start it with: make run '
                b'(or PHANTOM_DISABLE_LOOP=1 make run to serve seeded data only)"}'
            )
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    # --------------------------------------------------------------------- misc
    def end_headers(self) -> None:
        # The 3D experience is iterated on constantly; stale caches hide changes.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write(f"  {fmt % args}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the Phantom dashboard.")
    parser.add_argument("--port", type=int, default=5173)
    parser.add_argument("--engine", default="http://localhost:8000", help="engine base URL")
    args = parser.parse_args()

    DashboardHandler.engine_base = args.engine.rstrip("/")
    handler = partial(DashboardHandler)

    print("Phantom dashboard")
    print(f"  serving  {ROOT}")
    print(f"  url      http://localhost:{args.port}/")
    print(f"  /api/*   -> {DashboardHandler.engine_base}/api/*  (proxied, no CORS needed)")
    print("\n  Routes:")
    print("    /                     landing")
    for page in sorted((ROOT / "pages").glob("*.html")):
        print(f"    /pages/{page.stem:<14s} {page.name}")
    print("\n  Press ~ in the browser to inspect endpoints. Ctrl-C to stop.\n")

    try:
        with ThreadingHTTPServer(("0.0.0.0", args.port), handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Verify every asset the dashboard references actually exists on disk.

The source project kept all files in one flat directory, so restructuring required
rewriting 133 references. This checks the result: it walks every page and script,
resolves each root-absolute reference against the dashboard root, and reports
anything missing. Cheaper and more complete than clicking through a browser.

Usage:
    python3 apps/dashboard/scripts/check_links.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Root-absolute refs in markup: href="/src/css/x.css?v=1", src="/src/js/..."
HTML_REF = re.compile(r'(?:href|src)="(/[^"#?]+)(?:\?[^"]*)?"')
# Runtime asset loads in scripts: '/public/models/sofa.glb', '/pages/smriti.html'
JS_REF = re.compile(r"""['"](/(?:public|pages|src)/[^'"]+?)['"]""")


def check(path: Path, pattern: re.Pattern, kind: str) -> list[str]:
    problems: list[str] = []
    text = path.read_text(encoding="utf-8", errors="replace")
    for match in pattern.finditer(text):
        ref = match.group(1)
        target = ROOT / ref.lstrip("/")
        if not target.exists():
            problems.append(f"  MISSING  {path.relative_to(ROOT)} -> {ref}")
    if not problems:
        print(f"  ok  {path.relative_to(ROOT)}  ({kind})")
    return problems


def main() -> int:
    problems: list[str] = []

    pages = [ROOT / "index.html"] + sorted((ROOT / "pages").glob("*.html"))
    for page in pages:
        problems += check(page, HTML_REF, "markup")

    # Skip vendored libraries: three.min.js is minified and self-contained.
    for script in sorted((ROOT / "src" / "js").rglob("*.js")):
        problems += check(script, JS_REF, "runtime")
    for api in sorted((ROOT / "src" / "api").glob("*.js")):
        problems += check(api, JS_REF, "api")

    print()
    if problems:
        print(f"{len(problems)} broken reference(s):")
        print("\n".join(problems))
        return 1
    print("All references resolve.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

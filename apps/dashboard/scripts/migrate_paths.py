#!/usr/bin/env python3
"""Rewrite asset references for the restructured dashboard.

The source project kept every page, script and stylesheet in one flat directory,
so references were bare filenames ("style.css", "sofa.glb"). After grouping files
into src/css, src/js/*, src/lib and public/*, those references must point at the
new locations.

Root-absolute paths (/src/..., /public/...) are used deliberately: the same string
then resolves identically from index.html at the root and from pages/*.html one
level down, so no page needs its own relative prefix.
"""

from __future__ import annotations

import re
from pathlib import Path

DASH = Path("/Users/devanshsingh/Documents/Projects/Phantom/apps/dashboard")

CSS = [
    "style", "phantom", "phantom-core", "module-shared", "workspace",
    "reality-diff", "memory-receipt", "trust-section", "final-cta",
]
JS_CORE = ["phantom-core.js", "app.js", "phantom-engine.js"]
JS_EXP = ["disha-experience.js", "smriti-experience.js", "workspace.js"]
JS_SEC = ["reality-diff.js", "memory-receipt.js", "trust-section.js", "final-cta.js"]
JS_LIB = ["three.min.js", "GLTFLoader.js"]
JS_ENGINE = [
    "capture.js", "change-detection.js", "index.js", "search.js",
    "spatial-memory.js", "storage.js", "vision.js",
]
PAGES = [
    "phantom", "workspace", "smriti", "aegis", "lumen",
    "forge", "meridian", "sense", "sentinel",
]
MODELS = ["sofa.glb", "small_table.glb", "plant_with_pot.glb", "dora_dora_the_explorer.glb"]


def js_target(name: str) -> str:
    if name in JS_LIB:
        return f"/src/lib/{name}"
    if name in JS_CORE:
        return f"/src/js/core/{name}"
    if name in JS_EXP:
        return f"/src/js/experiences/{name}"
    if name in JS_SEC:
        return f"/src/js/sections/{name}"
    if name in JS_ENGINE:
        return f"/src/js/engine/{name}"
    return name


def rewrite_html(text: str) -> tuple[str, int]:
    n = 0

    # Stylesheets:  href="style.css?v=1"  ->  href="/src/css/style.css?v=1"
    def css_sub(m: re.Match) -> str:
        nonlocal n
        n += 1
        query = m.group(3) or ""  # the version query is optional
        return f'{m.group(1)}="/src/css/{m.group(2)}.css{query}"'

    text = re.sub(
        rf'(href)="({"|".join(map(re.escape, CSS))})\.css(\?[^"]*)?"',
        css_sub,
        text,
    )

    # Scripts: src="phantom-core.js?v=1" -> src="/src/js/core/phantom-core.js?v=1"
    def js_sub(m: re.Match) -> str:
        nonlocal n
        n += 1
        query = m.group(2) or ""
        return f'src="{js_target(m.group(1))}{query}"'

    all_js = JS_CORE + JS_EXP + JS_SEC + JS_LIB
    text = re.sub(
        rf'src="({"|".join(map(re.escape, all_js))})(\?[^"]*)?"',
        js_sub,
        text,
    )

    # Browser engine: src="engine/storage.js" -> src="/src/js/engine/storage.js"
    def engine_sub(m: re.Match) -> str:
        nonlocal n
        n += 1
        return f'src="/src/js/engine/{m.group(1)}"'

    text = re.sub(r'src="engine/([a-z-]+\.js)"', engine_sub, text)

    # Page links: href="smriti.html#x" -> href="/pages/smriti.html#x"
    def page_sub(m: re.Match) -> str:
        nonlocal n
        n += 1
        return f'href="/pages/{m.group(1)}.html{m.group(2) or ""}"'

    text = re.sub(
        rf'href="({"|".join(PAGES)})\.html(#[^"]*)?"',
        page_sub,
        text,
    )

    # Landing page: href="index.html" -> href="/"
    before = text
    text = text.replace('href="index.html"', 'href="/"')
    if text != before:
        n += 1
    return text, n


def rewrite_js(text: str) -> tuple[str, int]:
    n = 0
    # 3D models are loaded by bare filename at runtime.
    for model in MODELS:
        for quote in ("'", '"'):
            needle = f"{quote}{model}{quote}"
            if needle in text:
                n += text.count(needle)
                text = text.replace(needle, f"{quote}/public/models/{model}{quote}")

    # Module route table + imperative navigation.
    for page in PAGES:
        for quote in ("'", '"'):
            needle = f"{quote}{page}.html{quote}"
            if needle in text:
                n += text.count(needle)
                text = text.replace(needle, f"{quote}/pages/{page}.html{quote}")
    return text, n


def main() -> None:
    total = 0
    html_files = [DASH / "index.html"] + sorted((DASH / "pages").glob("*.html"))
    for path in html_files:
        original = path.read_text(encoding="utf-8")
        updated, n = rewrite_html(original)
        if n:
            path.write_text(updated, encoding="utf-8")
        total += n
        print(f"  {path.relative_to(DASH)!s:28s} {n:3d} refs")

    # Never touch vendored libraries (three.min.js is minified and self-contained).
    js_files = [
        p for p in (DASH / "src" / "js").rglob("*.js")
    ]
    for path in sorted(js_files):
        original = path.read_text(encoding="utf-8")
        updated, n = rewrite_js(original)
        if n:
            path.write_text(updated, encoding="utf-8")
            print(f"  {path.relative_to(DASH)!s:28s} {n:3d} refs")
        total += n

    print(f"\ntotal references rewritten: {total}")


if __name__ == "__main__":
    main()

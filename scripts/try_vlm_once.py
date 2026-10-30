#!/usr/bin/env python3
"""Send ONE live camera frame to the configured VLM and print the resulting Delta.

A focused smoke test for the understand stage: it exercises auth, the model name,
JSON-mode-with-image support, the prompt, strict-JSON parsing, key normalization,
and bbox coercion — all in a single call, so a provider problem surfaces clearly
instead of looking like a loop or gate problem.

Nothing is written to disk.

Usage:
    python scripts/try_vlm_once.py
    python scripts/try_vlm_once.py --source replay
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apps.engine.config import Config
from apps.engine.loop import build_camera, build_understand_service, encode_frame


def main() -> int:
    parser = argparse.ArgumentParser(description="One-shot VLM check on a live frame.")
    parser.add_argument("--source", default=None, help="override PHANTOM_CAMERA_SOURCE")
    parser.add_argument("--state", default="[]", help="prior-state JSON to send as context")
    args = parser.parse_args()

    config = Config.from_env()
    if args.source:
        config.camera_source = args.source

    print(f"camera   : {config.camera_source}")
    print(f"provider : {config.vlm_provider}")
    print(f"model    : {config.cloud_model}")
    if config.vlm_provider in ("groq", "nvidia") and not config.cloud_vlm_key:
        print("\n✗ PHANTOM_CLOUD_VLM_KEY is empty — add it to .env")
        return 1

    camera = build_camera(config)
    print("\nopening camera ...")
    camera.open()
    try:
        frame = camera.read()
    finally:
        camera.close()
    if frame is None:
        print("✗ camera delivered no frame")
        return 1

    jpeg = encode_frame(frame, fmt=".jpg")
    print(f"✓ captured {frame.image.shape[1]}x{frame.image.shape[0]} -> {len(jpeg):,} bytes JPEG")

    service = build_understand_service(config)
    print(f"\ncalling {service.provider.name} / {getattr(service.provider, 'model', '?')} ...")
    started = time.time()
    try:
        delta = service.process(args.state, "buf_0001", jpeg)
    except Exception as exc:  # noqa: BLE001 - surface any provider failure verbatim
        print(f"\n✗ {type(exc).__name__}: {str(exc)[:1200]}")
        return 1
    print(f"✓ responded in {time.time() - started:.1f}s\n")

    print("=== DELTA ===")
    print(json.dumps(delta.model_dump(by_alias=True, mode="json"), indent=2))
    print()
    print(f"object     : {delta.object}")
    print(f"event      : {delta.event}")
    print(f"location   : {delta.from_!r} -> {delta.to!r}")
    print(f"confidence : {delta.confidence}")
    print(f"bbox       : {delta.bbox}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

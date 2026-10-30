"""Shared test fixtures for the perception suite."""

from __future__ import annotations

from pathlib import Path

import pytest

from core.capture.base import Frame
from core.capture.replay import ReplayCamera

FRAMES_DIR = Path(__file__).parent / "fixtures" / "frames"


@pytest.fixture(scope="session")
def frames_dir() -> Path:
    return FRAMES_DIR


@pytest.fixture
def frames() -> list[Frame]:
    """The staged scene as an ordered list of frames (seq 0..5)."""
    cam = ReplayCamera(FRAMES_DIR, interval=2.0)
    cam.open()
    out: list[Frame] = []
    while (f := cam.read()) is not None:
        out.append(f)
    cam.close()
    return out

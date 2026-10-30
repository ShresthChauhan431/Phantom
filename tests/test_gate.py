"""Gate tests: replay fixtures -> expect trigger / no-trigger and clean promotion."""

from __future__ import annotations

import numpy as np
import pytest
from core.capture.base import Frame
from core.gate.debounce import Debouncer
from core.gate.differ import MotionGate

# Expected change between consecutive fixture frames (index i compares i-1 -> i).
#   0->1 static, 1->2 appear, 2->3 static, 3->4 move, 4->5 static
EXPECTED_CHANGE = [None, False, True, False, True, False]


def test_fixture_scene_has_six_frames(frames):
    assert [f.seq for f in frames] == [0, 1, 2, 3, 4, 5]


def test_motion_gate_triggers_only_on_real_change(frames):
    gate = MotionGate()
    for i in range(1, len(frames)):
        changed = gate.is_change(frames[i - 1], frames[i])
        assert changed is EXPECTED_CHANGE[i], f"frame {i - 1}->{i} changed={changed}"


def test_static_scene_scores_zero(frames):
    gate = MotionGate()
    assert gate.score(frames[0], frames[1]) == 0.0  # identical frames


def test_debounce_promotes_exactly_the_settled_end_states(frames):
    deb = Debouncer(MotionGate(), settle_frames=1)
    promoted = [es.seq for f in frames if (es := deb.feed(f)) is not None]
    # Appear settles at frame 3, move settles at frame 5.
    assert promoted == [3, 5]
    assert deb.flush() is None  # nothing left mid-motion


def test_debounce_flush_emits_unsettled_tail():
    """If a change never sees a trailing quiet frame, flush emits it once."""
    from core.capture.replay import ReplayCamera

    from tests.conftest import FRAMES_DIR

    cam = ReplayCamera(FRAMES_DIR, interval=2.0)
    cam.open()
    all_frames = []
    while (f := cam.read()) is not None:
        all_frames.append(f)
    cam.close()

    deb = Debouncer(MotionGate(), settle_frames=1)
    # Feed only up to the move (seq 4), withholding the settling frame (seq 5).
    promoted = [es.seq for f in all_frames[:5] if (es := deb.feed(f)) is not None]
    assert promoted == [3]  # only the appear settled
    tail = deb.flush()
    assert tail is not None and tail.seq == 4  # the move is flushed


# ------------------------------------------------- real-camera noise immunity
# Locks in a property measured against live camera frames: frame-to-frame sensor
# noise must not read as motion, or the debouncer never settles and the VLM is
# never called. Synthetic fixtures alone would not catch a regression here.


def _noisy(image, sigma, rng):
    noise = rng.normal(0, sigma, image.shape)
    return np.clip(image.astype(np.float32) + noise, 0, 255).astype(np.uint8)


@pytest.mark.parametrize("sigma", [5, 10, 20])
def test_sensor_noise_alone_does_not_trigger_the_gate(frames, sigma):
    rng = np.random.default_rng(42)
    still = frames[2].image  # a single static scene, sampled twice with noise
    a = Frame(image=_noisy(still, sigma, rng), seq=0, ts=frames[2].ts)
    b = Frame(image=_noisy(still, sigma, rng), seq=1, ts=frames[3].ts)

    gate = MotionGate()
    score = gate.score(a, b)
    assert score < gate.motion_threshold, f"sigma={sigma} noise read as motion ({score})"
    assert gate.is_change(a, b) is False


@pytest.mark.parametrize("sigma", [0, 10, 20])
def test_real_move_still_detected_under_noise(frames, sigma):
    rng = np.random.default_rng(7)
    before = Frame(image=_noisy(frames[2].image, sigma, rng), seq=0, ts=frames[2].ts)
    after = Frame(image=_noisy(frames[4].image, sigma, rng), seq=1, ts=frames[4].ts)

    gate = MotionGate()
    assert gate.is_change(before, after) is True

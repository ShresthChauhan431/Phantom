"""Gate tests: replay fixtures -> expect trigger / no-trigger and clean promotion."""

from __future__ import annotations

import cv2
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


# ----------------------------------------------- transient vs persistent change
# Measured on real desk footage: a hand reaching across scored 0.041 frame-to-frame
# while an actual object move scored only 0.022 — so motion magnitude alone cannot
# separate them, and thresholding would either ignore real moves or fire on hands.
# The distinction is persistence: a withdrawn hand leaves the scene exactly as it
# was, a moved object does not. These lock that behaviour in.


def _hand_over(image, rng=None):
    """A frame with a large bright shape across the scene, standing in for a hand."""
    out = image.copy()
    h, w = out.shape[:2]
    cv2.ellipse(out, (w // 2, h // 2), (w // 3, h // 6), 20, 0, 360, (210, 220, 235), -1)
    return out


def test_hand_passing_through_is_not_promoted(frames):
    """Scene -> hand reaches in -> hand withdraws: nothing changed, so no VLM call."""
    still = frames[2]  # bottle on desk
    hand = Frame(image=_hand_over(still.image), seq=1, ts=still.ts)
    after = Frame(image=still.image.copy(), seq=2, ts=still.ts)  # identical to before
    settled = Frame(image=still.image.copy(), seq=3, ts=still.ts)

    deb = Debouncer(MotionGate(), settle_frames=1)
    promoted = [es for f in (still, hand, after, settled) if (es := deb.feed(f)) is not None]

    assert promoted == [], "a hand passing through must not reach the VLM"
    assert deb.discarded_transients == 1
    assert deb.promoted == 0


def test_hand_that_moves_an_object_is_promoted(frames):
    """Scene -> hand reaches in -> hand leaves AND the bottle moved: real change."""
    before = frames[2]  # bottle centre
    hand = Frame(image=_hand_over(before.image), seq=1, ts=before.ts)
    moved = Frame(image=frames[4].image.copy(), seq=2, ts=before.ts)  # bottle elsewhere
    settled = Frame(image=frames[4].image.copy(), seq=3, ts=before.ts)

    deb = Debouncer(MotionGate(), settle_frames=1)
    promoted = [es for f in (before, hand, moved, settled) if (es := deb.feed(f)) is not None]

    assert len(promoted) == 1, "a real object move must reach the VLM"
    assert deb.promoted == 1
    assert deb.discarded_transients == 0


def test_change_threshold_can_ignore_small_rearrangements(frames):
    """A high change_threshold treats even a real move as not worth reporting."""
    before = frames[2]
    hand = Frame(image=_hand_over(before.image), seq=1, ts=before.ts)
    moved = Frame(image=frames[4].image.copy(), seq=2, ts=before.ts)
    settled = Frame(image=frames[4].image.copy(), seq=3, ts=before.ts)

    deb = Debouncer(MotionGate(), settle_frames=1, change_threshold=0.9)
    promoted = [es for f in (before, hand, moved, settled) if (es := deb.feed(f)) is not None]
    assert promoted == []
    assert deb.discarded_transients == 1


def test_reference_tracks_the_latest_stable_scene(frames):
    """While idle, 'before' follows the scene so slow drift never accumulates."""
    deb = Debouncer(MotionGate(), settle_frames=1)
    deb.feed(frames[0])
    deb.feed(frames[1])  # static -> reference should advance
    assert deb.reference is frames[1]


# --------------------------------------------- settle window is a duration
# The settle window must outlast a human pause, or a hand hovering mid-reach gets
# captured as the new scene state. Measured live: a 0.6s window promoted a hand,
# a 1.8s window let it withdraw so the transient filter discarded it. Frame counts
# alone are interval-dependent, so the duration is what gets configured.


@pytest.mark.parametrize(
    "interval,settle_seconds,expected",
    [
        (2.0, 2.0, 1),  # 1 frame x 2s = 2s
        (0.6, 2.0, 4),  # 4 frames x 0.6s = 2.4s, first count to reach 2s
        (1.0, 2.0, 2),
        (5.0, 2.0, 1),  # never below one frame
    ],
)
def test_settle_frames_derived_from_duration(interval, settle_seconds, expected):
    from apps.engine.config import Config

    config = Config(capture_interval=interval, settle_seconds=settle_seconds)
    assert config.effective_settle_frames == expected


def test_explicit_settle_frames_overrides_duration():
    from apps.engine.config import Config

    config = Config(capture_interval=0.6, settle_seconds=2.0, settle_frames=3)
    assert config.effective_settle_frames == 3


# --------------------------------------------- live-stream edge shimmer
# Measured on the real iPhone stream over a still desk: object outlines flicker by
# 25-90 grey levels (JPEG + focus/exposure micro-adjustment) while nothing moves,
# reaching 4.9% of pixels vs the reference — enough to fire the gate and send an
# unmoved scene to the VLM as a fake "move". A morphological opening erases thin
# outlines but keeps the solid blob a real move leaves.


def _desk_with_outlines(shift: int) -> np.ndarray:
    img = np.full((480, 640, 3), 200, np.uint8)
    for i in range(12):  # many object outlines, 2px wide, jittering by `shift`
        x, y = 30 + i * 50, 60 + (i % 4) * 90
        cv2.rectangle(img, (x + shift, y), (x + 40 + shift, y + 70), (40, 40, 40), 2)
    return img


def test_opening_removes_edge_shimmer_on_a_still_scene():
    a = Frame(image=_desk_with_outlines(0), seq=0)
    b = Frame(image=_desk_with_outlines(1), seq=1)  # outlines shimmer by 1px
    assert MotionGate(open_ksize=0).score(a, b) > 0.005  # shimmer reads as motion
    assert MotionGate(open_ksize=9).score(a, b) == 0.0  # and is erased by opening


def test_opening_keeps_a_real_object_move():
    base = _desk_with_outlines(0)
    moved = base.copy()
    cv2.rectangle(moved, (300, 200), (380, 300), (30, 90, 200), -1)  # solid object appears
    score = MotionGate(open_ksize=9).score(Frame(image=base, seq=0), Frame(image=moved, seq=1))
    assert score > 0.02

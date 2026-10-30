"""Gate tests: replay fixtures -> expect trigger / no-trigger and clean promotion."""

from __future__ import annotations

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

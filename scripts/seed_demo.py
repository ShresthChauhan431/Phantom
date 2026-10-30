#!/usr/bin/env python3
"""
Seed demo data for Phantom.

Writes a believable evening of object moves through the real `commit_delta` path
(no camera, no VLM) so the API/dashboard have something to show. Safe to re-run:
pass --reset to start from an empty DB.

Usage:
    python scripts/seed_demo.py [--reset] [--db data/phantom.db]
    make seed
"""
from __future__ import annotations

import argparse
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from core.memory.store import MemoryStore
from core.understand.schema.delta import Delta

NOW = datetime.now(timezone.utc)


def _d(obj, event, *, to=None, frm=None, conf, mins_ago, relations=None, frame=None):
    """Build a Delta observed `mins_ago` minutes before now."""
    return Delta(
        object=obj,
        event=event,
        to=to,
        from_=frm,
        confidence=conf,
        relations=relations or [],
        frame_ref=frame or f"buf_{obj[:3]}_{mins_ago}",
        observed_at=NOW - timedelta(minutes=mins_ago),
    )


# A small evening on a desk. Order doesn't matter much, but we commit oldest-first
# so lineages read naturally.
DELTAS = [
    # blue water bottle: appears on desk, migrates behind the laptop (the hero query)
    _d("blue_water_bottle", "appeared", to="center of desk", conf=0.90, mins_ago=14,
       relations=["left of monitor", "on desk"]),
    _d("blue_water_bottle", "moved", frm="center of desk", to="behind laptop",
       conf=0.94, mins_ago=3, relations=["left of monitor", "on desk"]),

    # glasses: on the nightstand, then onto the desk, last seen fairly recently
    _d("glasses", "appeared", to="nightstand", conf=0.88, mins_ago=160),
    _d("glasses", "moved", frm="nightstand", to="on the desk", conf=0.91, mins_ago=40,
       relations=["next to keyboard"]),

    # keys: tossed in the bowl, then picked up and removed from view
    _d("keys", "appeared", to="entry bowl", conf=0.86, mins_ago=150),
    _d("keys", "removed", conf=0.80, mins_ago=20),

    # mobile phone: charging, moved to hand — recent and high confidence
    _d("mobile_phone", "appeared", to="on charger", conf=0.95, mins_ago=120,
       relations=["right of lamp"]),
    _d("mobile_phone", "moved", frm="on charger", to="next to keyboard",
       conf=0.93, mins_ago=5),

    # passport: in the drawer, then an AMBIGUOUS reading (must not overwrite)
    _d("passport", "appeared", to="top drawer", conf=0.82, mins_ago=200),
    _d("passport", "ambiguous", to="maybe on shelf?", conf=0.41, mins_ago=90),

    # coffee mug: appeared long ago and not re-observed since -> should read STALE
    _d("coffee_mug", "appeared", to="left of monitor", conf=0.77, mins_ago=95),

    # tv remote: appeared, heartbeat confirms it's unchanged (still there)
    _d("tv_remote", "appeared", to="on the couch", conf=0.84, mins_ago=130),
    _d("tv_remote", "unchanged", conf=0.84, mins_ago=15),
]


def seed(db_path: str, *, reset: bool) -> MemoryStore:
    if reset:
        for suffix in ("", "-wal", "-shm"):
            Path(db_path + suffix).unlink(missing_ok=True)

    store = MemoryStore(db_path)
    for delta in DELTAS:
        store.commit_delta(delta)
    return store


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Phantom demo data.")
    parser.add_argument(
        "--db",
        default=os.environ.get("PHANTOM_DB_PATH", "data/phantom.db"),
        help="SQLite path (default: $PHANTOM_DB_PATH or data/phantom.db)",
    )
    parser.add_argument("--reset", action="store_true", help="wipe the DB first")
    args = parser.parse_args()

    print(f"Seeding demo data into {args.db} ...")
    store = seed(args.db, reset=args.reset)

    records = store.all()
    print(f"✓ committed {len(DELTAS)} deltas → {len(records)} objects")
    for r in records:
        print(f"  - {r.key:18s} {r.status:9s} @ {r.location or '-'}  "
              f"(conf {r.confidence:.2f}, {len(r.history)} history)")
    store.close()


if __name__ == "__main__":
    main()

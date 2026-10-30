"""
Phantom — Memory store (CONTRACT impl, Seam 2).

SQLite (WAL mode) key-value store. The single writer: only the engine loop calls
`commit_delta`. The API reads via get/all/history. Interface frozen in
docs/working/shared-contracts.md §4.

Owned by Track B (Memory & Serving / Shresth).
"""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime
from pathlib import Path

from core.geometry import BBox
from core.memory.models import HistoryEntry, ObjectRecord, Status
from core.understand.schema.delta import Delta

_MIGRATION = Path(__file__).parent / "migrations" / "0001_init.sql"


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _bbox_to_json(bbox: BBox | None) -> str | None:
    return json.dumps(bbox.model_dump()) if bbox is not None else None


def _bbox_from_json(raw: str | None) -> BBox | None:
    return BBox.model_validate_json(raw) if raw else None


class MemoryStore:
    """Persistent object memory backed by SQLite in WAL mode.

    A single connection is shared; writes are serialized with a lock so the API
    (reader) and the engine loop (writer) can share one process safely. WAL lets
    readers proceed without blocking the writer.
    """

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA foreign_keys=ON;")
        self._conn.executescript(_MIGRATION.read_text())
        self._ensure_columns()
        self._conn.commit()

    def _ensure_columns(self) -> None:
        """Additive, idempotent column backfill for DBs created before a column existed.

        SQLite has no ADD COLUMN IF NOT EXISTS, so we diff against table_info. Keeps
        older local phantom.db files working after additive schema changes (e.g. bbox).
        """
        cols = {r["name"] for r in self._conn.execute("PRAGMA table_info(objects)")}
        if "bbox" not in cols:
            self._conn.execute("ALTER TABLE objects ADD COLUMN bbox TEXT")

    # ----------------------------------------------------------------- write
    def commit_delta(self, delta: Delta) -> ObjectRecord:
        """Apply one delta to memory and return the resulting record.

        appeared  -> create/update head, append a history node.
        moved     -> update head to new location, append a history node.
        removed   -> mark status=removed, keep history, refresh last_seen.
        unchanged -> refresh last_seen only (heartbeat), keep everything else.
        ambiguous -> flag status=ambiguous, never overwrite location/history.
        """
        key = delta.object
        at = _iso(delta.observed_at)
        new_location = delta.to or delta.from_

        with self._lock:
            existing = self._read_head(key)

            if delta.event in ("appeared", "moved"):
                location = new_location or (existing["location"] if existing else None)
                self._upsert_head(
                    key,
                    location=location,
                    relations=delta.relations,
                    last_seen=at,
                    confidence=delta.confidence,
                    frame_ref=delta.frame_ref,
                    status="fresh",
                    bbox=delta.bbox,
                )
                if location is not None:
                    self._append_history(key, location, at, delta.confidence)

            elif delta.event == "removed":
                if existing:
                    self._set_fields(
                        key, status="removed", last_seen=at, frame_ref=delta.frame_ref
                    )
                else:
                    self._upsert_head(
                        key,
                        location=new_location,
                        relations=delta.relations,
                        last_seen=at,
                        confidence=delta.confidence,
                        frame_ref=delta.frame_ref,
                        status="removed",
                    )

            elif delta.event == "unchanged":
                if existing:
                    self._set_fields(key, last_seen=at, status="fresh")
                else:
                    # heartbeat for an object we never recorded — create minimally
                    self._upsert_head(
                        key,
                        location=new_location,
                        relations=delta.relations,
                        last_seen=at,
                        confidence=delta.confidence,
                        frame_ref=delta.frame_ref,
                        status="fresh",
                    )
                    if new_location is not None:
                        self._append_history(key, new_location, at, delta.confidence)

            elif delta.event == "ambiguous":
                if existing:
                    # never overwrite location/history — only flag + refresh last_seen
                    self._set_fields(key, status="ambiguous", last_seen=at)
                else:
                    self._upsert_head(
                        key,
                        location=new_location,
                        relations=delta.relations,
                        last_seen=at,
                        confidence=delta.confidence,
                        frame_ref=delta.frame_ref,
                        status="ambiguous",
                    )
                    if new_location is not None:
                        self._append_history(key, new_location, at, delta.confidence)

            self._conn.commit()

        record = self.get(key)
        assert record is not None  # we just wrote it
        return record

    # ------------------------------------------------------------------ read
    def get(self, key: str) -> ObjectRecord | None:
        row = self._read_head(key)
        if row is None:
            return None
        return self._row_to_record(row, self.history(key))

    def all(self) -> list[ObjectRecord]:
        rows = self._conn.execute("SELECT * FROM objects ORDER BY key").fetchall()
        return [self._row_to_record(r, self.history(r["key"])) for r in rows]

    def history(self, key: str) -> list[HistoryEntry]:
        rows = self._conn.execute(
            "SELECT location, at, confidence FROM history WHERE key = ? ORDER BY id",
            (key,),
        ).fetchall()
        return [
            HistoryEntry(
                location=r["location"],
                at=datetime.fromisoformat(r["at"]),
                confidence=r["confidence"],
            )
            for r in rows
        ]

    def close(self) -> None:
        self._conn.close()

    # --------------------------------------------------------------- helpers
    def _read_head(self, key: str) -> sqlite3.Row | None:
        return self._conn.execute(
            "SELECT * FROM objects WHERE key = ?", (key,)
        ).fetchone()

    def _upsert_head(
        self,
        key: str,
        *,
        location: str | None,
        relations: list[str],
        last_seen: str,
        confidence: float,
        frame_ref: str | None,
        status: Status,
        bbox: BBox | None = None,
    ) -> None:
        self._conn.execute(
            """
            INSERT INTO objects (
                key, location, relations, last_seen, confidence, frame_ref, bbox, status
            )
            VALUES (
                :key, :location, :relations, :last_seen, :confidence, :frame_ref, :bbox, :status
            )
            ON CONFLICT(key) DO UPDATE SET
                location   = excluded.location,
                relations  = excluded.relations,
                last_seen  = excluded.last_seen,
                confidence = excluded.confidence,
                frame_ref  = excluded.frame_ref,
                bbox       = excluded.bbox,
                status     = excluded.status
            """,
            {
                "key": key,
                "location": location,
                "relations": json.dumps(relations),
                "last_seen": last_seen,
                "confidence": confidence,
                "frame_ref": frame_ref,
                "bbox": _bbox_to_json(bbox),
                "status": status,
            },
        )

    def _set_fields(self, key: str, **fields: object) -> None:
        cols = ", ".join(f"{k} = ?" for k in fields)
        self._conn.execute(
            f"UPDATE objects SET {cols} WHERE key = ?",
            (*fields.values(), key),
        )

    def _append_history(
        self, key: str, location: str, at: str, confidence: float
    ) -> None:
        self._conn.execute(
            "INSERT INTO history (key, location, at, confidence) VALUES (?, ?, ?, ?)",
            (key, location, at, confidence),
        )

    @staticmethod
    def _row_to_record(row: sqlite3.Row, history: list[HistoryEntry]) -> ObjectRecord:
        return ObjectRecord(
            key=row["key"],
            location=row["location"],
            relations=json.loads(row["relations"]),
            last_seen=datetime.fromisoformat(row["last_seen"]),
            confidence=row["confidence"],
            frame_ref=row["frame_ref"],
            bbox=_bbox_from_json(row["bbox"]),
            status=row["status"],
            history=history,
        )

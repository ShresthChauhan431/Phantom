"""
Phantom — Query search.

Resolve a natural-language query to tracked objects: exact key match, then alias
match, then fuzzy match ("water bottle" ~= "blue_water_bottle"). Results are ranked
latest + highest-confidence + least-ambiguous first (see vision.md §Query).

Owned by Track B (Memory & Serving / Shresth).
"""
from __future__ import annotations

from rapidfuzz import fuzz

from core.memory.models import ObjectRecord

# How much worse each status is for ranking (fresh is best).
_STATUS_RANK = {"fresh": 0, "stale": 1, "ambiguous": 2, "removed": 3}

DEFAULT_THRESHOLD = 60.0


def _norm(s: str) -> str:
    return s.strip().lower()


def _words(key: str) -> str:
    """Turn a snake/kebab key into space-separated words for fuzzy matching."""
    return key.replace("_", " ").replace("-", " ").strip()


def match_score(query: str, record: ObjectRecord, aliases: dict[str, str]) -> float:
    """Score 0–100 for how well `query` identifies `record`."""
    q = _norm(query)
    key = record.key
    if q.replace(" ", "_") == key or q == _words(key):
        return 100.0
    if aliases.get(q) == key:
        return 100.0
    kwords = _words(key)
    fuzzy = max(
        fuzz.token_set_ratio(q, kwords),
        fuzz.partial_ratio(q, kwords),
    )
    # A non-exact match never scores a perfect 100 — exact/alias hits must win.
    return min(fuzzy, 99.0)


def search(
    query: str,
    records: list[ObjectRecord],
    *,
    aliases: dict[str, str] | None = None,
    threshold: float = DEFAULT_THRESHOLD,
    limit: int | None = None,
) -> list[ObjectRecord]:
    """Return records matching `query`, best first.

    aliases maps a normalized alias string -> object key (e.g. {"specs": "glasses"}).
    """
    norm_aliases = {_norm(k): v for k, v in (aliases or {}).items()}

    scored: list[tuple[ObjectRecord, float]] = []
    for r in records:
        score = match_score(query, r, norm_aliases)
        if score >= threshold:
            scored.append((r, score))

    scored.sort(
        key=lambda t: (
            -t[1],                                   # higher match score first
            _STATUS_RANK.get(t[0].status, 9),        # fresh before ambiguous/removed
            -t[0].last_seen.timestamp(),             # more recent first
            -t[0].confidence,                        # higher confidence first
        )
    )
    result = [r for r, _ in scored]
    return result[:limit] if limit is not None else result

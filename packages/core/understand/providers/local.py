"""Local VLM provider — Ollama (qwen2.5-vl) running on the MacBook.

Local-first per ADR-0002: the default provider. Sends the delta prompt plus the
end-state frame to a local vision model and parses the strict-JSON reply into a
``Delta``. The only place (with ``cloud.py``) allowed to call a model directly.
"""

from __future__ import annotations

import base64
from pathlib import Path

from ..schema.delta import Delta
from .base import ProviderError, parse_delta_json

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "delta.txt"


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


class LocalProvider:
    """Ollama-backed provider. Imported lazily so the package works without ollama installed."""

    name = "local"

    def __init__(
        self,
        model: str = "qwen2.5-vl:latest",
        host: str | None = None,
        *,
        prompt_template: str | None = None,
    ) -> None:
        self.model = model
        self.host = host
        self._prompt_template = prompt_template or _load_prompt()
        self._client = None  # lazy

    def _ensure_client(self):
        if self._client is None:
            try:
                import ollama
            except ImportError as exc:  # pragma: no cover - environment dependent
                raise ProviderError("ollama package is not installed") from exc
            self._client = ollama.Client(host=self.host) if self.host else ollama.Client()
        return self._client

    def whats_changed(self, prev_state_json: str, frame_ref: str, image_bytes: bytes) -> Delta:
        client = self._ensure_client()
        prompt = self._prompt_template.format(prev_state_json=prev_state_json)
        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        try:
            resp = client.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt, "images": [image_b64]}],
                format="json",
                options={"temperature": 0.0},
            )
        except Exception as exc:  # network / model errors -> uniform provider error
            raise ProviderError(f"ollama chat failed: {exc}") from exc
        content = (resp.get("message") or {}).get("content", "")
        return parse_delta_json(content, frame_ref=frame_ref)

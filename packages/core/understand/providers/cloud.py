"""Cloud VLM provider — OpenAI-compatible escalation target.

Used only when the local model is unsure (``confidence < 0.7``, ADR-0002). NVIDIA
and Groq both expose OpenAI-compatible chat endpoints, so a single client covers
``PHANTOM_VLM_PROVIDER=nvidia|groq`` by swapping ``base_url`` + ``model``. Like
``local.py``, this is one of the only modules permitted to call a model directly.
"""

from __future__ import annotations

import base64
from pathlib import Path

from ..schema.delta import Delta
from .base import ProviderError, parse_delta_json

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "delta.txt"

# Convenience base URLs for the common OpenAI-compatible vision backends.
KNOWN_BASE_URLS = {
    "nvidia": "https://integrate.api.nvidia.com/v1",
    "groq": "https://api.groq.com/openai/v1",
    "openai": None,  # library default
}


def _load_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")


def _image_mime(image_bytes: bytes) -> str:
    """Detect the payload format so the data URL advertises the right MIME type.

    The loop sends JPEG to keep uploads small (measured on a real 1920x1080 iPhone
    frame: 147KB as JPEG versus 1.47MB as PNG), but callers may send either.
    """
    if image_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    return "image/png"


class CloudProvider:
    """OpenAI-compatible provider. ``name`` reflects the backend (nvidia/groq/cloud)."""

    def __init__(
        self,
        model: str,
        api_key: str,
        *,
        base_url: str | None = None,
        name: str = "cloud",
        prompt_template: str | None = None,
    ) -> None:
        if not api_key:
            raise ProviderError("cloud provider requires an API key")
        self.model = model
        self.name = name
        self._api_key = api_key
        self._base_url = base_url
        self._prompt_template = prompt_template or _load_prompt()
        self._client = None  # lazy

    def _ensure_client(self):
        if self._client is None:
            try:
                from openai import OpenAI
            except ImportError as exc:  # pragma: no cover - environment dependent
                raise ProviderError("openai package is not installed") from exc
            kwargs = {"api_key": self._api_key}
            if self._base_url:
                kwargs["base_url"] = self._base_url
            self._client = OpenAI(**kwargs)
        return self._client

    def whats_changed(self, prev_state_json: str, frame_ref: str, image_bytes: bytes) -> Delta:
        client = self._ensure_client()
        prompt = self._prompt_template.format(prev_state_json=prev_state_json)
        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        mime = _image_mime(image_bytes)
        try:
            resp = client.chat.completions.create(
                model=self.model,
                temperature=0.0,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime};base64,{image_b64}"},
                            },
                        ],
                    }
                ],
            )
        except Exception as exc:  # network / API errors -> uniform provider error
            raise ProviderError(f"cloud chat failed: {exc}") from exc
        content = resp.choices[0].message.content or ""
        return parse_delta_json(content, frame_ref=frame_ref)

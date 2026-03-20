import os
import base64
import json
import logging
import mimetypes
import time
from collections import OrderedDict
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

MAX_CALLS_PER_MINUTE = int(os.getenv("AI_RATE_LIMIT", "100"))
CACHE_MAX_SIZE = 256
CACHE_TTL_SECONDS = 3600


class _RateLimiter:
    """Simple sliding-window rate limiter for outbound API calls."""

    def __init__(self, max_calls: int, window_seconds: int = 60):
        self.max_calls = max_calls
        self.window = window_seconds
        self._timestamps: list[float] = []

    def allow(self) -> bool:
        now = time.monotonic()
        self._timestamps = [t for t in self._timestamps if now - t < self.window]
        if len(self._timestamps) >= self.max_calls:
            return False
        self._timestamps.append(now)
        return True


class _LRUCache:
    """Bounded LRU cache with TTL for analysis results."""

    def __init__(self, max_size: int = CACHE_MAX_SIZE, ttl: int = CACHE_TTL_SECONDS):
        self._store: OrderedDict[str, tuple[float, object]] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl

    def get(self, key: str):
        if key not in self._store:
            return None
        ts, value = self._store[key]
        if time.monotonic() - ts > self._ttl:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return value

    def put(self, key: str, value: object):
        self._store[key] = (time.monotonic(), value)
        self._store.move_to_end(key)
        while len(self._store) > self._max_size:
            self._store.popitem(last=False)


class RateLimitExceeded(Exception):
    """Raised when the AI API rate limit is reached."""
    pass


class AIAnalysisError(Exception):
    """Raised when AI analysis fails and the image cannot be processed."""
    pass


_rate_limiter = _RateLimiter(MAX_CALLS_PER_MINUTE)
_analysis_cache = _LRUCache()
_context_cache = _LRUCache()
_notes_cache = _LRUCache()

SYSTEM_PROMPT = """You are a content moderation AI specialized in detecting hate speech, \
antisemitism, and extremist content in images and memes.
Analyze the provided image for:
1. Known hate symbols, extremist imagery, or antisemitic content
2. Coded language or symbols used by radical communities
3. Meme templates associated with hate groups
4. Any non-verbal indicators of harmful intent

Respond in JSON format:
{
  "contains_hate_content": boolean,
  "confidence": 0-100,
  "analysis": "brief explanation of findings",
  "detected_elements": ["list", "of", "specific", "elements", "found"],
  "recommendation": "block" | "review" | "approve"
}"""

FALLBACK_RESULT = {
    "contains_hate_content": False,
    "confidence": 0,
    "analysis": "AI analysis unavailable — falling back to hash-only matching.",
    "detected_elements": [],
    "recommendation": "approve",
}


MAX_BASE64_BYTES = 5 * 1024 * 1024  # Anthropic's 5 MB limit for base64 images


def _image_to_base64(filepath: str) -> tuple[str, str]:
    mime_type, _ = mimetypes.guess_type(filepath)
    if not mime_type:
        mime_type = "image/png"

    with open(filepath, "rb") as f:
        raw = f.read()

    encoded = base64.standard_b64encode(raw).decode("utf-8")
    if len(encoded) <= MAX_BASE64_BYTES:
        return encoded, mime_type

    from PIL import Image
    import io

    img = Image.open(filepath)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    output_format = "JPEG"
    output_mime = "image/jpeg"

    for quality in (85, 70, 50, 30):
        buf = io.BytesIO()
        img.save(buf, format=output_format, quality=quality, optimize=True)
        encoded = base64.standard_b64encode(buf.getvalue()).decode("utf-8")
        if len(encoded) <= MAX_BASE64_BYTES:
            return encoded, output_mime

    while True:
        w, h = img.size
        img = img.resize((w * 3 // 4, h * 3 // 4), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format=output_format, quality=50, optimize=True)
        encoded = base64.standard_b64encode(buf.getvalue()).decode("utf-8")
        if len(encoded) <= MAX_BASE64_BYTES:
            return encoded, output_mime


async def analyze_with_claude(filepath: str, cache_key: str | None = None) -> dict:
    if cache_key:
        cached = _analysis_cache.get(cache_key)
        if cached is not None:
            logger.info("analyze_with_claude cache hit for %s", cache_key[:12])
            return dict(cached)

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "your_key_here":
        raise AIAnalysisError("Anthropic API key is not configured. Add a valid ANTHROPIC_API_KEY to .env")

    if not _rate_limiter.allow():
        raise RateLimitExceeded("Rate limit reached — please wait a moment before uploading more images.")

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        image_data, media_type = _image_to_base64(filepath)

        message = client.messages.create(
            model="claude-haiku-4",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Analyze this image for hate content. Return only the JSON response.",
                        },
                    ],
                }
            ],
        )

        response_text = message.content[0].text
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        if start != -1 and end > start:
            result = json.loads(response_text[start:end])
            if cache_key:
                _analysis_cache.put(cache_key, result)
            return result
        raise AIAnalysisError("AI returned an unparseable response")

    except (RateLimitExceeded, AIAnalysisError):
        raise
    except Exception as e:
        logger.error("analyze_with_claude failed: %s", e)
        raise AIAnalysisError(f"AI analysis failed: {e}") from e


CONTEXT_SYSTEM_PROMPT = """Analyze this image for hate content, antisemitism, or extremist symbolism.
Respond in valid JSON only, no extra text:
{
  "what_it_depicts": "brief description of what the image shows",
  "why_harmful": "explanation of why this is harmful or hateful",
  "target_group": "who is being targeted (e.g. Jewish people, immigrants)",
  "severity": "high | medium | low | none",
  "coded_elements": ["list", "of", "specific", "symbols", "or", "references"],
  "origin_community": "where this likely originates (e.g. far-right boards, extremist groups)"
}"""

CONTEXT_FALLBACK = {
    "what_it_depicts": "Unable to analyze",
    "why_harmful": "Manual review required",
    "target_group": "Unknown",
    "severity": "unknown",
    "coded_elements": [],
    "origin_community": "Unknown",
}


async def generate_meme_context(filepath: str, cache_key: str | None = None) -> dict:
    if cache_key:
        cached = _context_cache.get(cache_key)
        if cached is not None:
            logger.info("generate_meme_context cache hit for %s", cache_key[:12])
            return dict(cached)

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "your_key_here":
        raise AIAnalysisError("Anthropic API key is not configured. Add a valid ANTHROPIC_API_KEY to .env")

    if not _rate_limiter.allow():
        raise RateLimitExceeded("Rate limit reached — please wait a moment before uploading more images.")

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        image_data, media_type = _image_to_base64(filepath)

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=CONTEXT_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Analyze this image. Return only the JSON response.",
                        },
                    ],
                }
            ],
        )

        response_text = message.content[0].text
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        if start != -1 and end > start:
            result = json.loads(response_text[start:end])
            if cache_key:
                _context_cache.put(cache_key, result)
            return result
        raise AIAnalysisError("AI returned an unparseable response")

    except (RateLimitExceeded, AIAnalysisError):
        raise
    except Exception as e:
        logger.error("generate_meme_context failed: %s", e)
        raise AIAnalysisError(f"AI analysis failed: {e}") from e


async def generate_context_notes(filepath: str, cache_key: str | None = None) -> str | None:
    if cache_key:
        cached = _notes_cache.get(cache_key)
        if cached is not None:
            logger.info("generate_context_notes cache hit for %s", cache_key[:12])
            return cached

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "your_key_here":
        raise AIAnalysisError("Anthropic API key is not configured. Add a valid ANTHROPIC_API_KEY to .env")

    if not _rate_limiter.allow():
        raise RateLimitExceeded("Rate limit reached — please wait a moment before uploading more images.")

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        image_data, media_type = _image_to_base64(filepath)

        message = client.messages.create(
            model="claude-haiku-4",
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Briefly describe what makes this image potentially harmful or associated with extremist communities. 1-2 sentences max.",
                        },
                    ],
                }
            ],
        )

        result = message.content[0].text.strip()
        if cache_key:
            _notes_cache.put(cache_key, result)
        return result
    except (RateLimitExceeded, AIAnalysisError):
        raise
    except Exception as e:
        logger.error("generate_context_notes failed: %s", e)
        raise AIAnalysisError(f"AI analysis failed: {e}") from e

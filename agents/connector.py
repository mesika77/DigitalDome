"""
connector.py — bridge: scraping agents → DigitalDome backend
============================================================
DigitalDome's ingest endpoint is IMAGE-based:

    POST /api/inject   (multipart/form-data)
        file           : the image bytes        (required)
        source         : platform/source string
        community      : community/channel string
        date_detected  : ISO date (YYYY-MM-DD)
        context_notes  : optional; if omitted the server's Claude fills it in

The server computes the perceptual hash and runs AI analysis itself, so the
agent does NOT send a risk score — it sends the picture and lets DigitalDome
judge it.

This module gives the scrapers one function, `inject_image()`, that downloads a
meme image and uploads it. A cheap text pre-filter (`looks_risky`) avoids
spending the server's AI quota on obviously-benign posts.
"""

from __future__ import annotations

import io
import os
import re
from datetime import date

import requests

# Where DigitalDome's backend is running. Override with an env var if needed.
API = os.getenv("DIGITALDOME_API", "http://localhost:8000")
INJECT_URL = API + "/api/inject"

UA = {"User-Agent": "DigitalDome-Agent/1.0 (research prototype)"}

# Cheap lexicon pre-filter — keeps us from uploading every random image.
_RISK = re.compile(
    r"\b(14\s*/?\s*88|great replacement|day of the rope|rahowa|groyper|"
    r"globalist|kalergi|zog|remove |subhuman|untermensch|blood libel|"
    r"deport|race war|degenerate|invasion)\b",
    re.I,
)


def looks_risky(text: str) -> bool:
    """True if the post text trips the lexicon. Tune/replace as you like.
    Returns True for empty text too, so image-only posts still get analyzed
    by the server's Claude (set PREFILTER=strict to change that)."""
    if not text:
        return os.getenv("PREFILTER", "loose") != "strict"
    return bool(_RISK.search(text))


def download_image(url: str, timeout: float = 12.0) -> tuple[bytes, str] | None:
    """Fetch image bytes. Returns (bytes, filename) or None on failure."""
    try:
        r = requests.get(url, headers=UA, timeout=timeout)
        r.raise_for_status()
        ctype = r.headers.get("Content-Type", "")
        if not ctype.startswith("image/"):
            return None
        ext = "." + (ctype.split("/")[-1].split(";")[0] or "png")
        name = os.path.basename(url.split("?")[0]) or f"scraped{ext}"
        if not os.path.splitext(name)[1]:
            name += ext
        return r.content, name
    except requests.RequestException:
        return None


def inject_image(
    *,
    image_url: str,
    source: str,
    community: str,
    context_notes: str | None = None,
    detected: date | None = None,
    timeout: float = 30.0,
) -> bool:
    """Download `image_url` and POST it to DigitalDome's /api/inject.

    Returns True on success. Handles the two expected non-200s:
      429 → server AI rate-limited (back off)
      503 → server has no ANTHROPIC_API_KEY configured (tell the operator)
    """
    got = download_image(image_url)
    if not got:
        print(f"  · skip (not an image): {image_url}")
        return False
    content, filename = got

    files = {"file": (filename, io.BytesIO(content), "image/png")}
    data = {
        "source": source,
        "community": community,
        "date_detected": (detected or date.today()).isoformat(),
    }
    if context_notes:
        data["context_notes"] = context_notes

    try:
        r = requests.post(INJECT_URL, files=files, data=data, timeout=timeout)
        if r.status_code in (200, 201):
            mid = ""
            try:
                mid = f" id={r.json().get('id')}"
            except Exception:
                pass
            print(f"  ✓ injected [{source}/{community}]{mid}")
            return True
        if r.status_code == 429:
            print("  · 429 rate-limited by server AI — backing off")
            return False
        if r.status_code == 503:
            print("  ✗ 503 — DigitalDome has no ANTHROPIC_API_KEY set. "
                  "Add it to backend/.env so /api/inject can analyze images.")
            return False
        print(f"  ✗ inject failed: HTTP {r.status_code} {r.text[:120]}")
        return False
    except requests.RequestException as exc:
        print(f"  ✗ backend unreachable at {INJECT_URL}: {exc}")
        return False


def ping_backend() -> bool:
    """Quick check that the backend is up before we start scraping."""
    try:
        r = requests.get(API + "/api/v1/status", timeout=5)
        if r.ok:
            print(f"[connector] backend OK: {r.json().get('total_flagged_memes', '?')} memes in DB")
            return True
    except requests.RequestException:
        pass
    print(f"[connector] WARNING: backend not reachable at {API} "
          f"(start it: cd backend && uvicorn main:app --port 8000)")
    return False

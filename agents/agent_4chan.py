"""
agent_4chan.py — live 4chan agent for DigitalDome (no credentials needed)
=========================================================================
Polls 4chan's official read-only JSON API, finds posts that have an image AND
trip the text pre-filter, downloads the image, and injects it into DigitalDome
via /api/inject. The backend's Claude then scores/severity-tags it.

Run (backend must be up first):
    cd backend && uvicorn main:app --port 8000        # terminal 1
    cd agents  && python agent_4chan.py               # terminal 2

Env knobs:
    DIGITALDOME_API   backend base URL (default http://localhost:8000)
    CHAN_BOARD        board to watch   (default pol)
    CHAN_POLL         seconds between catalog scans (default 45)
    MAX_INJECTS       safety cap per run, protects the AI quota (default 30)
"""

from __future__ import annotations

import html as _html
import os
import re
import time
from typing import Set

import requests

from connector import inject_image, looks_risky, ping_backend, send_heartbeat

BOARD = os.getenv("CHAN_BOARD", "pol")
POLL = float(os.getenv("CHAN_POLL", "45"))
MAX_INJECTS = int(os.getenv("MAX_INJECTS", "30"))
DELAY = 1.2  # 4chan asks for <= 1 req/sec; we use 1.2 to be safe
AGENT_ID = f"4chan-{BOARD}"

CATALOG = f"https://a.4cdn.org/{BOARD}/catalog.json"
THREAD = f"https://a.4cdn.org/{BOARD}/thread/{{no}}.json"
IMG = f"https://i.4cdn.org/{BOARD}/{{tim}}{{ext}}"
UA = {"User-Agent": "DigitalDome-Agent/1.0 (research prototype)"}

_seen: Set[int] = set()
_mtime: dict[int, int] = {}
_injected = 0


def _heartbeat(
    *,
    status: str = "healthy",
    message: str | None = None,
    threads_changed: int = 0,
    threads_total: int = 0,
    last_error: str | None = None,
) -> None:
    send_heartbeat(
        agent_id=AGENT_ID,
        agent_type="4chan",
        source="4chan",
        community=f"/{BOARD}/",
        status=status,
        message=message,
        last_error=last_error,
        metrics={
            "board": BOARD,
            "threads_changed": threads_changed,
            "threads_total": threads_total,
            "injected": _injected,
            "max_injects": MAX_INJECTS,
            "poll_seconds": POLL,
            "seen_posts": len(_seen),
        },
    )


def _clean(htmltext: str) -> str:
    if not htmltext:
        return ""
    t = re.sub(r"<br\s*/?>", "\n", htmltext)
    t = re.sub(r"<[^>]+>", "", t)
    return _html.unescape(t).strip()


def _get(url: str):
    r = requests.get(url, headers=UA, timeout=10)
    r.raise_for_status()
    time.sleep(DELAY)
    return r.json()


def process_thread(no: int) -> None:
    global _injected
    try:
        data = _get(THREAD.format(no=no))
    except requests.RequestException:
        return
    for post in data.get("posts", []):
        if _injected >= MAX_INJECTS:
            return
        pno = post.get("no")
        if pno in _seen:
            continue
        _seen.add(pno)

        # must have an image to inject (DigitalDome is image-based)
        if "tim" not in post or "ext" not in post:
            continue
        text = _clean(post.get("com", ""))
        if not looks_risky(text):
            continue

        image_url = IMG.format(tim=post["tim"], ext=post["ext"])
        ok = inject_image(
            image_url=image_url,
            source="4chan",
            community=f"/{BOARD}/",
            context_notes=text[:300] or None,
        )
        if ok:
            _injected += 1


def main() -> None:
    print(f"[4chan-agent] board=/{BOARD}/  cap={MAX_INJECTS}  -> DigitalDome")
    ping_backend()
    _heartbeat(message="agent started")
    global _injected
    while True:
        _injected = 0  # reset cap each cycle
        try:
            catalog = _get(CATALOG)
        except requests.RequestException as exc:
            print(f"[4chan-agent] catalog error: {exc}; retrying in {POLL}s")
            _heartbeat(status="degraded", message="catalog request failed", last_error=str(exc))
            time.sleep(POLL)
            continue

        threads = [t for page in catalog for t in page.get("threads", [])]
        fresh = []
        for t in threads:
            no, lm = t.get("no"), t.get("last_modified", 0)
            if _mtime.get(no) != lm:
                _mtime[no] = lm
                fresh.append(no)

        print(f"[4chan-agent] {len(fresh)}/{len(threads)} threads changed — scanning "
              f"(inject cap {MAX_INJECTS})")
        for no in fresh:
            if _injected >= MAX_INJECTS:
                print(f"[4chan-agent] hit inject cap ({MAX_INJECTS}) — pausing")
                break
            process_thread(no)

        if len(_seen) > 20000:
            _seen.clear()
        _heartbeat(
            message="scan complete",
            threads_changed=len(fresh),
            threads_total=len(threads),
        )
        time.sleep(POLL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        _heartbeat(status="down", message="agent stopped by operator")
        print("\n[4chan-agent] stopped")

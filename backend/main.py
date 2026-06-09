import os
import json
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import engine, get_db, Base
from models import FlaggedMeme, UploadBatch
from schemas import (
    FlaggedMemeResponse,
    CheckResult,
    AIAnalysisResult,
    UploadBatchResponse,
    BatchInjectResponse,
)
from image_utils import compute_phash, hamming_distance, similarity_score
from ai_analysis import analyze_with_claude, generate_context_notes, generate_meme_context, RateLimitExceeded, AIAnalysisError

load_dotenv()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
MIN_MATCH_SIMILARITY = 85
FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
AGENT_HEARTBEATS: dict[str, dict[str, Any]] = {}
HEARTBEAT_HEALTHY_SECONDS = 120
HEARTBEAT_DEGRADED_SECONDS = 300

app = FastAPI(
    title="DigitalDome Threat Intelligence API",
    description="Real-time hate meme detection and intelligence database. Subscribe at digitaldome.io",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://digitaldome.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

API_KEYS = {
    "demo-police-001": "Law Enforcement Demo",
    "demo-intel-001": "Intelligence Unit Demo",
    "demo-social-001": "Social Media Platform Demo",
    "demo-judge-001": "Hackathon Judge Access",
}


class AgentHeartbeat(BaseModel):
    agent_id: str = Field(..., min_length=1)
    agent_type: str = "agent"
    source: str = "Unknown"
    community: str = "Unclassified"
    status: str = "healthy"
    message: Optional[str] = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    last_error: Optional[str] = None


async def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    if api_key not in API_KEYS:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key. Contact DigitalDome to subscribe.",
        )
    return API_KEYS[api_key]


# Dev-only: drop and recreate DB when schema changes (no Alembic migrations in dev)
Base.metadata.create_all(bind=engine)

Path(UPLOAD_DIR, "source").mkdir(parents=True, exist_ok=True)
Path(UPLOAD_DIR, "gateway").mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def _determine_status(distance: int, ai_recommendation: str, match_severity: str) -> str:
    severity_is_serious = match_severity in ("high", "medium")

    if distance <= 10:
        if ai_recommendation == "block" and severity_is_serious:
            return "blocked"
        if ai_recommendation == "approve" and not severity_is_serious:
            return "approved"
        return "pending"

    if distance <= 20:
        if ai_recommendation == "block" and severity_is_serious:
            return "blocked"
        if ai_recommendation == "approve":
            return "approved"
        return "pending"

    if ai_recommendation == "block":
        return "pending"
    return "approved"


def _save_upload(file: UploadFile, subfolder: str) -> tuple[str, str]:
    ext = Path(file.filename).suffix or ".png"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = Path(UPLOAD_DIR, subfolder, unique_name)
    with open(dest, "wb") as f:
        f.write(file.file.read())
    return unique_name, str(dest)


def _meme_to_response(meme: FlaggedMeme) -> FlaggedMemeResponse:
    return FlaggedMemeResponse(
        id=meme.id,
        upload_batch_id=meme.upload_batch_id,
        filename=meme.filename,
        filepath=meme.filepath,
        phash=meme.phash,
        platform=meme.platform,
        original_poster=meme.original_poster,
        source_url=meme.source_url,
        source=meme.source,
        community=meme.community,
        date_detected=meme.date_detected,
        context_notes=meme.context_notes,
        context=meme.context,
        created_at=meme.created_at,
        thumbnail_url=f"/uploads/source/{meme.filename}",
    )


def _batch_to_response(batch: UploadBatch) -> UploadBatchResponse:
    return UploadBatchResponse(
        id=batch.id,
        batch_id=batch.batch_id,
        analyst_notes=batch.analyst_notes,
        image_count=batch.image_count,
        created_at=batch.created_at,
        memes=[_meme_to_response(m) for m in batch.memes],
    )


# ---------------------------------------------------------------------------
# Dataflow monitor endpoints
# ---------------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _node(
    node_id: str,
    label: str,
    node_type: str,
    status: str,
    details: str,
    metrics: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return {
        "id": node_id,
        "label": label,
        "type": node_type,
        "status": status,
        "details": details,
        "metrics": metrics or {},
    }


def _edge(source: str, target: str, label: str, status: str) -> dict[str, str]:
    return {"from": source, "to": target, "label": label, "status": status}


def _issue(severity: str, component: str, message: str) -> dict[str, str]:
    return {"severity": severity, "component": component, "message": message}


def _combine_status(*statuses: str) -> str:
    if "down" in statuses:
        return "down"
    if "degraded" in statuses:
        return "degraded"
    return "healthy"


def _storage_status() -> tuple[str, dict[str, Any], list[dict[str, str]]]:
    issues = []
    metrics = {}
    status = "healthy"

    for folder in ("source", "gateway"):
        path = Path(UPLOAD_DIR, folder)
        exists = path.exists() and path.is_dir()
        writable = False
        if exists:
            probe = path / ".monitor_write_check"
            try:
                probe.write_text("ok")
                probe.unlink(missing_ok=True)
                writable = True
            except OSError:
                writable = False

        metrics[f"{folder}_exists"] = exists
        metrics[f"{folder}_writable"] = writable
        if not exists:
            status = "down"
            issues.append(_issue("critical", "storage", f"Upload folder missing: {path}"))
        elif not writable:
            status = "down"
            issues.append(_issue("critical", "storage", f"Upload folder is not writable: {path}"))

    return status, metrics, issues


def _heartbeat_age_seconds(seen_at: datetime, now: datetime) -> int:
    return max(0, int((now - seen_at).total_seconds()))


def _agent_status(record: dict[str, Any], now: datetime) -> str:
    reported = record.get("reported_status", "healthy")
    if reported == "down":
        return "down"
    age = _heartbeat_age_seconds(record["last_seen_at"], now)
    if age > HEARTBEAT_DEGRADED_SECONDS:
        return "down"
    if reported == "degraded" or age > HEARTBEAT_HEALTHY_SECONDS:
        return "degraded"
    return "healthy"


def _agent_payload(record: dict[str, Any], now: datetime) -> dict[str, Any]:
    status = _agent_status(record, now)
    age = _heartbeat_age_seconds(record["last_seen_at"], now)
    return {
        "agent_id": record["agent_id"],
        "agent_type": record["agent_type"],
        "source": record["source"],
        "community": record["community"],
        "status": status,
        "reported_status": record.get("reported_status", "healthy"),
        "message": record.get("message"),
        "metrics": record.get("metrics", {}),
        "last_error": record.get("last_error"),
        "last_seen_at": _iso(record["last_seen_at"]),
        "age_seconds": age,
    }


def _known_agent_status(agent_type: str, now: datetime) -> tuple[str, list[dict[str, Any]]]:
    agents = [
        _agent_payload(record, now)
        for record in AGENT_HEARTBEATS.values()
        if record.get("agent_type") == agent_type
    ]
    if not agents:
        return "down", []
    return _combine_status(*(agent["status"] for agent in agents)), agents


@app.post("/api/agents/heartbeat")
async def agent_heartbeat(heartbeat: AgentHeartbeat):
    status = heartbeat.status.lower()
    if status not in {"healthy", "degraded", "down"}:
        raise HTTPException(status_code=400, detail="status must be healthy, degraded, or down")

    now = _utcnow()
    record = {
        "agent_id": heartbeat.agent_id,
        "agent_type": heartbeat.agent_type,
        "source": heartbeat.source,
        "community": heartbeat.community,
        "reported_status": status,
        "message": heartbeat.message,
        "metrics": heartbeat.metrics,
        "last_error": heartbeat.last_error,
        "last_seen_at": now,
    }
    AGENT_HEARTBEATS[heartbeat.agent_id] = record
    return {"ok": True, "agent_id": heartbeat.agent_id, "received_at": _iso(now)}


@app.get("/api/dataflows/status")
async def get_dataflow_status(db: Session = Depends(get_db)):
    now = _utcnow()
    issues: list[dict[str, str]] = []
    nodes: list[dict[str, Any]] = []

    total_memes = 0
    total_batches = 0
    latest_ingest = None
    db_status = "healthy"
    try:
        total_memes = db.query(FlaggedMeme).count()
        total_batches = db.query(UploadBatch).count()
        latest = db.query(FlaggedMeme).order_by(FlaggedMeme.created_at.desc()).first()
        latest_ingest = latest.created_at if latest else None
    except Exception as exc:
        db_status = "down"
        issues.append(_issue("critical", "database", f"Database query failed: {exc}"))

    nodes.append(_node(
        "database",
        "SQL Database",
        "persistence",
        db_status,
        "Stores flagged memes, batches, pHashes, and AI context.",
        {"total_memes": total_memes, "total_batches": total_batches, "latest_ingest_at": _iso(latest_ingest)},
    ))

    storage_status, storage_metrics, storage_issues = _storage_status()
    issues.extend(storage_issues)
    nodes.append(_node(
        "storage",
        "Upload Storage",
        "storage",
        storage_status,
        "Local source and gateway upload folders.",
        storage_metrics,
    ))

    ai_status = "healthy" if os.getenv("ANTHROPIC_API_KEY") else "degraded"
    if ai_status == "degraded":
        issues.append(_issue("warning", "ai-analysis", "ANTHROPIC_API_KEY is not configured; AI analysis endpoints will reject uploads."))
    nodes.append(_node(
        "ai-analysis",
        "AI Analysis",
        "analysis",
        ai_status,
        "Claude image and meme context analysis.",
        {"configured": ai_status == "healthy"},
    ))

    phash_status = "healthy" if storage_status != "down" else "degraded"
    nodes.append(_node(
        "phash",
        "pHash Engine",
        "analysis",
        phash_status,
        "Computes perceptual hashes for ingest and gateway matching.",
        {"min_match_similarity": MIN_MATCH_SIMILARITY},
    ))

    inject_status = _combine_status(db_status, storage_status, ai_status)
    if inject_status != "healthy":
        issues.append(_issue("warning", "inject-api", "Ingest depends on database, storage, and AI analysis; at least one dependency is degraded."))
    nodes.append(_node(
        "inject-api",
        "Inject API",
        "api",
        inject_status,
        "Accepts source images through /api/inject and /api/inject/batch.",
        {"endpoint": "/api/inject"},
    ))

    gateway_status = _combine_status(db_status, storage_status, ai_status, phash_status)
    nodes.append(_node(
        "gateway",
        "Gateway Check",
        "consumer",
        gateway_status,
        "Checks uploaded images against pHash matches and AI analysis.",
        {"endpoint": "/api/check"},
    ))

    dashboard_status = "healthy" if db_status == "healthy" else "down"
    nodes.append(_node(
        "dashboard",
        "Evidence Dashboard",
        "consumer",
        dashboard_status,
        "Reads flagged memes and similarity data for analysts.",
        {"route": "/dashboard"},
    ))

    agent_4chan_status, fourchan_agents = _known_agent_status("4chan", now)
    if not fourchan_agents:
        issues.append(_issue("warning", "agent-4chan", "No 4chan agent heartbeat has been received. Start agents/agent_4chan.py to activate this source."))
    elif agent_4chan_status != "healthy":
        issues.append(_issue("warning", "agent-4chan", "4chan agent heartbeat is stale or reporting a degraded state."))

    agent_metrics = fourchan_agents[0]["metrics"] if fourchan_agents else {}
    agent_details = fourchan_agents[0]["message"] if fourchan_agents and fourchan_agents[0].get("message") else "Polls 4chan catalog JSON and feeds matching image posts into the inject API."
    nodes.insert(0, _node(
        "agent-4chan",
        "4chan Agent",
        "source",
        agent_4chan_status,
        agent_details,
        agent_metrics,
    ))

    edges = [
        _edge("agent-4chan", "inject-api", "candidate images", _combine_status(agent_4chan_status, inject_status)),
        _edge("inject-api", "ai-analysis", "context + severity", _combine_status(inject_status, ai_status)),
        _edge("inject-api", "phash", "image fingerprint", _combine_status(inject_status, phash_status)),
        _edge("inject-api", "storage", "source image", _combine_status(inject_status, storage_status)),
        _edge("inject-api", "database", "flagged record", _combine_status(inject_status, db_status)),
        _edge("database", "dashboard", "evidence records", dashboard_status),
        _edge("database", "gateway", "known matches", _combine_status(db_status, gateway_status)),
        _edge("ai-analysis", "gateway", "AI decision", _combine_status(ai_status, gateway_status)),
        _edge("phash", "gateway", "similarity score", _combine_status(phash_status, gateway_status)),
    ]

    critical_status = _combine_status(db_status, storage_status, inject_status, ai_status)
    if db_status == "down":
        overall_status = "down"
    elif critical_status != "healthy" or agent_4chan_status != "healthy":
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    agents = [_agent_payload(record, now) for record in AGENT_HEARTBEATS.values()]
    agents.sort(key=lambda agent: agent["last_seen_at"] or "", reverse=True)

    return {
        "generated_at": _iso(now),
        "overall_status": overall_status,
        "summary": {
            "total_memes": total_memes,
            "total_batches": total_batches,
            "latest_ingest_at": _iso(latest_ingest),
            "active_agents": sum(1 for agent in agents if agent["status"] == "healthy"),
            "total_agents": len(agents),
            "issue_count": len(issues),
        },
        "nodes": nodes,
        "edges": edges,
        "issues": issues,
        "agents": agents,
    }


# ---------------------------------------------------------------------------
# Inject endpoints
# ---------------------------------------------------------------------------


@app.post("/api/inject", response_model=FlaggedMemeResponse)
async def inject_meme(
    file: UploadFile = File(...),
    source: str = Form(None),
    community: str = Form(None),
    date_detected: str = Form(None),
    context_notes: str = Form(None),
    db: Session = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    filename, filepath = _save_upload(file, "source")
    phash = compute_phash(filepath)

    try:
        if not context_notes:
            context_notes = await generate_context_notes(filepath, cache_key=phash)
        context = await generate_meme_context(filepath, cache_key=phash)
    except RateLimitExceeded:
        Path(filepath).unlink(missing_ok=True)
        raise HTTPException(status_code=429, detail="Rate limit reached — please wait a moment before uploading more images.")
    except AIAnalysisError as e:
        Path(filepath).unlink(missing_ok=True)
        raise HTTPException(status_code=503, detail=str(e))

    detected = date.today()
    if date_detected:
        try:
            detected = date.fromisoformat(date_detected)
        except ValueError:
            pass

    meme = FlaggedMeme(
        filename=filename,
        filepath=filepath,
        phash=phash,
        source=source or "Scraped source",
        community=community or "Unclassified",
        date_detected=detected,
        context_notes=context_notes,
        context=context,
        created_at=datetime.utcnow(),
    )
    db.add(meme)
    db.commit()
    db.refresh(meme)

    return _meme_to_response(meme)


@app.post("/api/inject/batch", response_model=BatchInjectResponse)
async def inject_batch(
    files: list[UploadFile] = File(...),
    image_metadata: Optional[str] = Form(None),
    analyst_notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Batch inject with per-image metadata.

    image_metadata is a JSON array matching files by index:
    [{"platform": "Reddit", "original_poster": "u/foo", "source_url": "..."}, ...]
    If omitted or shorter than files, missing entries get defaults.
    """
    MAX_BATCH_SIZE = 50
    image_files = [f for f in files if f.content_type and f.content_type.startswith("image/")]
    if not image_files:
        raise HTTPException(status_code=400, detail="No valid image files provided")
    if len(image_files) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Batch too large — max {MAX_BATCH_SIZE} images per batch",
        )

    meta_list = []
    if image_metadata:
        try:
            meta_list = json.loads(image_metadata)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="image_metadata must be valid JSON")

    batch = UploadBatch(
        batch_id=uuid.uuid4().hex,
        analyst_notes=analyst_notes or None,
        image_count=len(image_files),
        created_at=datetime.utcnow(),
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    processed = 0
    failed = 0
    saved_files: list[str] = []

    for i, file in enumerate(image_files):
        try:
            meta = meta_list[i] if i < len(meta_list) else {}
            img_platform = meta.get("platform", "Unknown")
            img_poster = meta.get("original_poster", "Unknown")
            img_source_url = meta.get("source_url") or None

            filename, filepath = _save_upload(file, "source")
            saved_files.append(filepath)
            phash = compute_phash(filepath)
            context = await generate_meme_context(filepath, cache_key=phash)

            meme = FlaggedMeme(
                upload_batch_id=batch.id,
                filename=filename,
                filepath=filepath,
                phash=phash,
                platform=img_platform,
                original_poster=img_poster,
                source_url=img_source_url,
                source=img_platform,
                community=img_poster,
                date_detected=date.today(),
                context=context,
                created_at=datetime.utcnow(),
            )
            db.add(meme)
            db.commit()
            processed += 1
        except RateLimitExceeded:
            for fp in saved_files:
                Path(fp).unlink(missing_ok=True)
            db.delete(batch)
            db.commit()
            raise HTTPException(
                status_code=429,
                detail="Rate limit reached — please wait a moment before uploading more images.",
            )
        except AIAnalysisError as e:
            for fp in saved_files:
                Path(fp).unlink(missing_ok=True)
            db.delete(batch)
            db.commit()
            raise HTTPException(status_code=503, detail=str(e))
        except Exception:
            failed += 1

    db.refresh(batch)

    return BatchInjectResponse(
        batch=_batch_to_response(batch),
        processed=processed,
        failed=failed,
    )


# ---------------------------------------------------------------------------
# Database & Batch read endpoints
# ---------------------------------------------------------------------------


@app.get("/api/database", response_model=list[FlaggedMemeResponse])
def get_database(db: Session = Depends(get_db)):
    memes = db.query(FlaggedMeme).order_by(FlaggedMeme.created_at.desc()).all()
    return [_meme_to_response(m) for m in memes]


@app.get("/api/batches", response_model=list[UploadBatchResponse])
def get_batches(db: Session = Depends(get_db)):
    batches = db.query(UploadBatch).order_by(UploadBatch.created_at.desc()).all()
    return [_batch_to_response(b) for b in batches]


@app.get("/api/batches/{batch_id}", response_model=UploadBatchResponse)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(UploadBatch).filter(UploadBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return _batch_to_response(batch)


@app.delete("/api/database/{meme_id}")
def delete_meme(meme_id: int, db: Session = Depends(get_db)):
    meme = db.query(FlaggedMeme).filter(FlaggedMeme.id == meme_id).first()
    if not meme:
        raise HTTPException(status_code=404, detail="Meme not found")

    batch_id = meme.upload_batch_id

    file_path = Path(meme.filepath)
    if file_path.exists():
        file_path.unlink()

    db.delete(meme)
    db.commit()

    if batch_id:
        remaining = db.query(FlaggedMeme).filter(FlaggedMeme.upload_batch_id == batch_id).count()
        if remaining == 0:
            batch = db.query(UploadBatch).filter(UploadBatch.id == batch_id).first()
            if batch:
                db.delete(batch)
                db.commit()

    return {"ok": True}


@app.delete("/api/batches/{batch_id}")
def delete_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(UploadBatch).filter(UploadBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    memes = db.query(FlaggedMeme).filter(FlaggedMeme.upload_batch_id == batch.id).all()
    for meme in memes:
        file_path = Path(meme.filepath)
        if file_path.exists():
            file_path.unlink()
        db.delete(meme)

    db.delete(batch)
    db.commit()
    return {"ok": True, "deleted": len(memes)}


# ---------------------------------------------------------------------------
# Similar memes endpoint
# ---------------------------------------------------------------------------


@app.get("/api/similar/{meme_id}")
async def get_similar_memes(
    meme_id: int,
    threshold: int = 64,
    db: Session = Depends(get_db),
):
    source = db.query(FlaggedMeme).filter(FlaggedMeme.id == meme_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Meme not found")

    if not source.phash:
        raise HTTPException(status_code=400, detail="This meme has no pHash")

    all_memes = db.query(FlaggedMeme).filter(FlaggedMeme.id != meme_id).all()

    results = []
    failed = 0
    for meme in all_memes:
        if not meme.phash:
            continue
        try:
            distance = hamming_distance(source.phash, meme.phash)
            score = similarity_score(distance)
            results.append({
                "id": meme.id,
                "filename": meme.filename,
                "thumbnail_url": f"/uploads/source/{meme.filename}",
                "source": meme.source,
                "community": meme.community,
                "date_detected": str(meme.date_detected),
                "phash": meme.phash,
                "context": meme.context,
                "similarity_score": score,
                "hamming_distance": distance,
            })
        except Exception as e:
            print(f"Error comparing meme {meme.id}: {e} | phash: {meme.phash}")
            failed += 1
            continue

    results.sort(key=lambda x: x["similarity_score"], reverse=True)
    filtered = [r for r in results if r["hamming_distance"] <= threshold]

    return {
        "source_id": meme_id,
        "source_phash": source.phash,
        "total_similar": len(filtered),
        "failed_comparisons": failed,
        "results": filtered,
    }


@app.get("/api/debug/similar/{meme_id}")
async def debug_similar(meme_id: int, db: Session = Depends(get_db)):
    source = db.query(FlaggedMeme).filter(FlaggedMeme.id == meme_id).first()
    if not source:
        return {"error": "Meme not found"}

    all_memes = db.query(FlaggedMeme).filter(FlaggedMeme.id != meme_id).all()

    results = []
    errors = []

    for meme in all_memes[:10]:  # test first 10 only
        try:
            distance = hamming_distance(source.phash, meme.phash)
            score = similarity_score(distance)
            results.append({
                "id": meme.id,
                "source_phash": source.phash,
                "compare_phash": meme.phash,
                "distance": distance,
                "score": score
            })
        except Exception as e:
            errors.append({
                "id": meme.id,
                "phash": meme.phash,
                "error": str(e)
            })

    return {
        "source_id": meme_id,
        "source_phash": source.phash,
        "comparisons": results,
        "errors": errors
    }


# ---------------------------------------------------------------------------
# Rehash endpoint
# ---------------------------------------------------------------------------


@app.get("/api/rehash")
async def rehash_all(db: Session = Depends(get_db)):
    memes = db.query(FlaggedMeme).all()
    updated = 0
    failed = 0
    skipped = 0

    for meme in memes:
        if meme.phash and len(meme.phash) > 0:
            skipped += 1
            continue

        filepath = None
        possible_paths = [
            meme.filepath,
            meme.thumbnail_url,
            f"uploads/source/{meme.filename}" if meme.filename else None,
        ]

        for path in possible_paths:
            if path and os.path.exists(path):
                filepath = path
                break

        if not filepath:
            failed += 1
            continue

        try:
            new_hash = compute_phash(filepath)
            meme.phash = new_hash
            db.commit()
            updated += 1
        except Exception:
            failed += 1
            continue

    return {
        "message": "Rehash complete",
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "total": len(memes),
    }


# ---------------------------------------------------------------------------
# Check endpoint
# ---------------------------------------------------------------------------


async def check_image_logic(file: UploadFile, db: Session) -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    filename, filepath = _save_upload(file, "gateway")
    uploaded_hash = compute_phash(filepath)
    uploaded_image_url = f"/uploads/gateway/{filename}"

    try:
        all_entries = db.query(FlaggedMeme).all()

        best_match = None
        best_distance = 64
        for entry in all_entries:
            distance = hamming_distance(uploaded_hash, entry.phash)
            if distance < best_distance:
                best_distance = distance
                best_match = entry

        score = similarity_score(best_distance) if best_match else 0
        has_meaningful_match = best_match is not None and score >= MIN_MATCH_SIMILARITY

        ai_result = await analyze_with_claude(filepath, cache_key=uploaded_hash)
        ai_obj = AIAnalysisResult(**ai_result)
        ai_recommendation = ai_result.get("recommendation", "approve")

        if has_meaningful_match:
            match_severity = "none"
            if best_match.context and isinstance(best_match.context, dict):
                match_severity = best_match.context.get("severity", "none").lower()

            status = _determine_status(best_distance, ai_recommendation, match_severity)

            return CheckResult(
                status=status,
                similarity_score=score,
                match=_meme_to_response(best_match) if status != "approved" else None,
                ai_analysis=ai_obj,
                ai_confidence=ai_result.get("confidence", 0),
                uploaded_image_url=uploaded_image_url,
            ).model_dump()

        ai_context = None
        if ai_recommendation == "block":
            ai_context = await generate_meme_context(filepath, cache_key=uploaded_hash)
            status = "blocked"
        elif ai_recommendation == "review":
            ai_context = await generate_meme_context(filepath, cache_key=uploaded_hash)
            status = "pending"
        else:
            status = "approved"

        return CheckResult(
            status=status,
            similarity_score=0,
            match=None,
            ai_analysis=ai_obj,
            ai_confidence=ai_result.get("confidence", 0),
            uploaded_image_url=uploaded_image_url,
            ai_context=ai_context,
        ).model_dump()
    except RateLimitExceeded:
        Path(filepath).unlink(missing_ok=True)
        raise HTTPException(
            status_code=429,
            detail="Rate limit reached — please wait a moment before uploading more images.",
        )
    except AIAnalysisError as e:
        Path(filepath).unlink(missing_ok=True)
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/api/check", response_model=CheckResult)
async def check_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return await check_image_logic(file, db)


# ---------------------------------------------------------------------------
# v1 API endpoints (API-key-protected threat intelligence API)
# ---------------------------------------------------------------------------


@app.get("/api/v1/status")
async def api_status(db: Session = Depends(get_db)):
    total = db.query(FlaggedMeme).count()
    return {
        "platform": "DigitalDome Threat Intelligence API",
        "status": "operational",
        "total_flagged_memes": total,
        "version": "1.0",
        "contact": "api@digitaldome.io",
    }


@app.get("/api/v1/memes")
async def get_all_memes(
    client: str = Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    memes = db.query(FlaggedMeme).all()
    return {
        "client": client,
        "total": len(memes),
        "data": memes,
    }


@app.get("/api/v1/memes/severity/{level}")
async def get_memes_by_severity(
    level: str,
    client: str = Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    if level not in ["high", "medium", "low", "none"]:
        raise HTTPException(
            status_code=400,
            detail="Severity must be: high, medium, low, or none",
        )
    memes = db.query(FlaggedMeme).filter(
        FlaggedMeme.context["severity"].astext == level
    ).all()
    return {
        "client": client,
        "severity_filter": level,
        "total": len(memes),
        "data": memes,
    }


@app.post("/api/v1/check")
async def check_image_v1(
    file: UploadFile = File(...),
    client: str = Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    result = await check_image_logic(file, db)
    result["client"] = client
    return result


def _serve_frontend_path(path: str):
    if path.startswith(("api/", "uploads/", "api", "uploads")):
        raise HTTPException(status_code=404, detail="Not Found")

    index_path = FRONTEND_DIST_DIR / "index.html"
    if not index_path.exists():
        if not path:
            return {
                "platform": "DigitalDome Threat Intelligence API",
                "status": "operational",
                "docs": "/api/docs",
            }
        raise HTTPException(status_code=404, detail="Frontend build not found")

    requested_path = (FRONTEND_DIST_DIR / path).resolve()
    if requested_path.is_file() and requested_path.is_relative_to(FRONTEND_DIST_DIR):
        return FileResponse(requested_path)

    return FileResponse(index_path)


@app.get("/", include_in_schema=False)
async def serve_frontend_root():
    return _serve_frontend_path("")


@app.get("/{path:path}", include_in_schema=False)
async def serve_frontend_route(path: str):
    return _serve_frontend_path(path)

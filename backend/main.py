import os
import json
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
from ai_analysis import analyze_with_claude, generate_context_notes, generate_meme_context, RateLimitExceeded

load_dotenv()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

app = FastAPI(title="DigitalDome", description="Pre-upload hate content gateway")

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,https://digitaldome.vercel.app",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dev-only: drop and recreate DB when schema changes (no Alembic migrations in dev)
Base.metadata.create_all(bind=engine)

Path(UPLOAD_DIR, "source").mkdir(parents=True, exist_ok=True)
Path(UPLOAD_DIR, "gateway").mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


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
# Check endpoint
# ---------------------------------------------------------------------------


@app.post("/api/check", response_model=CheckResult)
async def check_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    filename, filepath = _save_upload(file, "gateway")
    uploaded_hash = compute_phash(filepath)
    uploaded_image_url = f"/uploads/gateway/{filename}"

    try:
        all_entries = db.query(FlaggedMeme).all()

        if not all_entries:
            ai_result = await analyze_with_claude(filepath, cache_key=uploaded_hash)
            ai_obj = AIAnalysisResult(**ai_result)
            if ai_result.get("contains_hate_content") and ai_result.get("confidence", 0) > 75:
                return CheckResult(
                    status="pending",
                    similarity_score=0,
                    match=None,
                    ai_analysis=ai_obj,
                    ai_confidence=ai_result.get("confidence", 0),
                    uploaded_image_url=uploaded_image_url,
                )
            return CheckResult(
                status="approved",
                similarity_score=0,
                match=None,
                ai_analysis=ai_obj,
                ai_confidence=ai_result.get("confidence", 0),
                uploaded_image_url=uploaded_image_url,
            )

        best_match = None
        best_distance = 64

        for entry in all_entries:
            distance = hamming_distance(uploaded_hash, entry.phash)
            if distance < best_distance:
                best_distance = distance
                best_match = entry

        score = similarity_score(best_distance)

        if best_distance <= 10:
            status = "blocked"
            ai_result = await analyze_with_claude(filepath, cache_key=uploaded_hash)
            ai_obj = AIAnalysisResult(**ai_result)
            return CheckResult(
                status=status,
                similarity_score=score,
                match=_meme_to_response(best_match),
                ai_analysis=ai_obj,
                ai_confidence=ai_result.get("confidence", 0),
                uploaded_image_url=uploaded_image_url,
            )

        if best_distance <= 20:
            status = "pending"
            ai_result = await analyze_with_claude(filepath, cache_key=uploaded_hash)
            ai_obj = AIAnalysisResult(**ai_result)
            return CheckResult(
                status=status,
                similarity_score=score,
                match=_meme_to_response(best_match),
                ai_analysis=ai_obj,
                ai_confidence=ai_result.get("confidence", 0),
                uploaded_image_url=uploaded_image_url,
            )

        ai_result = await analyze_with_claude(filepath, cache_key=uploaded_hash)
        ai_obj = AIAnalysisResult(**ai_result)
        if ai_result.get("contains_hate_content") and ai_result.get("confidence", 0) > 75:
            status = "pending"
        else:
            status = "approved"

        return CheckResult(
            status=status,
            similarity_score=score,
            match=_meme_to_response(best_match) if status != "approved" else None,
            ai_analysis=ai_obj,
            ai_confidence=ai_result.get("confidence", 0),
            uploaded_image_url=uploaded_image_url,
        )
    except RateLimitExceeded:
        Path(filepath).unlink(missing_ok=True)
        raise HTTPException(
            status_code=429,
            detail="Rate limit reached — please wait a moment before uploading more images.",
        )

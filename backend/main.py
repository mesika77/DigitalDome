import os
import uuid
from datetime import date, datetime
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import engine, get_db, Base
from models import FlaggedMeme
from schemas import FlaggedMemeResponse, CheckResult, AIAnalysisResult
from image_utils import compute_phash, hamming_distance, similarity_score
from ai_analysis import analyze_with_claude, generate_context_notes

load_dotenv()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

app = FastAPI(title="DigitalDome", description="Pre-upload hate content gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        filename=meme.filename,
        filepath=meme.filepath,
        phash=meme.phash,
        source=meme.source,
        community=meme.community,
        date_detected=meme.date_detected,
        context_notes=meme.context_notes,
        created_at=meme.created_at,
        thumbnail_url=f"/uploads/source/{meme.filename}",
    )


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

    if not context_notes:
        context_notes = await generate_context_notes(filepath)

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
        created_at=datetime.utcnow(),
    )
    db.add(meme)
    db.commit()
    db.refresh(meme)

    return _meme_to_response(meme)


@app.get("/api/database", response_model=list[FlaggedMemeResponse])
def get_database(db: Session = Depends(get_db)):
    memes = db.query(FlaggedMeme).order_by(FlaggedMeme.created_at.desc()).all()
    return [_meme_to_response(m) for m in memes]


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

    all_entries = db.query(FlaggedMeme).all()

    if not all_entries:
        ai_result = await analyze_with_claude(filepath)
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
        ai_result = await analyze_with_claude(filepath)
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
        ai_result = await analyze_with_claude(filepath)
        ai_obj = AIAnalysisResult(**ai_result)
        return CheckResult(
            status=status,
            similarity_score=score,
            match=_meme_to_response(best_match),
            ai_analysis=ai_obj,
            ai_confidence=ai_result.get("confidence", 0),
            uploaded_image_url=uploaded_image_url,
        )

    ai_result = await analyze_with_claude(filepath)
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

from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class MemeCreate(BaseModel):
    filename: str
    filepath: str
    phash: str
    source: str
    community: str
    date_detected: date
    context_notes: Optional[str] = None


class FlaggedMemeResponse(BaseModel):
    id: int
    filename: str
    filepath: str
    phash: str
    source: str
    community: str
    date_detected: date
    context_notes: Optional[str] = None
    created_at: datetime
    thumbnail_url: Optional[str] = None

    model_config = {"from_attributes": True}


class AIAnalysisResult(BaseModel):
    contains_hate_content: bool = False
    confidence: int = 0
    analysis: str = ""
    detected_elements: list[str] = []
    recommendation: str = "approve"


class CheckResult(BaseModel):
    status: str
    similarity_score: int
    match: Optional[FlaggedMemeResponse] = None
    ai_analysis: Optional[AIAnalysisResult] = None
    ai_confidence: int = 0
    uploaded_image_url: Optional[str] = None

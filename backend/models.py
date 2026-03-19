from sqlalchemy import Column, Integer, String, Date, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from database import Base


class UploadBatch(Base):
    __tablename__ = "upload_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True, nullable=False)
    analyst_notes = Column(Text, nullable=True)
    image_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    memes = relationship("FlaggedMeme", back_populates="batch")


class FlaggedMeme(Base):
    __tablename__ = "flagged_memes"

    id = Column(Integer, primary_key=True, index=True)
    upload_batch_id = Column(Integer, ForeignKey("upload_batches.id"), nullable=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    phash = Column(String, nullable=False, index=True)
    platform = Column(String, nullable=True)
    original_poster = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    source = Column(String, nullable=False)
    community = Column(String, nullable=False)
    date_detected = Column(Date, default=date.today)
    context_notes = Column(Text, nullable=True)
    context = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("UploadBatch", back_populates="memes")

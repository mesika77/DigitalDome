from sqlalchemy import Column, Integer, String, Date, DateTime, Text
from datetime import datetime, date
from database import Base


class FlaggedMeme(Base):
    __tablename__ = "flagged_memes"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    phash = Column(String, nullable=False, index=True)
    source = Column(String, nullable=False)
    community = Column(String, nullable=False)
    date_detected = Column(Date, default=date.today)
    context_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

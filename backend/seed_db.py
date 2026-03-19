"""
seed_db.py — Initialize the database and inject 5 sample flagged memes.
Run from the backend/ directory: python seed_db.py
"""

import sys
import os
from datetime import date

# Ensure local imports resolve when run directly
sys.path.insert(0, os.path.dirname(__file__))

from database import engine, SessionLocal, Base
from models import FlaggedMeme

SAMPLE_MEMES = [
    FlaggedMeme(
        filename="pepe_ss_uniform.jpg",
        filepath="uploads/source/pepe_ss_uniform.jpg",
        phash="a1b2c3d4e5f6a7b8",
        source="4chan /pol/",
        community="Neo-Nazi",
        date_detected=date(2024, 11, 3),
        context_notes=(
            "Pepe the Frog depicted wearing an SS officer uniform with a swastika armband. "
            "Recurrent template used on /pol/ to normalise National Socialist imagery under "
            "ironic framing. High cross-post velocity observed across Telegram neo-Nazi channels."
        ),
    ),
    FlaggedMeme(
        filename="great_replacement_infographic.png",
        filepath="uploads/source/great_replacement_infographic.png",
        phash="f8e7d6c5b4a39281",
        source="Telegram — White Nationalist Hub",
        community="White Nationalist",
        date_detected=date(2024, 12, 17),
        context_notes=(
            "Infographic promoting the 'Great Replacement' conspiracy theory using manipulated "
            "demographic statistics. Circulated widely following a high-profile mass-shooting "
            "manifesto that cited identical talking points. Colour palette and typography match "
            "known Patriot Front design templates."
        ),
    ),
    FlaggedMeme(
        filename="jewish_banker_caricature.jpeg",
        filepath="uploads/source/jewish_banker_caricature.jpeg",
        phash="1122334455667788",
        source="Twitter/X — suspended account @redpill_anon",
        community="Antisemitic",
        date_detected=date(2025, 1, 9),
        context_notes=(
            "Caricature recycling 1930s Der Stürmer art style depicting a Jewish banker "
            "controlling puppet governments. Overlaid text references QAnon terminology "
            "(NWO, Deep State). Account was suspended after the image received 14 k retweets "
            "within 6 hours."
        ),
    ),
    FlaggedMeme(
        filename="isis_recruitment_overlay.png",
        filepath="uploads/source/isis_recruitment_overlay.png",
        phash="deadbeef01234567",
        source="Reddit r/MuslimExtremism (banned sub)",
        community="Jihadist",
        date_detected=date(2025, 2, 22),
        context_notes=(
            "Recruitment meme overlaying nasheed audio lyrics onto an image of armed militants "
            "in front of a black jihadist flag. pHash matched a version flagged by EU Internet "
            "Forum takedown request #EU-2025-0041. Detected using reverse-image lookup "
            "corroborated by AI analysis (confidence 94%)."
        ),
    ),
    FlaggedMeme(
        filename="accelerationist_clock.jpg",
        filepath="uploads/source/accelerationist_clock.jpg",
        phash="9876543210abcdef",
        source="Discord — Siege Culture server",
        community="Accelerationist",
        date_detected=date(2025, 3, 5),
        context_notes=(
            "Clock meme with the slogan 'It's always time' referencing accelerationist doctrine "
            "advocating for societal collapse. Visual language and colour scheme directly lifted "
            "from James Mason's 'Siege' publication. Server was deplatformed 48 hours after "
            "this meme began circulating; archived here for reference."
        ),
    ),
]


def seed():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing = db.query(FlaggedMeme).count()
        if existing > 0:
            print(f"Database already contains {existing} record(s). Skipping seed.")
            return

        db.add_all(SAMPLE_MEMES)
        db.commit()
        print(f"Inserted {len(SAMPLE_MEMES)} sample memes successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()

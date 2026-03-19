# DigitalDome

**Pre-upload hate content gateway** — a hate meme detection system that intercepts content before it's posted, checks it against a database of known radical-origin memes using perceptual hashing and AI analysis, and either blocks, holds for review, or approves it.

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- (Optional) An [Anthropic API key](https://console.anthropic.com/) for AI analysis — the app works without it using hash-only matching

### Backend

```bash
cd backend
pip install -r requirements.txt

# Add your Anthropic API key (optional)
# Edit .env and replace your_key_here with your actual key

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Demo Flow

1. **Open the app** — you'll see two panels side by side. The database is empty.
2. **Inject a meme** — drag an image into the left panel ("Source Database"), fill in the source (e.g. "4chan /pol/"), community name, and click **Add to Database**.
3. **Meme appears in the grid** below with its perceptual hash.
4. **Test with the same image** — drag the same meme (or a slightly modified version) into the right panel ("Instagram Gateway") and click **Post to Instagram**.
5. **See BLOCKED** — the system computes the pHash, finds a near-exact match, and shows a red BLOCKED card with a side-by-side comparison.
6. **Test with an innocent image** — upload a completely different image. The system shows a green APPROVED card.
7. **Test with a modified version** — upload a lightly edited version of the flagged meme. The system shows a yellow PENDING card with AI analysis.

---

## Architecture

| Component | Technology |
|-----------|------------|
| Frontend | React (Vite), TailwindCSS |
| Backend | FastAPI (Python) |
| Database | SQLite + SQLAlchemy |
| Image Hashing | imagehash (pHash) |
| AI Analysis | Anthropic Claude (claude-opus-4-6) |
| Image Storage | Local filesystem (`backend/uploads/`) |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/inject` | Add a meme to the flagged database |
| GET | `/api/database` | Get all flagged memes |
| POST | `/api/check` | Check an image against the database |
| GET | `/uploads/{folder}/{filename}` | Serve uploaded images |

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```
ANTHROPIC_API_KEY=your_key_here
UPLOAD_DIR=uploads
DATABASE_URL=sqlite:///./digitaldome.db
```

The app works fully offline (hash matching) when no API key is provided. Claude AI analysis is used as an additional layer when the key is available.

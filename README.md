# DigitalDome

**Pre-upload hate content gateway** — a hate meme detection system that intercepts content before it's posted, checks it against a database of known radical-origin memes using perceptual hashing and AI analysis, and either blocks, holds for review, or approves it.

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/) with credits — required for AI image analysis

### Backend

```bash
cd backend
pip install -r requirements.txt

# Configure your .env (see Environment Variables below)

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
| Frontend | React 19 (Vite), TailwindCSS 4 |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (Supabase) + SQLAlchemy |
| Image Hashing | imagehash (pHash) |
| AI Analysis | Anthropic Claude (Haiku 4 / Haiku 4.5) |
| Image Storage | Local filesystem (`backend/uploads/`) |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/inject` | Add a single meme to the flagged database |
| POST | `/api/inject/batch` | Batch-inject multiple memes (max 50) |
| GET | `/api/database` | Get all flagged memes |
| DELETE | `/api/database/{id}` | Delete a flagged meme |
| GET | `/api/batches` | Get all upload batches |
| GET | `/api/batches/{batch_id}` | Get a specific batch |
| DELETE | `/api/batches/{batch_id}` | Delete a batch and its memes |
| POST | `/api/check` | Check an image against the database |
| GET | `/uploads/{folder}/{filename}` | Serve uploaded images |

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```
ANTHROPIC_API_KEY=your_key_here
UPLOAD_DIR=uploads
DATABASE_URL=postgresql://user:pass@host:port/dbname
AI_RATE_LIMIT=100
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key for AI image analysis |
| `UPLOAD_DIR` | No | `uploads` | Directory for uploaded images |
| `DATABASE_URL` | No | `sqlite:///./digitaldome.db` | Database connection string |
| `AI_RATE_LIMIT` | No | `100` | Max AI API calls per minute (uploads are rejected if exceeded) |

Every uploaded image requires AI analysis. If the rate limit is exceeded or the API key is missing/invalid, uploads will be rejected with a 429 error and a user-visible notification.

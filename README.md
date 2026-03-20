# DigitalDome

**Pre-upload hate content gateway** — a hate meme detection system that intercepts content before it's posted, checks it against a database of known radical-origin memes using perceptual hashing, and independently analyzes it with AI vision. Content can be blocked by either a strong database match (≥85% similarity) or AI analysis alone — the two signals are evaluated independently to avoid false correlations.

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

Open **http://localhost:5173** in your browser. Vite proxies `/api` and `/uploads` requests to the backend automatically.

### Seed the Database

Optionally populate the database with sample memes:

```bash
cd backend
python seed_db.py
```

---

## Demo Flow

1. **Open the app** — you'll see two panels side by side. The database is empty.
2. **Inject a meme** — drag an image into the left panel ("Source Database"), fill in the source (e.g. "4chan /pol/"), community name, and click **Add to Database**.
3. **Meme appears in the grid** below with its perceptual hash.
4. **Test with the same image** — drag the same meme (or a slightly modified version) into the right panel ("Instagram Gateway") and click **Post to Instagram**.
5. **See BLOCKED (DB match)** — the system computes the pHash, finds a near-exact match (≥85% similarity), and shows a red BLOCKED card with a side-by-side image comparison and similarity score.
6. **Test with an innocent image** — upload a completely different image. The system shows a green APPROVED card.
7. **Test with a modified version** — upload a lightly edited version of the flagged meme. The system shows a yellow PENDING card with AI analysis.
8. **Test with new hate content** — upload a hateful image that isn't in the database. The system blocks it via AI analysis alone — no misleading database comparison is shown, just the AI's structured breakdown of why the content is harmful.

---

## How Detection Works

The check endpoint runs two independent detection paths and combines results:

1. **Perceptual hash matching** — computes a pHash of the uploaded image and compares it against every entry in the database. Only matches with ≥85% similarity are considered meaningful. Below that threshold, the match is discarded to avoid false correlations with unrelated images. Similarity is calculated as `max(0, (1 - hamming_distance / 64) * 100)`.

2. **AI vision analysis** — sends the image to Claude for content analysis, returning a structured assessment (hate content detected, confidence, recommendation, detected elements). Results are cached (LRU, 256 entries, 1-hour TTL) to reduce redundant API calls.

The final decision:
- **Strong DB match + AI confirms** → Blocked (with side-by-side comparison)
- **No DB match + AI detects hate** → Blocked (AI-only, with structured context)
- **Strong DB match + AI disagrees** → Held for manual review
- **No DB match + AI approves** → Approved

---

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Admin | `/`, `/admin` | Batch upload with per-image metadata (platform, poster, URL) |
| Gateway | `/gateway` | Single-image check — upload, analyze, and view result |
| Dashboard | `/dashboard` | Browse, filter, sort, export CSV, and find similar memes |

---

## Architecture

| Component | Technology |
|-----------|------------|
| Frontend | React 19 (Vite 8), TailwindCSS 4, React Router 7 |
| Backend | FastAPI (Python) |
| Database | SQLAlchemy (SQLite default, PostgreSQL/Supabase for production) |
| Image Hashing | imagehash (pHash), Pillow, 85% min threshold |
| AI Analysis | Anthropic Claude (Haiku 4.5) |
| Image Storage | Local filesystem (`backend/uploads/`) |
| HTTP Client | Axios |

---

## API Endpoints

### Public

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
| GET | `/api/similar/{meme_id}` | Find similar memes by pHash (configurable threshold) |
| GET | `/api/rehash` | Recompute pHash for memes missing it |
| GET | `/uploads/{folder}/{filename}` | Serve uploaded images |

### v1 — API Key Required

These endpoints require an `X-API-Key` header. Demo keys: `demo-police-001`, `demo-intel-001`, `demo-social-001`, `demo-judge-001`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/status` | Platform status and total flagged count |
| GET | `/api/v1/memes` | List all flagged memes |
| GET | `/api/v1/memes/severity/{level}` | Filter memes by severity (high/medium/low/none) |
| POST | `/api/v1/check` | Check an image (same as `/api/check`, authenticated) |

---

## Environment Variables

### Backend

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

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `https://digitaldome-production.up.railway.app` | Backend base URL |

---

## Deployment

| Layer | Platform | Details |
|-------|----------|---------|
| Frontend | Vercel | Configured via `vercel.json` — builds `frontend/`, outputs `frontend/dist`, SPA rewrites |
| Backend | Railway | Deployed at `https://digitaldome-production.up.railway.app` |

CORS is configured to allow requests from `https://digitaldome.vercel.app`, `http://localhost:5173`, and `http://localhost:3000`.

For production, set the `VITE_API_URL` environment variable in Vercel to point to the deployed backend URL.

---

## Project Structure

```
DigitalDome-1/
├── backend/
│   ├── main.py              # FastAPI app, routes, detection logic
│   ├── database.py          # SQLAlchemy engine & session
│   ├── models.py            # FlaggedMeme, UploadBatch models
│   ├── schemas.py           # Pydantic response schemas
│   ├── ai_analysis.py       # Claude AI image analysis
│   ├── image_utils.py       # pHash computation, hamming distance
│   ├── seed_db.py           # Database seeder (sample memes)
│   ├── requirements.txt
│   └── uploads/
│       ├── source/          # Injected / flagged memes
│       └── gateway/         # Checked images
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api/client.js    # Axios API client
│   │   ├── components/      # DropZone, ResultCard, DatabaseGrid, etc.
│   │   └── pages/           # AdminPage, GatewayPage, DashboardPage
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
├── vercel.json
└── README.md
```

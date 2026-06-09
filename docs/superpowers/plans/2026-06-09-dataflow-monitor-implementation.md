# Dataflow Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real backend-backed dataflow monitor with agent heartbeat reporting and a new `/dataflows` frontend page.

**Architecture:** The backend owns live health computation and in-memory agent heartbeat state. Agents POST liveness and scan metrics to the backend. The frontend renders the returned graph and issue list using existing app shell patterns.

**Tech Stack:** FastAPI, SQLAlchemy, pytest/FastAPI TestClient, Python requests, React 19, Vite, TailwindCSS 4, lucide-react.

---

## File Structure

- Create `backend/test_dataflows.py`: backend tests for status payload and heartbeat behavior.
- Modify `backend/main.py`: add heartbeat models, in-memory heartbeat store, health helpers, `GET /api/dataflows/status`, and `POST /api/agents/heartbeat`.
- Modify `agents/connector.py`: add `send_heartbeat()`.
- Modify `agents/agent_4chan.py`: send startup, scan, error, and shutdown heartbeats.
- Modify `frontend/src/api/client.js`: add `getDataflowStatus()`.
- Create `frontend/src/pages/DataflowsPage.jsx`: monitor UI.
- Modify `frontend/src/App.jsx`: add `/dataflows` route.
- Modify `frontend/src/components/AppShell.jsx`: add Dataflows navigation item.

## Task 1: Backend Status And Heartbeat

**Files:**
- Create: `backend/test_dataflows.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write failing backend tests**

Create `backend/test_dataflows.py` with tests that assert:

```python
from fastapi.testclient import TestClient

from main import AGENT_HEARTBEATS, app


client = TestClient(app)


def setup_function():
    AGENT_HEARTBEATS.clear()


def test_dataflow_status_reports_real_core_nodes():
    response = client.get("/api/dataflows/status")

    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] in {"healthy", "degraded", "down"}
    assert data["generated_at"]
    assert data["summary"]["total_memes"] >= 0
    assert data["summary"]["total_batches"] >= 0
    node_ids = {node["id"] for node in data["nodes"]}
    assert {"database", "storage", "inject-api", "ai-analysis", "agent-4chan"}.issubset(node_ids)
    assert any(edge["from"] == "agent-4chan" and edge["to"] == "inject-api" for edge in data["edges"])
    assert any(issue["component"] == "agent-4chan" for issue in data["issues"])


def test_agent_heartbeat_updates_dataflow_status():
    heartbeat = {
        "agent_id": "4chan-pol",
        "agent_type": "4chan",
        "source": "4chan",
        "community": "/pol/",
        "status": "healthy",
        "message": "scan complete",
        "metrics": {"threads_changed": 3, "injected": 1},
    }

    post_response = client.post("/api/agents/heartbeat", json=heartbeat)
    assert post_response.status_code == 200
    assert post_response.json()["ok"] is True

    status_response = client.get("/api/dataflows/status")
    data = status_response.json()
    agent = next(agent for agent in data["agents"] if agent["agent_id"] == "4chan-pol")
    assert agent["status"] == "healthy"
    assert agent["metrics"]["injected"] == 1
    agent_node = next(node for node in data["nodes"] if node["id"] == "agent-4chan")
    assert agent_node["status"] == "healthy"
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `cd backend && python -m pytest test_dataflows.py -v`

Expected: FAIL because the endpoint and heartbeat store do not exist.

- [ ] **Step 3: Implement backend monitor endpoints**

In `backend/main.py`, add:

- Pydantic models for heartbeat input.
- Global `AGENT_HEARTBEATS = {}`.
- Helpers for status severity, timestamp formatting, storage writability, heartbeat age, node/edge construction, and issue aggregation.
- `POST /api/agents/heartbeat`.
- `GET /api/dataflows/status`.

Use real database counts, latest ingest timestamp, upload folder checks, `ANTHROPIC_API_KEY` presence, and heartbeat freshness.

- [ ] **Step 4: Run backend tests and verify they pass**

Run: `cd backend && python -m pytest test_dataflows.py -v`

Expected: PASS.

## Task 2: Agent Heartbeat Reporting

**Files:**
- Modify: `agents/connector.py`
- Modify: `agents/agent_4chan.py`

- [ ] **Step 1: Add heartbeat helper**

Add `send_heartbeat()` to `agents/connector.py`. It posts JSON to `/api/agents/heartbeat`, returns `True` for 2xx responses, prints a short warning on failure, and never raises `requests.RequestException`.

- [ ] **Step 2: Wire 4chan agent metrics**

Import `send_heartbeat` in `agents/agent_4chan.py`. Send heartbeat on startup, after each successful scan, on catalog error, and on keyboard interrupt. Include board, changed thread count, total threads, injected count, max injects, poll seconds, and seen posts.

- [ ] **Step 3: Compile agent scripts**

Run: `python -m py_compile agents/connector.py agents/agent_4chan.py`

Expected: exit 0.

## Task 3: Frontend API And Page

**Files:**
- Modify: `frontend/src/api/client.js`
- Create: `frontend/src/pages/DataflowsPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/AppShell.jsx`

- [ ] **Step 1: Add API client function**

Add:

```js
export async function getDataflowStatus() {
  const { data } = await api.get("/api/dataflows/status");
  return data;
}
```

- [ ] **Step 2: Build dataflows page**

Create a page that fetches `getDataflowStatus()` on mount, supports loading/error states, and renders summary metrics, graph nodes/edges, issues, component health, and agent heartbeat cards.

- [ ] **Step 3: Add route and nav**

Import `DataflowsPage` in `App.jsx` and add `/dataflows`. Add a `Network` nav item in `AppShell.jsx`.

- [ ] **Step 4: Build frontend**

Run: `cd frontend && npm run build`

Expected: exit 0.

## Task 4: End-To-End Verification

**Files:**
- No planned edits.

- [ ] **Step 1: Run backend compile/tests**

Run: `cd backend && python -m pytest test_dataflows.py -v`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`

Expected: exit 0.

- [ ] **Step 3: Exercise monitor endpoint manually**

Run backend, then:

```bash
curl -s http://localhost:8000/api/dataflows/status
curl -s -X POST http://localhost:8000/api/agents/heartbeat \
  -H 'Content-Type: application/json' \
  -d '{"agent_id":"4chan-pol","agent_type":"4chan","source":"4chan","community":"/pol/","status":"healthy","metrics":{"injected":1}}'
```

Expected: first response includes nodes/issues; second returns `{"ok": true, ...}`.

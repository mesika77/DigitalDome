# Dataflow Monitor Design

## Goal

Add a real backend-backed dataflow monitor to DigitalDome so operators can see which ingestion, analysis, storage, and consumer paths are functional and which are degraded or failing.

The first version should make the newly added scraping-agent pipeline observable instead of inferred. It should show a network of system components, live status, operational metrics, and specific issues that need attention.

## Scope

In scope:

- A new backend monitor endpoint that returns live system health and a dataflow graph.
- A lightweight agent heartbeat endpoint so external agents can report that they are alive.
- Updates to the 4chan agent so it sends heartbeat data to the backend.
- A new frontend page at `/dataflows`.
- Navigation entry in the existing app shell.
- Status and issue display for backend API, database, upload storage, AI configuration, inject API, gateway check path, dashboard data path, and known agents.

Out of scope for the first version:

- Long-term event retention.
- Log streaming.
- Per-image trace timelines.
- Authentication for monitor endpoints.
- Auto-restarting failed agents.
- Distributed tracing or external observability integrations.

## Backend Design

Add two endpoints to `backend/main.py`:

- `GET /api/dataflows/status`
- `POST /api/agents/heartbeat`

`GET /api/dataflows/status` returns:

- `generated_at`: ISO timestamp.
- `overall_status`: `healthy`, `degraded`, or `down`.
- `summary`: counts and core health metrics.
- `nodes`: graph nodes with `id`, `label`, `type`, `status`, `metrics`, and `details`.
- `edges`: directional dataflow edges with `from`, `to`, `label`, and `status`.
- `issues`: human-readable issue records with `severity`, `component`, and `message`.
- `agents`: latest known heartbeat records.

Backend checks should be real and cheap:

- Database: run count queries for `FlaggedMeme` and `UploadBatch`.
- Recent ingest: query latest `FlaggedMeme.created_at`.
- Storage: verify `uploads/source` and `uploads/gateway` exist and are writable.
- AI configuration: check whether `ANTHROPIC_API_KEY` is present.
- API endpoints: mark inject/check routes available because they are mounted in-process, but degrade them if required dependencies are unhealthy.
- Agents: use heartbeat freshness.

`POST /api/agents/heartbeat` accepts a JSON body:

- `agent_id`: stable string, for example `4chan-pol`.
- `agent_type`: source category, for example `4chan`.
- `source`: display source, for example `4chan`.
- `community`: display community, for example `/pol/`.
- `status`: `healthy`, `degraded`, or `down`.
- `message`: optional short status message.
- `metrics`: optional object, for example scanned threads, injected count, errors.
- `last_error`: optional error text.

Store heartbeat records in process memory for the first version. This is acceptable because it tracks liveness, not durable evidence. If the server restarts, missing heartbeats correctly become an operator-visible issue until agents report again.

Agent freshness thresholds:

- Healthy: heartbeat age is at most 2 minutes.
- Degraded: heartbeat age is over 2 minutes and at most 5 minutes, or the agent reports `degraded`.
- Down: heartbeat age is over 5 minutes, missing, or the agent reports `down`.

## Agent Design

Update `agents/connector.py` with a reusable `send_heartbeat()` helper.

Update `agents/agent_4chan.py` to send heartbeats:

- On startup.
- After each catalog scan.
- When the catalog request fails.
- When stopping via keyboard interrupt.

Heartbeat metrics should include:

- `board`
- `threads_changed`
- `threads_total`
- `injected`
- `max_injects`
- `poll_seconds`
- `seen_posts`

Heartbeat failures should never crash the scraper.

## Frontend Design

Add `frontend/src/pages/DataflowsPage.jsx` and route it at `/dataflows`.

Use the existing `AppShell`, shared UI primitives, Tailwind style, and lucide icons. Add a nav item labeled `Dataflows`.

The page should show:

- Header metrics: overall status, active agents, issues, recent ingest.
- A network view of nodes and directional edges.
- A component health list with status, details, and metrics.
- An issues panel for degraded/down components.
- An agents panel showing heartbeat age, source/community, and metrics.

The network should be functional and readable without needing a graph library. A responsive CSS grid with directional connector labels is enough for version one. It should emphasize operational scanning over decorative diagramming.

The frontend should fetch `getDataflowStatus()` from the API client. It should support loading, error, and empty states.

## Dataflow Nodes

Initial node set:

- `agent-4chan`: 4chan agent, derived from heartbeat if present.
- `inject-api`: `/api/inject`.
- `ai-analysis`: Claude image/context analysis.
- `phash`: perceptual hash computation.
- `storage`: upload folders.
- `database`: SQL database.
- `dashboard`: evidence dashboard read path.
- `gateway`: gateway image check path.

Initial edges:

- `agent-4chan` -> `inject-api`
- `inject-api` -> `ai-analysis`
- `inject-api` -> `phash`
- `inject-api` -> `storage`
- `inject-api` -> `database`
- `database` -> `dashboard`
- `database` -> `gateway`
- `ai-analysis` -> `gateway`
- `phash` -> `gateway`

If no 4chan heartbeat exists yet, the agent node should be marked down with an issue explaining that no heartbeat has been received.

## Status Rules

Overall status:

- `down` if the database is unreachable or backend status generation fails.
- `degraded` if any critical component is degraded/down, AI key is missing, storage is not writable, or known agent heartbeat is stale.
- `healthy` only if all critical checks pass.

Critical components for version one:

- database
- storage
- inject API
- AI configuration

Agent status affects overall status as degraded, not down, because the backend can still serve manual uploads and gateway checks.

## Error Handling

Backend:

- Never let one check failure prevent the entire status payload.
- Convert check failures into `issues`.
- Keep heartbeat input validation strict enough to reject missing `agent_id`, but tolerant of optional metrics.

Frontend:

- Show a clear error state if `/api/dataflows/status` is unreachable.
- Do not crash on missing optional fields.
- Format unknown timestamps as `never`.

## Testing And Verification

Backend verification:

- Run Python import/compile checks.
- Hit `GET /api/dataflows/status` with the backend running.
- POST a sample heartbeat and confirm the status payload reflects it.

Frontend verification:

- Run frontend build or lint where available.
- Open `/dataflows` locally and verify loading, success, and error states.
- Confirm the navigation works on desktop and mobile widths.

## Implementation Notes

Keep implementation intentionally small:

- Use in-memory heartbeat storage first.
- Do not introduce a graph library.
- Do not add database migrations.
- Do not change existing ingest/check behavior.
- Keep monitor endpoints unauthenticated to match the current public demo API style.

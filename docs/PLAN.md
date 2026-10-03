# Project Plan

Checklist items are checked off by the agent as work completes. Parts marked "user sign-off" stop for approval before moving on.

## Key decisions

- Single Docker container on port 8000. Multi-stage build: Node stage runs `next build` with `output: "export"`; Python stage (uv) runs FastAPI with uvicorn and serves the exported `out/` directory at `/`.
- All backend routes live under `/api`.
- Backend layout: `backend/app/main.py` (app, routes, static mount), `backend/app/db.py` (SQLite), `backend/app/ai.py` (OpenRouter), `backend/tests/`. Dependencies in `backend/pyproject.toml` with `uv.lock`.
- Auth: `POST /api/login` checks the hardcoded `user` / `password` and sets a session cookie (Starlette `SessionMiddleware`). `POST /api/logout` clears it. `GET /api/me` returns the current user or 401. Board routes require a session.
- Board API uses the existing frontend `BoardData` shape as the contract: `GET /api/board` and `PUT /api/board` (replace whole board). The frontend saves after each change.
- SQLite file at `data/kanban.db`, mounted as a Docker volume so it survives restarts. Created with schema on startup if missing. A new user gets a seeded default board.
- AI: `openai` Python SDK pointed at `https://openrouter.ai/api/v1`, model `openai/gpt-oss-120b`, key from `OPENROUTER_API_KEY` in `.env` (passed with `--env-file`).
- AI structured output: `{ "message": string, "board": BoardData | null }`. When `board` is present the backend validates and saves it, then returns it to the frontend. Conversation history is kept in frontend state and sent with each request (not persisted).
- Scripts: `scripts/start.sh` / `scripts/stop.sh` (Mac, Linux) and `scripts/start.ps1` / `scripts/stop.ps1` (Windows). Start builds the image and runs the container detached; stop removes it.

## Part 1: Plan

- [x] Enrich this document with substeps, tests and success criteria
- [x] Create `frontend/AGENTS.md` describing the existing frontend
- [x] User reviews and approves this plan (user sign-off)

Success: user approves the plan.

## Part 2: Scaffolding

- [x] `backend/pyproject.toml` with fastapi, uvicorn; pytest and httpx2 as dev dependencies; `uv.lock`
- [x] `backend/app/main.py` with `GET /api/health` returning `{"status": "ok"}` and a static `hello world` HTML page served at `/`
- [x] `Dockerfile` at project root using uv; `.dockerignore`
- [x] Start and stop scripts for Mac/Linux and Windows
- [x] Update `backend/AGENTS.md` and `scripts/AGENTS.md`
- [x] Test: pytest for `/api/health` and `/`

Success: `scripts/start` builds and runs the container; `http://localhost:8000` shows hello world; `/api/health` returns ok; stop script removes the container; pytest passes.

## Part 3: Add in Frontend

- [x] Set `output: "export"` in `next.config.ts`
- [x] Dockerfile Node build stage; copy `frontend/out` into the Python image; FastAPI serves it at `/` (API routes take precedence)
- [x] Remove the placeholder hello world page
- [x] Add card editing (edit title and details of an existing card) with unit and e2e tests
- [x] Test: backend test that `/` returns the built index when present; all frontend unit tests pass; Playwright e2e runs against the container (`baseURL` configurable via env var, default dev server)

Success: Kanban board loads at `http://localhost:8000` from the container; drag and drop, rename, add, edit and delete work; all tests pass.

## Part 4: Fake user sign in

- [x] Backend: `SessionMiddleware` (secret from env with a dev default), `POST /api/login`, `POST /api/logout`, `GET /api/me`
- [x] Frontend: on load call `/api/me`; show a login form if 401, else the board. Log out button in the header
- [x] Next dev server proxies `/api` to `localhost:8000` (rewrites in dev only) so `npm run dev` still works
- [x] Tests: pytest for login success, wrong credentials (401), me before/after login, logout. Unit tests for login form. E2E: wrong password shows error, correct login shows board, logout returns to login

Success: board is not visible until logging in with `user` / `password`; logout works; session survives page reload; all tests pass.

## Part 5: Database modeling (user sign-off)

- [x] Propose schema in `docs/DATABASE.md`: tables `users`, `boards` (one per user for MVP), `columns` (board_id, title, position), `cards` (column_id, title, details, position)
- [x] Include example JSON of a board as stored and as returned by the API (`BoardData`)
- [x] Describe creation on startup, seeding of the default board for a new user, and how `PUT /api/board` maps to rows
- [x] User reviews and approves

Success: user approves `docs/DATABASE.md`.

## Part 6: Backend

- [x] `backend/app/db.py`: create db and tables if missing (stdlib `sqlite3`), seed user and default board
- [x] `GET /api/board` returns the signed-in user's board as `BoardData`
- [x] `PUT /api/board` validates (Pydantic) and replaces the board in a single transaction
- [x] DB path configurable via env var so tests use a temp file
- [x] Tests: db created from scratch; default board seeded; get board; put board then get returns the same data (renames, moves, adds, deletes); invalid payload rejected (422); unauthenticated requests get 401

Success: board persists across container restarts; all pytest tests pass.

## Part 7: Frontend + Backend

- [x] `src/lib/api.ts` with `getBoard` and `saveBoard`
- [x] `KanbanBoard` loads the board from the API after login and saves after each change (rename saves on blur, not per keystroke)
- [x] Remove `initialData` from the frontend (seed lives in the backend)
- [x] Tests: unit tests with mocked fetch for load and save; e2e: add, edit, move, rename, delete, then reload and verify persistence

Success: all board changes persist across reload and container restart; all tests pass.

## Part 8: AI connectivity

- [x] Add `openai` dependency; `backend/app/ai.py` creates the OpenRouter client
- [x] `POST /api/ai/test` (temporary) sends "What is 2+2?" and returns the reply
- [x] Tests: unit test with the client mocked; an integration test that calls OpenRouter for real, skipped when `OPENROUTER_API_KEY` is not set

Success: real call returns an answer containing "4".

## Part 9: AI with board context and structured outputs

- [x] `POST /api/chat` takes `{ message, history }`; sends system prompt + current board JSON + history + message
- [x] Response format is a JSON schema for `{ message, board | null }`; parse with Pydantic
- [x] If `board` is returned, validate and save it; respond with `{ message, board }`
- [x] Remove the temporary `/api/ai/test` route
- [x] Tests (AI mocked): reply without board change leaves db unchanged; reply with board change is saved; invalid AI board is rejected and the db is unchanged; history is passed through. Real-AI integration test (skipped without key): ask to create a card and verify it exists in the db

Success: asking the AI to create, edit or move cards updates the stored board; all tests pass.

## Part 10: AI chat sidebar

- [x] Collapsible sidebar on the right with message list, input and send button (purple submit), loading state
- [x] Keeps history in state and sends it with each message
- [x] When the response includes a board, replace the board state so the UI refreshes immediately
- [x] Tests: unit tests with mocked API for sending, rendering replies, and board refresh; e2e with `/api/chat` mocked via Playwright route interception verifying the board updates; one manual check against the real AI

Success: user can chat with the AI in the sidebar, and AI-made changes to cards appear on the board without reload; all tests pass.

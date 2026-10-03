# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The imported AGENTS.md above holds the business requirements, technical decisions, color scheme and coding standards. Follow them. `docs/PLAN.md` is the phased build plan (Parts 1-10); check which part is in progress before starting work, and keep its checklist updated. Subdirectories (`frontend/`, `backend/`, `scripts/`) have their own AGENTS.md files that should describe that area and be kept current.

## Current state

Parts 1-7 are done: a FastAPI backend in `backend/` with `/api/health` and session-cookie login (`/api/login`, `/api/logout`, `/api/me`, hardcoded `user` / `password`), a multi-stage root `Dockerfile` that builds the Next.js static export and serves it at `/`, and start/stop scripts in `scripts/`. The frontend shows a login form until signed in. The backend persists each user's board in SQLite (`GET` / `PUT /api/board`, see `docs/DATABASE.md`), and the frontend loads the board from it and saves after every change. See `docs/PLAN.md` for what is next.

## Backend and Docker commands

```bash
cd backend && uv run pytest                     # all backend tests (use `python -m uv` if uv is not on PATH)
uv run pytest tests/test_main.py::test_health   # single test
scripts/start.sh  |  scripts/start.ps1          # build image and run container on :8000
scripts/stop.sh   |  scripts/stop.ps1
```

## Frontend commands (run in `frontend/`)

```bash
npm install
npm run dev                # dev server on :3000; proxies /api to the backend on :8000 (start it separately)
npm run build
npm run lint
npm run test:unit          # Vitest (jsdom), src/**/*.test.{ts,tsx}
npm run test:e2e           # Playwright, tests/*.spec.ts; starts backend on :8000 and dev server on :3000
npm run test:all
BASE_URL=http://localhost:8000 npm run test:e2e   # e2e against the running container

npx vitest run src/lib/kanban.test.ts          # single unit test file
npx vitest run -t "test name"                  # single unit test by name
npx playwright test tests/kanban.spec.ts -g "name"  # single e2e test
```

## Frontend architecture

- `src/lib/kanban.ts` is the data model and pure logic: `BoardData` is normalized as `columns` (ordered, each holding ordered `cardIds`) plus a `cards` map keyed by id. `moveCard` handles both reordering within a column and moving across columns, where the drop target id may be a card id or a column id.
- `src/components/KanbanBoard.tsx` is the single stateful board component: it loads `BoardData` from the API into `useState`, saves the whole board after each change (`src/lib/api.ts`), wires up `@dnd-kit` (`DndContext`, `DragOverlay`) and passes rename/add/delete/edit handlers down to `KanbanColumn` / `KanbanCard` / `NewCardForm`.
- `src/app/page.tsx` checks the session (`/api/me`) and renders `LoginForm` or `KanbanBoard`. Path alias `@/` maps to `src/`.
- Styling is Tailwind v4 (via `@tailwindcss/postcss`), with globals in `src/app/globals.css`.

The `BoardData` JSON shape is the contract for the board API, persistence (`backend/app/models.py`) and the AI structured-output updates.

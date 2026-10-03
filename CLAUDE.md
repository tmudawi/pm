# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The imported AGENTS.md above holds the business requirements, technical decisions, color scheme and coding standards. Follow them. `docs/PLAN.md` is the phased build plan (Parts 1-10); check which part is in progress before starting work, and keep its checklist updated. Subdirectories (`frontend/`, `backend/`, `scripts/`) have their own AGENTS.md files that should describe that area and be kept current.

## Current state

Part 2 (scaffolding) is done: a FastAPI backend in `backend/` serving a hello world page and `/api/health`, a root `Dockerfile`, and start/stop scripts in `scripts/`. The frontend is still a standalone Next.js demo with in-memory state, not yet served by the backend. See `docs/PLAN.md` for what is next.

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
npm run dev                # dev server on :3000
npm run build
npm run lint
npm run test:unit          # Vitest (jsdom), src/**/*.test.{ts,tsx}
npm run test:e2e           # Playwright, tests/*.spec.ts; starts dev server on 127.0.0.1:3000
npm run test:all

npx vitest run src/lib/kanban.test.ts          # single unit test file
npx vitest run -t "test name"                  # single unit test by name
npx playwright test tests/kanban.spec.ts -g "name"  # single e2e test
```

## Frontend architecture

- `src/lib/kanban.ts` is the data model and pure logic: `BoardData` is normalized as `columns` (ordered, each holding ordered `cardIds`) plus a `cards` map keyed by id. `moveCard` handles both reordering within a column and moving across columns, where the drop target id may be a card id or a column id. `initialData` is the hardcoded demo board (5 fixed columns).
- `src/components/KanbanBoard.tsx` is the single stateful client component: it owns `BoardData` in `useState`, wires up `@dnd-kit` (`DndContext`, `DragOverlay`) and passes rename/add/delete/edit handlers down to `KanbanColumn` / `KanbanCard` / `NewCardForm`.
- `src/app/page.tsx` just renders `KanbanBoard`. Path alias `@/` maps to `src/`.
- Styling is Tailwind v4 (via `@tailwindcss/postcss`), with globals in `src/app/globals.css`.

When the backend is introduced, the board state in `KanbanBoard` is what will move to the API, and the `BoardData` JSON shape is the natural contract for both persistence and the AI structured-output updates.

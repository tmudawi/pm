# Frontend

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, dnd-kit for drag and drop. Built as a static export (`output: "export"` in `next.config.ts`, output in `out/`) that the backend serves at `/` in Docker. In `next dev`, `next.config.ts` instead rewrites `/api/*` to the backend at `127.0.0.1:8000`, so run the backend alongside the dev server. All board state is still in memory and resets on reload.

## Structure

- `src/app/layout.tsx` - root layout; loads fonts (Space Grotesk as `--font-display`, Manrope as `--font-body`).
- `src/app/page.tsx` - client component; calls `/api/me` on load, shows `LoginForm` when signed out and `KanbanBoard` when signed in.
- `src/lib/api.ts` - fetch helpers for the backend: `getMe`, `login`, `logout`.
- `src/components/LoginForm.tsx` - username / password form; shows "Invalid username or password" on failure.
- `src/app/globals.css` - Tailwind import and CSS variables for the color scheme (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus `--surface`, `--stroke`, `--shadow`). Components reference these as `text-[var(--navy-dark)]` etc.
- `src/lib/kanban.ts` - data model and pure logic:
  - `BoardData = { columns: Column[], cards: Record<string, Card> }`. Columns are ordered and hold ordered `cardIds`; cards are looked up by id.
  - `initialData` - hardcoded demo board (5 columns, 8 cards).
  - `moveCard(columns, activeId, overId)` - reorder within a column or move across columns; `overId` may be a card id or a column id (drop on column appends to end).
  - `createId(prefix)` - random id generator.
- `src/components/KanbanBoard.tsx` - the only stateful board component; takes an `onLogout` prop for the header Log out button. Owns `BoardData` in `useState`, sets up `DndContext` with `PointerSensor` (6px activation distance) and `closestCorners`, and handles rename column, add card, edit card, delete card and drag end.
- `src/components/KanbanColumn.tsx` - droppable column; inline title `<input>` (rename on every keystroke), `SortableContext` of cards, empty-state placeholder, `NewCardForm`.
- `src/components/KanbanCard.tsx` - sortable card showing title and details, with Edit and Remove buttons. Edit switches to an inline form (title required) with Save and Cancel; dragging is disabled and the dnd-kit attributes are not applied while editing.
- `src/components/KanbanCardPreview.tsx` - static card used in the `DragOverlay`.
- `src/components/NewCardForm.tsx` - toggled form for title (required) and details.

## Test hooks

- `data-testid="column-<columnId>"` on columns, `data-testid="card-<cardId>"` on cards.
- Column title input has `aria-label="Column title"`; edit and remove buttons have `aria-label="Edit <title>"` / `"Delete <title>"`; edit form fields have `aria-label="Edit title"` / `"Edit details"`.

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.{ts,tsx}`. `npm run test:unit`.
- E2E (Playwright, Chromium): `tests/*.spec.ts`. `npm run test:e2e` starts the backend (`uv run uvicorn` in `../backend`) on 127.0.0.1:8000 and the dev server on 127.0.0.1:3000, reusing either if already running; set `BASE_URL` (e.g. `http://localhost:8000`) to run against the container instead.

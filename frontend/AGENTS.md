# Frontend

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, dnd-kit for drag and drop. Built as a static export (`output: "export"` in `next.config.ts`, output in `out/`) that the backend serves at `/` in Docker. In `next dev`, `next.config.ts` instead rewrites `/api/*` to the backend at `127.0.0.1:8000`, so run the backend alongside the dev server. The board is loaded from and saved to the backend (`GET` / `PUT /api/board`).

## Structure

- `src/app/layout.tsx` - root layout; loads fonts (Space Grotesk as `--font-display`, Manrope as `--font-body`).
- `src/app/page.tsx` - client component; calls `/api/me` on load, shows `LoginForm` when signed out and `KanbanBoard` when signed in.
- `src/lib/api.ts` - fetch helpers for the backend: `getMe`, `login`, `logout`, `getBoard`, `saveBoard`, `sendChat`. `saveBoard` queues saves so they reach the server one at a time, in order. `sendChat(message, history)` returns `{message, board}` and throws an `Error` with a user-facing message on failure (502 means the AI's board was rejected).
- `src/components/LoginForm.tsx` - username / password form; shows "Invalid username or password" on failure.
- `src/app/globals.css` - Tailwind import and CSS variables for the color scheme (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus `--surface`, `--stroke`, `--shadow`). Components reference these as `text-[var(--navy-dark)]` etc.
- `src/lib/kanban.ts` - data model and pure logic:
  - `BoardData = { columns: Column[], cards: Record<string, Card> }`. Columns are ordered and hold ordered `cardIds`; cards are looked up by id.
  - `moveCard(columns, activeId, overId)` - reorder within a column or move across columns; `overId` may be a card id or a column id (drop on column appends to end).
  - `createId(prefix)` - random id generator.
- `src/components/KanbanBoard.tsx` - the only stateful board component; takes an `onLogout` prop for the header Log out button. The header's AI Assistant button (`aria-expanded`) toggles `ChatSidebar`, which sits beside `<main>` in a flex row; its `onBoardUpdate` is `setBoard` (no save, the backend already saved the AI's board). Loads the board with `getBoard` on mount (renders nothing until loaded) and holds it in `useState`. Every change goes through `update()`, which sets state and saves the whole board; column renames update state per keystroke and save on blur. Sets up `DndContext` with `PointerSensor` (6px activation distance) and a collision detection that uses `pointerWithin`, falling back to `closestCorners` (plain `closestCorners` drops cards into the neighboring column when the target column is empty).
- `src/components/ChatSidebar.tsx` - AI chat panel (`<aside aria-label="AI chat">`, 360px, sticky on the right). Collapsed via the HTML `hidden` attribute rather than unmounting, so the conversation survives closing. The message box is a 3-row wrapping `<textarea>`: Enter sends, Shift+Enter adds a new line. Holds the message history in state and sends it with each message; shows "Thinking..." while waiting and errors with `role="alert"`. Calls `onBoardUpdate` when a reply includes a board.
- `src/components/KanbanColumn.tsx` - droppable column; inline title `<input>` (`onRename` on every keystroke, `onRenameDone` on blur), `SortableContext` of cards, empty-state placeholder, `NewCardForm`.
- `src/components/KanbanCard.tsx` - sortable card showing title and details, with Edit and Remove buttons. Edit switches to an inline form (title required) with Save and Cancel; dragging is disabled and the dnd-kit attributes are not applied while editing.
- `src/components/KanbanCardPreview.tsx` - static card used in the `DragOverlay`.
- `src/components/NewCardForm.tsx` - toggled form for title (required) and details.

## Test hooks

- `data-testid="column-<columnId>"` on columns, `data-testid="card-<cardId>"` on cards.
- Column title input has `aria-label="Column title"`; edit and remove buttons have `aria-label="Edit <title>"` / `"Delete <title>"`; edit form fields have `aria-label="Edit title"` / `"Edit details"`.
- Cards get `role="button"` from dnd-kit, so a card's accessible name contains its buttons' labels and role queries like `{ name: /delete foo/i }` match the card too. Scope to the card (`getByTestId("card-...")`) or use exact names.
- Chat sidebar: `getByRole("complementary", { name: "AI chat" })`; input `aria-label="Message"`; buttons Send and Close chat (`aria-label="Close chat"`); messages have `data-testid="chat-user"` / `"chat-assistant"`. E2E tests fake `/api/chat` with `page.route` so they never call the real AI.
- Login inputs have `aria-label="Username"` / `"Password"`; the error message has `role="alert"` (Next.js also renders a `role="alert"` route announcer, so in e2e match the error by text).

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.{ts,tsx}`. `npm run test:unit`. Tests stub `fetch` with `vi.stubGlobal`. `src/test/board.ts` exports `testBoard`, a copy of the backend's `DEFAULT_BOARD`, used by unit and e2e tests.
- E2E (Playwright, Chromium): `tests/*.spec.ts`. `npm run test:e2e` starts the backend (`uv run uvicorn` in `../backend`) on 127.0.0.1:8000 and the dev server on 127.0.0.1:3000, reusing either if already running; set `BASE_URL` (e.g. `http://localhost:8000`) to run against the container instead. The e2e backend uses `DB_PATH=data/e2e.db` (only when Playwright starts it, not when reusing a running server). Each signed-in test resets the board to `testBoard` via `PUT /api/board`, so running e2e against the container overwrites the stored board. Tests run with one worker because they share one user's board.

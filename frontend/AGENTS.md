# Frontend

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, dnd-kit for drag and drop. Currently a client-only demo: all board state is in memory and resets on reload.

## Structure

- `src/app/layout.tsx` - root layout; loads fonts (Space Grotesk as `--font-display`, Manrope as `--font-body`).
- `src/app/page.tsx` - renders `KanbanBoard`.
- `src/app/globals.css` - Tailwind import and CSS variables for the color scheme (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus `--surface`, `--stroke`, `--shadow`). Components reference these as `text-[var(--navy-dark)]` etc.
- `src/lib/kanban.ts` - data model and pure logic:
  - `BoardData = { columns: Column[], cards: Record<string, Card> }`. Columns are ordered and hold ordered `cardIds`; cards are looked up by id.
  - `initialData` - hardcoded demo board (5 columns, 8 cards).
  - `moveCard(columns, activeId, overId)` - reorder within a column or move across columns; `overId` may be a card id or a column id (drop on column appends to end).
  - `createId(prefix)` - random id generator.
- `src/components/KanbanBoard.tsx` - the only stateful component. Owns `BoardData` in `useState`, sets up `DndContext` with `PointerSensor` (6px activation distance) and `closestCorners`, and handles rename column, add card, delete card and drag end.
- `src/components/KanbanColumn.tsx` - droppable column; inline title `<input>` (rename on every keystroke), `SortableContext` of cards, empty-state placeholder, `NewCardForm`.
- `src/components/KanbanCard.tsx` - sortable card showing title and details, with a Remove button.
- `src/components/KanbanCardPreview.tsx` - static card used in the `DragOverlay`.
- `src/components/NewCardForm.tsx` - toggled form for title (required) and details.

Not yet implemented: editing an existing card's title or details.

## Test hooks

- `data-testid="column-<columnId>"` on columns, `data-testid="card-<cardId>"` on cards.
- Column title input has `aria-label="Column title"`; remove button has `aria-label="Delete <title>"`.

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.{ts,tsx}`. `npm run test:unit`.
- E2E (Playwright, Chromium): `tests/*.spec.ts`. `npm run test:e2e` starts the dev server on 127.0.0.1:3000.

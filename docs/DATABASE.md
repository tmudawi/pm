# Database

SQLite through the Python stdlib `sqlite3` module. Four tables: `users`, `boards`, `columns`, `cards`. The API contract stays the frontend `BoardData` shape; the tables are a normalized copy of it.

## Schema

```sql
CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS boards (
    id      INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS columns (
    board_id INTEGER NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    id       TEXT    NOT NULL,
    title    TEXT    NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (board_id, id)
);

CREATE TABLE IF NOT EXISTS cards (
    board_id  INTEGER NOT NULL,
    id        TEXT    NOT NULL,
    column_id TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    details   TEXT    NOT NULL,
    position  INTEGER NOT NULL,
    PRIMARY KEY (board_id, id),
    FOREIGN KEY (board_id, column_id) REFERENCES columns (board_id, id) ON DELETE CASCADE
);
```

`PRAGMA foreign_keys = ON` is set on every connection.

Design notes:

- **Column and card ids are the frontend's string ids** (`col-backlog`, `card-1`, `card-k3x9a1...`), stored as-is and scoped to the board by a composite primary key. No id mapping is needed between API and database, every user's seeded board can reuse `card-1`, and the AI can return a board using the same ids it was given.
- **Order is a `position` integer** (0-based index): a column's position on the board, and a card's position within its column. The API's `cardIds` array is rebuilt by sorting on it.
- **One board per user** is enforced by `UNIQUE (user_id)` on `boards`. Dropping that constraint is all it takes to allow several boards later.
- **No passwords in the database.** Login stays hardcoded (`user` / `password`) in `main.py` for the MVP; the `users` table exists so boards belong to a user. A password hash column comes with real auth.

## Example

The board as returned and accepted by `GET` / `PUT /api/board` (`BoardData`, shortened to two columns):

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"] },
    { "id": "col-discovery", "title": "Discovery", "cardIds": [] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Align roadmap themes", "details": "Draft quarterly themes with impact statements and metrics." },
    "card-2": { "id": "card-2", "title": "Gather customer signals", "details": "Review support tags, sales notes, and churn feedback." }
  }
}
```

The same board as stored (user `user` with id 1, board id 1):

`users`

| id | username |
|----|----------|
| 1  | user     |

`boards`

| id | user_id |
|----|---------|
| 1  | 1       |

`columns`

| board_id | id            | title     | position |
|----------|---------------|-----------|----------|
| 1        | col-backlog   | Backlog   | 0        |
| 1        | col-discovery | Discovery | 1        |

`cards`

| board_id | id     | column_id   | title                   | details                         | position |
|----------|--------|-------------|-------------------------|---------------------------------|----------|
| 1        | card-1 | col-backlog | Align roadmap themes    | Draft quarterly themes with ... | 0        |
| 1        | card-2 | col-backlog | Gather customer signals | Review support tags, sales ...  | 1        |

## Creation and seeding

- The database file path comes from `DB_PATH` (default `data/kanban.db`, relative to the working directory; `/app/data/kanban.db` in the container). Tests point it at a temp file.
- On app startup (FastAPI lifespan) the parent directory is created if missing and the `CREATE TABLE IF NOT EXISTS` statements run. A missing database file is created by SQLite on connect.
- Users and boards are created lazily: when a signed-in user calls `GET /api/board` (or `PUT`) and has no row in `users` / `boards`, both are inserted along with the default board (the current `initialData`: 5 columns, 8 cards), which moves from the frontend into `backend/app/db.py`.
- In Docker, `/app/data` is a named volume (`docker run -v pm-data:/app/data ...` in the start scripts) so the database survives container rebuilds and restarts. The stop scripts leave the volume in place.

## Reads and writes

`GET /api/board`: select the board's columns ordered by `position`, then its cards ordered by `column_id, position`; build `columns[].cardIds` from the card rows and `cards` as a map by id.

`PUT /api/board` replaces the whole board in a single transaction:

1. Validate the body with Pydantic as `BoardData`, plus these checks (422 on failure):
   - every id in a column's `cardIds` exists in `cards`, and every card appears in exactly one column;
   - the column ids are the same as the stored ones, in the same order (columns are fixed; only titles can change).
2. `DELETE FROM cards WHERE board_id = ?`, then `DELETE FROM columns WHERE board_id = ?`.
3. Insert each column with `position` = its index, and each card with its `column_id` and `position` = its index in that column's `cardIds`.
4. Commit and return the saved board.

Replacing everything keeps the write path to one simple code path for renames, moves, adds, edits, deletes and AI updates alike; the board is small enough that this costs nothing.

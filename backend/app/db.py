import os
import sqlite3
from contextlib import closing
from pathlib import Path

SCHEMA = """
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
"""

DEFAULT_BOARD = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {"id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"]},
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
        },
    },
}


def db_path() -> Path:
    return Path(os.environ.get("DB_PATH", "data/kanban.db"))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path())
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    db_path().parent.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as conn:
        conn.executescript(SCHEMA)


def _write_board(conn: sqlite3.Connection, board_id: int, board: dict):
    conn.execute("DELETE FROM cards WHERE board_id = ?", (board_id,))
    conn.execute("DELETE FROM columns WHERE board_id = ?", (board_id,))
    for column_pos, column in enumerate(board["columns"]):
        conn.execute(
            "INSERT INTO columns (board_id, id, title, position) VALUES (?, ?, ?, ?)",
            (board_id, column["id"], column["title"], column_pos),
        )
        for card_pos, card_id in enumerate(column["cardIds"]):
            card = board["cards"][card_id]
            conn.execute(
                "INSERT INTO cards (board_id, id, column_id, title, details, position)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (board_id, card_id, column["id"], card["title"], card["details"], card_pos),
            )


def _board_id(conn: sqlite3.Connection, username: str) -> int:
    """Return the user's board id, creating the user and a default board if missing."""
    conn.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (username,))
    (user_id,) = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    row = conn.execute("SELECT id FROM boards WHERE user_id = ?", (user_id,)).fetchone()
    if row:
        return row[0]
    board_id = conn.execute("INSERT INTO boards (user_id) VALUES (?)", (user_id,)).lastrowid
    _write_board(conn, board_id, DEFAULT_BOARD)
    return board_id


def get_board(username: str) -> dict:
    with closing(connect()) as conn, conn:
        board_id = _board_id(conn, username)
        columns = [
            {"id": column_id, "title": title, "cardIds": []}
            for column_id, title in conn.execute(
                "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position", (board_id,)
            )
        ]
        by_id = {column["id"]: column for column in columns}
        cards = {}
        for card_id, column_id, title, details in conn.execute(
            "SELECT id, column_id, title, details FROM cards"
            " WHERE board_id = ? ORDER BY column_id, position",
            (board_id,),
        ):
            by_id[column_id]["cardIds"].append(card_id)
            cards[card_id] = {"id": card_id, "title": title, "details": details}
        return {"columns": columns, "cards": cards}


def save_board(username: str, board: dict):
    with closing(connect()) as conn, conn:
        _write_board(conn, _board_id(conn, username), board)

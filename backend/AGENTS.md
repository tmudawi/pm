# Backend

FastAPI app, Python 3.14, managed with uv (`pyproject.toml`, `uv.lock`).

## Structure

- `app/main.py` - FastAPI app. API routes live under `/api`; static files are mounted at `/` last so API routes take precedence. Sessions use Starlette `SessionMiddleware` (signed cookie, secret from `SESSION_SECRET`, default `dev-secret`). The `current_user` dependency returns the signed-in username or raises 401.
- `app/db.py` - SQLite via stdlib `sqlite3`; schema and design in `docs/DATABASE.md`. File path from `DB_PATH` (default `data/kanban.db` relative to the working directory). `init_db()` runs in the app lifespan and creates the directory and tables. `get_board` / `save_board` take a username and lazily create the user and a `DEFAULT_BOARD` on first use. `save_board` replaces all columns and cards in one transaction.
- `app/ai.py` - OpenRouter through the `openai` SDK (`base_url=https://openrouter.ai/api/v1`, key from `OPENROUTER_API_KEY`), model `openai/gpt-oss-120b`. `client()` builds the client (tests monkeypatch it). `chat(board, history, message)` sends `SYSTEM_PROMPT` plus the board JSON as the system message, then the history and the new message, and parses the reply into `AIReply` with `chat.completions.parse` (strict JSON schema). OpenRouter routing: `require_parameters` (only providers that support structured outputs), `ignore: ["CoreWeave"]` (it returned malformed boards in every test call while other providers returned 41 of 41 valid), and `reasoning.effort: low` (faster, no accuracy loss seen).
- `app/models.py` - Pydantic `BoardData` (`columns`, `cards`), matching the frontend type. Validates that card keys match ids and every card is in exactly one column. `AIBoard` is the AI's board shape with `cards` as a list (strict JSON schema cannot express a map with arbitrary keys); `to_board_data()` converts and validates. `AIReply` (`message`, `board | None`), and the chat request / response models.
- `app/static/` - the exported Next.js frontend served at `/`. Populated by the Docker build (`frontend/out`); gitignored. The directory can be overridden with the `STATIC_DIR` env var.
- `tests/` - pytest tests using FastAPI `TestClient` (requires `httpx2`). `conftest.py` points `STATIC_DIR` at a temp dir with a stub `index.html`, gives every test a fresh `DB_PATH` in `tmp_path`, and provides the `client` fixture (entered as a context manager so the lifespan runs) and a `login` helper.

## Routes

- `GET /api/health` - returns `{"status": "ok"}`.
- `POST /api/login` - body `{username, password}`; checks the hardcoded `user` / `password`, sets the session, returns `{username}`; 401 on bad credentials.
- `POST /api/logout` - clears the session.
- `GET /api/me` - returns `{username}` or 401.
- `GET /api/board` - the signed-in user's board as `BoardData`; 401 if signed out.
- `POST /api/chat` - body `{message, history: [{role: "user" | "assistant", content}]}`. Returns `{message, board}`; `board` is null when the AI made no change, otherwise the saved board. If the AI's board is invalid (fails `BoardData` validation or changes the columns) it returns 502 and nothing is saved.
- `PUT /api/board` - replaces the board with the `BoardData` body and returns it. 422 if invalid, or if the column ids differ from the stored ones (columns are fixed; only titles can change).

## Commands (run in `backend/`)

```bash
uv sync
uv run pytest                      # real OpenRouter tests are skipped without OPENROUTER_API_KEY
uv run --env-file ../.env pytest   # include the real OpenRouter tests
uv run --env-file ../.env uvicorn app.main:app --reload --port 8000
```

On this Windows machine uv is installed via pip, so use `python -m uv ...` if `uv` is not on PATH.

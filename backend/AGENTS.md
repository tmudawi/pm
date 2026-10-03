# Backend

FastAPI app, Python 3.14, managed with uv (`pyproject.toml`, `uv.lock`).

## Structure

- `app/main.py` - FastAPI app. API routes live under `/api`; static files are mounted at `/` last so API routes take precedence. Sessions use Starlette `SessionMiddleware` (signed cookie, secret from `SESSION_SECRET`, default `dev-secret`). The `current_user` dependency returns the signed-in username or raises 401.
- `app/db.py` - SQLite via stdlib `sqlite3`; schema and design in `docs/DATABASE.md`. File path from `DB_PATH` (default `data/kanban.db` relative to the working directory). `init_db()` runs in the app lifespan and creates the directory and tables. `get_board` / `save_board` take a username and lazily create the user and a `DEFAULT_BOARD` on first use. `save_board` replaces all columns and cards in one transaction.
- `app/ai.py` - OpenRouter through the `openai` SDK (`base_url=https://openrouter.ai/api/v1`, key from `OPENROUTER_API_KEY`), model `openai/gpt-oss-120b`. `client()` builds the client (tests monkeypatch it); `ask(prompt)` returns the reply text.
- `app/models.py` - Pydantic `BoardData` (`columns`, `cards`), matching the frontend type. Validates that card keys match ids and every card is in exactly one column.
- `app/static/` - the exported Next.js frontend served at `/`. Populated by the Docker build (`frontend/out`); gitignored. The directory can be overridden with the `STATIC_DIR` env var.
- `tests/` - pytest tests using FastAPI `TestClient` (requires `httpx2`). `conftest.py` points `STATIC_DIR` at a temp dir with a stub `index.html`, gives every test a fresh `DB_PATH` in `tmp_path`, and provides the `client` fixture (entered as a context manager so the lifespan runs) and a `login` helper.

## Routes

- `GET /api/health` - returns `{"status": "ok"}`.
- `POST /api/login` - body `{username, password}`; checks the hardcoded `user` / `password`, sets the session, returns `{username}`; 401 on bad credentials.
- `POST /api/logout` - clears the session.
- `GET /api/me` - returns `{username}` or 401.
- `GET /api/board` - the signed-in user's board as `BoardData`; 401 if signed out.
- `POST /api/ai/test` - temporary (removed in Part 9): asks the model "What is 2+2?" and returns `{reply}`; requires sign in.
- `PUT /api/board` - replaces the board with the `BoardData` body and returns it. 422 if invalid, or if the column ids differ from the stored ones (columns are fixed; only titles can change).

## Commands (run in `backend/`)

```bash
uv sync
uv run pytest                      # real OpenRouter tests are skipped without OPENROUTER_API_KEY
uv run --env-file ../.env pytest   # include the real OpenRouter tests
uv run --env-file ../.env uvicorn app.main:app --reload --port 8000
```

On this Windows machine uv is installed via pip, so use `python -m uv ...` if `uv` is not on PATH.

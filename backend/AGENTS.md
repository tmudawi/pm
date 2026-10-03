# Backend

FastAPI app, Python 3.14, managed with uv (`pyproject.toml`, `uv.lock`).

## Structure

- `app/main.py` - FastAPI app. API routes live under `/api`; static files are mounted at `/` last so API routes take precedence. Sessions use Starlette `SessionMiddleware` (signed cookie, secret from `SESSION_SECRET`, default `dev-secret`). The `current_user` dependency returns the signed-in username or raises 401.
- `app/static/` - the exported Next.js frontend served at `/`. Populated by the Docker build (`frontend/out`); gitignored. The directory can be overridden with the `STATIC_DIR` env var.
- `tests/` - pytest tests using FastAPI `TestClient` (requires `httpx2`). `conftest.py` points `STATIC_DIR` at a temp dir with a stub `index.html`.

## Routes

- `GET /api/health` - returns `{"status": "ok"}`.
- `POST /api/login` - body `{username, password}`; checks the hardcoded `user` / `password`, sets the session, returns `{username}`; 401 on bad credentials.
- `POST /api/logout` - clears the session.
- `GET /api/me` - returns `{username}` or 401.

## Commands (run in `backend/`)

```bash
uv sync
uv run pytest
uv run uvicorn app.main:app --reload --port 8000
```

On this Windows machine uv is installed via pip, so use `python -m uv ...` if `uv` is not on PATH.

# Backend

FastAPI app, Python 3.14, managed with uv (`pyproject.toml`, `uv.lock`).

## Structure

- `app/main.py` - FastAPI app. API routes live under `/api`; static files are mounted at `/` last so API routes take precedence.
- `app/static/` - static site served at `/` (currently a hello world page that calls `/api/health`).
- `tests/` - pytest tests using FastAPI `TestClient` (requires `httpx2`).

## Routes

- `GET /api/health` - returns `{"status": "ok"}`.

## Commands (run in `backend/`)

```bash
uv sync
uv run pytest
uv run uvicorn app.main:app --reload --port 8000
```

On this Windows machine uv is installed via pip, so use `python -m uv ...` if `uv` is not on PATH.

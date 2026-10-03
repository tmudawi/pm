import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

static_dir = Path(tempfile.mkdtemp())
(static_dir / "index.html").write_text("<h1>Kanban Studio</h1>")
os.environ["STATIC_DIR"] = str(static_dir)

from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "data" / "kanban.db"
    monkeypatch.setenv("DB_PATH", str(path))
    return path


@pytest.fixture
def client():
    # Entering the context runs the lifespan, which creates the database
    with TestClient(app) as client:
        yield client


def login(client, password="password"):
    return client.post("/api/login", json={"username": "user", "password": password})

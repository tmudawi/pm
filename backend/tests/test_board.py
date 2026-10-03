import copy
import sqlite3

import pytest
from conftest import login
from fastapi.testclient import TestClient

from app import db
from app.main import app


@pytest.fixture
def user_client(client):
    login(client)
    return client


def test_db_created_from_scratch(db_path):
    assert not db_path.exists()
    db.init_db()
    with sqlite3.connect(db_path) as conn:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert {"users", "boards", "columns", "cards"} <= tables


def test_default_board_seeded(user_client):
    response = user_client.get("/api/board")
    assert response.status_code == 200
    assert response.json() == db.DEFAULT_BOARD


def test_board_seeded_once_per_user(user_client, db_path):
    user_client.get("/api/board")
    user_client.get("/api/board")
    with sqlite3.connect(db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM boards").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM cards").fetchone()[0] == 8


def test_put_then_get_returns_same_board(user_client):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    columns = {column["id"]: column for column in board["columns"]}
    # rename a column
    columns["col-backlog"]["title"] = "Ideas"
    # move card-1 to review, ahead of card-6
    columns["col-backlog"]["cardIds"].remove("card-1")
    columns["col-review"]["cardIds"].insert(0, "card-1")
    # reorder within a column
    columns["col-done"]["cardIds"].reverse()
    # edit a card
    board["cards"]["card-3"]["title"] = "Edited"
    # add a card
    board["cards"]["card-new"] = {"id": "card-new", "title": "New", "details": "Fresh"}
    columns["col-discovery"]["cardIds"].append("card-new")
    # delete a card
    del board["cards"]["card-5"]
    columns["col-progress"]["cardIds"].remove("card-5")

    response = user_client.put("/api/board", json=board)
    assert response.status_code == 200
    assert response.json() == board
    assert user_client.get("/api/board").json() == board


def test_board_survives_restart(client):
    login(client)
    board = copy.deepcopy(db.DEFAULT_BOARD)
    board["columns"][0]["title"] = "Persisted"
    client.put("/api/board", json=board)

    with TestClient(app) as restarted:
        login(restarted)
        assert restarted.get("/api/board").json()["columns"][0]["title"] == "Persisted"


@pytest.mark.parametrize(
    "mutate",
    [
        pytest.param(lambda board: board.pop("cards"), id="missing cards"),
        pytest.param(lambda board: board["columns"][0]["cardIds"].append("card-missing"), id="unknown card id"),
        pytest.param(lambda board: board["columns"][1]["cardIds"].append("card-1"), id="card in two columns"),
        pytest.param(lambda board: board["columns"][0]["cardIds"].remove("card-1"), id="card in no column"),
        pytest.param(lambda board: board["cards"]["card-1"].update(id="card-x"), id="key does not match id"),
        pytest.param(lambda board: board["columns"].pop(), id="column removed"),
        pytest.param(lambda board: board["columns"].reverse(), id="columns reordered"),
        pytest.param(
            lambda board: board["columns"].append({"id": "col-new", "title": "New", "cardIds": []}),
            id="column added",
        ),
    ],
)
def test_invalid_board_rejected(user_client, mutate):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    mutate(board)
    assert user_client.put("/api/board", json=board).status_code == 422
    assert user_client.get("/api/board").json() == db.DEFAULT_BOARD


def test_board_requires_login(client):
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json=db.DEFAULT_BOARD).status_code == 401

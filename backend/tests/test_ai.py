import copy
import os
from types import SimpleNamespace

import pytest
from conftest import login

from app import ai, db
from app.models import AIBoard, AIReply, BoardData


class FakeCompletions:
    def __init__(self, reply: AIReply):
        self.reply = reply
        self.calls = []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        message = SimpleNamespace(parsed=self.reply)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def ai_board(board: dict) -> AIBoard:
    return AIBoard(columns=board["columns"], cards=list(board["cards"].values()))


@pytest.fixture
def fake_ai(monkeypatch):
    def install(reply: AIReply) -> FakeCompletions:
        completions = FakeCompletions(reply)
        fake_client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
        monkeypatch.setattr(ai, "client", lambda: fake_client)
        return completions

    return install


@pytest.fixture
def user_client(client):
    login(client)
    return client


def test_reply_without_board_leaves_db_unchanged(user_client, fake_ai):
    fake_ai(AIReply(message="You have 8 cards.", board=None))

    response = user_client.post("/api/chat", json={"message": "How many cards?"})

    assert response.status_code == 200
    assert response.json() == {"message": "You have 8 cards.", "board": None}
    assert user_client.get("/api/board").json() == db.DEFAULT_BOARD


def test_reply_with_board_is_saved(user_client, fake_ai):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    board["cards"]["card-ai-1"] = {"id": "card-ai-1", "title": "Write tests", "details": "Cover the chat."}
    board["columns"][0]["cardIds"].append("card-ai-1")
    board["columns"][0]["cardIds"].remove("card-1")
    board["columns"][3]["cardIds"].append("card-1")
    fake_ai(AIReply(message="Done.", board=ai_board(board)))

    response = user_client.post("/api/chat", json={"message": "Add a card and move card-1"})

    assert response.status_code == 200
    assert response.json() == {"message": "Done.", "board": board}
    assert user_client.get("/api/board").json() == board


@pytest.mark.parametrize(
    "mutate",
    [
        pytest.param(lambda board: board["columns"][0]["cardIds"].remove("card-1"), id="card in no column"),
        pytest.param(lambda board: board["columns"][1]["cardIds"].append("card-missing"), id="unknown card id"),
        pytest.param(lambda board: board["columns"].pop(), id="column removed"),
        pytest.param(lambda board: board["columns"][0].update(id="col-new"), id="column id changed"),
    ],
)
def test_invalid_ai_board_is_rejected(user_client, fake_ai, mutate):
    board = copy.deepcopy(db.DEFAULT_BOARD)
    mutate(board)
    fake_ai(AIReply(message="Done.", board=ai_board(board)))

    response = user_client.post("/api/chat", json={"message": "Break it"})

    assert response.status_code == 502
    assert user_client.get("/api/board").json() == db.DEFAULT_BOARD


def test_prompt_includes_board_and_history(user_client, fake_ai):
    completions = fake_ai(AIReply(message="Sure.", board=None))
    history = [
        {"role": "user", "content": "Hi"},
        {"role": "assistant", "content": "Hello! How can I help?"},
    ]

    user_client.post("/api/chat", json={"message": "Rename Backlog", "history": history})

    [call] = completions.calls
    assert call["model"] == "openai/gpt-oss-120b"
    assert call["response_format"] is AIReply
    system, *rest = call["messages"]
    assert system["role"] == "system"
    board_json = system["content"].split("Current board:\n", 1)[1]
    assert AIBoard.model_validate_json(board_json).to_board_data() == BoardData(**db.DEFAULT_BOARD)
    assert rest == [*history, {"role": "user", "content": "Rename Backlog"}]


def test_chat_requires_login(client):
    assert client.post("/api/chat", json={"message": "Hi"}).status_code == 401


@pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set")
def test_real_ai_creates_card(user_client):
    response = user_client.post(
        "/api/chat",
        json={"message": "Add a card titled 'Write release notes' to the Backlog column."},
    )

    assert response.status_code == 200
    board = user_client.get("/api/board").json()
    backlog_titles = [board["cards"][card_id]["title"] for card_id in board["columns"][0]["cardIds"]]
    assert "write release notes" in [title.lower() for title in backlog_titles]
    assert response.json()["board"] == board

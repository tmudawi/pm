import os
from types import SimpleNamespace

import pytest
from conftest import login

from app import ai


class FakeCompletions:
    def __init__(self, reply):
        self.reply = reply
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        message = SimpleNamespace(content=self.reply)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def test_ai_test_with_mocked_client(client, monkeypatch):
    completions = FakeCompletions("2 + 2 = 4")
    monkeypatch.setattr(ai, "client", lambda: SimpleNamespace(chat=SimpleNamespace(completions=completions)))
    login(client)

    response = client.post("/api/ai/test")

    assert response.status_code == 200
    assert response.json() == {"reply": "2 + 2 = 4"}
    assert completions.calls == [
        {"model": "openai/gpt-oss-120b", "messages": [{"role": "user", "content": "What is 2+2?"}]}
    ]


def test_ai_test_requires_login(client):
    assert client.post("/api/ai/test").status_code == 401


@pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set")
def test_ai_test_real_openrouter(client):
    login(client)
    response = client.post("/api/ai/test")
    assert response.status_code == 200
    assert "4" in response.json()["reply"]

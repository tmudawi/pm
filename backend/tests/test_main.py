from conftest import login


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_index_served_from_static_dir(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Kanban Studio" in response.text


def test_login_success(client):
    response = login(client)
    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_login_wrong_password(client):
    response = login(client, password="wrong")
    assert response.status_code == 401
    assert client.get("/api/me").status_code == 401


def test_me_before_and_after_login(client):
    assert client.get("/api/me").status_code == 401
    login(client)
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_logout(client):
    login(client)
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/me").status_code == 401

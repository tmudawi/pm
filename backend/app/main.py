import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from starlette.middleware.sessions import SessionMiddleware

from app import ai, db
from app.models import BoardData, ChatRequest, ChatResponse

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent / "static"))
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-secret")
USERS = {"user": "password"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)


class Credentials(BaseModel):
    username: str
    password: str


def current_user(request: Request) -> str:
    username = request.session.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(credentials: Credentials, request: Request):
    if USERS.get(credentials.username) != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    request.session["username"] = credentials.username
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/me")
def me(username: str = Depends(current_user)):
    return {"username": username}


@app.get("/api/board", response_model=BoardData)
def get_board(username: str = Depends(current_user)):
    return db.get_board(username)


def same_columns(username: str, board: BoardData) -> bool:
    stored_ids = [column["id"] for column in db.get_board(username)["columns"]]
    return [column.id for column in board.columns] == stored_ids


@app.put("/api/board", response_model=BoardData)
def put_board(board: BoardData, username: str = Depends(current_user)):
    if not same_columns(username, board):
        raise HTTPException(status_code=422, detail="Columns are fixed; only titles can change")
    db.save_board(username, board.model_dump())
    return db.get_board(username)


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest, username: str = Depends(current_user)):
    board = BoardData(**db.get_board(username))
    reply = ai.chat(board, request.history, request.message)
    if reply.board is None:
        return {"message": reply.message, "board": None}
    try:
        new_board = reply.board.to_board_data()
    except ValidationError:
        new_board = None
    if new_board is None or not same_columns(username, new_board):
        raise HTTPException(status_code=502, detail="The AI returned an invalid board; nothing was changed")
    db.save_board(username, new_board.model_dump())
    return {"message": reply.message, "board": db.get_board(username)}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True, check_dir=False), name="static")

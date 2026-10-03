import os

from openai import OpenAI

from app.models import AIBoard, AIReply, BoardData, ChatMessage

MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = """You are the assistant in a Kanban project management app. You help the user \
manage their board and can create, edit, move and delete cards.

The current board is given below as JSON. Columns are ordered; each column lists its cards in \
order by id in `cardIds`. `cards` holds each card's id, title and details.

Reply with JSON matching the schema:
- `message`: your reply to the user, short and in plain text (no Markdown).
- `board`: null if the board does not need to change. If it does change, the complete updated \
board, including everything that stays the same.

Rules for a changed board:
- Keep exactly the same columns, with the same ids, in the same order. You may change a \
column's title only when the user asks to rename it.
- Every card must appear in exactly one column's `cardIds` and in `cards`.
- Keep existing card ids. Give new cards a new unique id like `card-ai-1`, `card-ai-2`.
- Give each card a short title and one sentence of details."""


def client() -> OpenAI:
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"])


def chat(board: BoardData, history: list[ChatMessage], message: str) -> AIReply:
    current = AIBoard(columns=board.columns, cards=list(board.cards.values()))
    messages = [
        {"role": "system", "content": f"{SYSTEM_PROMPT}\n\nCurrent board:\n{current.model_dump_json()}"},
        *[item.model_dump() for item in history],
        {"role": "user", "content": message},
    ]
    response = client().chat.completions.parse(
        model=MODEL,
        messages=messages,
        response_format=AIReply,
        extra_body={
            # Only route to providers that support structured outputs. CoreWeave
            # returned malformed boards for this model in every test call.
            "provider": {"require_parameters": True, "ignore": ["CoreWeave"]},
            # Low effort was faster with no loss of accuracy in testing
            "reasoning": {"effort": "low"},
        },
    )
    return response.choices[0].message.parsed

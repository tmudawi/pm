from typing import Literal

from pydantic import BaseModel, model_validator


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def check_consistency(self):
        if any(key != card.id for key, card in self.cards.items()):
            raise ValueError("card keys must match card ids")
        placed = [card_id for column in self.columns for card_id in column.cardIds]
        if sorted(placed) != sorted(self.cards):
            raise ValueError("every card must appear in exactly one column")
        return self


class AIBoard(BaseModel):
    """Board shape for AI structured output: strict JSON schema cannot express
    a map with arbitrary keys, so cards are a list."""

    columns: list[Column]
    cards: list[Card]

    def to_board_data(self) -> BoardData:
        return BoardData(columns=self.columns, cards={card.id: card for card in self.cards})


class AIReply(BaseModel):
    message: str
    board: AIBoard | None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    message: str
    board: BoardData | None

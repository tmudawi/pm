import type { BoardData } from "@/lib/kanban";

export const getMe = async (): Promise<string | null> => {
  const response = await fetch("/api/me");
  if (!response.ok) {
    return null;
  }
  const { username } = await response.json();
  return username;
};

export const login = async (username: string, password: string) => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return response.ok;
};

export const logout = async () => {
  await fetch("/api/logout", { method: "POST" });
};

export const getBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board");
  return response.json();
};

const putBoard = async (board: BoardData) => {
  await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
};

// Saves run one at a time so an older board never overwrites a newer one
let lastSave = Promise.resolve();

export const saveBoard = (board: BoardData) => {
  const save = () => putBoard(board);
  lastSave = lastSave.then(save, save);
  return lastSave;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatReply = { message: string; board: BoardData | null };

export const sendChat = async (
  message: string,
  history: ChatMessage[]
): Promise<ChatReply> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 502
        ? "The AI suggested an invalid change, so the board was not changed. Please try again."
        : "The assistant could not answer. Please try again."
    );
  }
  return response.json();
};

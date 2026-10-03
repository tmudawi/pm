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

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { BoardData } from "@/lib/kanban";
import { testBoard } from "@/test/board";

let fetchMock: ReturnType<typeof vi.fn>;

const savedBoards = (): BoardData[] =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(init.body));

const renderBoard = async () => {
  render(<KanbanBoard onLogout={() => {}} />);
  await screen.findAllByTestId(/column-/i);
  return screen.getAllByTestId(/column-/i)[0];
};

describe("KanbanBoard", () => {
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => structuredClone(testBoard),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the board from the API", async () => {
    await renderBoard();
    expect(fetchMock).toHaveBeenCalledWith("/api/board");
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
    expect(screen.getByText("Align roadmap themes")).toBeInTheDocument();
    expect(savedBoards()).toHaveLength(0);
  });

  it("renames a column and saves on blur", async () => {
    const column = await renderBoard();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    expect(savedBoards()).toHaveLength(0);

    await userEvent.tab();
    expect(savedBoards()).toHaveLength(1);
    expect(savedBoards()[0].columns[0].title).toBe("New Name");
  });

  it("adds and removes a card, saving each change", async () => {
    const column = await renderBoard();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.type(within(column).getByPlaceholderText(/details/i), "Notes");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();
    const added = savedBoards()[0];
    const newId = added.columns[0].cardIds.at(-1)!;
    expect(added.cards[newId]).toEqual({ id: newId, title: "New card", details: "Notes" });

    await userEvent.click(within(column).getByRole("button", { name: /delete new card/i }));

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    const removed = savedBoards()[1];
    expect(removed.cards[newId]).toBeUndefined();
    expect(removed.columns[0].cardIds).not.toContain(newId);
  });

  it("edits a card and saves it", async () => {
    const column = await renderBoard();
    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );

    const titleInput = within(column).getByLabelText("Edit title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated title");
    const detailsInput = within(column).getByLabelText("Edit details");
    await userEvent.clear(detailsInput);
    await userEvent.type(detailsInput, "Updated details");
    await userEvent.click(within(column).getByRole("button", { name: /save/i }));

    expect(within(column).getByText("Updated title")).toBeInTheDocument();
    expect(within(column).getByText("Updated details")).toBeInTheDocument();
    expect(within(column).queryByText("Align roadmap themes")).not.toBeInTheDocument();
    expect(savedBoards()[0].cards["card-1"]).toEqual({
      id: "card-1",
      title: "Updated title",
      details: "Updated details",
    });
  });

  it("cancels editing a card without saving", async () => {
    const column = await renderBoard();
    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );
    const titleInput = within(column).getByLabelText("Edit title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Discarded");
    await userEvent.click(within(column).getByRole("button", { name: /cancel/i }));

    expect(within(column).getByText("Align roadmap themes")).toBeInTheDocument();
    expect(within(column).queryByText("Discarded")).not.toBeInTheDocument();
    expect(savedBoards()).toHaveLength(0);
  });
});

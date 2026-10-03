import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";
import { testBoard } from "@/test/board";

const reply = (body: object, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const send = async (text: string) => {
  await userEvent.type(screen.getByLabelText("Message"), text);
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
};

const sentBodies = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));

describe("ChatSidebar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends messages with history and renders replies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ message: "Hello! How can I help?", board: null }))
      .mockResolvedValueOnce(reply({ message: "Nothing to change.", board: null }));
    vi.stubGlobal("fetch", fetchMock);
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar open onClose={() => {}} onBoardUpdate={onBoardUpdate} />);

    await send("Hi");
    expect(await screen.findByText("Hello! How can I help?")).toBeInTheDocument();
    await send("Anything to do?");
    expect(await screen.findByText("Nothing to change.")).toBeInTheDocument();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/chat");
    expect(sentBodies(fetchMock)).toEqual([
      { message: "Hi", history: [] },
      {
        message: "Anything to do?",
        history: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hello! How can I help?" },
        ],
      },
    ]);
    expect(screen.getAllByTestId("chat-user")).toHaveLength(2);
    expect(screen.getAllByTestId("chat-assistant")).toHaveLength(2);
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("uses Shift+Enter for new lines and Enter to send", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ message: "Got it.", board: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatSidebar open onClose={() => {}} onBoardUpdate={() => {}} />);
    const input = screen.getByLabelText("Message");

    await userEvent.type(input, "First line{Shift>}{Enter}{/Shift}Second line");
    expect(input).toHaveValue("First line\nSecond line");
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.type(input, "{Enter}");
    expect(await screen.findByText("Got it.")).toBeInTheDocument();
    expect(sentBodies(fetchMock)[0].message).toBe("First line\nSecond line");
    expect(input).toHaveValue("");
  });

  it("passes a returned board to onBoardUpdate", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ message: "Added.", board: testBoard })));
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar open onClose={() => {}} onBoardUpdate={onBoardUpdate} />);

    await send("Add a card");

    expect(await screen.findByText("Added.")).toBeInTheDocument();
    expect(onBoardUpdate).toHaveBeenCalledWith(testBoard);
  });

  it("shows a loading state while waiting", async () => {
    let respond!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise((resolve) => (respond = resolve))));
    render(<ChatSidebar open onClose={() => {}} onBoardUpdate={() => {}} />);

    await send("Hi");

    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    expect(screen.getByLabelText("Message")).toHaveValue("");

    respond(reply({ message: "Hello!", board: null }));
    expect(await screen.findByText("Hello!")).toBeInTheDocument();
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
  });

  it("shows an error when the AI returns an invalid board", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({}, false, 502)));
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar open onClose={() => {}} onBoardUpdate={onBoardUpdate} />);

    await send("Break it");

    expect(await screen.findByRole("alert")).toHaveTextContent(/board was not changed/i);
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("is hidden when closed", () => {
    render(<ChatSidebar open={false} onClose={() => {}} onBoardUpdate={() => {}} />);
    expect(screen.queryByLabelText("Message")).not.toBeVisible();
  });
});

import { saveBoard } from "@/lib/api";
import { testBoard } from "@/test/board";

describe("saveBoard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends saves one at a time, in order", async () => {
    let finishFirst!: () => void;
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(new Promise((resolve) => (finishFirst = () => resolve({ ok: true }))))
      .mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const first = { ...testBoard, columns: [{ ...testBoard.columns[0], title: "First" }] };
    const second = { ...testBoard, columns: [{ ...testBoard.columns[0], title: "Second" }] };
    saveBoard(first);
    const done = saveBoard(second);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    finishFirst();
    await done;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const titles = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).columns[0].title);
    expect(titles).toEqual(["First", "Second"]);
  });
});

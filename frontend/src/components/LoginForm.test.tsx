import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/LoginForm";

const mockFetch = (ok: boolean) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const submit = async (username: string, password: string) => {
  await userEvent.type(screen.getByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("LoginForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("signs in with valid credentials", async () => {
    const fetchMock = mockFetch(true);
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    await submit("user", "password");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "user", password: "password" }),
      })
    );
    expect(onLogin).toHaveBeenCalledWith("user");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    mockFetch(false);
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    await submit("user", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password"
    );
    expect(onLogin).not.toHaveBeenCalled();
  });
});

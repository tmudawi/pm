import { expect, test, type Page } from "@playwright/test";
import { testBoard } from "../src/test/board";

const login = async (page: Page, password = "password") => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
};

test("wrong password shows an error", async ({ page }) => {
  await login(page, "wrong");
  await expect(page.getByText("Invalid username or password")).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(0);
});

test("logs in, survives reload, and logs out", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);

  await page.reload();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

test.describe("when signed in", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
    // Start every test from the default board
    await page.request.put("/api/board", { data: testBoard });
    await page.reload();
    await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
  });

  test("adds a card to a column", async ({ page }) => {
    const firstColumn = page.locator('[data-testid^="column-"]').first();
    await firstColumn.getByRole("button", { name: /add a card/i }).click();
    await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
    await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
    await firstColumn.getByRole("button", { name: /add card/i }).click();
    await expect(firstColumn.getByText("Playwright card")).toBeVisible();
  });

  test("moves a card between columns", async ({ page }) => {
    const card = page.getByTestId("card-card-1");
    const targetColumn = page.getByTestId("column-col-review");
    const cardBox = await card.boundingBox();
    const columnBox = await targetColumn.boundingBox();
    if (!cardBox || !columnBox) {
      throw new Error("Unable to resolve drag coordinates.");
    }

    await page.mouse.move(
      cardBox.x + cardBox.width / 2,
      cardBox.y + cardBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      columnBox.x + columnBox.width / 2,
      columnBox.y + 120,
      { steps: 12 }
    );
    await page.mouse.up();
    await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  });

  test("reorders cards within a column", async ({ page }) => {
    // Both backlog cards must be on screen to drag between them
    await page.setViewportSize({ width: 1280, height: 1200 });
    const backlog = page.getByTestId("column-col-backlog");
    const cardBox = await page.getByTestId("card-card-2").boundingBox();
    const targetBox = await page.getByTestId("card-card-1").boundingBox();
    if (!cardBox || !targetBox) {
      throw new Error("Unable to resolve drag coordinates.");
    }

    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 10, { steps: 12 });
    await page.mouse.up();

    await expect(backlog.locator('[data-testid^="card-"]').first()).toHaveAttribute(
      "data-testid",
      "card-card-2"
    );
  });

  test("edits a card", async ({ page }) => {
    const card = page.getByTestId("card-card-2");
    await card.getByRole("button", { name: /edit/i }).click();
    await card.getByLabel("Edit title").fill("Edited in e2e");
    await card.getByLabel("Edit details").fill("New details.");
    await card.getByRole("button", { name: /save/i }).click();
    await expect(card.getByText("Edited in e2e")).toBeVisible();
    await expect(card.getByText("New details.")).toBeVisible();
  });

  test("changes persist across reload", async ({ page }) => {
    const backlog = page.getByTestId("column-col-backlog");
    const review = page.getByTestId("column-col-review");

    // add
    await backlog.getByRole("button", { name: /add a card/i }).click();
    await backlog.getByPlaceholder("Card title").fill("Persisted card");
    await backlog.getByPlaceholder("Details").fill("Survives reload.");
    await backlog.getByRole("button", { name: /add card/i }).click();
    await expect(backlog.getByText("Persisted card")).toBeVisible();

    // edit
    const card2 = page.getByTestId("card-card-2");
    await card2.getByRole("button", { name: /edit/i }).click();
    await card2.getByLabel("Edit title").fill("Edited and saved");
    await card2.getByRole("button", { name: /save/i }).click();
    await expect(card2.getByText("Edited and saved")).toBeVisible();

    // rename (saves on blur)
    const title = backlog.getByLabel("Column title");
    await title.fill("Ideas");
    await title.blur();

    // delete
    await page.getByTestId("card-card-6").getByRole("button", { name: /delete/i }).click();
    await expect(page.getByTestId("card-card-6")).toHaveCount(0);

    // move card-1 into the now empty review column
    const cardBox = await page.getByTestId("card-card-1").boundingBox();
    const columnBox = await review.boundingBox();
    if (!cardBox || !columnBox) {
      throw new Error("Unable to resolve drag coordinates.");
    }
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, { steps: 12 });
    const saved = page.waitForResponse(
      (response) => response.url().endsWith("/api/board") && response.request().method() === "PUT"
    );
    await page.mouse.up();
    await expect(review.getByTestId("card-card-1")).toBeVisible();
    await saved;

    await page.reload();

    await expect(backlog.getByLabel("Column title")).toHaveValue("Ideas");
    await expect(backlog.getByText("Persisted card")).toBeVisible();
    await expect(page.getByTestId("card-card-2").getByText("Edited and saved")).toBeVisible();
    await expect(page.getByTestId("card-card-6")).toHaveCount(0);
    await expect(review.getByTestId("card-card-1")).toBeVisible();
  });

  test("AI chat updates the board", async ({ page }) => {
    const board = structuredClone(testBoard);
    board.columns[0].cardIds = ["card-2", "card-ai-1"];
    board.columns[4].cardIds.push("card-1");
    board.cards["card-ai-1"] = { id: "card-ai-1", title: "Write release notes", details: "For v1." };
    await page.route("**/api/chat", (route) =>
      route.fulfill({ json: { message: "Added a card and moved card 1 to Done.", board } })
    );

    const sidebar = page.getByRole("complementary", { name: "AI chat" });
    await expect(sidebar).toBeHidden();
    await page.getByRole("button", { name: "AI Assistant" }).click();
    await expect(sidebar).toBeVisible();

    await sidebar.getByLabel("Message").fill("Add release notes and finish card 1");
    await sidebar.getByRole("button", { name: /send/i }).click();

    await expect(sidebar.getByText("Added a card and moved card 1 to Done.")).toBeVisible();
    await expect(page.getByTestId("column-col-backlog").getByText("Write release notes")).toBeVisible();
    await expect(page.getByTestId("column-col-done").getByTestId("card-card-1")).toBeVisible();

    await sidebar.getByRole("button", { name: "Close chat" }).click();
    await expect(sidebar).toBeHidden();
  });
});

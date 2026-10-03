import { expect, test, type Page } from "@playwright/test";

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

  test("edits a card", async ({ page }) => {
    const card = page.getByTestId("card-card-2");
    await card.getByRole("button", { name: /edit/i }).click();
    await card.getByLabel("Edit title").fill("Edited in e2e");
    await card.getByLabel("Edit details").fill("New details.");
    await card.getByRole("button", { name: /save/i }).click();
    await expect(card.getByText("Edited in e2e")).toBeVisible();
    await expect(card.getByText("New details.")).toBeVisible();
  });
});

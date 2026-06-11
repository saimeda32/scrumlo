import { test, expect, type Page } from "@playwright/test";

// Each test gets a fresh room (fresh Durable Object) so tests can't bleed into
// each other — random so parallel workers can't collide on the same millisecond.
const newRoom = () => `e2e-${Math.random().toString(36).slice(2, 10)}`;

/** Join a room as the first member (= facilitator) and open the retro wall. */
async function joinRetro(page: Page, room: string, name = "Pat") {
  await page.goto(`/r/${room}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join the room" }).click();
  await page.getByRole("tab", { name: "Retro" }).click();
  // An empty retro pops the format picker for the facilitator — keep the default.
  const close = page.getByRole("button", { name: "Close" });
  await close.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
  if (await close.isVisible()) await close.click();
  await expect(page.getByRole("button", { name: /Add a sticky/i }).first()).toBeVisible();
}

/** Drop a sticky in the first column and type its text (a fresh blank opens in edit). */
async function addSticky(page: Page, text: string) {
  await page.getByRole("button", { name: /Add a sticky/i }).first().click();
  const input = page.locator("[data-card-id] textarea");
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press("Enter");
  await expect(page.locator("[data-card-id]").getByText(text)).toBeVisible();
}

test("a sticky can be edited after it was entered (double-click)", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "first thought");

  const card = page.locator("[data-card-id]").first();
  await card.getByText("first thought").dblclick();
  const input = card.locator("textarea");
  await expect(input, "double-click should reopen the sticky for editing").toBeVisible();

  await input.fill("second thought");
  await input.press("Enter");
  await expect(card.getByText("second thought")).toBeVisible();
  await expect(input).toBeHidden();
});

test("editing still works after moving to the vote phase", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "needs a tweak");

  await page.getByRole("button", { name: "3 Vote" }).click(); // phase stepper (facilitator)
  const card = page.locator("[data-card-id]").first();
  await card.getByText("needs a tweak").dblclick();
  const input = card.locator("textarea");
  await expect(input, "own stickies stay editable in the vote phase").toBeVisible();
  await input.fill("tweaked in vote phase");
  await input.press("Enter");
  await expect(card.getByText("tweaked in vote phase")).toBeVisible();
});

test("a single click still drags, not edits", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "drag me");
  const card = page.locator("[data-card-id]").first();
  await card.getByText("drag me").click();
  await expect(card.locator("textarea")).toBeHidden();
});

test("fullscreen keeps facilitator + participant controls reachable", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "talk about this");

  await page.getByRole("button", { name: "Fullscreen" }).click();

  // phase + advance, timer, vote budget, room toggles — all without leaving fullscreen
  const bar = page.getByTestId("fullscreen-bar");
  await expect(bar).toBeVisible();
  await expect(bar.getByText("Brainstorm")).toBeVisible();
  await expect(bar.getByRole("button", { name: /Reveal/ })).toBeVisible();
  await expect(bar.getByRole("button", { name: "3m" })).toBeVisible();
  await expect(bar.getByText(/votes? left/)).toBeVisible();
  await expect(bar.getByRole("button", { name: /Anonymous|Names shown/ })).toBeVisible();
  await expect(bar.getByRole("button", { name: /Cards hidden|Cards shown/ })).toBeVisible();

  // spotlight a card and the focus banner shows inside fullscreen too
  await page.locator("[data-card-id]").first().hover();
  await page.getByRole("button", { name: "Spotlight this sticky" }).click();
  await expect(page.getByTestId("fullscreen-spotlight")).toBeVisible();
  await expect(page.getByTestId("fullscreen-spotlight")).toContainText("talk about this");

  // discuss phase: the facilitator can spin for a card without exiting
  await bar.getByRole("button", { name: /Reveal/ }).click(); // → group
  await bar.getByRole("button", { name: /Vote →/ }).click(); // → vote
  await bar.getByRole("button", { name: /Discuss →/ }).click(); // → discuss
  await expect(bar.getByRole("button", { name: /Spin/ })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(bar).toBeHidden();
});

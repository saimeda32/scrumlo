import { test, expect } from "@playwright/test";
import { newRoom, join, openRetro, addSticky } from "./helpers";

test("export: markdown copy, .md download, and board PNG all produce output", async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await join(page, newRoom(), "Eve");
  await openRetro(page);
  await addSticky(page, "keep this decision");

  await page.getByRole("button", { name: "⤓ Export" }).click();
  await expect(page.getByText("Take the session with you")).toBeVisible();

  await page.getByRole("button", { name: "Copy Markdown" }).click();
  await expect(page.getByRole("button", { name: "Copied ✓" })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("keep this decision");

  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .md" }).click();
  expect((await dl).suggestedFilename()).toMatch(/\.md$/);

  const png = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("button", { name: /Board image/ }).click();
  expect((await png).suggestedFilename()).toMatch(/\.png$/);

  await ctx.close();
});

test("dark mode: toggles the html class, persists across reload, board stays readable", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await join(page, newRoom(), "Nox");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 10_000 });

  await openRetro(page);
  await addSticky(page, "night owl note");
  await page.screenshot({ path: "test-results/dark-retro.png" });
  await page.getByRole("button", { name: "Fullscreen" }).click();
  await expect(page.getByTestId("fullscreen-bar")).toBeVisible();
  await page.screenshot({ path: "test-results/dark-fullscreen.png" });
  await page.context().close();
});

test("jira export: choose which action items make the CSV", async ({ page }) => {
  await join(page, newRoom(), "Eve");
  await openRetro(page);
  await addSticky(page, "fix login bug");
  await addSticky(page, "speed up builds");

  // Promote both to action items.
  for (const text of ["fix login bug", "speed up builds"]) {
    const card = page.locator("[data-card-id]", { hasText: text });
    await card.hover();
    await card.getByRole("button", { name: "Mark as action item" }).click();
  }

  await page.getByRole("button", { name: "⤓ Export" }).click();

  // Both action items appear with checkboxes; drop one from the handoff.
  await page.getByRole("checkbox", { name: "fix login bug" }).uncheck();

  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: /Jira CSV/ }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const body = await (await import("node:fs/promises")).readFile((await download.path())!, "utf8");
  expect(body).toContain("speed up builds");
  expect(body).not.toContain("fix login bug");
  expect(body).toContain("Summary");
});

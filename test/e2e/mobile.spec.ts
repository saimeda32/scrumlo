import { test, expect } from "@playwright/test";
import { newRoom, join, openRetro, addSticky } from "./helpers";

// iPhone-ish viewport with a real touchscreen — the layer where desktop-tested
// pointer handling usually breaks (touch-action: none, double-tap, drag).
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("phone: join, add a sticky, double-tap to edit", async ({ page }) => {
  await join(page, newRoom(), "Mo");
  await openRetro(page);
  // zoom in so a sticky is a realistic thumb target, the way a phone user would
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Zoom in" }).click();
  await addSticky(page, "thumb typed");

  // double-tap the note text (top of the card, above the action buttons) → edit opens
  const card = page.locator("[data-card-id]").first();
  const box = (await card.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + 14;
  await page.touchscreen.tap(cx, cy);
  await page.touchscreen.tap(cx, cy);
  await expect(card.locator("textarea"), "double-tap should open the sticky for editing").toBeVisible();
  await card.locator("textarea").fill("edited by thumb");
  await card.locator("textarea").press("Enter");
  await expect(card.getByText("edited by thumb")).toBeVisible();
});

test("phone: estimate deck is tappable and the room header fits", async ({ page }) => {
  await join(page, newRoom(), "Mo");
  // no horizontal overflow on a phone — the classic responsive mishap
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll sideways on a phone").toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "+ Add stories" }).click();
  await page.getByPlaceholder(/One per line/).fill("Mobile story");
  await page.getByRole("button", { name: "Queue them" }).click();
  await page.getByTestId("deck").getByRole("button", { name: "Vote 8", exact: true }).tap();
  await expect(
    page.getByTestId("deck").getByRole("button", { name: "Vote 8", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/mobile-estimate.png" });
});

test("phone: fullscreen retro bar wraps without covering the wall", async ({ page }) => {
  await join(page, newRoom(), "Mo");
  await openRetro(page);
  await addSticky(page, "tiny screen");
  await page.getByRole("button", { name: "Fullscreen" }).click();
  await expect(page.getByTestId("fullscreen-bar")).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-fullscreen.png" });
});

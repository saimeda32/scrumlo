import { test, expect } from "@playwright/test";
import { newRoom, join } from "./helpers";

test("the GitHub link lives in the landing footer — exactly one, and only there", async ({ page }) => {
  await page.goto("/");
  const gh = page.locator('a[href*="github.com/saimeda32/scrumlo"]');
  await expect(gh).toHaveCount(1);
  await expect(gh).toBeVisible();
  await expect(gh).toHaveAttribute("target", "_blank");
  await expect(gh).toHaveAttribute("rel", /noopener/);

  // not duplicated inside a live room (the user asked for one place only)
  await join(page, newRoom(), "Pat");
  await expect(page.locator('a[href*="github.com"]')).toHaveCount(0);
});

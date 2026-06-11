import { expect, type Browser, type Page } from "@playwright/test";

/** Fresh room per test (fresh Durable Object) — random so parallel workers can't collide. */
export const newRoom = () => `e2e-${Math.random().toString(36).slice(2, 10)}`;

/** Join a room. The first joiner becomes the facilitator. */
export async function join(page: Page, room: string, name: string) {
  await page.goto(`/r/${room}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join the room" }).click();
  await expect(page.getByText("facilitated by")).toBeVisible();
}

/** Two real users = two browser contexts (separate sessionStorage identities). */
export async function twoUsers(browser: Browser, room: string): Promise<[Page, Page]> {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await join(a, room, "Ana");
  await join(b, room, "Ben");
  return [a, b];
}

/** Open the retro wall (facilitator page) and dismiss the format picker. */
export async function openRetro(page: Page) {
  await page.getByRole("tab", { name: "Retro" }).click();
  // an empty retro pops the format picker for the facilitator — keep the default (Escape closes)
  const picker = page.getByRole("dialog", { name: "Choose a retro format" });
  await picker.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
  if (await picker.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await picker.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  }
  await expect(page.getByRole("button", { name: /Add a sticky/i }).first()).toBeVisible();
}

/** Drop a sticky in the first column and type its text (a fresh blank opens in edit). */
export async function addSticky(page: Page, text: string) {
  await page.getByRole("button", { name: /Add a sticky/i }).first().click();
  const input = page.locator("[data-card-id] textarea");
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press("Enter");
  await expect(page.locator("[data-card-id]").getByText(text)).toBeVisible();
}

import { test, expect, type Page } from "@playwright/test";

const newRoom = () => `e2e-${Math.random().toString(36).slice(2, 10)}`;

async function join(page: Page, room: string, name: string) {
  await page.goto(`/r/${room}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join the room" }).click();
  await expect(page.getByText(`facilitated by`)).toBeVisible();
}

test("a page refresh does not demote the facilitator", async ({ browser }) => {
  const room = newRoom();
  // two real users = two browser contexts (separate sessionStorage identities)
  const ana = await (await browser.newContext()).newPage();
  const ben = await (await browser.newContext()).newPage();
  await join(ana, room, "Ana");
  await expect(ana.getByText("facilitated by Ana (you)")).toBeVisible();
  await join(ben, room, "Ben");
  await expect(ben.getByText("facilitated by Ana")).toBeVisible();

  // the bug: reloading closed Ana's socket and instantly handed the baton to Ben
  await ana.reload();
  await expect(ana.getByText("facilitated by Ana (you)")).toBeVisible();
  await expect(ben.getByText("facilitated by Ana")).toBeVisible();

  // and a refreshed facilitator keeps the facilitator-only controls
  await expect(ana.getByRole("button", { name: "End room" })).toBeVisible();

  await ana.context().close();
  await ben.context().close();
});

test("solo facilitator survives a refresh too", async ({ browser }) => {
  const room = newRoom();
  const page = await (await browser.newContext()).newPage();
  await join(page, room, "Solo");
  await expect(page.getByText("facilitated by Solo (you)")).toBeVisible();
  await page.reload();
  await expect(page.getByText("facilitated by Solo (you)")).toBeVisible();
  await page.context().close();
});

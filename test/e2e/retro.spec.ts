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

test("two stickies fit side by side inside one column", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "left note");
  await addSticky(page, "right note");

  // Drag the second sticky to sit immediately right of the first, same row.
  const right = page.locator("[data-card-id]", { hasText: "right note" });
  const left = page.locator("[data-card-id]", { hasText: "left note" });
  const a0 = (await left.boundingBox())!;
  const b0 = (await right.boundingBox())!;
  await page.mouse.move(b0.x + b0.width / 2, b0.y + 10);
  await page.mouse.down();
  await page.mouse.move(a0.x + a0.width + 8 + b0.width / 2, a0.y + 10, { steps: 8 });
  await page.mouse.up();
  const zone = page.locator("#scrumlo-canvas > div.border-r").first();

  // Moves are server-authoritative, so poll until the snapshot lands.
  await expect(async () => {
    const a = (await left.boundingBox())!;
    const b = (await right.boundingBox())!;
    const z = (await zone.boundingBox())!;

    // Side by side: on the same row, not overlapping each other…
    expect(Math.abs(b.y - a.y), "stickies should share a row").toBeLessThan(a.height);
    expect(b.x, "stickies should not overlap").toBeGreaterThanOrEqual(a.x + a.width - 2);
    // …and BOTH fully inside the first column's band (no bleed over the divider).
    expect(a.x + a.width, "left sticky should fit in the column").toBeLessThanOrEqual(z.x + z.width + 1);
    expect(b.x + b.width, "right sticky should fit in the column").toBeLessThanOrEqual(z.x + z.width + 1);
  }).toPass({ timeout: 5_000 });
});

test("a card can be tagged and shows the tag chip", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "tag me");

  const card = page.locator("[data-card-id]", { hasText: "tag me" });
  await card.hover();
  await card.getByRole("button", { name: "Add tag" }).click();
  await page.getByRole("button", { name: "Priority" }).click();

  // The chip renders from server state, so visibility proves the round-trip.
  await expect(card.getByText("Priority")).toBeVisible();
});

test("dragging a sticky over another highlights it as a group target", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "anchor");
  await addSticky(page, "drifter");

  const anchor = page.locator("[data-card-id]", { hasText: "anchor" });
  const drifter = page.locator("[data-card-id]", { hasText: "drifter" });
  const a = (await anchor.boundingBox())!;
  const d = (await drifter.boundingBox())!;

  await page.mouse.move(d.x + d.width / 2, d.y + 10);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 6 });

  // Hovering a fellow sticky mid-drag should announce "release to group" on the target.
  await expect(anchor).toHaveAttribute("data-drop-target", "group");

  // Dragging away again clears the hint.
  await page.mouse.move(a.x + a.width / 2, a.y + a.height + 160, { steps: 4 });
  await expect(anchor).not.toHaveAttribute("data-drop-target", "group");
  await page.mouse.up();
});

test("clustering two stickies names the theme, and the name can be edited", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "ci is slow");
  await addSticky(page, "flaky tests");

  const anchor = page.locator("[data-card-id]", { hasText: "ci is slow" });
  const drifter = page.locator("[data-card-id]", { hasText: "flaky tests" });
  const a = (await anchor.boundingBox())!;
  const d = (await drifter.boundingBox())!;
  await page.mouse.move(d.x + d.width / 2, d.y + 10);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 6 });
  await page.mouse.up();

  // A fresh cluster gets an editable default name…
  const pill = page.getByRole("button", { name: /Rename cluster/ });
  await expect(pill).toBeVisible();
  await expect(pill).toContainText("Theme 1");

  // …which renames in place (server round-trip).
  await pill.click();
  const input = page.getByLabel("Cluster name");
  await input.fill("Test debt");
  await input.press("Enter");
  await expect(page.getByRole("button", { name: /Rename cluster/ })).toContainText("Test debt");
});

test("gather by tag pulls tagged stickies into one titled cluster", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "fix login bug");
  await addSticky(page, "speed up builds");
  await addSticky(page, "lunch was great");

  // Tag two of the three as Priority (scoped to the card so chips elsewhere don't collide).
  for (const text of ["fix login bug", "speed up builds"]) {
    const card = page.locator("[data-card-id]", { hasText: text });
    await card.hover();
    await card.getByRole("button", { name: "Add tag" }).click();
    await card.getByRole("button", { name: "Priority" }).click();
    await expect(card.getByText("Priority")).toBeVisible();
  }

  // Facilitator gathers by tag → the two Priority cards become one cluster named after the tag.
  await page.getByRole("button", { name: "Gather" }).click();
  await page.getByRole("button", { name: "By tag" }).click();

  const pills = page.getByRole("button", { name: /Rename cluster/ });
  await expect(pills).toHaveCount(1);
  await expect(pills.first()).toContainText("Priority");
});

test("two stickies can be linked with a connector, and unlinked", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "cause");
  await addSticky(page, "effect");

  const cause = page.locator("[data-card-id]", { hasText: "cause" });
  const effect = page.locator("[data-card-id]", { hasText: "effect" });

  await cause.hover();
  await cause.getByRole("button", { name: "Link to another sticky" }).click();
  await effect.click();

  // The connector renders from server state (works for everyone in the room).
  await expect(page.locator("[data-edge-id]")).toHaveCount(1);

  // Its midpoint button removes it again.
  await page.getByRole("button", { name: "Remove connector" }).click();
  await expect(page.locator("[data-edge-id]")).toHaveCount(0);
});

test("mind map format seeds a central topic on one open canvas", async ({ page }) => {
  await joinRetro(page, newRoom());

  await page.getByTitle("Browse formats with previews").click();
  await page.getByRole("button", { name: /Mind map/ }).click();

  // Seeded center node, ready to branch with connectors…
  await expect(page.locator("[data-card-id]", { hasText: "Central topic" })).toBeVisible();
  // …on a single open canvas (no column dividers beyond the one band).
  await expect(page.locator("#scrumlo-canvas > div.border-r")).toHaveCount(1);
});

test("reaction chips reveal who reacted when names are shown", async ({ page }) => {
  await joinRetro(page, newRoom());
  await addSticky(page, "nice work");

  // Names are anonymous by default — show them so reactors are attributable.
  await page.getByRole("button", { name: /Anonymous/ }).click();

  const card = page.locator("[data-card-id]").first();
  await card.hover();
  await card.getByRole("button", { name: "Add reaction" }).click();
  await card.getByRole("button", { name: "👍", exact: true }).click();

  const chip = card.getByRole("button", { name: /👍 reaction/ });
  await expect(chip).toBeVisible();
  // The chip's tooltip names the reactors (server-derived, anonymous-aware).
  await expect(chip).toHaveAttribute("title", /Pat/);
});

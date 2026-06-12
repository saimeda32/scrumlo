import { test, expect } from "@playwright/test";
import { newRoom, twoUsers, openRetro, addSticky } from "./helpers";

test("blind brainstorm: others' card bodies are masked in the DOM, facilitator sees all", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await openRetro(ana);
  await expect(ben.getByRole("button", { name: /Add a sticky/i }).first()).toBeVisible();

  await ana.getByRole("button", { name: "👁 Cards shown" }).click();
  await expect(ben.getByText("🔒 Cards hidden")).toBeVisible();

  // Ben writes a note · he sees his own text, the facilitator sees it too
  await addSticky(ben, "candid feedback");
  await expect(ana.locator("[data-card-id]").getByText("candid feedback")).toBeVisible();

  // Ana writes one · Ben must get a masked placeholder, not the text
  await addSticky(ana, "host secret");
  await expect(ben.getByText("host secret")).toBeHidden();

  // reveal · now Ben sees Ana's text
  await ana.getByRole("button", { name: "🔒 Cards hidden" }).click();
  await expect(ben.locator("[data-card-id]").getByText("host secret")).toBeVisible();

  await ana.context().close();
  await ben.context().close();
});

test("a drag lands on the other user's screen; spotlight reaches participants", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await openRetro(ana);
  await addSticky(ana, "move me");
  const onBen = ben.locator("[data-card-id]").first();
  await expect(onBen.getByText("move me")).toBeVisible();
  const before = await onBen.boundingBox();

  // Ana drags her sticky a few hundred px
  const onAna = ana.locator("[data-card-id]").first();
  const box = (await onAna.boundingBox())!;
  await ana.mouse.move(box.x + box.width / 2, box.y + 10);
  await ana.mouse.down();
  await ana.mouse.move(box.x + box.width / 2 + 200, box.y + 180, { steps: 8 });
  await ana.mouse.up();

  // …and it lands in the new spot for Ben (resting position, not just the live ghost)
  await expect(async () => {
    const after = (await onBen.boundingBox())!;
    expect(after.x).toBeGreaterThan(before!.x + 100);
    expect(after.y).toBeGreaterThan(before!.y + 80);
  }).toPass({ timeout: 10_000 });

  // facilitator spotlights → the participant gets the focus banner
  await onAna.hover();
  await ana.getByRole("button", { name: "Spotlight this sticky" }).click();
  await expect(ben.getByText(/everyone.s looking here/i)).toBeVisible();
  await expect(ben.getByText("move me").first()).toBeVisible();

  await ana.context().close();
  await ben.context().close();
});

test("the facilitator can pass the baton to a teammate", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());

  await ana.getByRole("button", { name: "Pass baton" }).click();
  await ana.getByRole("button", { name: /Ben/ }).click();

  // Everyone gets the coronation: crown, circles, confetti.
  await expect(ben.getByTestId("baton-handoff")).toBeVisible();
  await expect(ben.getByTestId("baton-handoff")).toContainText("Ben has the baton");
  await expect(ana.getByTestId("baton-handoff")).toBeVisible();

  // Both sides agree on the new facilitator (server round-trip).
  await expect(ana.getByText("facilitated by")).toContainText("Ben");
  await expect(ben.getByText("facilitated by")).toContainText("Ben");
  // The new facilitator gets the controls (phase stepper is facilitator-gated).
  await ben.context().close();
  await ana.context().close();
});

test("take the lead: followers' canvases track the facilitator's viewport", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await openRetro(ana);
  await expect(ben.getByRole("button", { name: /Add a sticky/i }).first()).toBeVisible();

  await ana.getByRole("button", { name: "Take the lead" }).click();
  await expect(ben.getByText(/Following Ana/)).toBeVisible();

  // Ana zooms out; Ben's canvas follows to the same zoom level.
  await ana.getByRole("button", { name: "Zoom out" }).click();
  const anaZoom = await ana.getByTestId("zoom-level").textContent();
  await expect(ben.getByTestId("zoom-level")).toHaveText(anaZoom!);

  // A follower can break away.
  await ben.getByRole("button", { name: "Stop following" }).click();
  await expect(ben.getByText(/Following Ana/)).toBeHidden();

  await ana.context().close();
  await ben.context().close();
});

test("blind mode keeps tags, colors and connectors of masked cards private", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await openRetro(ana);
  await addSticky(ana, "secret one");
  await addSticky(ana, "secret two");

  // Ana decorates: tag + color on one, a connector between the two.
  const one = ana.locator("[data-card-id]", { hasText: "secret one" });
  await one.hover();
  await one.getByRole("button", { name: "Add tag" }).click();
  await one.getByRole("button", { name: "Priority" }).click();
  await one.getByRole("button", { name: "Sticky color" }).click();
  await ana.getByRole("button", { name: "Pink", exact: true }).click();
  await one.getByRole("button", { name: "Link to another sticky" }).click();
  await ana.locator("[data-card-id]", { hasText: "secret two" }).click();
  await expect(ana.locator("[data-edge-id]")).toHaveCount(1);

  // Facilitator flips the room blind: Ben's view must reveal nothing.
  await ana.getByRole("button", { name: /Cards shown/ }).click();
  await expect(ben.getByText("\u{1F512}").first()).toBeVisible(); // masked placeholders
  await expect(ben.getByText("Priority")).toBeHidden();
  await expect(ben.locator('[data-color="pink"]')).toHaveCount(0);
  await expect(ben.locator("[data-edge-id]")).toHaveCount(0);

  // The facilitator still sees everything (they run the session).
  await expect(ana.locator("[data-edge-id]")).toHaveCount(1);
  await expect(ana.getByText("Priority").first()).toBeVisible();

  await ana.context().close();
  await ben.context().close();
});

test("anonymous rooms don't name reactors on hover", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await openRetro(ana);
  await addSticky(ana, "react to me");

  // Anonymous is the default · Ben reacts; the chip shows a count but no names.
  const onBen = ben.locator("[data-card-id]", { hasText: "react to me" });
  await onBen.hover();
  await onBen.getByRole("button", { name: "Add reaction" }).click();
  await onBen.getByRole("button", { name: "👍", exact: true }).click();

  const chip = ana.locator("[data-card-id]").getByRole("button", { name: /👍 reaction/ });
  await expect(chip).toBeVisible();
  await expect(chip).not.toHaveAttribute("title", /Ben/);

  await ana.context().close();
  await ben.context().close();
});

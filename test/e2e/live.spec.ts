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

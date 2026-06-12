import { test, expect } from "@playwright/test";
import { newRoom, twoUsers } from "./helpers";

test("word-cloud poll: blind while answering, words appear on reveal", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await ana.getByRole("tab", { name: "Poll" }).click();
  await expect(ben.getByLabel("Your submission")).toBeVisible();

  await ana.getByLabel("Poll question").fill("One word for this sprint?");
  await ana.getByRole("button", { name: "Word cloud" }).click();
  await expect(ben.getByText("One word for this sprint?")).toBeVisible();

  await ben.getByLabel("Your submission").fill("chaotic");
  await ben.getByRole("button", { name: /Add|Submit/ }).click();
  // blind by default: the word is hidden from everyone until the facilitator reveals
  await expect(ana.getByText("chaotic")).toBeHidden();
  await ana.getByRole("button", { name: /Reveal/ }).click();
  await expect(ana.getByText("chaotic")).toBeVisible();
  await expect(ben.getByText("chaotic")).toBeVisible();

  await ana.context().close();
  await ben.context().close();
});

test("pulse: two ratings reveal anonymous averages", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await ana.getByRole("tab", { name: "Pulse" }).click();

  for (const page of [ana, ben]) {
    await expect(page.getByRole("button", { name: /: 4 of 5/ }).first()).toBeVisible();
    for (const btn of await page.getByRole("button", { name: /: 4 of 5/ }).all()) await btn.click();
    await expect(page.getByText("✓ your ratings are in")).toBeVisible();
  }

  await ana.getByRole("button", { name: /Reveal results/ }).click();
  await expect(ana.getByText("overall · out of 5")).toBeVisible();
  await expect(ben.getByText("overall · out of 5")).toBeVisible();
  await expect(ana.getByText("4.0").first()).toBeVisible();

  await ana.context().close();
  await ben.context().close();
});

test("pick: a person spin lands on a member, for both screens", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await ana.getByRole("tab", { name: "Pick" }).click();
  await expect(ben.getByText(/Waiting for the facilitator to spin/)).toBeVisible();

  await ana.locator("button", { hasText: "Pick someone" }).click();
  // the reveal animation settles on the same person ("It's <name>") for everyone
  await expect(ana.getByText("It’s")).toBeVisible({ timeout: 15_000 });
  const picked = await ana.getByText("It’s").locator("xpath=following-sibling::div").first().textContent();
  expect(picked).toMatch(/Ana|Ben/);
  await expect(ben.getByText(picked!.trim(), { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  await ana.context().close();
  await ben.context().close();
});

test("pulse: facilitator switches the theme and everyone gets new questions", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await ana.getByRole("tab", { name: "Pulse" }).click();

  await ana.getByRole("button", { name: "Sprint health" }).click();
  // New dimension set lands on both screens; old one is gone.
  await expect(ana.getByText("Pace")).toBeVisible();
  await expect(ben.getByText("Pace")).toBeVisible();
  await expect(ben.getByText("Morale")).toBeHidden();

  await ana.context().close();
  await ben.context().close();
});

test("pulse: reveal distills the room into one word", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await ana.getByRole("tab", { name: "Pulse" }).click();

  for (const page of [ana, ben]) {
    await expect(page.getByRole("button", { name: /: 4 of 5/ }).first()).toBeVisible();
    for (const btn of await page.getByRole("button", { name: /: 4 of 5/ }).all()) await btn.click();
    await expect(page.getByText("✓ your ratings are in")).toBeVisible();
  }
  await ana.getByRole("button", { name: /Reveal results/ }).click();

  // 4.0 across the board → the room is "Humming" on both screens.
  await expect(ana.getByTestId("pulse-verdict")).toHaveText("Humming");
  await expect(ben.getByTestId("pulse-verdict")).toHaveText("Humming");

  await ana.context().close();
  await ben.context().close();
});

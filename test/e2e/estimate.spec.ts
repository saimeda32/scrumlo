import { test, expect } from "@playwright/test";
import { newRoom, twoUsers } from "./helpers";

test("deck voting: hidden while voting, auto-reveal, consensus recorded", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());

  // facilitator queues two stories; the first becomes the current story for everyone
  await ana.getByRole("button", { name: "+ Add stories" }).click();
  await ana.getByPlaceholder(/One per line/).fill("Login page, Search API");
  await ana.getByRole("button", { name: "Queue them" }).click();
  await expect(ben.getByText("Login page")).toBeVisible();

  // Ben votes · his seat flips to "voted" but the VALUE stays hidden from Ana
  await ben.getByTestId("deck").getByRole("button", { name: "Vote 5", exact: true }).click();
  await expect(ana.getByTestId("seats").getByText("voted", { exact: true })).toBeVisible();
  await expect(ana.getByTestId("seats").getByText("voted 5")).toBeHidden();

  // Ana votes too → everyone has voted → the round auto-reveals the consensus for both
  await ana.getByTestId("deck").getByRole("button", { name: "Vote 5", exact: true }).click();
  await expect(ana.getByText("Everyone said 5")).toBeVisible();
  await expect(ben.getByText("Everyone said 5")).toBeVisible();

  // record the consensus and advance to the queued story
  await ana.getByRole("button", { name: /Next story/ }).click();
  await expect(ana.getByText("✓ 1 estimated")).toBeVisible();
  await expect(ben.getByText("Search API")).toBeVisible();

  await ana.context().close();
  await ben.context().close();
});

test("a participant cannot reveal or see facilitator-only controls", async ({ browser }) => {
  const [ana, ben] = await twoUsers(browser, newRoom());
  await ana.getByRole("button", { name: "+ Add stories" }).click();
  await ana.getByPlaceholder(/One per line/).fill("Solo story");
  await ana.getByRole("button", { name: "Queue them" }).click();

  await expect(ben.getByText("Solo story")).toBeVisible();
  await expect(ben.getByRole("button", { name: "Reveal cards" })).toBeHidden();
  await expect(ben.getByRole("button", { name: "+ Add stories" })).toBeHidden();
  await expect(ben.getByRole("button", { name: "End room" })).toBeHidden();

  await ana.context().close();
  await ben.context().close();
});

import { defineConfig } from "@playwright/test";

// Browser-level e2e: drives the real UI against a local wrangler dev server, so it
// catches DOM/event/visual bugs the websocket flow tests (test/flows.mjs) can't see.
export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 }, // local DO + websocket reconnects can take a beat over 5s
  fullyParallel: true,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:8787",
    viewport: { width: 1440, height: 900 },
  },
  // Default run = chromium. BROWSERS=all adds Firefox + WebKit (Safari engine) so the
  // pointer-capture drags, focus traps and reveal flows get exercised cross-engine.
  projects:
    process.env.BROWSERS === "all"
      ? [
          { name: "chromium", use: { browserName: "chromium" as const } },
          { name: "firefox", use: { browserName: "firefox" as const } },
          { name: "webkit", use: { browserName: "webkit" as const } },
        ]
      : [{ name: "chromium", use: { browserName: "chromium" as const } }],
  // With BASE_URL set (e.g. a prod smoke run against https://scrumlo.com) there is
  // no local server to boot; rooms there are ephemeral, so e2e droppings self-delete.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "pnpm build && npx wrangler dev --port 8787",
        url: "http://localhost:8787",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

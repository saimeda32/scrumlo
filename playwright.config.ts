import { defineConfig } from "@playwright/test";

// Browser-level e2e: drives the real UI against a local wrangler dev server, so it
// catches DOM/event/visual bugs the websocket flow tests (test/flows.mjs) can't see.
export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:8787",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "pnpm build && npx wrangler dev --port 8787",
    url: "http://localhost:8787",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

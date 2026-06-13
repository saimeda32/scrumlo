// Records a ~45s marketing reel of a real soak session. It boots (or reuses) the
// local worker, fires the DEMO soak — 15 agents, one fast, readable lap through every
// tool — into a fresh room, opens that room in a browser as a silent spectator and
// captures video, then transcodes to a muted MP4 (for the site) and a looping WebP
// (for the README) with ffmpeg.
//
//   pnpm soak:record                 # default: 45s, 15 agents
//   SECONDS=30 N=12 pnpm soak:record # override length / headcount
//   DEMO_SPEED=0.18 pnpm soak:record # slow the agents down a touch
//
// Nothing here touches the app: the spectator just watches what the agents do.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 8787;
const BASE = `http://localhost:${PORT}`;
const WS = `ws://localhost:${PORT}`;
// A clean, real-looking room name (it shows in the header on camera — no "localhost").
const ROOM = process.env.ROOM || `sprint-${Date.now().toString(36).slice(-3)}`;
const SECONDS = Number(process.env.SECONDS) || 46;
const N = process.env.N || "15";
const DEMO_SPEED = process.env.DEMO_SPEED || "0.085";
const RAW = path.join(ROOT, "test-results", "soak-reel"); // raw capture + palette (gitignored)
const PUBLIC = path.join(ROOT, "public"); // shipped site assets: the looping MP4 hero + poster
const DOCS = path.join(ROOT, "docs"); // the looping GIF the README embeds
// The room boards are taller than 720p, so film a roomy viewport and zoom the page
// out a touch — the whole board stays in frame instead of running off the bottom.
const VW = Number(process.env.VW) || 1440;
const VH = Number(process.env.VH) || 1024;
const ZOOM = process.env.ZOOM || "0.8";

const run = (cmd, args, opts = {}) => spawn(cmd, args, { cwd: ROOT, ...opts });
const up = async () => {
  try {
    const r = await fetch(BASE);
    return r.status < 500;
  } catch {
    return false;
  }
};
async function waitFor(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(500);
  }
  throw new Error(`timed out waiting for ${label}`);
}
const exec = (cmd, args, opts) =>
  new Promise((res, rej) =>
    run(cmd, args, { stdio: "inherit", ...opts }).on("exit", (c) => (c ? rej(new Error(`${cmd} ${args.join(" ")} exited ${c}`)) : res())),
  );

// 1) Server: reuse if it's already up, else build the bundle + start wrangler dev.
let server;
if (!(await up())) {
  console.log("· building web bundle…");
  await exec("npx", ["vite", "build"]);
  console.log("· starting wrangler dev…");
  server = run("npx", ["wrangler", "dev", "--port", String(PORT)], { stdio: "ignore" });
  await waitFor(up, 90_000, "wrangler dev");
}
console.log(`· server up at ${BASE}`);

// 2) Open a recording spectator browser.
mkdirSync(RAW, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
mkdirSync(DOCS, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  recordVideo: { dir: RAW, size: { width: VW, height: VH } },
});
const page = await ctx.newPage();
await page.goto(`${BASE}/r/${ROOM}`);
// Spectate — don't claim a seat, so all the agents own the room.
await page
  .getByRole("button", { name: /just watching/i })
  .click()
  .catch(() => {});
// Zoom the page out so tall boards fit fully in frame (SPA — set once, it sticks).
await page.evaluate((z) => (document.documentElement.style.zoom = z), ZOOM);

// 3) Fire the demo soak into the same room.
console.log(`· running demo soak (${N} agents) in room ${ROOM}…`);
const soak = run("node", ["test/soak.mjs"], {
  env: { ...process.env, HOST: WS, ROOM, DEMO: "1", N, DEMO_SPEED },
  stdio: "inherit",
});
const soakDone = new Promise((res) => soak.on("exit", res));

// 4) Record for the soak's lifetime (with a hard cap so a hung run can't film forever).
await Promise.race([soakDone, wait((SECONDS + 25) * 1000)]);
await wait(800);

// 5) Flush the video.
const video = page.video();
await ctx.close(); // finalizes the .webm
await browser.close();
try {
  soak.kill();
} catch {}
if (server)
  try {
    server.kill();
  } catch {}
const rawVideo = await video.path();
console.log(`· raw capture: ${rawVideo}`);

// 6) Transcode the same reel into each platform's format:
//    · public/soak-highlight.mp4  — looping muted hero for the site (autoplays on mobile)
//    · public/soak-poster.jpg     — first-frame poster (shown if a phone blocks autoplay)
//    · docs/soak-highlight.gif    — looping GIF the README embeds (GitHub won't autoplay mp4)
const mp4 = path.join(PUBLIC, "soak-highlight.mp4");
const poster = path.join(PUBLIC, "soak-poster.jpg");
const gif = path.join(DOCS, "soak-highlight.gif");
const palette = path.join(RAW, "palette.png");
const ff = (args) => exec("ffmpeg", ["-y", ...args]);
await ff(["-i", rawVideo, "-t", String(SECONDS), "-an", "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=1280:-2", mp4]);
await ff(["-ss", "3", "-i", mp4, "-frames:v", "1", "-q:v", "3", poster]);
// Two-pass palette GIF (loops forever, renders everywhere GitHub does, no codec needed).
const GIF_VF = "fps=12,scale=860:-1:flags=lanczos";
await ff(["-i", rawVideo, "-t", String(SECONDS), "-vf", `${GIF_VF},palettegen=stats_mode=diff`, palette]);
await ff(["-i", rawVideo, "-i", palette, "-t", String(SECONDS), "-lavfi", `${GIF_VF}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, "-loop", "0", gif]);

console.log(`\n✓ reel ready:\n  ${mp4}\n  ${poster}\n  ${gif}`);
process.exit(0);

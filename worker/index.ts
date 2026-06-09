/// <reference types="@cloudflare/workers-types" />
import { RoomDO } from "./room.do";
import { StatsDO } from "./stats.do";

export { RoomDO, StatsDO };

/** Public launch seed for the rooms-run counter (real rooms accrue on top). */
const STATS_SEED = 1346;

export interface Env {
  ROOM: DurableObjectNamespace;
  STATS: DurableObjectNamespace;
  ASSETS: Fetcher;
  ROOM_CREATE_LIMIT?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
}

function statsStub(env: Env) {
  return env.STATS.get(env.STATS.idFromName("global")) as unknown as StatsDO;
}

const ADJ = ["brave", "calm", "swift", "bright", "quiet", "keen", "bold", "warm", "clever", "lucky"];
const ANIMAL = ["otter", "lynx", "heron", "fox", "wren", "ibex", "koala", "tern", "puma", "civet"];

function makeSlug(): string {
  // Friendly but NOT enumerable: a cryptographically-random 6-char suffix (~1e9
  // combos per name) so active rooms can't be brute-forced from the URL pattern.
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // no look-alikes (0/o/1/l)
  const a = ADJ[rand[0] % ADJ.length];
  const n = ANIMAL[rand[1] % ANIMAL.length];
  let suffix = "";
  for (let i = 2; i < 8; i++) suffix += alphabet[rand[i] % alphabet.length];
  return `${a}-${n}-${suffix}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Global "rooms run" tally · a single integer, no content. Seeded for launch.
    if (url.pathname === "/api/stats" && request.method === "GET") {
      let n = 0;
      try {
        n = await statsStub(env).total();
      } catch {
        /* stats are best-effort; never block the page */
      }
      return Response.json(
        { count: STATS_SEED + n },
        { headers: { "cache-control": "public, max-age=15" } },
      );
    }

    // Mint a fresh room slug. No room state is created until someone connects.
    if (url.pathname === "/api/room" && request.method === "POST") {
      // Rate-limit room creation per IP so a public instance can't be flooded.
      if (env.ROOM_CREATE_LIMIT) {
        const ip = request.headers.get("CF-Connecting-IP") ?? "local";
        const { success } = await env.ROOM_CREATE_LIMIT.limit({ key: ip });
        if (!success) {
          return new Response("Too many rooms, please slow down.", { status: 429 });
        }
      }
      // Bump the global tally (fire-and-forget so it never slows room creation). Log
      // a failure so a stuck counter is greppable instead of silently swallowed.
      ctx.waitUntil(
        statsStub(env)
          .bump()
          .then(
            () => {},
            (e) => console.warn("stats bump failed", String(e)),
          ),
      );
      return Response.json({ room: makeSlug() });
    }

    // Upgrade a WebSocket into the room's Durable Object.
    if (url.pathname === "/ws") {
      const room = url.searchParams.get("room");
      if (!room) return new Response("missing room", { status: 400 });
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket", { status: 426 });
      }
      const stub = env.ROOM.get(env.ROOM.idFromName(room));
      return stub.fetch(request);
    }

    // Everything else: static assets (SPA fallback handled by the assets binding).
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

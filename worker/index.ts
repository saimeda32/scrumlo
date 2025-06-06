/// <reference types="@cloudflare/workers-types" />
import { RoomDO } from "./room.do";

export { RoomDO };

export interface Env {
  ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
  ROOM_CREATE_LIMIT?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
}

const ADJ = ["brave", "calm", "swift", "bright", "quiet", "keen", "bold", "warm", "clever", "lucky"];
const ANIMAL = ["otter", "lynx", "heron", "fox", "wren", "ibex", "koala", "tern", "puma", "civet"];

function makeSlug(): string {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = ANIMAL[Math.floor(Math.random() * ANIMAL.length)];
  const d = Math.floor(10 + Math.random() * 90);
  return `${a}-${n}-${d}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Mint a fresh room slug. No room state is created until someone connects.
    if (url.pathname === "/api/room" && request.method === "POST") {
      // Rate-limit room creation per IP so a public instance can't be flooded.
      if (env.ROOM_CREATE_LIMIT) {
        const ip = request.headers.get("CF-Connecting-IP") ?? "local";
        const { success } = await env.ROOM_CREATE_LIMIT.limit({ key: ip });
        if (!success) {
          return new Response("Too many rooms — please slow down.", { status: 429 });
        }
      }
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

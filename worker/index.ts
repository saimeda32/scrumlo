/// <reference types="@cloudflare/workers-types" />
import { RoomDO } from "./room.do";

export { RoomDO };

export interface Env {
  ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
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

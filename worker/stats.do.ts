/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";

/**
 * One global tally of rooms ever created. It holds a single integer — no room
 * content, no names, no PII — so it stays honest with "nothing is stored". This
 * is the only durable state in the whole app that outlives a room.
 */
export class StatsDO extends DurableObject {
  async bump(): Promise<number> {
    const n = ((await this.ctx.storage.get<number>("rooms")) ?? 0) + 1;
    await this.ctx.storage.put("rooms", n);
    return n;
  }

  async total(): Promise<number> {
    return (await this.ctx.storage.get<number>("rooms")) ?? 0;
  }
}

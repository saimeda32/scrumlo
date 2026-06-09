/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";

/**
 * One global tally of rooms ever created. It holds a single integer · no room
 * content, no names, no PII · so it stays honest with "nothing is stored". This
 * is the only durable state in the whole app that outlives a room.
 */
export class StatsDO extends DurableObject {
  async bump(): Promise<number> {
    // Atomic read-modify-write so concurrent bumps can't lose an increment, with a
    // finite guard so a corrupt value can't poison the counter into NaN forever.
    return this.ctx.storage.transaction(async (txn) => {
      const cur = await txn.get<number>("rooms");
      const base = Number.isFinite(cur) ? (cur as number) : 0;
      const n = base + 1;
      await txn.put("rooms", n);
      return n;
    });
  }

  async total(): Promise<number> {
    const cur = await this.ctx.storage.get<number>("rooms");
    return Number.isFinite(cur) ? (cur as number) : 0;
  }
}

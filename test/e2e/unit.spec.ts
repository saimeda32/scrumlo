import { test, expect } from "@playwright/test";
import { pulseVerdict } from "../../src/lib/pulseVerdict";

// Pure-function checks (no browser): every verdict band and the Divided override.
const flat = (avg: number) => Array.from({ length: 5 }, () => ({ avg }));

test("pulse verdict: every band maps to its word", () => {
  expect(pulseVerdict([])).toBeNull();
  expect(pulseVerdict(flat(4.6))!.word).toBe("Thriving");
  expect(pulseVerdict(flat(4.0))!.word).toBe("Humming");
  expect(pulseVerdict(flat(3.5))!.word).toBe("Cruising");
  expect(pulseVerdict(flat(3.0))!.word).toBe("Steady");
  expect(pulseVerdict(flat(2.5))!.word).toBe("Wobbly");
  expect(pulseVerdict(flat(2.0))!.word).toBe("Strained");
  expect(pulseVerdict(flat(1.2))!.word).toBe("Mayday");
});

test("pulse verdict: a wide best-vs-worst gap reads Divided even when the mean looks fine", () => {
  const v = pulseVerdict([{ avg: 4.8 }, { avg: 4.6 }, { avg: 4.7 }, { avg: 4.5 }, { avg: 2.8 }]);
  expect(v!.word).toBe("Divided");
});

import { reapReason } from "../../shared/lifecycle";

test("room reaping: a connected team that's just talking is not 'idle'", () => {
  const base = { now: 1_000_000_000, createdAt: 1_000_000_000 - 60 * 60 * 1000, idleMs: 30 * 60 * 1000, maxRoomMs: 12 * 60 * 60 * 1000 };
  const quietFor40min = base.now - 40 * 60 * 1000;

  // Two joined members, silent for 40 min, sockets alive → the room lives.
  expect(reapReason({ ...base, sockets: 2, members: 2, lastActivityAt: quietFor40min })).toBeNull();
  // Spectator-only ghosts idle out.
  expect(reapReason({ ...base, sockets: 1, members: 0, lastActivityAt: quietFor40min })).toBe("idle");
  // Nobody connected → empty.
  expect(reapReason({ ...base, sockets: 0, members: 0, lastActivityAt: base.now })).toBe("empty");
  // The 12h cap still wins even with members present.
  expect(
    reapReason({ ...base, createdAt: base.now - 13 * 60 * 60 * 1000, sockets: 2, members: 2, lastActivityAt: base.now }),
  ).toBe("lifetime");
});

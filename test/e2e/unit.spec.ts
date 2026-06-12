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

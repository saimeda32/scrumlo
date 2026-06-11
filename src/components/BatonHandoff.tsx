import { useEffect, useState } from "react";
import { avatarColor, initials } from "../lib/colors";

/** One of these plays per coronation. {to} = new facilitator, {from} = the abdicator. */
const BATON_LINES = [
  "Alright, we have a new leader in the room.",
  "The baton was getting heavy for {from} anyway.",
  "{to} didn't even campaign. Landslide.",
  "Heavy is the head. Hydrate, {to}.",
  "{from} has left the throne. Long live {to}.",
  "Power transfers peacefully at scrumlo dot com.",
  "{to} now owns the awkward silences.",
  "New management. Same sprint.",
  "The crown fits. Suspiciously well, {to}.",
  "{from} can finally go get coffee.",
  "Coup successful. No blood spilled, only ink.",
  "{to} is now legally required to say “let's take this offline.”",
  "All hail {to}, ruler of the dot votes.",
  "{from} passed the baton. And the responsibility. Mostly the responsibility.",
  "A wild facilitator appeared!",
  "{to} rolls for initiative… natural 20.",
  "The torch is passed. Please don't drop it, {to}.",
  "Democracy? No. {from} just pointed at {to}.",
  "{to}, your first act: pretend this was planned.",
  "Crown's on, {to}. The retro fears you now.",
  "Breaking: {to} promoted. Salary unchanged: $0.",
  "{from} steps down gracefully. Crowd goes mild.",
  "{to} now controls the timer. Absolute power.",
  "Scepter? No. Spreadsheet? Also no. Just vibes, {to}.",
  "It's {to}'s room now. We're all just stickies in it.",
  "{from} → {to}. Smoothest deploy of the day.",
  "The prophecy is fulfilled. {to} leads.",
  "{to} accepts the baton and the emotional baggage.",
  "May your reveals be unanimous, {to}.",
  "{from} taps out. {to} tags in. Wrestling rules apply.",
  "New facilitator unlocked: {to}.",
  "{to}, the spotlight is yours now. Use it wisely.",
  "Bow before {to}. Or just keep voting, whatever.",
  "The baton has chosen, wand-at-Ollivanders style.",
  "{to} is now the adult in the room. Allegedly.",
  "Plot twist: {to} runs the show now.",
  "{from} retires undefeated. {to} steps up.",
  "Captain {to} at the helm. Steady as she goes.",
  "{to} now has one job: keep it under an hour.",
  "Royalty detected. Everyone act natural.",
  "The keys to the kingdom (one WebSocket) go to {to}.",
  "{to}, with great baton comes great backlog.",
  "{from} dropped the mic. {to} picked up the baton.",
  "Regime change complete. Stickies unharmed.",
  "{to} promises shorter meetings. Crowd erupts.",
  "Make way, make way — {to} is walking here.",
  "It's a bird, it's a plane, it's {to} with a baton.",
  "{from} abdicates. {to} redecorates.",
  "Congrats {to}. Your reward is more clicking.",
  "The room pledges allegiance to {to}. The room had no choice.",
];

async function fireConfetti() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return; // respect reduced-motion
  try {
    const confetti = (await import("canvas-confetti")).default;
    // All gold — it's a coronation, not a birthday party.
    const golds = ["#FFD700", "#FFC107", "#F59E0B", "#FDE68A", "#D4AF37"];
    confetti({ particleCount: 160, spread: 80, startVelocity: 45, origin: { y: 0.45 }, colors: golds });
    setTimeout(() => confetti({ particleCount: 70, spread: 110, scalar: 0.8, origin: { y: 0.5 }, colors: golds }), 220);
  } catch {
    /* confetti is pure delight; never block on it */
  }
}

/** The coronation: crown glides from the old facilitator's circle to the new one,
 *  confetti falls, everyone knows who runs the room now. Auto-dismisses. */
export function BatonHandoff({ from, to, onDone }: { from: string; to: string; onDone: () => void }) {
  const [line] = useState(
    () => BATON_LINES[Math.floor(Math.random() * BATON_LINES.length)].replaceAll("{to}", to).replaceAll("{from}", from),
  );
  useEffect(() => {
    fireConfetti();
    const id = setTimeout(onDone, 3800);
    return () => clearTimeout(id);
    // run once per mount — parent re-renders (snapshots) must not restart the show
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      data-testid="baton-handoff"
      className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-slate-900/45 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-start gap-16">
          <span className="crown-glide absolute -top-10 left-5 text-4xl drop-shadow" aria-hidden>
            👑
          </span>
          <div className="flex flex-col items-center gap-2">
            <span
              className="grid h-20 w-20 place-items-center rounded-full text-2xl font-bold text-white shadow-xl"
              style={{ background: avatarColor(from) }}
            >
              {initials(from)}
            </span>
            <span className="text-sm font-semibold text-white/85">{from}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span
              className="grid h-20 w-20 place-items-center rounded-full text-2xl font-bold text-white shadow-xl ring-4 ring-amber-300/90"
              style={{ background: avatarColor(to) }}
            >
              {initials(to)}
            </span>
            <span className="text-sm font-semibold text-white/85">{to}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <p className="animate-pop text-xl font-extrabold tracking-tight text-white drop-shadow-lg" style={{ animationDelay: "1.6s" }}>
            {line}
          </p>
          <p className="animate-pop text-sm font-semibold text-white/80" style={{ animationDelay: "2s" }}>
            {to} has the baton 👑
          </p>
        </div>
      </div>
    </div>
  );
}

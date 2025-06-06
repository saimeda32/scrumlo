import { useState } from "react";
import { useLocation } from "wouter";
import { StatusTicker } from "../components/StatusTicker";
import { FLAVOR } from "../lib/flavor";

export default function Landing() {
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");

  async function createRoom() {
    setBusy(true);
    try {
      const res = await fetch("/api/room", { method: "POST" });
      const data = (await res.json()) as { room: string };
      navigate(`/r/${data.room}`);
    } finally {
      setBusy(false);
    }
  }

  function joinRoom() {
    const slug = code.trim().toLowerCase().replace(/\s+/g, "-");
    if (slug) navigate(`/r/${slug}`);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* hero */}
        <div className="text-center">
          <div className="mx-auto mb-5 flex items-center justify-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500" />
            <span className="text-lg font-bold tracking-tight">Ephem</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Estimate. Retro. <span className="text-indigo-600">Forgotten.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600">
            Planning poker, retrospectives, and a name-picker in one no-login link. The room deletes
            itself when everyone leaves — no account, no database, nothing kept.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={createRoom}
              disabled={busy}
              aria-busy={busy}
              className="w-full max-w-xs rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {busy ? <StatusTicker phrases={FLAVOR.creating} /> : "Create a room"}
            </button>

            <div className="flex w-full max-w-xs items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                placeholder="have a link? enter the room code"
                aria-label="Room code to join"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              <button
                onClick={joinRoom}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Join
              </button>
            </div>
          </div>

          <p className="mt-5 text-xs text-slate-500">
            No accounts · No database · Open source (AGPL-3.0)
          </p>
        </div>

        {/* product preview — show, don't just tell */}
        <div className="mx-auto mt-14 max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span>blind reveal</span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600">↔ spread 3–13</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { v: "3", c: "#34b27b", n: "Priya" },
              { v: "5", c: "#f0a23b", n: "Sai" },
              { v: "8", c: "#f0a23b", n: "Dana" },
              { v: "13", c: "#e8615f", n: "Jo" },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div
                  className="mx-auto mb-1 flex h-12 w-9 items-center justify-center rounded-md text-sm font-extrabold text-white"
                  style={{ background: s.c }}
                >
                  {s.v}
                </div>
                <div className="truncate text-[10px] text-slate-500">{s.n}</div>
              </div>
            ))}
          </div>
        </div>

        {/* what it does */}
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            { i: "⟳", t: "Estimate", d: "Blind-reveal planning poker, 6 decks, instant consensus." },
            { i: "✎", t: "Retro", d: "10 formats, anonymous cards, dot-voting." },
            { i: "🎲", t: "Pick", d: "Random person, order, or topic. Who goes first?" },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-lg" aria-hidden>
                {x.i}
              </div>
              <div className="mt-1 font-semibold">{x.t}</div>
              <p className="mt-1 text-sm text-slate-600">{x.d}</p>
            </div>
          ))}
        </div>

        {/* the wedge */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-lg font-semibold">
            Other tools keep your boards. Ephem keeps <span className="text-indigo-600">nothing</span>{" "}
            — on purpose.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            There's no database to leak and no account to manage. Each room is one little server that
            holds your votes and cards only while you're there, then deletes itself. It's
            open-source, so you can read exactly how — it's not a promise in a privacy policy, it's
            the architecture.
          </p>
        </div>

        {/* honest footer / SEO surface */}
        <footer className="mt-12 text-center text-xs leading-relaxed text-slate-400">
          <p>
            Free, open-source planning poker and sprint retrospectives with no login and no
            database — anonymous, ephemeral, self-hostable. The room is deleted when everyone leaves.
          </p>
          <p className="mt-2">Estimate. Retro. Forgotten.</p>
        </footer>
      </div>
    </main>
  );
}

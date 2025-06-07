import { useState } from "react";
import { useLocation } from "wouter";
import { StatusTicker } from "../components/StatusTicker";
import { FLAVOR } from "../lib/flavor";
import { IconEstimate, IconRetro, IconPick } from "../components/icons";

// Mock reveal for the hero. Deck index positions (fib): 3→0.43, 5→0.57, 8→0.71, 13→0.86.
// avg = (3+5+8+13)/4 = 7.25 — computed below, never hardcoded.
const SEATS = [
  { v: 3, n: "Priya", pos: 0.43, kind: "low" as const },
  { v: 5, n: "Sai", pos: 0.57, kind: "mid" as const },
  { v: 8, n: "Dana", pos: 0.71, kind: "mid" as const },
  { v: 13, n: "Jo", pos: 0.86, kind: "high" as const },
];
const AVG = (SEATS.reduce((s, x) => s + x.v, 0) / SEATS.length).toFixed(2).replace(/\.?0+$/, "");

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
    <main className="min-h-screen bg-gradient-to-b from-indigo-50/60 via-slate-50 to-slate-50 text-slate-900">
      {/* nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500" />
          <span className="font-bold tracking-tight">Ephem</span>
        </div>
        <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500">
          Open source · AGPL-3.0
        </span>
      </nav>

      {/* hero */}
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-6 pb-8 pt-8 lg:grid-cols-2 lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
            No login · Nothing stored · Deleted when you leave
          </span>
          <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Estimate. Retro.
            <br />
            <span className="text-indigo-600">Forgotten.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-slate-600">
            Every planning-poker tool flips the cards and goes quiet. Ephem turns the spread into a
            conversation — the outliers say what they're pricing, then you re-vote. Plus retro and a
            name-picker, all in one no-login link that deletes itself when everyone leaves.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={createRoom}
              disabled={busy}
              aria-busy={busy}
              className="rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {busy ? <StatusTicker phrases={FLAVOR.creating} /> : "Create a room →"}
            </button>
            <div className="flex items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                placeholder="or enter a room code"
                aria-label="Room code to join"
                className="w-40 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              <button
                onClick={joinRoom}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        {/* product window */}
        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-indigo-200/40 to-violet-200/30 blur-2xl" />
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-indigo-900/10">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                Copy invite link
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                ● live
              </span>
              <span className="ml-auto text-[10px] font-medium text-slate-400">cards revealed</span>
            </div>
            <div className="p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Add CSV export to billing</span>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                  ↔ spread 3–13
                </span>
              </div>

              {/* the tension line */}
              <div className="relative mx-1 my-7 h-1 rounded-full bg-slate-100">
                <div
                  className="absolute top-0 h-1 rounded-full bg-gradient-to-r from-sky-400 to-rose-400"
                  style={{ left: "43%", width: "43%" }}
                />
                {SEATS.map((s) => (
                  <div
                    key={s.n}
                    className="absolute -top-1 -translate-x-1/2"
                    style={{ left: `${s.pos * 100}%` }}
                  >
                    <div
                      className={`h-3 w-3 rounded-full border-2 border-white ${
                        s.kind === "low"
                          ? "scale-110 bg-sky-500"
                          : s.kind === "high"
                            ? "scale-110 bg-rose-500"
                            : "bg-slate-300"
                      }`}
                    />
                  </div>
                ))}
                <span className="absolute -bottom-6 -translate-x-1/2 text-sm font-extrabold text-sky-600" style={{ left: "43%" }}>
                  3
                </span>
                <span className="absolute -bottom-6 -translate-x-1/2 text-sm font-extrabold text-rose-600" style={{ left: "86%" }}>
                  13
                </span>
              </div>

              <p className="mt-7 text-center text-[11px] leading-relaxed text-slate-600">
                <b className="text-sky-600">Priya</b> is pricing “just the endpoint” ·{" "}
                <b className="text-rose-600">Jo</b> is pricing “pagination + permissions”
              </p>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                <span>
                  avg <b className="text-slate-700">{AVG}</b> · two camps
                </span>
                <span className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white">
                  ↻ Re-estimate
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* three activities band */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              Icon: IconEstimate,
              t: "Estimate",
              d: "Blind-reveal poker that doesn’t go quiet — the spread becomes a conversation, then you re-vote.",
            },
            { Icon: IconRetro, t: "Retro", d: "10 real formats. Anonymous cards, dot-voting." },
            { Icon: IconPick, t: "Pick", d: "Random person, order, or topic. Who goes first?" },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 font-semibold">{t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-sm text-slate-500">
          All three in one room — the facilitator switches live and everyone follows.
        </p>
      </section>

      {/* the wedge — contrasting dark band */}
      <section className="bg-slate-900 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Other tools keep your boards. Ephem keeps{" "}
            <span className="text-indigo-400">nothing</span> — on purpose.
          </h2>
          <p className="mt-4 text-slate-300">
            No database to leak, no account to manage. Each room is one little server that holds your
            votes and cards only while you're there, then deletes itself. It's open-source, so you
            can read exactly how — it's not a promise in a privacy policy, it's the architecture.
          </p>
          <button
            onClick={createRoom}
            className="mt-7 rounded-xl bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Start a room →
          </button>
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-6 py-10 text-center text-xs leading-relaxed text-slate-500">
        Free, open-source planning poker and sprint retrospectives — no login, no database,
        anonymous, ephemeral, self-hostable. Estimate. Retro. Forgotten.
      </footer>
    </main>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { StatusTicker } from "../components/StatusTicker";
import { FLAVOR } from "../lib/flavor";
import { IconEstimate, IconRetro, IconPick } from "../components/icons";

const SEATS = [
  { v: "3", c: "#34b27b", n: "Priya" },
  { v: "5", c: "#f0a23b", n: "Sai" },
  { v: "8", c: "#f0a23b", n: "Dana" },
  { v: "13", c: "#e8615f", n: "Jo" },
];

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
            Planning poker, retrospectives, and a name-picker — three sprint ceremonies in one
            no-login link. The room deletes itself when everyone leaves.
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
              <div className="ml-auto flex -space-x-1.5">
                {SEATS.map((s) => (
                  <span
                    key={s.n}
                    className="h-5 w-5 rounded-full border-2 border-white text-[9px] font-bold leading-[16px] text-white"
                    style={{ background: s.c, textAlign: "center" }}
                  >
                    {s.n[0]}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Reset password via email</span>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                  ↔ spread 3–13
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {SEATS.map((s) => (
                  <div key={s.n} className="text-center">
                    <div
                      className="mx-auto mb-1 flex h-14 w-10 items-center justify-center rounded-md text-base font-extrabold text-white"
                      style={{ background: s.c }}
                    >
                      {s.v}
                    </div>
                    <div className="truncate text-[10px] text-slate-500">{s.n}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                avg <b className="text-slate-700">8.0</b> · not in sync — talk to the 3 and the 13
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
              d: "Blind-reveal planning poker. 6 decks, instant color-coded consensus.",
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

      <footer className="mx-auto max-w-3xl px-6 py-10 text-center text-xs leading-relaxed text-slate-400">
        Free, open-source planning poker and sprint retrospectives — no login, no database,
        anonymous, ephemeral, self-hostable. Estimate. Retro. Forgotten.
      </footer>
    </main>
  );
}

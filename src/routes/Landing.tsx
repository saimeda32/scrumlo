import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { StatusTicker } from "../components/StatusTicker";
import { FLAVOR } from "../lib/flavor";
import { IconEstimate, IconRetro, IconPick, IconBoard, IconPulse, IconPoll } from "../components/icons";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { DemoTheater } from "../components/DemoTheater";

// A live, count-up tally of rooms ever run (one global integer on the edge · no DB).
function RoomsCounter() {
  const [target, setTarget] = useState<number | null>(null);
  const [val, setVal] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json() as Promise<{ count: number }>)
        .then((d) => alive && setTarget(d.count))
        .catch(() => {});
    load();
    const id = setInterval(load, 15000); // gently live
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (target === null) return;
    const start = Math.max(0, target - 60);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1100);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (target === null) return null;
  return (
    <div className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-bold tabular-nums text-slate-900 dark:text-white">
        {val.toLocaleString()}
      </span>
      sprint rooms run, then forgotten.
    </div>
  );
}

export default function Landing() {
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  async function createRoom() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/room", { method: "POST" });
      if (!res.ok) {
        setErr(res.status === 429 ? "Whoa, slow down · too many rooms. Try again in a moment." : "Couldn't create a room. Try again.");
        return;
      }
      const data = (await res.json().catch(() => null)) as { room?: string } | null;
      if (!data?.room) {
        setErr("Couldn't create a room. Try again.");
        return;
      }
      navigate(`/r/${data.room}`);
    } catch {
      setErr("Network hiccup · couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function joinRoom() {
    const slug = code.trim().toLowerCase().replace(/\s+/g, "-");
    if (slug) navigate(`/r/${slug}`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-iris-50/60 via-slate-50 to-slate-50 text-slate-900 dark:from-[#11101c] dark:via-[#0a0a0f] dark:to-[#0a0a0f] dark:text-slate-100">
      {/* nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            Open source · AGPL-3.0
          </span>
          <ThemeToggle />
        </div>
      </nav>

      {/* hero */}
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-6 pb-8 pt-8 lg:grid-cols-2 lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-iris-100 px-3 py-1 text-xs font-semibold text-iris-700">
            No login · No AI · Nothing stored · Deleted when you leave
          </span>
          <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Estimate. Retro.
            <br />
            <span className="text-iris-600">Forgotten.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-slate-600 dark:text-slate-300">
            Most tools flip the cards and go quiet. Scrumlo turns that silence into a real conversation,
            then a number everyone owns. A retro, a roadmap board, and a name-picker ride the same link.
            When the last person leaves, the room forgets it ever happened.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={createRoom}
              disabled={busy}
              aria-busy={busy}
              className="rounded-xl bg-iris-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-iris-600/20 transition hover:bg-iris-500 focus-visible:ring-2 focus-visible:ring-iris-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {busy ? <StatusTicker phrases={FLAVOR.creating} /> : "Create a room →"}
            </button>
            <div className="flex items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                placeholder="enter room code"
                aria-label="Room code to join"
                className="w-44 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus-visible:border-iris-500 focus-visible:ring-2 focus-visible:ring-iris-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <button
                onClick={joinRoom}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-iris-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Join
              </button>
            </div>
          </div>

          {err && (
            <p role="alert" className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">
              {err}
            </p>
          )}

          <RoomsCounter />
        </div>

        {/* live demo theater · a looping mini-session */}
        <DemoTheater />
      </section>

      {/* activities band */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              Icon: IconEstimate,
              t: "Estimate",
              d: "Blind-reveal estimation that refuses to go quiet. Custom decks, a story backlog (paste CSV/Jira), and a quick nudge toward the outliers when the room splits.",
            },
            {
              Icon: IconRetro,
              t: "Retro",
              d: "A free Miro-style canvas with facilitated phases: blind brainstorm → group → vote → discuss. Tag stickies, gather them into named themes, dot-vote, capture action items — and take the lead to walk everyone through the wall together.",
            },
            {
              Icon: IconBoard,
              t: "Plan",
              d: "One planning space, four canvases: a Now / Next / Later roadmap, a mind map, a flowchart and an impact/effort matrix. Drag curved connectors between stickies, dot-vote, export. Ephemeral planning, no database.",
            },
            {
              Icon: IconPulse,
              t: "Pulse",
              d: "A team health check: rate morale, clarity, delivery… 1–5, blind, then reveal an aggregate radar. Just votes · nothing kept.",
            },
            {
              Icon: IconPoll,
              t: "Poll & Q&A",
              d: "Ask the room a question: collect answers and upvote the best, or drop one word each into a live word cloud. No accounts, no dashboard to log into.",
            },
            { Icon: IconPick, t: "Pick", d: "Who goes first? Spin for a name, shuffle an order, or pick from a list. No favorites." },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-iris-50 text-iris-600 dark:bg-iris-500/15 dark:text-iris-300">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 font-semibold">{t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          All six in one room · the facilitator switches live and everyone follows.
        </p>
      </section>

      {/* how it works · quick guide */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Up and running in four steps</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            No account, no setup, no install · one link runs the whole ceremony.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "1", t: "Start a room", d: "Hit Create a room · you get a private link like scrumlo.com/r/brave-otter. Nothing to configure." },
            { n: "2", t: "Share the link", d: "Drop it in Slack. Teammates open it and land instantly, then type a name to grab a seat. No sign-up." },
            { n: "3", t: "Run the ceremony", d: "The facilitator switches between Estimate, Retro, and Pick and runs the shared timer. Everyone follows live." },
            { n: "4", t: "Export, then poof", d: "Grab a Markdown or full-board PNG/PDF with your action items. When the last person leaves, the room deletes itself." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-iris-600 text-sm font-bold text-white shadow-sm shadow-iris-600/30">
                {s.n}
              </div>
              <div className="mt-3 font-semibold">{s.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-6 dark:border-white/10 dark:bg-white/5 sm:grid-cols-3">
          {[
            { t: "Estimate", d: "Pick a card (or press a number); R reveals. Votes stay blind until everyone's in. Build a custom deck, queue a backlog (paste CSV/Jira), step through it, export the results." },
            { t: "Retro & boards", d: "Step the room through brainstorm → group → vote → discuss (notes stay hidden until the reveal). Drag to cluster, dot-vote themes, flag action items with owners · or switch to the Now/Next/Later roadmap board. Export to Markdown or a full-board PNG." },
            { t: "Pick", d: "Spin for a random person, shuffle an order, or pick from a comma-separated list · confetti, no repeats." },
          ].map((s) => (
            <div key={s.t}>
              <div className="text-sm font-bold text-iris-600 dark:text-iris-300">{s.t}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* the wedge · contrasting dark band */}
      <section className="bg-slate-900 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Other tools keep your boards. Scrumlo keeps{" "}
            <span className="text-iris-400">nothing</span>.
          </h2>
          <p className="mt-4 text-slate-300">
            No database to leak, no account to manage. Each room is one little server that holds your
            votes and cards only while you're there, then deletes itself. It's open-source, so you
            can read exactly how · it's not a promise in a privacy policy, it's the architecture.
          </p>
          <button
            onClick={createRoom}
            className="mt-7 rounded-xl bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Start a room →
          </button>
        </div>
      </section>

      {/* FAQ · accordion cards — both humans and answer engines lift from this */}
      <section className="mx-auto max-w-3xl px-6 py-14">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">You're probably wondering…</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The short, honest answers.</p>
        </div>
        <div className="space-y-3">
          {[
            {
              q: "Is Scrumlo free?",
              a: "Yes — completely free. No paid tier, no seat limits, no trial clock counting down on you. It's open-source too.",
              open: true,
            },
            {
              q: "Do I need an account?",
              a: "No. Start a room, share the link, and teammates just type a display name to join. Spectators can watch without joining at all.",
            },
            {
              q: "Where is my data stored?",
              a: "Only in memory, in a single ephemeral room server, and only while the room is live. There is no database — when everyone leaves, the room deletes itself. Export to Markdown, PNG or PDF before you go if you want to keep the results.",
            },
            {
              q: "Does AI read our retro?",
              a: "No. Nothing does. What your team writes here is never summarized, sorted, scored or \u201cenhanced\u201d by a model \u2014 not ours, not anyone's. It isn't stored either. The room forgets; so does everything else. That's a feature, and it's permanent.",
            },
            {
              q: "What can I run in a room?",
              a: "Sprint estimation (planning poker) with blind reveal and custom decks, retrospectives in 17 formats including mind map, flowchart and impact/effort matrix canvases, sticky connectors for dependencies, your own sticky colors, a Now/Next/Later roadmap board, polls and live word clouds with hide-until-reveal, anonymous team health checks, a random picker wheel, and a shared timer — all behind one link.",
            },
            {
              q: "How many people can join?",
              a: "A whole scrum team and then some — rooms are tested with 20+ simultaneous participants voting and revealing together.",
            },
            {
              q: "Can votes be influenced by what others picked?",
              a: "No — estimation votes, retro brainstorms, polls and health checks are all blind by default: the server withholds everyone's answers until the reveal, so nobody anchors anybody.",
            },
          ].map((f) => (
            <details
              key={f.q}
              open={f.open}
              className="group rounded-2xl border border-slate-200 bg-white shadow-soft transition open:shadow-md dark:border-white/10 dark:bg-[#14141b]"
            >
              <summary className="flex cursor-pointer select-none items-center gap-3 px-5 py-4 font-semibold text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden dark:text-slate-100">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-iris-50 text-sm font-bold text-iris-600 dark:bg-iris-500/15 dark:text-iris-300">
                  ?
                </span>
                <span className="min-w-0 flex-1">{f.q}</span>
                <svg
                  className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <p className="px-5 pb-4 pl-[3.75rem] text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-6 py-10 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-500">
        <nav className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-medium">
          <a href="https://github.com/saimeda32/scrumlo" target="_blank" rel="noopener noreferrer" className="hover:text-iris-600">GitHub</a>
        </nav>
        Free, open-source sprint estimation and retrospectives · no login, no database,
        anonymous, ephemeral. Estimate. Retro. Forgotten.
      </footer>
    </main>
  );
}

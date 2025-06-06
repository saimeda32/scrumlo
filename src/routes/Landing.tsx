import { useState } from "react";
import { useLocation } from "wouter";
import { StatusTicker } from "../components/StatusTicker";
import { FLAVOR } from "../lib/flavor";

export default function Landing() {
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500" />
        <h1 className="text-3xl font-bold tracking-tight">Ephem</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Estimate. Retro. Forgotten. One link, no login — deleted when everyone
          leaves.
        </p>
        <button
          onClick={createRoom}
          disabled={busy}
          className="mt-8 w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? <StatusTicker phrases={FLAVOR.creating} /> : "Create a room"}
        </button>
        <p className="mt-4 text-xs text-slate-400">
          No account. No database. Nothing kept after the room ends.
        </p>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { PickView, PickMode, Member } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";

export function PickerBoard({
  pick,
  members,
  isFacil,
  client,
}: {
  pick: PickView;
  members: Member[];
  isFacil: boolean;
  client: RoomClient;
}) {
  const [item, setItem] = useState("");
  const [flicker, setFlicker] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const lastNonce = useRef(pick.nonce);

  const candidates = pick.mode === "list" ? pick.items : members.map((m) => m.name);

  // Re-run the slot-machine flicker whenever the server bumps the spin nonce.
  useEffect(() => {
    if (pick.nonce === lastNonce.current) return;
    lastNonce.current = pick.nonce;
    if (pick.result.length === 0) {
      setSpinning(false);
      setFlicker(null);
      return;
    }
    const pool = candidates.length ? candidates : pick.result;
    setSpinning(true);
    let n = 0;
    const id = setInterval(() => {
      setFlicker(pool[Math.floor(Math.random() * pool.length)] ?? "");
      if (++n > 12) {
        clearInterval(id);
        setSpinning(false);
        setFlicker(null);
      }
    }, 70);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick.nonce]);

  const modeBtn = (m: PickMode, label: string) => (
    <button
      key={m}
      onClick={() => isFacil && client.pickSetMode(m)}
      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
        pick.mode === m
          ? "bg-indigo-100 text-indigo-700"
          : isFacil
            ? "text-slate-400 hover:bg-slate-100"
            : "text-slate-300"
      }`}
    >
      {label}
    </button>
  );

  const spinLabel =
    pick.mode === "person" ? "Pick someone" : pick.mode === "order" ? "Shuffle order" : "Pick one";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {modeBtn("person", "🙋 Person")}
          {modeBtn("order", "🔀 Order")}
          {modeBtn("list", "📋 List")}
        </div>
        {isFacil && (
          <div className="ml-auto flex gap-2">
            {pick.result.length > 0 && (
              <button
                onClick={() => client.pickClear()}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => client.pickSpin()}
              disabled={spinning}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              🎲 {spinLabel}
            </button>
          </div>
        )}
      </div>

      {pick.mode === "list" && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {isFacil && (
            <input
              value={item}
              onChange={(e) => setItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && item.trim()) {
                  client.pickAddItem(item.trim());
                  setItem("");
                }
              }}
              placeholder="Add an option / topic, press Enter"
              aria-label="Add a pick option"
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {pick.items.map((it, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
              >
                {it}
                {isFacil && (
                  <button
                    onClick={() => client.pickRemoveItem(i)}
                    aria-label={`Remove ${it}`}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
            {pick.items.length === 0 && <span className="text-sm text-slate-400">No options yet.</span>}
          </div>
        </div>
      )}

      <div className="grid min-h-[180px] place-items-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {spinning ? (
          <div className="text-3xl font-extrabold text-slate-300">{flicker ?? "…"}</div>
        ) : pick.result.length === 0 ? (
          <div className="text-center text-slate-400">
            <div className="text-4xl" aria-hidden>
              🎲
            </div>
            <div className="mt-2 text-sm">
              {isFacil ? `Hit "${spinLabel}" to pick` : "Waiting for the facilitator to spin…"}
            </div>
          </div>
        ) : pick.mode === "order" ? (
          <ol className="space-y-1 text-lg font-semibold text-slate-800">
            {pick.result.map((r, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-sm text-indigo-700">
                  {i + 1}
                </span>
                {r}
              </li>
            ))}
          </ol>
        ) : (
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              {pick.mode === "person" ? "It’s" : "Picked"}
            </div>
            <div className="mt-1 text-4xl font-extrabold text-indigo-600">{pick.result[0]}</div>
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-slate-400">
        A fair random picker for “who goes first?” — fast, and forgotten when the room ends.
      </p>
    </div>
  );
}

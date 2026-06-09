import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PickView, PickMode, Member } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { IconPerson, IconOrder, IconList, IconPick } from "./icons";
import { Wheel } from "./Wheel";

async function fireConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 140, spread: 75, startVelocity: 42, origin: { y: 0.42 } });
    setTimeout(() => confetti({ particleCount: 60, spread: 100, scalar: 0.8, origin: { y: 0.5 } }), 180);
  } catch {
    /* confetti is pure delight; never block on it */
  }
}

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
  const [spinning, setSpinning] = useState(false);
  const lastNonce = useRef(pick.nonce);

  const candidates = pick.mode === "list" ? pick.items : members.map((m) => m.name);
  const wheelMode = pick.mode === "person" || pick.mode === "list";

  // When the server bumps the spin nonce, start the wheel (person/list); the Wheel
  // calls onSettle when it lands. Order mode reveals its list instantly.
  useEffect(() => {
    if (pick.nonce === lastNonce.current) return;
    lastNonce.current = pick.nonce;
    const willSpin = wheelMode && pick.result.length > 0;
    setSpinning(willSpin);
    // Safety net: never let the Spin button stay disabled if the wheel's settle
    // never fires (e.g. transition interrupted). Auto-release after the spin window.
    if (willSpin) {
      const t = setTimeout(() => setSpinning(false), 4500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick.nonce]);

  const modeBtn = (m: PickMode, icon: ReactNode, label: string) => (
    <button
      key={m}
      onClick={() => isFacil && client.pickSetMode(m)}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
        pick.mode === m
          ? "bg-iris-100 text-iris-700 dark:bg-iris-500/20 dark:text-iris-300"
          : isFacil
            ? "text-slate-400 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
            : "text-slate-300 dark:text-slate-600"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const spinLabel =
    pick.mode === "person" ? "Pick someone" : pick.mode === "order" ? "Shuffle order" : "Pick one";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {modeBtn("person", <IconPerson className="h-3.5 w-3.5" />, "Person")}
          {modeBtn("order", <IconOrder className="h-3.5 w-3.5" />, "Order")}
          {modeBtn("list", <IconList className="h-3.5 w-3.5" />, "List")}
        </div>
        {isFacil && (
          <div className="ml-auto flex gap-2">
            {pick.result.length > 0 && (
              <button
                onClick={() => client.pickClear()}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => client.pickSpin()}
              disabled={spinning}
              className="inline-flex items-center gap-1.5 rounded-xl bg-iris-600 px-5 py-2 text-sm font-semibold text-white hover:bg-iris-500 disabled:opacity-50"
            >
              <IconPick className="h-4 w-4" />
              {spinLabel}
            </button>
          </div>
        )}
      </div>

      {pick.mode === "list" && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
          {isFacil && (
            <input
              value={item}
              onChange={(e) => setItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && item.trim()) {
                  // accept a whole comma- (or newline-) separated list at once
                  for (const part of item.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)) {
                    client.pickAddItem(part);
                  }
                  setItem("");
                }
              }}
              placeholder="Add options · paste a comma-separated list, press Enter"
              aria-label="Add pick options (comma-separated)"
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-iris-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {pick.items.map((it, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 dark:bg-white/10 dark:text-slate-200"
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
            {pick.items.length === 0 && <span className="text-sm text-slate-400 dark:text-slate-500">No options yet.</span>}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
        {pick.mode === "order" ? (
          <div className="grid min-h-[160px] place-items-center">
            {pick.result.length === 0 ? (
              <div className="text-center text-sm text-slate-400 dark:text-slate-500">
                <IconPick className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
                <div className="mt-2">
                  {isFacil ? `Hit "${spinLabel}"` : "Waiting for the facilitator to spin…"}
                </div>
              </div>
            ) : (
              <ol className="space-y-1.5 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {pick.result.map((r, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-iris-100 text-sm text-iris-700 dark:bg-iris-500/20 dark:text-iris-300">
                      {i + 1}
                    </span>
                    {r}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : candidates.length === 0 ? (
          <div className="grid min-h-[160px] place-items-center text-sm text-slate-400 dark:text-slate-500">
            {pick.mode === "list" ? "Add a few options to spin." : "No one’s here to pick yet."}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Wheel
              candidates={candidates}
              winner={pick.result[0] ?? null}
              nonce={pick.nonce}
              spinning={spinning}
              onSettle={() => {
                setSpinning(false);
                fireConfetti();
              }}
            />
            <div className="mt-3 flex h-12 flex-col justify-center text-center">
              {!spinning && pick.result[0] ? (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {pick.mode === "person" ? "It’s" : "Picked"}
                  </div>
                  <div className="text-3xl font-extrabold text-iris-600 dark:text-iris-400">
                    {pick.result[0]}
                  </div>
                </>
              ) : !spinning ? (
                <div className="text-sm text-slate-400 dark:text-slate-500">
                  {isFacil ? `Hit "${spinLabel}"` : "Waiting for the facilitator to spin…"}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {wheelMode && pick.recent.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3 text-center dark:border-white/10">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Picked so far · no repeats until everyone’s had a turn
            </div>
            <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
              {pick.recent.map((r, i) => (
                <span
                  key={i}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-white/10 dark:text-slate-400"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-slate-400 dark:text-slate-500">
        A fair shake for “who goes first?” Spin it, and it’s forgotten when the room ends.
      </p>
    </div>
  );
}

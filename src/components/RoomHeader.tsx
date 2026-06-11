import { useState } from "react";
import type { Member } from "../../shared/protocol";
import { avatarColor, initials } from "../lib/colors";
import { IconCrown } from "./icons";
import { TimerChip } from "./TimerChip";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function RoomHeader({
  room,
  connected,
  members,
  facilitator,
  you,
  timerEndsAt,
  onClaim,
  onHandBaton,
  onExport,
  onTimerStart,
  onTimerStop,
  onEnd,
  onReport,
}: {
  room: string;
  connected: boolean;
  members: Member[];
  facilitator: string | null;
  you: string | null;
  timerEndsAt: number | null;
  onClaim: () => void;
  onHandBaton: (toId: string) => void;
  onExport: () => void;
  onTimerStart: (seconds: number) => void;
  onTimerStop: () => void;
  onEnd: () => void;
  onReport: () => void;
}) {
  const facil = members.find((m) => m.id === facilitator);
  const isFacil = !!you && you === facilitator;
  const [copied, setCopied] = useState(false);
  const [batonOpen, setBatonOpen] = useState(false);
  const others = members.filter((m) => m.id !== you);

  function copyLink() {
    navigator.clipboard
      .writeText(`${location.origin}/r/${room}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2.5 shadow-soft backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
      <a href="/" title="Scrumlo · new room" className="flex shrink-0 items-center gap-2">
        <LogoMark size={22} />
        <span className="hidden text-[12px] font-light uppercase tracking-[0.32em] text-slate-900 dark:text-white sm:inline">
          Scrumlo
        </span>
      </a>
      <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{room}</span>
      <button
        onClick={copyLink}
        className="rounded-lg border border-iris-200 bg-iris-50 px-3 py-1.5 text-xs font-semibold text-iris-700 transition hover:bg-iris-100 focus-visible:ring-2 focus-visible:ring-iris-500"
        title="Copy the invite link to share this room"
      >
        {copied ? "Link copied ✓" : "Copy invite link"}
      </button>
      <span
        data-testid="conn"
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
        }`}
      >
        {connected ? "● live" : "connecting…"}
      </span>
      {facil && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          facilitated by{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {facil.name}
            {isFacil && <span className="font-normal text-slate-400 dark:text-slate-500"> (you)</span>}
          </span>
        </span>
      )}
      {isFacil && others.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setBatonOpen((v) => !v)}
            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
            title="Hand the facilitator role to a teammate"
          >
            👑 Pass baton
          </button>
          {batonOpen && (
            <div className="absolute left-0 top-9 z-40 flex w-44 flex-col rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#14141b]">
              {others.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onHandBaton(m.id);
                    setBatonOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: avatarColor(m.name) }}>
                    {initials(m.name)}
                  </span>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <TimerChip
          endsAt={timerEndsAt}
          isFacil={isFacil}
          onStart={onTimerStart}
          onStop={onTimerStop}
        />
        <button
          onClick={onExport}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          title="Copy/download the session before it's gone"
        >
          ⤓ Export
        </button>
        {!isFacil && !facil && (
          <button
            onClick={onClaim}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            title="No active facilitator · take over"
          >
            Take over
          </button>
        )}
        {isFacil ? (
          <button
            onClick={() => {
              if (confirm("End the room for everyone now? It will be deleted.")) onEnd();
            }}
            className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            title="End and delete the room for everyone"
          >
            End room
          </button>
        ) : (
          <button
            onClick={() => {
              if (confirm("Report this room as abusive? Two reports end it.")) onReport();
            }}
            className="text-xs font-medium text-slate-400 hover:text-rose-500"
            title="Report an abusive room"
          >
            Report
          </button>
        )}
        <div className="flex -space-x-2">
          {members.slice(0, 8).map((m) => (
            <div
              key={m.id}
              title={m.name + (m.id === facilitator ? " · facilitator" : "")}
              className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white"
              style={{ background: avatarColor(m.id) }}
            >
              {initials(m.name)}
              {m.id === facilitator && (
                <span className="absolute -right-1.5 -top-2 text-amber-500">
                  <IconCrown className="h-3 w-3" />
                </span>
              )}
            </div>
          ))}
          {members.length > 8 && (
            <div
              title={members.slice(8).map((m) => m.name).join(", ")}
              className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-400 text-xs font-bold text-white dark:border-[#14141b] dark:bg-slate-600"
            >
              +{members.length - 8}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

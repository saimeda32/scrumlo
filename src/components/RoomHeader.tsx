import { useState } from "react";
import type { Member } from "../../shared/protocol";
import { avatarColor, initials } from "../lib/colors";
import { IconCrown } from "./icons";

export function RoomHeader({
  room,
  connected,
  members,
  facilitator,
  you,
  onClaim,
  onExport,
}: {
  room: string;
  connected: boolean;
  members: Member[];
  facilitator: string | null;
  you: string | null;
  onClaim: () => void;
  onExport: () => void;
}) {
  const facil = members.find((m) => m.id === facilitator);
  const isFacil = !!you && you === facilitator;
  const [copied, setCopied] = useState(false);

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
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        onClick={copyLink}
        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
        title="Copy the invite link to share this room"
      >
        {copied ? "Link copied ✓" : "Copy invite link"}
      </button>
      <span className="font-mono text-xs text-slate-400">{room}</span>
      <span
        data-testid="conn"
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
        }`}
      >
        {connected ? "● live" : "connecting…"}
      </span>
      {facil && (
        <span className="text-xs text-slate-500">
          facilitated by{" "}
          <span className="font-semibold text-slate-700">{isFacil ? "you" : facil.name}</span>
        </span>
      )}

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={onExport}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          title="Copy/download the session before it's gone"
        >
          ⤓ Export
        </button>
        {!isFacil && (
          <button
            onClick={onClaim}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            title="Become the facilitator (e.g. if they left)"
          >
            Take over
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
        </div>
      </div>
    </div>
  );
}

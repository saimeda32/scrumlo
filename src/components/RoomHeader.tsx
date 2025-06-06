import type { Member } from "../../shared/protocol";
import { avatarColor, initials } from "../lib/colors";

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

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="font-mono text-sm text-slate-500">🔗 {room}</span>
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
                <span className="absolute -right-1 -top-2 text-[11px]" aria-hidden>
                  👑
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

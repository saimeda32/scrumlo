import type { Member } from "../../shared/protocol";
import { avatarColor, initials } from "../lib/colors";

export function RoomHeader({
  room,
  connected,
  members,
}: {
  room: string;
  connected: boolean;
  members: Member[];
}) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="font-mono text-sm text-slate-500">🔗 {room}</span>
      <span
        data-testid="conn"
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
        }`}
      >
        {connected ? "● live" : "connecting…"}
      </span>
      <div className="ml-auto flex -space-x-2">
        {members.slice(0, 8).map((m) => (
          <div
            key={m.id}
            title={m.name}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white"
            style={{ background: avatarColor(m.id) }}
          >
            {initials(m.name)}
          </div>
        ))}
      </div>
    </div>
  );
}

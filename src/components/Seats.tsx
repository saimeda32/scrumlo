import type { EstimateView, Member } from "../../shared/protocol";
import { consensusColor } from "../lib/colors";
import { IconCheck, IconWaiting } from "./icons";

export function Seats({
  members,
  estimate,
}: {
  members: Member[];
  estimate: EstimateView;
}) {
  const revealed = estimate.phase === "revealed";
  const votedSet = new Set(estimate.voted);

  return (
    <ul
      data-testid="seats"
      className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-3"
    >
      {members.map((m) => {
        const voted = votedSet.has(m.id);
        const value = estimate.votes?.[m.id];

        let face: React.ReactNode;
        let faceStyle: React.CSSProperties;
        if (revealed && value !== undefined) {
          face = value;
          faceStyle = { background: consensusColor(value), color: "#fff" };
        } else if (voted) {
          face = "";
          faceStyle = {
            background:
              "repeating-linear-gradient(135deg,#eceefe,#eceefe 6px,#e3e6ff 6px,#e3e6ff 12px)",
            border: "1px solid #d8dcff",
          };
        } else {
          face = <IconWaiting className="h-5 w-5 text-slate-400" />;
          faceStyle = { background: "#f1f5f9", border: "1px dashed #cbd5e1" };
        }

        return (
          <li
            key={m.id}
            className="relative rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm"
          >
            {!revealed && (
              <span className="absolute right-2 top-2">
                {voted ? (
                  <IconCheck className="h-4 w-4 text-emerald-500" />
                ) : (
                  <IconWaiting className="h-4 w-4 text-slate-300" />
                )}
              </span>
            )}
            <div
              className="mx-auto mb-2 flex h-16 w-12 items-center justify-center rounded-lg text-lg font-extrabold"
              style={faceStyle}
            >
              {face}
            </div>
            <div className="truncate text-sm font-semibold text-slate-800">{m.name}</div>
            <div className="text-xs text-slate-400">
              {revealed
                ? value
                  ? `voted ${value}`
                  : "didn’t vote"
                : voted
                  ? "voted"
                  : "thinking…"}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

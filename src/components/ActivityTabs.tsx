import type { ReactNode } from "react";
import type { Activity } from "../../shared/protocol";
import { IconEstimate, IconRetro, IconPick } from "./icons";

export function ActivityTabs({
  activity,
  canSwitch,
  onSwitch,
}: {
  activity: Activity;
  canSwitch: boolean;
  onSwitch: (a: Activity) => void;
}) {
  const tab = (a: Activity, label: string, icon: ReactNode) => {
    const active = activity === a;
    return (
      <button
        key={a}
        aria-pressed={active}
        onClick={() => canSwitch && onSwitch(a)}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
          active
            ? "bg-indigo-50 text-indigo-700"
            : canSwitch
              ? "text-slate-400 hover:bg-slate-100"
              : "cursor-default text-slate-300"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div className="mb-5 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {tab("estimate", "Estimate", <IconEstimate className="h-4 w-4" />)}
      {tab("retro", "Retro", <IconRetro className="h-4 w-4" />)}
      {tab("pick", "Pick", <IconPick className="h-4 w-4" />)}
    </div>
  );
}

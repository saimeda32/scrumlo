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
            ? "bg-white text-iris-700 shadow-soft dark:bg-white/10 dark:text-white"
            : canSwitch
              ? "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              : "cursor-default text-slate-300 dark:text-slate-600"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div className="mb-5 inline-flex gap-1 rounded-xl border border-slate-200/70 bg-slate-100/70 p-1 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
      {tab("estimate", "Estimate", <IconEstimate className="h-4 w-4" />)}
      {tab("retro", "Retro", <IconRetro className="h-4 w-4" />)}
      {tab("pick", "Pick", <IconPick className="h-4 w-4" />)}
    </div>
  );
}

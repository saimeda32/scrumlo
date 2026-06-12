import type { ReactNode } from "react";
import type { Activity } from "../../shared/protocol";
import { IconEstimate, IconRetro, IconPick, IconBoard, IconPulse, IconPoll } from "./icons";

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
    // Non-facilitators can't switch: mark it disabled (not a silent dead-end) and say
    // why on hover, instead of a clickable-looking button that quietly does nothing.
    const locked = !canSwitch && !active;
    return (
      <button
        key={a}
        role="tab"
        aria-selected={active}
        aria-disabled={locked || undefined}
        title={locked ? "Only the facilitator can switch activities" : undefined}
        onClick={() => canSwitch && onSwitch(a)}
        className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
          active
            ? "bg-white text-iris-700 shadow-soft dark:bg-white/10 dark:text-white"
            : canSwitch
              ? "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              : "cursor-not-allowed text-slate-300 dark:text-slate-600"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div role="tablist" aria-label="Activities" className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200/70 bg-slate-100/70 p-1 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-white/10 dark:bg-white/5">
      {tab("estimate", "Estimate", <IconEstimate className="h-4 w-4" />)}
      {tab("retro", "Retro", <IconRetro className="h-4 w-4" />)}
      {tab("board", "Plan", <IconBoard className="h-4 w-4" />)}
      {tab("pulse", "Pulse", <IconPulse className="h-4 w-4" />)}
      {tab("poll", "Poll", <IconPoll className="h-4 w-4" />)}
      {tab("pick", "Pick", <IconPick className="h-4 w-4" />)}
    </div>
  );
}

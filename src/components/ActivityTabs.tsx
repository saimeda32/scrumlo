import type { Activity } from "../../shared/protocol";

export function ActivityTabs({
  activity,
  canSwitch,
  onSwitch,
}: {
  activity: Activity;
  canSwitch: boolean;
  onSwitch: (a: Activity) => void;
}) {
  const tab = (a: Activity, label: string, icon: string) => {
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
        <span aria-hidden>{icon}</span>
        {label}
      </button>
    );
  };

  return (
    <div className="mb-5 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {tab("estimate", "Estimate", "⟳")}
      {tab("retro", "Retro", "✎")}
      {tab("pick", "Pick", "🎲")}
    </div>
  );
}
